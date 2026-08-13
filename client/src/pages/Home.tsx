/**
 * Dawnveil Reverie: a luminous, handcrafted fantasy ascent. UI is airy editorial
 * framing; gameplay readability wins over ornament; motion, clean sound, and responsive armory feedback stay tactile and precise.
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
  Store,
  Trophy,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Screen = "menu" | "playing" | "paused" | "gameover";
type Modal = "none" | "settings" | "about" | "profile" | "shop";
type PlatformKind = "cloud" | "moving" | "fading" | "spring";
type EffectMode = "starlight" | "ember" | "mist" | "leaf" | "lunar" | "rose" | "aurora" | "storm" | "sunforge" | "void";

type KnightStyle = {
  id: string;
  name: string;
  epithet: string;
  cost: number;
  effect: EffectMode;
  avatar?: "mage";
  colors: { armor: string; visor: string; cape: string; crest: string; boots: string; trailHue: number; landingHue: number };
};

type LocalProfile = { name: string; points: number; best: number; unlocked: string[]; selected: string };
type AudioGraph = { master: GainNode; compressor: DynamicsCompressorNode; active: Set<OscillatorNode | AudioBufferSourceNode>; lastByKey: Map<string, number> };

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

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hue: number; mode?: EffectMode; aspect?: number };

type World = {
  player: { x: number; y: number; vx: number; vy: number; squash: number; landing: number; boostAvailable: boolean };
  platforms: Platform[];
  particles: Particle[];
  cameraY: number;
  highestY: number;
  nextPlatformId: number;
  lastHudAt: number;
  lastTrailAt: number;
  t: number;
  shake: number;
  runRewarded: boolean;
};

const ART = {
  menu: "/manus-storage/skybound-menu-sky_f3f3d42c.jpg",
  sky: "/manus-storage/skybound-game-sky_36ed0a53.jpg",
  castle: "/manus-storage/skybound-castle-horizon_d6571e75.jpg",
  mark: "/manus-storage/skybound-compass-mark_04c7d693.png",
};

const WORLD_WIDTH = 1000;
const KNIGHT_W = 50;
const KNIGHT_H = 64;
const PROFILE_STORAGE_KEY = "skybound-profile-v2";

const KNIGHT_STYLES: KnightStyle[] = [
  { id: "dawn-squire", name: "Dawn Squire", epithet: "The first brave step", cost: 0, effect: "starlight", colors: { armor: "#eaf0f1", visor: "#234a7c", cape: "#3d67be", crest: "#f2c05b", boots: "#324f75", trailHue: 202, landingHue: 43 } },
  { id: "ember-warden", name: "Ember Warden", epithet: "A warm spark in thin air", cost: 180, effect: "ember", colors: { armor: "#fff0d6", visor: "#7d3528", cape: "#c85139", crest: "#f3b54d", boots: "#71372f", trailHue: 20, landingHue: 34 } },
  { id: "aether-mage", name: "Aether Mage", epithet: "The arcane routefinder", cost: 120, effect: "lunar", avatar: "mage", colors: { armor: "#eeeafd", visor: "#54467d", cape: "#8270bf", crest: "#f5dc86", boots: "#453766", trailHue: 264, landingHue: 282 } },
  { id: "verdant-vow", name: "Verdant Vow", epithet: "Promise of the floating grove", cost: 620, effect: "leaf", colors: { armor: "#eaf1d4", visor: "#395c37", cape: "#688a49", crest: "#d4ba5c", boots: "#3d5f3c", trailHue: 97, landingHue: 77 } },
  { id: "moon-archivist", name: "Moon Archivist", epithet: "Keeper of silver routes", cost: 950, effect: "lunar", colors: { armor: "#eeebf7", visor: "#55487f", cape: "#7868ae", crest: "#ebdbff", boots: "#4d4972", trailHue: 264, landingHue: 280 } },
  { id: "rose-vanguard", name: "Rose Vanguard", epithet: "Courage in bloom", cost: 1350, effect: "rose", colors: { armor: "#fff0f0", visor: "#92435d", cape: "#d86e87", crest: "#f7c0a8", boots: "#793c58", trailHue: 345, landingHue: 12 } },
  { id: "aurora-sentinel", name: "Aurora Sentinel", epithet: "Northlight above the storm", cost: 1850, effect: "aurora", colors: { armor: "#dff6f0", visor: "#207786", cape: "#32b6a4", crest: "#d7f279", boots: "#1f6173", trailHue: 157, landingHue: 188 } },
  { id: "storm-herald", name: "Storm Herald", epithet: "Rider of high pressure", cost: 2500, effect: "storm", colors: { armor: "#e0e8ff", visor: "#334b91", cape: "#496cca", crest: "#99c9ff", boots: "#2d407f", trailHue: 219, landingHue: 233 } },
  { id: "sunforge-paladin", name: "Sunforge Paladin", epithet: "Tempered at the horizon", cost: 3400, effect: "sunforge", colors: { armor: "#fff1cb", visor: "#8a571a", cape: "#d68e28", crest: "#fff0a4", boots: "#75491e", trailHue: 45, landingHue: 50 } },
  { id: "voidglass-knight", name: "Voidglass Knight", epithet: "A mirror of the last sky", cost: 4600, effect: "void", colors: { armor: "#e7e4f2", visor: "#171831", cape: "#35315f", crest: "#cda9ff", boots: "#22213f", trailHue: 286, landingHue: 303 } },
];

const DEFAULT_PROFILE: LocalProfile = { name: "Skyward Guest", points: 0, best: 0, unlocked: ["dawn-squire"], selected: "dawn-squire" };

function getKnightStyle(id: string) {
  return KNIGHT_STYLES.find((style) => style.id === id) || KNIGHT_STYLES[0];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function emitStyleParticles(world: World, style: KnightStyle, x: number, y: number, kind: "trail" | "landing", count = 4) {
  const multiplier = style.effect === "aurora" || style.effect === "sunforge" ? 1.5 : style.effect === "void" ? 0.75 : 1;
  const total = Math.ceil(count * multiplier);
  for (let index = 0; index < total; index += 1) {
    const max = randomBetween(kind === "trail" ? 0.19 : 0.34, kind === "trail" ? 0.42 : 0.76);
    const side = index % 2 ? -1 : 1;
    const hueShift = style.effect === "aurora" ? index * 26 : style.effect === "rose" ? index * 7 : 0;
    world.particles.push({
      x: x + randomBetween(-5, 5),
      y: y + randomBetween(-4, 4),
      vx: randomBetween(22, 120) * side,
      vy: kind === "trail" ? randomBetween(-145, -34) : randomBetween(38, 175),
      life: max,
      max,
      size: randomBetween(style.effect === "void" ? 2 : 3, style.effect === "sunforge" ? 8 : 6),
      hue: (kind === "trail" ? style.colors.trailHue : style.colors.landingHue) + hueShift,
      mode: style.effect,
      aspect: style.effect === "leaf" || style.effect === "ember" ? randomBetween(1.35, 2.4) : 1,
    });
  }
  if (world.particles.length > 150) world.particles.splice(0, world.particles.length - 150);
}

function getStoredNumber(key: string) {
  try {
    return Number(window.localStorage.getItem(key) || "0") || 0;
  } catch {
    return 0;
  }
}

function loadProfile(): LocalProfile {
  try {
    const saved = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) as Partial<LocalProfile> : null;
    const legacyBest = getStoredNumber("skybound-best");
    const migrateStyle = (id: string) => id === "mist-ranger" ? "aether-mage" : id;
    const rawUnlocked = Array.isArray(parsed?.unlocked) ? parsed!.unlocked.map(migrateStyle) : [];
    const unlocked = rawUnlocked.includes("dawn-squire")
      ? Array.from(new Set(rawUnlocked.filter((id) => KNIGHT_STYLES.some((style) => style.id === id))))
      : DEFAULT_PROFILE.unlocked;
    const selectedCandidate = typeof parsed?.selected === "string" ? migrateStyle(parsed.selected) : "";
    const selected = unlocked.includes(selectedCandidate) ? selectedCandidate : "dawn-squire";
    return {
      name: typeof parsed?.name === "string" && parsed.name.trim() ? parsed.name.trim().slice(0, 18) : DEFAULT_PROFILE.name,
      points: Math.max(0, Number(parsed?.points) || 0),
      best: Math.max(legacyBest, Number(parsed?.best) || 0),
      unlocked,
      selected,
    };
  } catch {
    return { ...DEFAULT_PROFILE, best: getStoredNumber("skybound-best") };
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
  // The baseline is captured at run start; the boolean prevents frame-by-frame record replay.
  const runRecordBaselineRef = useRef(0);
  const newRecordSoundPlayedRef = useRef(false);
  const artRef = useRef<Record<string, HTMLImageElement>>({});
  const audioRef = useRef<AudioContext | null>(null);
  const audioGraphRef = useRef<AudioGraph | null>(null);
  const ambientRef = useRef<{ gain: GainNode; oscillators: OscillatorNode[] } | null>(null);
  const melodyTimerRef = useRef<number | null>(null);
  const worldRef = useRef<World>({
    player: { x: 500, y: 95, vx: 0, vy: 0, squash: 0, landing: 0, boostAvailable: true },
    platforms: [], particles: [], cameraY: 0, highestY: 0, nextPlatformId: 1, lastHudAt: 0, lastTrailAt: 0, t: 0, shake: 0, runRewarded: false,
  });

  const [screen, setScreen] = useState<Screen>("menu");
  const [modal, setModal] = useState<Modal>("none");
  const [profile, setProfile] = useState<LocalProfile>(() => loadProfile());
  const profileRef = useRef<LocalProfile>(profile);
  const [muted, setMuted] = useState(() => {
    try { return window.localStorage.getItem("skybound-muted") === "true"; } catch { return false; }
  });
  const [isTouch, setIsTouch] = useState(isTouchFirst);
  const [hud, setHud] = useState({ current: 0, best: profile.best });
  const [recordFlash, setRecordFlash] = useState(false);
  const [boostReady, setBoostReady] = useState(true);
  const [runReward, setRunReward] = useState(0);
  const [profileNameDraft, setProfileNameDraft] = useState(profile.name);
  const [armoryNotice, setArmoryNotice] = useState("");

  useEffect(() => {
    mutedRef.current = muted;
    try { window.localStorage.setItem("skybound-muted", String(muted)); } catch { /* local storage is optional */ }
    if (ambientRef.current) {
      ambientRef.current.gain.gain.setTargetAtTime(muted || screenRef.current !== "playing" ? 0 : 0.025, audioRef.current?.currentTime || 0, 0.12);
    }
  }, [muted]);

  useEffect(() => {
    profileRef.current = profile;
    bestRef.current = Math.max(bestRef.current, profile.best);
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      window.localStorage.setItem("skybound-best", String(profile.best));
    } catch { /* local browser storage is the intentional offline database */ }
    setHud((previous) => ({ ...previous, best: Math.max(previous.best, profile.best) }));
  }, [profile]);

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

  const getAudioGraph = useCallback(() => {
    const context = audioContext();
    if (!context) return null;
    if (!audioGraphRef.current) {
      const master = context.createGain();
      const compressor = context.createDynamicsCompressor();
      master.gain.value = 0.46;
      compressor.threshold.value = -18;
      compressor.knee.value = 18;
      compressor.ratio.value = 7;
      compressor.attack.value = 0.008;
      compressor.release.value = 0.16;
      master.connect(compressor).connect(context.destination);
      audioGraphRef.current = { master, compressor, active: new Set(), lastByKey: new Map() };
    }
    return { context, graph: audioGraphRef.current };
  }, [audioContext]);

  const playTone = useCallback((frequency: number, seconds = 0.12, type: OscillatorType = "sine", volume = 0.045, endFrequency?: number, key = "tone", cooldown = 0.035) => {
    if (mutedRef.current) return;
    const audio = getAudioGraph();
    if (!audio) return;
    const { context, graph } = audio;
    const now = context.currentTime;
    if (now - (graph.lastByKey.get(key) ?? -Infinity) < cooldown || graph.active.size >= 12) return;
    graph.lastByKey.set(key, now);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(12, endFrequency), now + seconds);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + Math.min(0.014, seconds * 0.22));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    oscillator.connect(gain).connect(graph.master);
    graph.active.add(oscillator);
    oscillator.onended = () => graph.active.delete(oscillator);
    oscillator.start(now);
    oscillator.stop(now + seconds + 0.025);
  }, [getAudioGraph]);

  const playNoise = useCallback((seconds: number, volume: number, cutoff: number, key: string, cooldown = 0.08) => {
    if (mutedRef.current) return;
    const audio = getAudioGraph();
    if (!audio) return;
    const { context, graph } = audio;
    const now = context.currentTime;
    if (now - (graph.lastByKey.get(key) ?? -Infinity) < cooldown || graph.active.size >= 12) return;
    graph.lastByKey.set(key, now);
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(graph.master);
    graph.active.add(source);
    source.onended = () => graph.active.delete(source);
    source.start(now);
  }, [getAudioGraph]);

  const playNewRecordSound = useCallback(() => {
    // A single airy, ascending milestone cue: shimmer, then a restrained major arpeggio.
    // Each voice has its own key and cooldown so the cue remains clean within the shared limiter.
    playNoise(0.18, 0.014, 3600, "record-shimmer", 0.7);
    playTone(392, 0.34, "sine", 0.038, 587.33, "record-root", 0.7);
    window.setTimeout(() => {
      playTone(493.88, 0.4, "sine", 0.036, 739.99, "record-third", 0.7);
      playTone(659.25, 0.58, "triangle", 0.032, 1046.5, "record-bell", 0.7);
    }, 82);
    window.setTimeout(() => playTone(1046.5, 0.42, "sine", 0.018, 1318.51, "record-air", 0.7), 164);
  }, [playNoise, playTone]);

  const startAmbient = useCallback(() => {
    const context = audioContext();
    if (!context) return;
    if (!ambientRef.current) {
      const gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(getAudioGraph()?.graph.master || context.destination);
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
  }, [audioContext, getAudioGraph, playTone]);

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
    bestRef.current = Math.max(bestRef.current, profileRef.current.best);
    runRecordBaselineRef.current = bestRef.current;
    newRecordSoundPlayedRef.current = false;
    world.player = { x: 500, y: 104, vx: 0, vy: 800, squash: 0, landing: 0, boostAvailable: true };
    world.platforms = [{ id: 0, x: 365, y: 50, width: 270, kind: "cloud", phase: 0, amplitude: 0 }];
    world.particles = [];
    world.cameraY = 0;
    world.highestY = 104;
    world.nextPlatformId = 1;
    world.lastTrailAt = 0;
    world.t = 0;
    world.shake = 0;
    world.runRewarded = false;
    while (world.platforms[world.platforms.length - 1].y < 1900) makePlatform(world);
    setHud({ current: 0, best: bestRef.current });
    setRecordFlash(false);
    setBoostReady(true);
    setRunReward(0);
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

  const openProfile = useCallback(() => {
    if (screenRef.current === "playing") pauseRun();
    setProfileNameDraft(profileRef.current.name);
    modalRef.current = "profile";
    setModal("profile");
    playTone(523.25, 0.08, "sine", 0.03);
  }, [pauseRun, playTone]);

  const openShop = useCallback(() => {
    if (screenRef.current === "playing") pauseRun();
    modalRef.current = "shop";
    setModal("shop");
    setArmoryNotice("");
    playTone(698.46, 0.1, "triangle", 0.03);
  }, [pauseRun, playTone]);

  const saveProfileName = () => {
    const nextName = profileNameDraft.trim().slice(0, 18) || "Skyward Guest";
    setProfile((current) => ({ ...current, name: nextName }));
    setProfileNameDraft(nextName);
    playTone(659.25, 0.1, "sine", 0.035, 880);
  };

  const purchaseOrEquip = (style: KnightStyle) => {
    const current = profileRef.current;
    console.info("[Skybound Armory] Transaction requested", { styleId: style.id, balance: current.points, cost: style.cost, alreadyUnlocked: current.unlocked.includes(style.id) });
    if (current.unlocked.includes(style.id)) {
      const next = { ...current, selected: style.id };
      profileRef.current = next;
      setProfile(next);
      setArmoryNotice(`${style.name} equipped.`);
      console.info("[Skybound Armory] Existing style equipped", { styleId: style.id });
      playTone(587.33, 0.09, "sine", 0.035, 783.99);
      return;
    }
    if (current.points < style.cost) {
      setArmoryNotice(`Need ${style.cost - current.points} more height points for ${style.name}.`);
      console.warn("[Skybound Armory] Purchase denied: insufficient height points", { styleId: style.id, balance: current.points, cost: style.cost });
      playTone(220, 0.14, "triangle", 0.032, 155);
      return;
    }
    const next = { ...current, points: current.points - style.cost, unlocked: [...current.unlocked, style.id], selected: style.id };
    profileRef.current = next;
    setProfile(next);
    setArmoryNotice(`${style.name} unlocked and equipped. ${next.points.toLocaleString()} height points remain.`);
    console.info("[Skybound Armory] Purchase complete", { styleId: style.id, cost: style.cost, balanceBefore: current.points, balanceAfter: next.points, equippedStyle: next.selected });
    playTone(659.25, 0.12, "sine", 0.05, 987.77);
    window.setTimeout(() => playTone(987.77, 0.18, "triangle", 0.04, 1318.51), 90);
  };

  const useBoost = useCallback(() => {
    const world = worldRef.current;
    const player = world.player;
    if (screenRef.current !== "playing" || modalRef.current !== "none" || !player.boostAvailable) return;
    player.boostAvailable = false;
    player.vy = Math.max(player.vy + 440, 1090);
    player.squash = 0.52;
    world.shake = Math.max(world.shake, 0.42);
    setBoostReady(false);
    emitStyleParticles(world, getKnightStyle(profileRef.current.selected), player.x, player.y - 16, "trail", 10);
    if (navigator.vibrate) navigator.vibrate(12);
    playNoise(0.075, 0.026, 1900, "boost-air", 0.06);
    playTone(620, 0.11, "triangle", 0.05, 980);
    window.setTimeout(() => playTone(980, 0.12, "sine", 0.026, 1240), 68);
  }, [playNoise, playTone]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
      if (event.code === "KeyA" || event.code === "ArrowLeft") keysRef.current.left = true;
      if (event.code === "KeyD" || event.code === "ArrowRight") keysRef.current.right = true;
      if (event.code === "Space") useBoost();
      if (event.code === "Escape" && screenRef.current === "playing") pauseRun();
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "KeyA" || event.code === "ArrowLeft") keysRef.current.left = false;
      if (event.code === "KeyD" || event.code === "ArrowRight") keysRef.current.right = false;
    };
    window.addEventListener("keydown", keyDown, { passive: false });
    window.addEventListener("keyup", keyUp);
    return () => { window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); };
  }, [pauseRun, useBoost]);

  useEffect(() => {
    const blockContextMenu = (event: MouseEvent) => event.preventDefault();
    const blockInspectionShortcut = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const windowsShortcut = event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key);
      const macShortcut = event.metaKey && event.altKey && key === "i";
      if (event.key === "F12" || windowsShortcut || macShortcut) {
        event.preventDefault();
        console.info("[Skybound Knight] Browser inspection shortcut prevented.");
      }
    };
    window.addEventListener("contextmenu", blockContextMenu);
    window.addEventListener("keydown", blockInspectionShortcut);
    return () => { window.removeEventListener("contextmenu", blockContextMenu); window.removeEventListener("keydown", blockInspectionShortcut); };
  }, []);

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
      if (player.vy > 80 && world.t - world.lastTrailAt > 62) {
        world.lastTrailAt = world.t;
        emitStyleParticles(world, getKnightStyle(profileRef.current.selected), player.x, player.y - 18, "trail", 2);
      }

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
            player.boostAvailable = true;
            setBoostReady(true);
            world.shake = platform.kind === "spring" ? 0.75 : 0.32;
            if (platform.kind === "fading" && !platform.fadingAt) platform.fadingAt = now;
            puff(world, player.x, platform.y + 4, platform.kind === "spring" ? 16 : 10, platform.kind === "spring" ? 47 : 37);
            emitStyleParticles(world, getKnightStyle(profileRef.current.selected), player.x, platform.y + 5, "landing", platform.kind === "spring" ? 15 : 9);
            playNoise(platform.kind === "spring" ? 0.1 : 0.055, platform.kind === "spring" ? 0.03 : 0.022, platform.kind === "spring" ? 2100 : 1300, platform.kind === "spring" ? "spring-noise" : "landing-noise", 0.07);
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
        bestRef.current = heightScore;
        try { window.localStorage.setItem("skybound-best", String(bestRef.current)); } catch { /* persistence remains optional */ }
      }

      if (
        !newRecordSoundPlayedRef.current
        && heightScore > runRecordBaselineRef.current
      ) {
        newRecordSoundPlayedRef.current = true;
        setRecordFlash(true);
        window.setTimeout(() => setRecordFlash(false), 1600);
        puff(world, player.x, player.y, 22, 45);
        playNewRecordSound();
      }

      if (now - world.lastHudAt > 85) {
        world.lastHudAt = now;
        setHud({ current: heightScore, best: bestRef.current });
      }
      if (player.y < world.cameraY - 175) {
        if (!world.runRewarded) {
          const earned = Math.max(1, Math.floor(heightScore / 8));
          world.runRewarded = true;
          setRunReward(earned);
          setProfile((current) => ({ ...current, points: current.points + earned, best: Math.max(current.best, heightScore) }));
        }
        screenRef.current = "gameover";
        setScreen("gameover");
        silenceAmbient();
        playNoise(0.16, 0.027, 720, "fall-noise", 0.18);
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
      const style = getKnightStyle(profileRef.current.selected);
      // A self-drawn knight keeps the player crisp and guarantees no sprite backdrop enters the game world.
      if (style.avatar === "mage") {
        context.fillStyle = style.colors.cape;
        context.beginPath();
        context.moveTo(-20 * scale, 25 * scale);
        context.lineTo(0, -4 * scale);
        context.lineTo(20 * scale, 25 * scale);
        context.closePath();
        context.fill();
        context.strokeStyle = style.colors.visor;
        context.lineWidth = 2 * scale;
        context.stroke();
        context.fillStyle = style.colors.armor;
        context.beginPath();
        context.arc(0, -11 * scale, 13 * scale, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.fillStyle = style.colors.visor;
        context.beginPath();
        context.moveTo(-18 * scale, -13 * scale);
        context.lineTo(0, -47 * scale);
        context.lineTo(18 * scale, -13 * scale);
        context.closePath();
        context.fill();
        context.fillStyle = style.colors.crest;
        context.beginPath();
        context.arc(0, -28 * scale, 3.5 * scale, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = style.colors.boots;
        context.lineWidth = 3 * scale;
        context.beginPath();
        context.moveTo(23 * scale, -2 * scale);
        context.lineTo(28 * scale, 28 * scale);
        context.stroke();
        context.fillStyle = style.colors.crest;
        context.beginPath();
        context.arc(23 * scale, -3 * scale, 4 * scale, 0, Math.PI * 2);
        context.fill();
        context.restore();
        return;
      }
      context.fillStyle = style.colors.visor;
      context.beginPath();
      context.ellipse(15 * scale, 12 * scale, 10 * scale, 18 * scale, -0.38, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = style.colors.cape;
      context.beginPath();
      context.moveTo(10 * scale, -1 * scale);
      context.quadraticCurveTo(34 * scale, 8 * scale, 28 * scale, 30 * scale);
      context.lineTo(6 * scale, 20 * scale);
      context.closePath();
      context.fill();
      context.fillStyle = style.colors.armor;
      context.strokeStyle = style.colors.visor;
      context.lineWidth = 2 * scale;
      context.beginPath();
      context.moveTo(-12 * scale, 2 * scale);
      context.lineTo(12 * scale, 2 * scale);
      context.lineTo(15 * scale, 24 * scale);
      context.lineTo(-15 * scale, 24 * scale);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = style.colors.armor;
      context.beginPath();
      context.arc(0, -10 * scale, 17 * scale, Math.PI, 0);
      context.lineTo(17 * scale, 1 * scale);
      context.lineTo(-17 * scale, 1 * scale);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = style.colors.visor;
      context.beginPath();
      context.roundRect(-12 * scale, -8 * scale, 24 * scale, 7 * scale, 3 * scale);
      context.fill();
      context.fillStyle = style.colors.crest;
      context.beginPath();
      context.moveTo(0, 7 * scale);
      context.lineTo(5 * scale, 13 * scale);
      context.lineTo(0, 19 * scale);
      context.lineTo(-5 * scale, 13 * scale);
      context.closePath();
      context.fill();
      context.fillStyle = style.colors.boots;
      context.fillRect(-14 * scale, 23 * scale, 10 * scale, 4 * scale);
      context.fillRect(5 * scale, 23 * scale, 10 * scale, 4 * scale);
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
        context.translate(x, y);
        if (particle.mode === "leaf" || particle.mode === "ember") {
          context.rotate((particle.vx + particle.vy) * 0.008);
          context.beginPath();
          context.ellipse(0, 0, particle.size * scale * (particle.aspect || 1), particle.size * scale * 0.68, 0, 0, Math.PI * 2);
          context.fill();
        } else if (particle.mode === "starlight" || particle.mode === "sunforge") {
          const radius = particle.size * scale;
          context.beginPath();
          context.moveTo(0, -radius);
          context.lineTo(radius * .58, 0);
          context.lineTo(0, radius);
          context.lineTo(-radius * .58, 0);
          context.closePath();
          context.fill();
        } else if (particle.mode === "void") {
          context.globalCompositeOperation = "screen";
          context.beginPath();
          context.arc(0, 0, particle.size * scale * 1.35, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = "rgba(255,255,255,.72)";
          context.beginPath();
          context.arc(0, 0, particle.size * scale * .35, 0, Math.PI * 2);
          context.fill();
        } else {
          context.beginPath();
          context.arc(0, 0, particle.size * scale, 0, Math.PI * 2);
          context.fill();
        }
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
  }, [makePlatform, playNewRecordSound, playNoise, playTone, silenceAmbient]);

  useEffect(() => () => {
    if (melodyTimerRef.current) window.clearInterval(melodyTimerRef.current);
    ambientRef.current?.oscillators.forEach((oscillator) => oscillator.stop());
  }, []);

  const toggleMute = () => {
    const nextMuted = !mutedRef.current;
    mutedRef.current = nextMuted;
    setMuted(nextMuted);
    if (!nextMuted) playTone(660, 0.08, "sine", 0.03);
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
    <main className="skybound-shell" data-app="skybound-knight" data-screen={screen} data-player={profile.name} data-equipped-style={profile.selected} data-content-protection="basic-deterrent">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Skybound Knight game world" data-renderer="canvas" data-inspect-role="visual-game-layer" />
      <div className="sky-grain" aria-hidden="true" />
      <output className="inspectable-game-state" data-inspect-role="game-state" data-height={hud.current} data-best-height={hud.best} data-height-points={profile.points} data-unlocked-styles={profile.unlocked.length} aria-live="polite">{`${profile.name}: ${hud.current} metres, ${profile.points} height points, ${profile.unlocked.length} styles unlocked.`}</output>

      {armoryNotice && <output className="armory-notice" role="status" aria-live="polite">{armoryNotice}</output>}
      <header className="game-hud" aria-label="Game status" data-ui-region="game-hud">
        <div className="brand-lockup">
          <div className="brand-mark brand-crest" role="img" aria-label="Skybound Knight compass crest"><span>✦</span></div>
          <div><span>SKYBOUND</span><strong>Knight</strong></div>
        </div>
        {screen !== "menu" && (
          <div className="score-stack" aria-live="polite">
            <div className="score-pill"><span>ALTITUDE</span><strong>{hud.current.toLocaleString()}<small> m</small></strong></div>
            <div className="best-pill"><Trophy size={13} /><span>BEST {hud.best.toLocaleString()} m</span></div>
            {screen === "playing" && <div className={`boost-pill ${boostReady ? "" : "is-spent"}`}><Sparkles size={12} /><span>{boostReady ? "SPACE · BOOST READY" : "BOOST USED · LAND TO RECHARGE"}</span></div>}
          </div>
        )}
        <div className="hud-actions">
          {screen === "playing" && <button className="round-control" onClick={pauseRun} aria-label="Pause game"><Pause size={17} /></button>}
          <button className="round-control" onClick={openShop} aria-label="Open style shop"><Store size={17} /></button>
          <button className="round-control" onClick={openProfile} aria-label="Open player profile"><UserRound size={17} /></button>
          <button className="round-control" onClick={screen === "menu" ? showSettingsFromMenu : openSettings} aria-label="Open settings"><Settings size={17} /></button>
        </div>
      </header>

      {recordFlash && screen === "playing" && (
        <div className="record-banner" role="status"><Sparkles size={17} /><span>NEW HEIGHT RECORD</span><Sparkles size={17} /></div>
      )}

      {screen === "menu" && modal === "none" && (
        <section className="menu-stage" aria-label="Skybound Knight main menu">
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
                <Button variant="outline" className="sky-button sky-button-quiet" onClick={openShop}><Store size={16} /> Style shop</Button>
                <Button variant="outline" className="sky-button sky-button-quiet" onClick={openProfile}><UserRound size={16} /> {profile.name}</Button>
              </div>
            </div>
            <div className="menu-stats"><div className="menu-best"><Trophy size={15} /><span>Highest horizon</span><strong>{hud.best.toLocaleString()} m</strong></div><div className="menu-wallet"><Sparkles size={14} /><span>Height points</span><strong>{profile.points.toLocaleString()}</strong></div></div>
          </div>
          {!isTouch && <div className="key-hint"><Keyboard size={15} /><span><kbd>A</kbd><kbd>D</kbd> or <kbd>←</kbd><kbd>→</kbd> steer · <kbd>Space</kbd> boost</span></div>}
        </section>
      )}

      {screen === "paused" && modal === "none" && (
        <section className="state-overlay"><div className="state-card compact-card"><p className="eyebrow"><Pause size={15} /> THE SKY HOLDS STILL</p><h2>Expedition paused</h2><p>Take a breath. The next cloud will wait.</p><Button className="sky-button sky-button-primary" onClick={resumeRun}><Play size={17} fill="currentColor" /> Resume ascent</Button><Button variant="outline" className="sky-button sky-button-quiet full" onClick={beginRun}><RotateCcw size={16} /> Restart run</Button><button className="text-link" onClick={openSettings}>Open settings</button></div></section>
      )}

      {screen === "gameover" && modal === "none" && (
        <section className="state-overlay"><div className="state-card"><p className="eyebrow"><Cloud size={15} /> THE CLOUDS WILL CATCH YOU</p><h2>Journey complete</h2><div className="result-height"><span>YOUR ALTITUDE</span><strong>{hud.current.toLocaleString()}<small> m</small></strong><p>Highest horizon: <b>{hud.best.toLocaleString()} m</b></p><div className="reward-stamp"><Sparkles size={14} /> +{runReward.toLocaleString()} height points</div></div><Button className="sky-button sky-button-primary" onClick={beginRun}><RotateCcw size={17} /> Ascend again</Button><Button variant="outline" className="sky-button sky-button-quiet full" onClick={openShop}><Store size={16} /> Visit style shop</Button><Button variant="outline" className="sky-button sky-button-quiet full" onClick={() => { screenRef.current = "menu"; setScreen("menu"); }}><ChevronLeft size={16} /> Main menu</Button></div></section>
      )}

      {modal === "settings" && (
        <section className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="modal-card settings-card"><button className="modal-back" onClick={closeModal} aria-label="Close settings"><ChevronLeft size={19} /></button><div className="modal-mark brand-crest" aria-hidden="true"><span>✦</span></div><p className="eyebrow">EXPEDITION SETTINGS</p><h2 id="settings-title">Set your course</h2><p className="modal-intro">Your preferences stay with you, even after the clouds drift away.</p><div className="setting-row"><div><strong>Soundscape</strong><span>{muted ? "Muted — visuals remain fully readable" : "Dreamy sky audio is on"}</span></div><Button className={`sound-toggle ${muted ? "is-muted" : ""}`} onClick={toggleMute} aria-pressed={!muted}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}{muted ? "Muted" : "Sound on"}</Button></div>{screen !== "menu" && <div className="setting-row"><div><strong>Current run</strong><span>Paused safely at {hud.current.toLocaleString()} m</span></div><Button variant="outline" className="mini-action" onClick={beginRun}><RotateCcw size={15} /> Restart</Button></div>}<Button className="sky-button sky-button-primary full" onClick={screen === "paused" ? resumeRun : closeModal}>{screen === "paused" ? <><Play size={17} fill="currentColor" /> Resume ascent</> : "Back to menu"}</Button></div></section>
      )}

      {modal === "profile" && (
        <section className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="profile-title"><div className="modal-card profile-card"><button className="modal-back" onClick={closeModal} aria-label="Close profile"><ChevronLeft size={19} /></button><div className="profile-crest"><UserRound size={28} /></div><p className="eyebrow">SKYWARD PASSPORT</p><h2 id="profile-title">Your expedition</h2><p className="modal-intro">Your name, height points, unlocked styles, and highest horizon are saved privately in this browser or phone.</p><label className="profile-name-label" htmlFor="skybound-player-name">CALLSIGN</label><div className="profile-name-row"><input id="skybound-player-name" className="profile-name-input" value={profileNameDraft} onChange={(event) => setProfileNameDraft(event.target.value)} maxLength={18} placeholder="Enter a name" /><Button className="mini-action profile-save" onClick={saveProfileName}>Save</Button></div><div className="profile-stat-grid"><div><span>HEIGHT POINTS</span><strong>{profile.points.toLocaleString()}</strong><small>Earned from completed climbs</small></div><div><span>BEST HORIZON</span><strong>{profile.best.toLocaleString()} m</strong><small>Personal ascent record</small></div><div><span>STYLE VAULT</span><strong>{profile.unlocked.length} / {KNIGHT_STYLES.length}</strong><small>Knights in your collection</small></div></div><Button className="sky-button sky-button-primary full" onClick={openShop}><Store size={17} /> Open style shop</Button></div></section>
      )}

      {modal === "shop" && (
        <section className="modal-layer shop-layer" role="dialog" aria-modal="true" aria-labelledby="shop-title"><div className="shop-card"><button className="modal-back" onClick={closeModal} aria-label="Close style shop"><ChevronLeft size={19} /></button><div className="shop-heading"><div><p className="eyebrow"><Store size={15} /> THE SKYWARD ARMORY</p><h2 id="shop-title">Choose your legend.</h2><p>Each knight carries a distinct silhouette, jump trace, and landing bloom.</p></div><div className="shop-wallet"><Sparkles size={17} /><span>HEIGHT POINTS</span><strong>{profile.points.toLocaleString()}</strong></div></div><div className="shop-grid">{KNIGHT_STYLES.map((style) => { const owned = profile.unlocked.includes(style.id); const equipped = profile.selected === style.id; const available = owned || profile.points >= style.cost; return <article key={style.id} className={`style-card ${equipped ? "is-equipped" : ""} ${owned ? "is-owned" : "is-locked"}`}><div className="style-card-top"><div className="style-knight-preview" style={{ background: `linear-gradient(145deg, ${style.colors.armor}, ${style.colors.cape})` }}><span className="style-helmet" style={{ borderColor: style.colors.visor, background: style.colors.armor }} /><span className="style-cape" style={{ background: style.colors.cape }} /><i style={{ background: style.colors.crest }} /></div><div className="style-effect-dots"><span style={{ background: `hsl(${style.colors.trailHue} 78% 67%)` }} /><span style={{ background: `hsl(${style.colors.landingHue} 85% 72%)` }} /><span style={{ background: style.colors.crest }} /></div></div><div className="style-card-copy"><span className="style-index">{String(KNIGHT_STYLES.indexOf(style) + 1).padStart(2, "0")}</span><h3>{style.name}</h3><p>{style.epithet}</p><small>{style.effect} trail · landing bloom</small></div><Button className={`style-action ${equipped ? "is-equipped" : ""}`} onClick={() => purchaseOrEquip(style)} disabled={!available || equipped}>{equipped ? "Equipped" : owned ? "Equip" : available ? <><Sparkles size={13} /> Unlock · {style.cost}</> : <><Sparkles size={13} /> Need {style.cost - profile.points}</>}</Button></article>; })}</div><p className="shop-footnote">Height points are earned at the end of each run and stored locally on this device. Unlocks never leave this browser unless its storage is cleared.</p></div></section>
      )}

      {modal === "about" && (
        <section className="modal-layer about-layer" role="dialog" aria-modal="true" aria-labelledby="about-title"><div className="about-card"><button className="modal-back" onClick={closeModal} aria-label="Back to main menu"><ChevronLeft size={19} /></button><div className="about-header"><div className="modal-mark brand-crest" aria-hidden="true"><span>✦</span></div><p className="eyebrow">A SMALL SKYWARD STORY</p><h2 id="about-title">Made for the climb.</h2><p>Skybound Knight is a pocket-sized act of courage: one careful bounce, one new cloud, one horizon further than before.</p></div><div className="creator-portrait" style={{ backgroundImage: `url(${ART.castle})` }} role="img" aria-label="A luminous castle floating among clouds" /><div className="about-grid"><div><span className="mini-label">CREATOR</span><h3>Created with passion by MK</h3><p>An independent developer shaping the concept, experience, visuals, gameplay direction, and the overall dream of a tiny knight in an enormous sky.</p></div><div><span className="mini-label">PHILOSOPHY</span><p>Make the next decision clear, the landing satisfying, and the view worth carrying on for.</p><a className="telegram-button" href="https://t.me/TianyiXiong" target="_blank" rel="noreferrer"><span className="telegram-plane">➤</span><span><b>Telegram</b><small>@TianyiXiong</small></span></a></div></div><div className="about-credit">Skybound Knight · Original game concept and direction by MK · Built with care above the clouds</div></div></section>
      )}

      {isTouch && screen === "playing" && modal === "none" && (
        <div className="touch-controls" aria-label="Touch movement controls">
          <button className="touch-button" onPointerDown={() => beginTouch("left")} onPointerUp={() => endTouch("left")} onPointerCancel={() => endTouch("left")} onPointerLeave={() => endTouch("left")} aria-label="Move left">←</button>
          <button className={`touch-button touch-boost ${boostReady ? "" : "is-spent"}`} onPointerDown={useBoost} aria-label={boostReady ? "Use aerial boost" : "Boost used; land to recharge"} disabled={!boostReady}>↟</button>
          <button className="touch-button" onPointerDown={() => beginTouch("right")} onPointerUp={() => endTouch("right")} onPointerCancel={() => endTouch("right")} onPointerLeave={() => endTouch("right")} aria-label="Move right">→</button>
        </div>
      )}
    </main>
  );
}
