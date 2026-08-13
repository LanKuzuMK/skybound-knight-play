# Skybound Knight — Android APK Readiness & Mobile UX Audit

**Audit scope.** This report evaluates the current React/Vite game and its Capacitor preparation for Android packaging, with emphasis on safe areas, portrait orientation, screen standby, haptics, Android Back behavior, and mobile performance. The assessment is based on the current project implementation, including `client/index.html`, `client/src/index.css`, `client/src/pages/Home.tsx`, `capacitor.config.json`, `package.json`, and `APK_BUILD.md`.

> **Release decision: No-Go for a public Android launch today.** The web game is a strong candidate for Capacitor packaging, and the touch UI, safe-area CSS, pointer controls, and base Capacitor configuration are already useful foundations. However, the native Android project has not been generated, the Capacitor CLI is not installed in the project, portrait locking, wake lock, lifecycle pause, native Back handling, and an APK asset strategy are not yet implemented or device-tested.

| Area | Current state | Readiness | Launch decision |
| --- | --- | --- | --- |
| Capacitor foundation | `@capacitor/core` and `@capacitor/android` are declared; app ID, Android scheme, and web directory are configured. | Partial | **Must complete native generation and build validation.** |
| Android project and CLI | No `android/` project exists and `@capacitor/cli` is not installed. | Missing | **Blocker.** |
| Safe areas and touch | `viewport-fit=cover`, `100dvh`, `env(safe-area-inset-*)`, 44 px controls, pointer capture, and `touch-action` rules are present. | Good foundation | **Device validation required.** |
| Portrait behavior | Portrait-specific CSS exists, but Android orientation is not locked. | Missing | **Blocker for this portrait-only game.** |
| Screen standby | No wake-lock lifecycle exists. | Missing | **Must-fix.** |
| Haptics | A single `navigator.vibrate(12)` call occurs on boost. | Partial | **Expand and add graceful fallback.** |
| Android Back and lifecycle | No Capacitor App listener or app-background pause path exists. | Missing | **Must-fix.** |
| Assets and frame stability | Images are preloaded into `Image` objects, audio is generated on demand, and the canvas uses `requestAnimationFrame`; there is no boot gate, runtime quality tier, or native offline-asset plan. | Partial | **Must-fix for predictable APK delivery.** |

## 1. Mobile Screen, Cutouts, and Safe Areas

The game already includes an appropriate viewport declaration with `viewport-fit=cover`; it also applies `env(safe-area-inset-*)` to the mobile HUD, virtual joystick, boost control, notices, and portrait menu. This is the correct web-layer foundation. Android cutout behavior still needs native validation because important UI must never be placed directly in a cutout, even when the game is rendered edge-to-edge.[1]

### Required web-layer baseline

Keep the following viewport declaration in `client/index.html`. It is already present; do not remove `viewport-fit=cover` during native packaging.

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, maximum-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#d9e8f2" />
<meta name="mobile-web-app-capable" content="yes" />
```

Centralize safe-area spacing in `client/src/index.css` so every persistent HUD item uses the same protected insets. This should replace scattered hard-coded phone offsets gradually, not all at once.

```css
:root {
  --safe-top: max(12px, env(safe-area-inset-top, 0px));
  --safe-right: max(12px, env(safe-area-inset-right, 0px));
  --safe-bottom: max(16px, env(safe-area-inset-bottom, 0px));
  --safe-left: max(12px, env(safe-area-inset-left, 0px));
}

@media (max-width: 680px) {
  .game-hud {
    top: var(--safe-top);
    right: var(--safe-right);
    left: var(--safe-left);
  }

  .touch-controls {
    right: var(--safe-right);
    bottom: var(--safe-bottom);
    left: var(--safe-left);
  }

  .skybound-shell > .armory-notice {
    top: calc(var(--safe-top) + 132px);
  }
}
```

### Required Android edge-to-edge setting

After generating `android/`, add the following item to the existing app theme in `android/app/src/main/res/values/styles.xml`. Android allows content to extend under a cutout in this mode, so the CSS insets above remain essential for interactive controls.[1]

```xml
<style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">
    <!-- Keep the existing Capacitor theme items. -->
    <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
</style>
```

Test physical devices or emulators with at least a center punch-hole, waterdrop notch, and curved corners. Android specifically recommends simulating cutouts through Developer Options when a real test device is unavailable.[1]

## 2. Portrait Orientation and Screen Wake Lock

For Skybound Knight, portrait must be locked twice: once in Android native configuration so the first rendered frame is portrait, and again through Capacitor at runtime as a defensive check. Capacitor documents both the Android manifest approach and the `@capacitor/screen-orientation` plugin.[2] [3]

### Install the required native packages

```bash
pnpm add @capacitor/app @capacitor/screen-orientation
pnpm add -D @capacitor/cli
pnpm exec cap add android
pnpm exec cap sync android
```

The project currently has Android build scripts but no local Capacitor CLI. Also change `android:prepare` so it does not call `cap add android` every time; adding a platform is a one-time action.

```json
{
  "scripts": {
    "android:add": "cap add android",
    "android:sync": "pnpm run build && cap sync android",
    "android:apk": "pnpm run android:sync && cd android && ./gradlew assembleDebug",
    "android:release": "pnpm run android:sync && cd android && ./gradlew bundleRelease"
  }
}
```

### Lock portrait in the Android manifest

In the existing `<activity>` entry in `android/app/src/main/AndroidManifest.xml`, add only the `screenOrientation` attribute. Preserve Capacitor’s existing `configChanges`, launch mode, exported status, and theme attributes.

```xml
<activity
    android:name=".MainActivity"
    android:screenOrientation="portrait"
    ... >
```

### Lock portrait at runtime

Place this effect in `Home.tsx` after adding the package. It protects the WebView if a device changes orientation while the app is already open.

```tsx
import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";

useEffect(() => {
  if (!Capacitor.isNativePlatform()) return;

  void ScreenOrientation.lock({ orientation: "portrait" }).catch((error) => {
    console.warn("[Skybound] Portrait lock was unavailable", error);
  });

  return () => {
    void ScreenOrientation.unlock().catch(() => undefined);
  };
}, []);
```

> **Tablet note.** On Android 16 and higher, Capacitor’s runtime orientation lock has limitations on large screens. Portrait phone support is unaffected, but a tablet release should be tested as an adaptive layout rather than assuming the lock will always apply.[3]

### Keep the display awake only during active gameplay

The Screen Wake Lock API must be feature-detected, requested only while a run is active, released when the run pauses or ends, and reacquired after a visibility change when appropriate.[4]

```tsx
const wakeLockRef = useRef<WakeLockSentinel | null>(null);

const acquireWakeLock = useCallback(async () => {
  if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
  if (wakeLockRef.current && !wakeLockRef.current.released) return;

  try {
    const sentinel = await navigator.wakeLock.request("screen");
    wakeLockRef.current = sentinel;
    sentinel.addEventListener("release", () => {
      if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
    });
  } catch (error) {
    // Battery Saver, low battery, or browser policy can reject this request.
    console.info("[Skybound] Wake lock unavailable", error);
  }
}, []);

const releaseWakeLock = useCallback(async () => {
  const sentinel = wakeLockRef.current;
  wakeLockRef.current = null;
  if (sentinel && !sentinel.released) await sentinel.release();
}, []);

useEffect(() => {
  const running = screen === "playing" && modal === "none";
  if (running) void acquireWakeLock();
  else void releaseWakeLock();

  const onVisibilityChange = () => {
    if (document.hidden) {
      if (screenRef.current === "playing") pauseRun();
      void releaseWakeLock();
    } else if (screenRef.current === "playing" && modalRef.current === "none") {
      void acquireWakeLock();
    }
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    void releaseWakeLock();
  };
}, [screen, modal, acquireWakeLock, pauseRun, releaseWakeLock]);
```

Do not promise permanent screen-on behavior. The OS can release a lock due to battery saver, low battery, or inactive visibility, so the game should remain playable when the request is refused.[4]

## 3. Haptic Feedback and Touch Response

The current game already uses Pointer Events, pointer capture for the virtual joystick, and `touch-action: manipulation` on buttons and links. It also calls `navigator.vibrate(12)` on boost, which is a reasonable starting cue.

The Vibration API is limited-availability, requires a prior user interaction, can be disabled by the device’s sound or vibration settings, and replaces an in-progress pattern when a new vibration begins.[5] Use tiny, throttled effects and treat haptics as optional enhancement—not a game mechanic.

### Drop-in haptic helper

```tsx
type HapticEvent = "boost" | "landing" | "point" | "record" | "damage";

const HAPTIC_PATTERN: Record<HapticEvent, number | number[]> = {
  boost: 10,
  landing: 7,
  point: 6,
  record: [12, 34, 18],
  damage: 24,
};

const lastHapticAtRef = useRef(0);

const playHaptic = useCallback((event: HapticEvent) => {
  if (!isTouchFirst() || document.visibilityState !== "visible") return;

  const now = performance.now();
  if (now - lastHapticAtRef.current < 65) return;
  lastHapticAtRef.current = now;

  try {
    navigator.vibrate?.(HAPTIC_PATTERN[event]);
  } catch {
    // Vibration is deliberately non-critical.
  }
}, []);
```

Call the helper at event boundaries rather than every animation frame:

```tsx
// In useBoost()
playHaptic("boost");

// In the successful platform-landing branch
playHaptic("landing");

// When height points are awarded
playHaptic("point");

// In the guarded new-record block, only once per run
playHaptic("record");

// In the future damage or fail-state transition
playHaptic("damage");
```

For a public native release, add an optional **Haptics** setting and consider `@capacitor/haptics` for more consistent Android behavior. Keep the Vibration API fallback so the browser build retains its current behavior.

## 4. Android Back Button and App Lifecycle

The current game only maps `Escape` to pause. A Capacitor Android shell needs the App plugin so a physical Back press first pauses a run, then closes an open panel, then returns the player to the menu before minimizing the app. Capacitor’s `backButton` listener disables the default behavior, so the handler must define the complete sequence.[6]

### Install and use the App plugin

```bash
pnpm add @capacitor/app
pnpm exec cap sync android
```

Add the following effect in `Home.tsx`. It uses the current refs so the native callback always sees the current game state.

```tsx
import { App, type PluginListenerHandle } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

const returnToMenu = useCallback(() => {
  modalRef.current = "none";
  setModal("none");
  screenRef.current = "menu";
  setScreen("menu");
  pauseBgm();
}, [pauseBgm]);

useEffect(() => {
  if (!Capacitor.isNativePlatform()) return;

  let disposed = false;
  let backHandle: PluginListenerHandle | undefined;
  let stateHandle: PluginListenerHandle | undefined;

  void App.addListener("backButton", () => {
    if (modalRef.current !== "none") {
      closeModal();
      return;
    }

    if (screenRef.current === "playing") {
      pauseRun();
      return;
    }

    if (screenRef.current === "paused" || screenRef.current === "gameover") {
      returnToMenu();
      return;
    }

    // From the main menu, minimize instead of abruptly terminating the process.
    void App.minimizeApp();
  }).then((handle) => {
    if (disposed) void handle.remove();
    else backHandle = handle;
  });

  void App.addListener("appStateChange", ({ isActive }) => {
    if (!isActive && screenRef.current === "playing") pauseRun();
  }).then((handle) => {
    if (disposed) void handle.remove();
    else stateHandle = handle;
  });

  return () => {
    disposed = true;
    void backHandle?.remove();
    void stateHandle?.remove();
  };
}, [closeModal, pauseRun, returnToMenu]);
```

Test this exact sequence on a physical Android device: **playing → Back → paused; modal → Back → closed; paused/game-over → Back → menu; menu → Back → minimized**. Capacitor also exposes pause/resume and app-state events, which makes this lifecycle path suitable for phone calls, system dialogs, and app switching.[6]

## 5. Asset Preloading and 30/60 FPS Stability

### Current assessment

The code already preloads the `ART` image entries with `new Image()` and caps canvas device pixel ratio at `2`, both of which are positive steps. The BGM and effects are procedural Web Audio rather than downloaded audio files, so there are no SFX/BGM files to preload today. However, images are not gated behind a loading state, there is no quality tier for lower-end Android devices, and several current asset URLs are remote storage/CDN paths rather than bundled Android assets.

> **Critical APK asset risk.** A native APK should not assume `/manus-storage/...` or session CDN URLs are available offline inside a Capacitor WebView. Before release, either ship gameplay-critical assets inside the native web bundle or move them to a durable HTTPS asset origin with explicit online-first behavior. This is a launch blocker for an offline-capable APK.

### Lightweight image boot gate

Use this preloader for images. It decodes assets before the interactive menu appears and fails open if a non-critical image is unavailable.

```tsx
type AssetStatus = "loading" | "ready";

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = async () => {
      try {
        if ("decode" in image) await image.decode();
        resolve();
      } catch {
        resolve(); // The browser has still decoded enough to display the image.
      }
    };
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

const [assetStatus, setAssetStatus] = useState<AssetStatus>("loading");

useEffect(() => {
  let cancelled = false;
  const criticalImages = [ART.sky, ART.mark, ART.menu];

  void Promise.allSettled(criticalImages.map(preloadImage)).finally(() => {
    if (!cancelled) setAssetStatus("ready");
  });

  return () => {
    cancelled = true;
  };
}, []);

if (assetStatus === "loading") {
  return (
    <main className="skybound-boot" role="status" aria-live="polite">
      <span className="brand-crest" aria-hidden="true">✦</span>
      <p>Preparing the skyward route…</p>
    </main>
  );
}
```

For any future file-based BGM or SFX, fetch and decode the `AudioBuffer` only after the first tap; mobile browsers and WebViews can restrict audio-context work before user activation.

```tsx
async function preloadAudioBuffer(context: AudioContext, src: string) {
  const response = await fetch(src, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Audio preload failed: ${src}`);
  return context.decodeAudioData(await response.arrayBuffer());
}
```

### Adaptive quality tier

Preloading prevents first-use stalls; it cannot guarantee 60 FPS. For predictable low-end performance, lower the canvas pixel ratio on constrained phones while keeping the current 2× cap on stronger devices.

```tsx
function preferredCanvasRatio() {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  const lowEnd = memory <= 4 || cores <= 4;
  const cap = lowEnd ? 1.5 : 2;
  return Math.min(window.devicePixelRatio || 1, cap);
}

// In the current canvas resize function:
const ratio = preferredCanvasRatio();
canvas.width = Math.round(width * ratio);
canvas.height = Math.round(height * ratio);
context.setTransform(ratio, 0, 0, ratio, 0, 0);
```

Keep all per-frame work bounded: retain the current particle caps, avoid image allocation inside the animation loop, avoid layout reads during every frame, and profile gameplay on a low-end Android device before setting a 60 FPS target. A stable 30 FPS on entry-level hardware is preferable to irregular 60 FPS.

## Prioritized Launch Checklist

### Must-Fix Before a Public APK

| Priority | Item | Completion evidence |
| --- | --- | --- |
| P0 | Add the Capacitor CLI, generate `android/`, and make `android:sync` idempotent. | `pnpm run android:apk` produces an installable debug APK. |
| P0 | Package or durably host every gameplay-critical image; do not rely on transient storage/session paths for native offline play. | Airplane-mode launch reaches gameplay with sky, HUD, knight, and platforms visible. |
| P0 | Add manifest portrait lock and Capacitor runtime lock. | Repeated phone rotation never rotates an active run. |
| P0 | Add Android Back and app-state listeners. | Back pauses instead of exiting; backgrounding pauses safely. |
| P0 | Add wake-lock lifecycle and release behavior. | Active run keeps screen awake; pause, game over, menu, and background release it. |
| P1 | Apply the centralized safe-area variables and test punch-hole/notch devices. | HUD, shop/profile/settings controls, joystick, boost, and notices are all reachable. |
| P1 | Add a boot preloader plus adaptive canvas ratio. | No first-use artwork flash; no sustained frame spikes in a 10-minute run. |
| P1 | Configure signing, versionCode/versionName, Play App Signing, privacy disclosures, and release AAB output. | A signed release AAB installs on a clean device and passes Play Console checks. |

### Nice-to-Have Before Version 1.1

| Priority | Item | Benefit |
| --- | --- | --- |
| P2 | Add an in-game Haptics toggle and optional Capacitor Haptics implementation. | User control and more reliable native tactile feedback. |
| P2 | Add a graphics mode selector: Battery, Balanced, High. | Better behavior across entry-level and premium phones. |
| P2 | Add a one-screen first-run tutorial for joystick, boost, and pause. | Reduces early-run abandonment. |
| P2 | Add a lightweight frame-time counter visible only in debug builds. | Faster device-specific performance triage. |

## Device Test Matrix and Launch Gate

Before approving release, test a signed release build on at least one 720p/low-memory Android phone, one modern 1080p phone with a notch or punch-hole, and one Android 15/16 device. Run the test matrix in both Wi-Fi and airplane mode.

| Test | Pass condition |
| --- | --- |
| Cold launch | Boot gate resolves without a blank screen; all critical gameplay assets appear. |
| Cutout and corners | HUD, settings, shop, profile, joystick, boost, and notices remain visible and tappable. |
| Orientation | Rotation cannot interrupt or redraw the game in landscape. |
| Standby | Screen stays on only during active gameplay and releases outside gameplay. |
| Back/lifecycle | Back pauses first; incoming app switch or background transition pauses safely; resuming does not duplicate audio. |
| Performance | Ten-minute run shows no asset hitch, memory growth, or repeated audio distortion; entry device remains comfortably playable. |
| Offline assets | Airplane-mode run works if offline gameplay is a product promise; otherwise show an intentional offline error screen. |

## Recommended Release Sequence

Adopt **Capacitor**, not Cordova: the project is already configured around Capacitor’s Android runtime. Implement P0 items in a single native-readiness pass, generate and install the debug APK, complete device testing, then create a signed AAB for Play Console. Do not rely on the successful Cloudflare web deployment as proof of APK readiness—the native build has a separate WebView, asset, lifecycle, cutout, and signing surface.

## References

[1]: https://developer.android.com/develop/ui/views/layout/display-cutout "Android Developers: Support display cutouts"
[2]: https://capacitorjs.com/docs/guides/screen-orientation "Capacitor: Screen Orientation guide"
[3]: https://capacitorjs.com/docs/apis/screen-orientation "Capacitor: Screen Orientation plugin API"
[4]: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API "MDN: Screen Wake Lock API"
[5]: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate "MDN: Navigator.vibrate()"
[6]: https://capacitorjs.com/docs/apis/app "Capacitor: App plugin API"
