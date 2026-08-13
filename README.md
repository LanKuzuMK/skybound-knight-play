# Skybound Knight

> **An endless vertical fantasy platformer about keeping courage above the weather.**

[![Live web game](https://img.shields.io/badge/Play-Live%20web%20game-3d67be?style=flat-square)](https://skybound-knight-play.pages.dev)
[![Android ready](https://img.shields.io/badge/Android-Capacitor%208-3ddc84?style=flat-square)](./APK_BUILD.md)
[![License](https://img.shields.io/badge/License-MIT-f5b544?style=flat-square)](./LICENSE)

**Skybound Knight** is a responsive, browser-first platformer with a handcrafted **Dawnveil Reverie** visual language. Guide a tiny knight through an endless sky route, build height points, unlock visual styles, and chase a new horizon record on desktop or touch devices.

## Play

The web build is live at **[skybound-knight-play.pages.dev](https://skybound-knight-play.pages.dev)**. The same project includes a Capacitor Android wrapper; see [Android build instructions](./APK_BUILD.md) for local APK packaging.

## Highlights

| Area | Included experience |
| --- | --- |
| **Platforming** | Endless vertical ascent, moving platform routes, one-use aerial boost, camera scaling, and height-record progression. |
| **Personal progression** | Browser-local name, height points, high score, unlocked styles, and equipped character persistence. |
| **Audio** | Procedural lo-fi acoustic score, separate music/effects controls, night-sky transition, record cue, and a subtle HUD equalizer. |
| **Mobile play** | Left virtual joystick, right boost control, notch-aware spacing, touch-first controls, and adaptive canvas density. |
| **Android readiness** | Portrait lock, Back-to-pause behavior, background lifecycle pausing, optional wake lock, touch haptics, and Capacitor packaging. |

## Controls

| Platform | Move | Boost | Pause |
| --- | --- | --- | --- |
| **Desktop** | `A` / `D` or `←` / `→` | `Space` | `Esc` or the HUD pause control |
| **Mobile** | Left virtual joystick | Right-side boost button | HUD pause control or Android Back |

## Quick start

Skybound Knight uses **Node.js 22+** and **pnpm 10.18.1**.

```bash
pnpm install
pnpm run dev
```

Run the production checks before making a pull request or packaging a build:

```bash
pnpm run check
pnpm run build
```

## Android APK build

The native Android project is checked in. Install Android SDK Platform 36, Android Build Tools, and JDK 21, then run:

```bash
pnpm install
pnpm run android:sync
pnpm run android:apk
```

The debug APK is created at `android/app/build/outputs/apk/debug/app-debug.apk`. For a release package, use the signed-build guidance in **[APK_BUILD.md](./APK_BUILD.md)**.

> Generated Capacitor output such as `android/app/src/main/assets/public/`, `android/capacitor-cordova-android-plugins/`, and `android/local.properties` is intentionally excluded from Git. Run `pnpm run android:sync` after cloning to recreate it for the local machine.

## Project map

```text
client/
  src/pages/Home.tsx       Main game loop, canvas rendering, audio, and UI
  src/index.css            Dawnveil Reverie styling and responsive rules
  public/                  Small web configuration assets
android/                   Capacitor Android wrapper and Gradle project
APK_BUILD.md               Android setup, debug, and release guidance
SKYBOUND_KNIGHT_APK_READINESS_AUDIT.md
                           Native-readiness assessment and implementation notes
AUDIO_SOURCES.md           Audio design and sourcing notes
CONTRIBUTING.md            Local workflow and contribution expectations
CHANGELOG.md               Notable release history
```

## Player data and privacy

Skybound Knight stores player name, high score, height points, unlocks, equipped style, and audio preferences in browser or device-local storage. The game does not require an account or a remote database for core play.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup, quality checks, Android-specific rules, and a concise change workflow.

## License

This project is available under the [MIT License](./LICENSE). The original project artwork, title, and branding remain part of the Skybound Knight identity; consult the repository owner before redistributing branded game assets as a separate product.

