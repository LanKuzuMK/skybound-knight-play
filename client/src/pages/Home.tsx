/**
 * Dawnveil Reverie: a luminous, handcrafted fantasy ascent. UI is airy editorial
 * framing; gameplay readability wins over ornament; motion is calm, tactile, and precise.
 */
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  Cloud,
  Info,
  Keyboard,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Screen = "menu" | "playing" | "paused" | "gameover";
type Modal = "none" | "settings" | "about";
type PlatformKind = "cloud" | "moving" | "fading" | "spring";

type Platform = {
  id: number;
  x: number;
  y: number;
  width: number;
  kind: PlatformKind;
  phase: number;
  amplitude: number;
  landed?: boolean;
  fadingAt?: number;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hue: number };

type World = {
  player: { x: number; y: number; vx: number; vy: number; squash: number; landing: number };
  platforms: Platform[];
  particles: Particle[];
  cameraY: number;
  highestY: number;
  nextPlatformId: number;
  lastHudAt: number;
  t: number;
  shake: number;
};

const ART = {
  menu: "/manus-storage/skybound-menu-sky_f3f3d42c.jpg",
  sky: "/manus-storage/skybound-game-sky_36ed0a53.jpg",
  castle: "/manus-storage/skybound-castle-horizon_d6571e75.jpg",
  knight: "/manus-storage/skybound-knight-idle_34f141e5.png",
  mark: "/manus-storage/skybound-compass-mark_04c7d693.png",
};

const WORLD_WIDTH = 1000;
const KNIGHT_W = 50;
const KNIGHT_H = 64;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function getStoredNumber(key: string) {
  try {
    return Number(window.localStorage.getItem(key) || "0") || 0;
  } catch {
    return 0;
  }
}

function isTouchFirst() {
  return typeof window !== "undefined" && (navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches);
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const keysRef = useRef({ left: false, right: false });
  const screenRef = useRef<Screen>("menu");
  const modalRef = useRef<Modal>("none");
  const mutedRef = useRef(false);
  const bestRef = useRef(0);
  const artRef = useRef<Record<string, HTMLImageElement>>({});
  const audioRef = useRef<AudioContext | null>(null);
  const ambientRef = useRef<{ gain: GainNode; oscillators: OscillatorNode[] } | null>(null);
  const melodyTimerRef = useRef<number | null>(null);
  const worldRef = useRef<World>({
    player: { x: 500, y: 95, vx: 0, vy: 0, squash: 0, landing: 0 },
    platforms: [], particles: [], cameraY: 0, highestY: 0, nextPlatformId: 1, lastHudAt: 0, t: 0, shake: 0,
  });

  const [screen, setScreen] = useState<Screen>("menu");
  const [modal, setModal] = useState<Modal>("none");
  const [muted, setMuted] = useState(() => {
    try { return window.localStorage.getItem("skybound-muted") === "true"; } catch { return false; }
  });
  const [isTouch, setIsTouch] = useState(isTouchFirst);
  const [hud, setHud] = useState({ current: 0, best: getStoredNumber("skybound-best") });
  const [recordFlash, setRecordFlash] = useState(false);

  useEffect(() => {
    mutedRef.current = muted;
    try { window.localStorage.setItem("skybound-muted", String(muted)); } catch { /* local storage is optional */ }
    if (ambientRef.current) {
      ambientRef.current.gain.gain.setTargetAtTime(muted || screenRef.current !== "playing" ? 0 : 0.025, audioRef.current?.currentTime || 0, 0.12);
    }
  }, [muted]);

  useEffect(() => {
    bestRef.current = getStoredNumber("skybound-best");
    setHud((previous) => ({ ...previous, best: bestRef.current }));
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const updateInput = () => setIsTouch(navigator.maxTouchPoints > 0 || media.matches);
    media.addEventListener("change", updateInput);
    window.addEventListener("resize", updateInput);
    return () => { media.removeEventListener("change", updateInput); window.removeEventListener("resize", updateInput); };
  }, []);

  useEffect(() => {
    Object.entries(ART).forEach(([key, src]) => {
      const image = new Image();
      image.src = src;
      artRef.current[key] = image;
    });
  }, []);

  const audioContext = useCallback(() => {
    if (!audioRef.current) {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) audioRef.current = new Ctx();
    }
    if (audioRef.current?.state === "suspended") audioRef.current.resume();
    return audioRef.current;
  }, []);

  const playTone = useCallback((frequency: number, seconds = 0.12, type: OscillatorType = "sine", volume = 0.045, endFrequency?: number) => {
    if (mutedRef.current) return;
    const context = audioContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(12, endFrequency), context.currentTime + seconds);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + seconds);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + seconds + 0.02);
  }, [audioContext]);

  const startAmbient = useCallback(() => {
    const context = audioContext();
    if (!context) return;
    if (!ambientRef.current) {
      const gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(context.destination);
      const frequencies = [110, 164.81];
      const oscillators = frequencies.map((frequency, index) => {
        const oscillator = context.createOscillator();
        oscillator.type = index ? "sine" : "triangle";
        oscillator.frequency.value = frequency;
        oscillator.detune.value = index ? 4 : -6;
        oscillator.connect(gain);
        oscillator.start();
        return oscillator;
      });
      ambientRef.current = { gain, oscillators };
    }
    ambientRef.current.gain.gain.setTargetAtTime(mutedRef.current ? 0 : 0.025, context.currentTime, 0.18);
    if (!melodyTimerRef.current) {
      let step = 0;
      const melody = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 392];
      melodyTimerRef.current = window.setInterval(() => {
        if (screenRef.current !== "playing" || mutedRef.current) return;
        playTone(melody[step % melody.length], 0.55, "sine", 0.018, melody[step % melody.length] * 1.04);
        if (step % 4 === 2) playTone(melody[(step + 2) % melody.length] * 2, 0.18, "sine", 0.009);
        step += 1;
      }, 560);
    }
  }, [audioContext, playTone]);

  const silenceAmbient = useCallback(() => {
    const context = audioRef.current;
    if (ambientRef.current && context) ambientRef.current.gain.gain.setTargetAtTime(0, context.currentTime, 0.08);
  }, []);

  const makePlatform = useCallback((world: World, previous?: Platform) => {
    const last = previous || world.platforms[world.platforms.length - 1];
    const altitude = last?.y || 0;
    const tier = altitude / 900;
    const gap = 112 + Math.min(tier * 14, 64) + randomBetween(-16, 32);
    const width = clamp(210 - tier * 11 + randomBetween(-26, 30), 94, 230);
    const horizontalRange = clamp(170 + tier * 11, 170, 340);
    const center = last ? last.x + last.width / 2 : 500;
    const direction = Math.random() < 0.5 ? -1 : 1;
    const targetCenter = clamp(center + direction * randomBetween(70, horizontalRange), width / 2 + 28, WORLD_WIDTH - width / 2 - 28);
    let kind: PlatformKind = "cloud";
    const roll = Math.random();
    if (tier > 0.9 && roll < 0.18) kind = "moving";
    if (tier > 2.0 && roll < 0.13) kind = "fading";
    if (tier > 3.5 && roll < 0.11) kind = "spring";
    world.platforms.push({
      id: world.nextPlatformId++, x: targetCenter - width / 2, y: altitude + gap, width, kind,
      phase: Math.random() * Math.PI * 2, amplitude: kind === "moving" ? randomBetween(38, 82) : 0,
    });
  }, []);

  const resetWorld = useCallback(() => {
    const world = worldRef.current;
    world.player = { x: 500, y: 104, vx: 0, vy: 800, squash: 0, landing: 0 };
    world.platforms = [{ id: 0, x: 365, y: 50, width: 270, kind: "cloud", phase: 0, amplitude: 0 }];
    world.particles = [];
    world.cameraY = 0;
    world.highestY = 104;
    world.nextPlatformId = 1;
    world.t = 0;
    world.shake = 0;
    while (world.platforms[world.platforms.length - 1].y < 1900) makePlatform(world);
    setHud({ current: 0, best: bestRef.current });
    setRecordFlash(false);
  }, [makePlatform]);

  const beginRun = useCallback(() => {
    resetWorld();
    screenRef.current = "playing";
    modalRef.current = "none";
    setModal("none");
    setScreen("playing");
    startAmbient();
    playTone(440, 0.12, "sine", 0.04, 660);
  }, [playTone, resetWorld, startAmbient]);

  const pauseRun = useCallback(() => {
    if (screenRef.current !== "playing") return;
    screenRef.current = "paused";
    setScreen("paused");
    silenceAmbient();
    playTone(293.66, 0.1, "sine", 0.035, 220);
  }, [playTone, silenceAmbient]);

  const resumeRun = useCallback(() => {
    screenRef.current = "playing";
    modalRef.current = "none";
    setModal("none");
    setScreen("playing");
    startAmbient();
    playTone(392, 0.12, "sine", 0.035, 523.25);
  }, [playTone, startAmbient]);

  const openSettings = useCallback(() => {
    if (screenRef.current === "playing") pauseRun();
    modalRef.current = "settings";
    setModal("settings");
    playTone(587.33, 0.08, "sine", 0.03);
  }, [pauseRun, playTone]);

  const closeModal = useCallback(() => {
    modalRef.current = "none";
    setModal("none");
    playTone(523.25, 0.07, "sine", 0.025);
  }, [playTone]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
      if (event.code === "KeyA" || event.code === "ArrowLeft") keysRef.current.left = true;
      if (event.code === "KeyD" || event.code === "ArrowRight") keysRef.current.right = true;
      if (event.code === "Space" && modalRef.current === "none") {
        if (screenRef.current === "playing") pauseRun();
        else if (screenRef.current === "paused") resumeRun();
      }
      if (event.code === "Escape" && screenRef.current === "playing") pauseRun();
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "KeyA" || event.code === "ArrowLeft") keysRef.current.left = false;
      if (event.code === "KeyD" || event.code === "ArrowRight") keysRef.current.right = false;
    };
    window.addEventListener("keydown", keyDown, { passive: false });
    window.addEventListener("keyup", keyUp);
    return () => { window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); };
  }, [pauseRun, resumeRun]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let width = 0;
    let height = 0;
    let previous = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const platformX = (platform: Platform, time: number) => platform.x + (platform.kind === "moving" ? Math.sin(time * 0.00115 + platform.phase) * platform.amplitude : 0);

    const puff = (world: World, x: number, y: number, count: number, hue = 42) => {
      for (let index = 0; index < count; index += 1) {
        const max = randomBetween(0.35, 0.7);
        world.particles.push({ x, y, vx: randomBetween(-120, 120), vy: randomBetween(45, 190), life: max, max, size: randomBetween(3, 8), hue });
      }
      if (world.particles.length > 100) world.particles.splice(0, world.particles.length - 100);
    };

    const update = (delta: number, now: number, viewHeight: number) => {
      const world = worldRef.current;
      world.t += delta * 1000;
      const player = world.player;
      const oldY = player.y;
      const difficulty = Math.max(0, world.highestY / 1000);
      const intent = (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0);
      const acceleration = intent ? 2380 : 1780;
      const targetVelocity = intent * 405;
      player.vx += clamp(targetVelocity - player.vx, -acceleration * delta, acceleration * delta);
      if (!intent) player.vx *= Math.pow(0.00075, delta);
      if (player.y > 1550) player.vx += Math.sin(world.t * 0.001 + player.y * 0.004) * 26 * delta;
      player.vx = clamp(player.vx, -440, 440);
      player.vy -= (1820 + Math.min(difficulty * 26, 180)) * delta;
      player.x += player.vx * delta;
      player.y += player.vy * delta;
      if (player.x < -KNIGHT_W / 2) player.x = WORLD_WIDTH + KNIGHT_W / 2;
      if (player.x > WORLD_WIDTH + KNIGHT_W / 2) player.x = -KNIGHT_W / 2;
      player.squash = Math.max(0, player.squash - delta * 4.8);
      player.landing = Math.max(0, player.landing - delta * 3.4);
      world.shake = Math.max(0, world.shake - delta * 2.5);

      if (player.vy <= 0) {
        const previousBottom = oldY - KNIGHT_H / 2;
        const nextBottom = player.y - KNIGHT_H / 2;
        for (const platform of world.platforms) {
          const opacity = platform.fadingAt ? 1 - (now - platform.fadingAt) / 720 : 1;
          if (opacity <= 0) continue;
          const x = platformX(platform, world.t);
          const overlaps = player.x + KNIGHT_W * 0.34 > x && player.x - KNIGHT_W * 0.34 < x + platform.width;
          if (overlaps && previousBottom >= platform.y && nextBottom <= platform.y) {
            player.y = platform.y + KNIGHT_H / 2;
            player.vy = platform.kind === "spring" ? 975 : 785;
            player.squash = 1;
            player.landing = 1;
            world.shake = platform.kind === "spring" ? 0.75 : 0.32;
            if (platform.kind === "fading" && !platform.fadingAt) platform.fadingAt = now;
            puff(world, player.x, platform.y + 4, platform.kind === "spring" ? 16 : 10, platform.kind === "spring" ? 47 : 37);
            playTone(platform.kind === "spring" ? 660 : 440, platform.kind === "spring" ? 0.22 : 0.1, platform.kind === "spring" ? "triangle" : "sine", 0.035, platform.kind === "spring" ? 990 : 530);
            break;
          }
        }
      }

      world.platforms = world.platforms.filter((platform) => platform.y > world.cameraY - 260 && (!platform.fadingAt || now - platform.fadingAt < 780));
      const top = world.platforms[world.platforms.length - 1]?.y || 0;
      if (top < world.cameraY + viewHeight + 1100) makePlatform(world);
      if (world.platforms[world.platforms.length - 1].y < world.cameraY + viewHeight + 880) makePlatform(world);

      world.particles = world.particles.filter((particle) => {
        particle.life -= delta;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.vy -= 320 * delta;
        return particle.life > 0;
      });
      world.highestY = Math.max(world.highestY, player.y - 60);
      const heightScore = Math.max(0, Math.floor(world.highestY / 10));
      const targetCamera = Math.max(0, player.y - viewHeight * 0.6);
      if (targetCamera > world.cameraY) world.cameraY += (targetCamera - world.cameraY) * (1 - Math.exp(-delta * 3.8));

      if (heightScore > bestRef.current) {
        const firstRecord = bestRef.current > 0 && heightScore - bestRef.current < 4;
        bestRef.current = heightScore;
        try { window.localStorage.setItem("skybound-best", String(bestRef.current)); } catch { /* persistence remains optional */ }
        if (firstRecord) {
          setRecordFlash(true);
          window.setTimeout(() => setRecordFlash(false), 1600);
          puff(world, player.x, player.y, 22, 45);
          playTone(523.25, 0.12, "sine", 0.05, 783.99);
          window.setTimeout(() => playTone(783.99, 0.24, "triangle", 0.04, 1046.5), 110);
        }
      }

      if (now - world.lastHudAt > 85) {
        world.lastHudAt = now;
        setHud({ current: heightScore, best: bestRef.current });
      }
      if (player.y < world.cameraY - 175) {
        screenRef.current = "gameover";
        setScreen("gameover");
        silenceAmbient();
        playTone(311.13, 0.36, "triangle", 0.055, 120);
      }
    };

    const cloud = (x: number, y: number, radius: number, alpha: number, color: string) => {
      context.save();
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.beginPath();
      context.arc(x - radius * 0.34, y + radius * 0.08, radius * 0.42, 0, Math.PI * 2);
      context.arc(x, y - radius * 0.1, radius * 0.56, 0, Math.PI * 2);
      context.arc(x + radius * 0.42, y + radius * 0.06, radius * 0.38, 0, Math.PI * 2);
      context.arc(x + radius * 0.1, y + radius * 0.2, radius * 0.54, 0, Math.PI * 2);
      context.closePath();
      context.fill();
      context.restore();
    };

    const drawPlatform = (platform: Platform, time: number, scale: number, cameraY: number) => {
      const x = platformX(platform, time);
      const y = height - (platform.y - cameraY) * scale;
      const px = x * scale;
      const w = platform.width * scale;
      const faded = platform.fadingAt ? clamp(1 - (performance.now() - platform.fadingAt) / 720, 0, 1) : 1;
      if (y < -90 || y > height + 100 || faded <= 0) return;
      context.save();
      context.globalAlpha = faded;
      const special = platform.kind === "spring" ? "#F2BE59" : platform.kind === "moving" ? "#8ebee0" : "#f5eee0";
      context.shadowColor = platform.kind === "spring" ? "rgba(238,177,74,.58)" : "rgba(70,111,171,.18)";
      context.shadowBlur = 18;
      context.fillStyle = special;
      context.beginPath();
      context.ellipse(px + w * 0.5, y, w * 0.52, 13 * scale, 0, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.fillStyle = "rgba(255,255,255,.78)";
      context.beginPath();
      context.ellipse(px + w * 0.5, y - 4 * scale, w * 0.47, 8 * scale, 0, Math.PI, Math.PI * 2);
      context.fill();
      context.strokeStyle = platform.kind === "spring" ? "rgba(127,78,25,.34)" : "rgba(53,91,150,.16)";
      context.lineWidth = Math.max(1, scale * 1.1);
      context.beginPath();
      context.moveTo(px + w * 0.12, y + 2 * scale);
      context.quadraticCurveTo(px + w * 0.5, y + 8 * scale, px + w * 0.88, y + 2 * scale);
      context.stroke();
      if (platform.kind === "moving") {
        context.fillStyle = "rgba(50,93,163,.66)";
        context.beginPath();
        context.arc(px + w * 0.5, y - 3 * scale, 3.5 * scale, 0, Math.PI * 2);
        context.fill();
      }
      if (platform.kind === "fading") {
        context.strokeStyle = "rgba(171,130,198,.52)";
        context.setLineDash([4 * scale, 4 * scale]);
        context.beginPath();
        context.ellipse(px + w * 0.5, y, w * 0.52, 13 * scale, 0, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);
      }
      if (platform.kind === "spring") {
        context.fillStyle = "rgba(103,68,30,.72)";
        context.font = `${Math.max(10, 16 * scale)}px serif`;
        context.textAlign = "center";
        context.fillText("✦", px + w * 0.5, y + 5 * scale);
      }
      context.restore();
    };

    const drawKnight = (player: World["player"], scale: number, cameraY: number) => {
      const x = player.x * scale;
      const y = height - (player.y - cameraY) * scale;
      const bounce = Math.sin(worldRef.current.t * 0.01) * 1.5 * scale;
      const squashX = 1 + player.squash * 0.18;
      const squashY = 1 - player.squash * 0.19;
      context.save();
      context.translate(x, y + bounce);
      context.scale(squashX, squashY);
      context.shadowColor = "rgba(30,65,124,.32)";
      context.shadowBlur = 14 * scale;
      const image = artRef.current.knight;
      if (image?.complete && image.naturalWidth > 0) {
        context.drawImage(image, -34 * scale, -42 * scale, 68 * scale, 68 * scale);
      } else {
        context.fillStyle = "#e9edf6";
        context.beginPath();
        context.arc(0, -9 * scale, 18 * scale, Math.PI, 0);
        context.lineTo(18 * scale, 16 * scale);
        context.lineTo(-18 * scale, 16 * scale);
        context.closePath();
        context.fill();
        context.fillStyle = "#3d67be";
        context.beginPath();
        context.moveTo(12 * scale, 0);
        context.quadraticCurveTo(32 * scale, 8 * scale, 27 * scale, 28 * scale);
        context.lineTo(8 * scale, 19 * scale);
        context.fill();
        context.fillStyle = "#f2be59";
        context.beginPath();
        context.arc(0, -4 * scale, 8 * scale, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    };

    const draw = (now: number) => {
      if (!width || !height) return;
      const world = worldRef.current;
      const scale = width / WORLD_WIDTH;
      const viewHeight = height / scale;
      context.clearRect(0, 0, width, height);
      const altitude = clamp(world.cameraY / 5200, 0, 1);
      const gradient = context.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, `hsl(${211 + altitude * 15} ${58 - altitude * 15}% ${72 - altitude * 10}%)`);
      gradient.addColorStop(0.52, `hsl(${202 + altitude * 7} 66% ${82 - altitude * 4}%)`);
      gradient.addColorStop(1, "hsl(35 64% 92%)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      const background = artRef.current.sky;
      if (background?.complete && background.naturalWidth) {
        context.save();
        context.globalAlpha = 0.27;
        context.drawImage(background, 0, 0, width, height);
        context.restore();
      }
      const horizonGlow = context.createRadialGradient(width * 0.56, height * 0.78, 8, width * 0.56, height * 0.78, width * 0.76);
      horizonGlow.addColorStop(0, "rgba(255,232,186,.46)");
      horizonGlow.addColorStop(1, "rgba(255,232,186,0)");
      context.fillStyle = horizonGlow;
      context.fillRect(0, 0, width, height);

      const band = Math.floor(world.cameraY / 700);
      for (let index = -3; index < 12; index += 1) {
        const seed = index + band * 7;
        const cloudY = ((band * 700 + index * 218) - world.cameraY) * scale;
        const x = ((seed * 173) % 1200 - 110) * scale;
        cloud(x, height - cloudY, (70 + ((seed * 41) % 80)) * scale, 0.08 + ((seed % 4) * 0.018), "#f8fbff");
      }
      for (let index = 0; index < 30; index += 1) {
        const px = ((index * 137 + 91) % 1000) * scale;
        const py = ((index * 191 + 57 - world.cameraY * 0.13) % (viewHeight + 180)) * scale - 70;
        context.fillStyle = index % 4 === 0 ? "rgba(236,183,83,.62)" : "rgba(255,255,255,.48)";
        context.beginPath();
        context.arc(px, py, index % 4 === 0 ? 1.7 : 1, 0, Math.PI * 2);
        context.fill();
      }

      const castleWorldY = 3300;
      const castleScreenY = height - (castleWorldY - world.cameraY) * scale;
      const castle = artRef.current.castle;
      if (castle?.complete && castle.naturalWidth && castleScreenY > -height * 0.8 && castleScreenY < height * 1.4) {
        context.save();
        context.globalAlpha = 0.48;
        context.drawImage(castle, width * 0.28, castleScreenY - width * 0.36, width * 0.58, width * 0.38);
        context.restore();
      }

      context.save();
      const jitter = world.shake * 5;
      if (jitter) context.translate(Math.sin(now * 0.065) * jitter, Math.cos(now * 0.083) * jitter);
      for (const platform of world.platforms) drawPlatform(platform, world.t, scale, world.cameraY);
      for (const particle of world.particles) {
        const x = particle.x * scale;
        const y = height - (particle.y - world.cameraY) * scale;
        context.save();
        context.globalAlpha = particle.life / particle.max;
        context.fillStyle = `hsl(${particle.hue} 88% 76%)`;
        context.beginPath();
        context.arc(x, y, particle.size * scale, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
      drawKnight(world.player, scale, world.cameraY);
      context.restore();

      if (screenRef.current === "menu") {
        context.save();
        context.globalAlpha = 0.14;
        cloud(width * 0.76, height * 0.67, width * 0.19, 0.9, "#ffffff");
        cloud(width * 0.12, height * 0.18, width * 0.13, 0.9, "#ffffff");
        context.restore();
      }
    };

    const loop = (now: number) => {
      const delta = Math.min(0.034, (now - previous) / 1000);
      previous = now;
      if (screenRef.current === "playing" && modalRef.current === "none") update(delta, now, height / (width / WORLD_WIDTH));
      draw(now);
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frameRef.current); observer.disconnect(); };
  }, [makePlatform, playTone, silenceAmbient]);

  useEffect(() => () => {
    if (melodyTimerRef.current) window.clearInterval(melodyTimerRef.current);
    ambientRef.current?.oscillators.forEach((oscillator) => oscillator.stop());
  }, []);

  const toggleMute = () => {
    setMuted((current) => !current);
    playTone(muted ? 660 : 300, 0.08, "sine", 0.03);
  };

  const showSettingsFromMenu = () => {
    modalRef.current = "settings";
    setModal("settings");
    playTone(587.33, 0.08, "sine", 0.03);
  };

  const openAbout = () => {
    modalRef.current = "about";
    setModal("about");
    playTone(659.25, 0.09, "sine", 0.03);
  };

  const endTouch = (direction: "left" | "right") => { keysRef.current[direction] = false; };
  const beginTouch = (direction: "left" | "right") => { keysRef.current[direction] = true; };

  return (
    <main className="skybound-shell">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Skybound Knight game world" />
      <div className="sky-grain" aria-hidden="true" />

      <header className="game-hud" aria-label="Game status">
        <div className="brand-lockup">
          <div className="brand-mark brand-crest" role="img" aria-label="Skybound Knight compass crest"><span>✦</span></div>
          <div><span>SKYBOUND</span><strong>Knight</strong></div>
        </div>
        {screen !== "menu" && (
          <div className="score-stack" aria-live="polite">
            <div className="score-pill"><span>ALTITUDE</span><strong>{hud.current.toLocaleString()}<small> m</small></strong></div>
            <div className="best-pill"><Trophy size={13} /><span>BEST {hud.best.toLocaleString()} m</span></div>
          </div>
        )}
        <div className="hud-actions">
          {screen === "playing" && <button className="round-control" onClick={pauseRun} aria-label="Pause game"><Pause size={17} /></button>}
          <button className="round-control" onClick={screen === "menu" ? showSettingsFromMenu : openSettings} aria-label="Open settings"><Settings size={17} /></button>
        </div>
      </header>

      {recordFlash && screen === "playing" && (
        <div className="record-banner" role="status"><Sparkles size={17} /><span>NEW HEIGHT RECORD</span><Sparkles size={17} /></div>
      )}

      {screen === "menu" && modal === "none" && (
        <section className="menu-stage" aria-label="Skybound Knight main menu">
          <div className="menu-world-art" style={{ backgroundImage: `url(${ART.menu})` }} aria-hidden="true" />
          <div className="menu-vignette" />
          <div className="expedition-window" aria-hidden="true">
            <div className="window-field-note note-top">CASTLEWARD<br /><b>01</b></div>
            <div className="window-field-note note-bottom">SAFE LANDINGS<br /><b>∞</b></div>
            <div className="sun-disc" />
            <div className="contour-cloud contour-one" /><div className="contour-cloud contour-two" /><div className="contour-cloud contour-three" />
            <div className="journey-castle"><i /><i /><i /><b>✦</b></div>
            <div className="castle-beacon" />
            <div className="ascent-thread"><span /><span /><span /><span /></div>
            <div className="route-platform platform-one" /><div className="route-platform platform-two" /><div className="route-platform platform-three" /><div className="route-platform platform-four" />
            <div className="journey-knight"><i /><b /><span /></div>
            <div className="compass-pip pip-one">✦</div><div className="compass-pip pip-two">✦</div>
          </div>
          <div className="menu-copy">
            <p className="eyebrow"><Cloud size={15} /> AN ENDLESS ASCENT</p>
            <h1>Skybound<br /><em>Knight</em></h1>
            <p className="menu-tagline">Keep your courage above the weather.</p>
            <div className="menu-actions">
              <Button className="sky-button sky-button-primary" onClick={beginRun}><Play size={18} fill="currentColor" /> Begin the climb</Button>
              <div className="menu-secondary-actions">
                <Button variant="outline" className="sky-button sky-button-quiet" onClick={showSettingsFromMenu}><Settings size={16} /> Settings</Button>
                <Button variant="outline" className="sky-button sky-button-quiet" onClick={openAbout}><Info size={16} /> About</Button>
              </div>
            </div>
            <div className="menu-best"><Trophy size={15} /><span>Highest horizon</span><strong>{hud.best.toLocaleString()} m</strong></div>
          </div>
          <div className="menu-knight-frame"><div className="menu-knight-sprite" style={{ backgroundImage: `url(${ART.knight})` }} role="img" aria-label="A tiny knight ready to climb" /><span>A new horizon is waiting.</span></div>
          {!isTouch && <div className="key-hint"><Keyboard size={15} /><span><kbd>A</kbd><kbd>D</kbd> or <kbd>←</kbd><kbd>→</kbd> to steer</span></div>}
        </section>
      )}

      {screen === "paused" && modal === "none" && (
        <section className="state-overlay"><div className="state-card compact-card"><p className="eyebrow"><Pause size={15} /> THE SKY HOLDS STILL</p><h2>Expedition paused</h2><p>Take a breath. The next cloud will wait.</p><Button className="sky-button sky-button-primary" onClick={resumeRun}><Play size={17} fill="currentColor" /> Resume ascent</Button><Button variant="outline" className="sky-button sky-button-quiet full" onClick={beginRun}><RotateCcw size={16} /> Restart run</Button><button className="text-link" onClick={openSettings}>Open settings</button></div></section>
      )}

      {screen === "gameover" && modal === "none" && (
        <section className="state-overlay"><div className="state-card"><p className="eyebrow"><Cloud size={15} /> THE CLOUDS WILL CATCH YOU</p><h2>Journey complete</h2><div className="result-height"><span>YOUR ALTITUDE</span><strong>{hud.current.toLocaleString()}<small> m</small></strong><p>Highest horizon: <b>{hud.best.toLocaleString()} m</b></p></div><Button className="sky-button sky-button-primary" onClick={beginRun}><RotateCcw size={17} /> Ascend again</Button><Button variant="outline" className="sky-button sky-button-quiet full" onClick={() => { screenRef.current = "menu"; setScreen("menu"); }}><ChevronLeft size={16} /> Main menu</Button></div></section>
      )}

      {modal === "settings" && (
        <section className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="modal-card settings-card"><button className="modal-back" onClick={closeModal} aria-label="Close settings"><ChevronLeft size={19} /></button><div className="modal-mark brand-crest" aria-hidden="true"><span>✦</span></div><p className="eyebrow">EXPEDITION SETTINGS</p><h2 id="settings-title">Set your course</h2><p className="modal-intro">Your preferences stay with you, even after the clouds drift away.</p><div className="setting-row"><div><strong>Soundscape</strong><span>{muted ? "Muted — visuals remain fully readable" : "Dreamy sky audio is on"}</span></div><Button className={`sound-toggle ${muted ? "is-muted" : ""}`} onClick={toggleMute} aria-pressed={!muted}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}{muted ? "Muted" : "Sound on"}</Button></div>{screen !== "menu" && <div className="setting-row"><div><strong>Current run</strong><span>Paused safely at {hud.current.toLocaleString()} m</span></div><Button variant="outline" className="mini-action" onClick={beginRun}><RotateCcw size={15} /> Restart</Button></div>}<Button className="sky-button sky-button-primary full" onClick={screen === "paused" ? resumeRun : closeModal}>{screen === "paused" ? <><Play size={17} fill="currentColor" /> Resume ascent</> : "Back to menu"}</Button></div></section>
      )}

      {modal === "about" && (
        <section className="modal-layer about-layer" role="dialog" aria-modal="true" aria-labelledby="about-title"><div className="about-card"><button className="modal-back" onClick={closeModal} aria-label="Back to main menu"><ChevronLeft size={19} /></button><div className="about-header"><div className="modal-mark brand-crest" aria-hidden="true"><span>✦</span></div><p className="eyebrow">A SMALL SKYWARD STORY</p><h2 id="about-title">Made for the climb.</h2><p>Skybound Knight is a pocket-sized act of courage: one careful bounce, one new cloud, one horizon further than before.</p></div><div className="creator-portrait" style={{ backgroundImage: `url(${ART.castle})` }} role="img" aria-label="A luminous castle floating among clouds" /><div className="about-grid"><div><span className="mini-label">CREATOR</span><h3>Created with passion by MK</h3><p>An independent developer shaping the concept, experience, visuals, gameplay direction, and the overall dream of a tiny knight in an enormous sky.</p></div><div><span className="mini-label">PHILOSOPHY</span><p>Make the next decision clear, the landing satisfying, and the view worth carrying on for.</p><a className="telegram-button" href="https://t.me/TianyiXiong" target="_blank" rel="noreferrer"><span className="telegram-plane">➤</span><span><b>Telegram</b><small>@TianyiXiong</small></span></a></div></div><div className="about-credit">Skybound Knight · Original game concept and direction by MK · Built with care above the clouds</div></div></section>
      )}

      {isTouch && screen === "playing" && modal === "none" && (
        <div className="touch-controls" aria-label="Touch movement controls">
          <button className="touch-button" onPointerDown={() => beginTouch("left")} onPointerUp={() => endTouch("left")} onPointerCancel={() => endTouch("left")} onPointerLeave={() => endTouch("left")} aria-label="Move left">←</button>
          <button className="touch-button" onPointerDown={() => beginTouch("right")} onPointerUp={() => endTouch("right")} onPointerCancel={() => endTouch("right")} onPointerLeave={() => endTouch("right")} aria-label="Move right">→</button>
        </div>
      )}
    </main>
  );
}
