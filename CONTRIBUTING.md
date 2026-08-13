# Contributing to Skybound Knight

Thank you for helping improve the sky route. This project is a React, TypeScript, Vite, Tailwind, and Capacitor game, with the primary game loop concentrated in `client/src/pages/Home.tsx`.

## Local setup

Install Node.js 22+ and pnpm 10.18.1, then prepare the workspace:

```bash
pnpm install
pnpm run dev
```

Before sharing a change, run both checks:

```bash
pnpm run check
pnpm run build
```

## Change expectations

Keep each change focused and preserve the **Dawnveil Reverie** material language: parchment-ivory surfaces, Dawnveil Blue actions, gilded accents, and readable field-note controls. Test desktop keyboard play and a narrow touch viewport whenever gameplay or HUD code changes.

| Change area | Minimum verification |
| --- | --- |
| Canvas, physics, or camera | Start a run, test steering and boost, then confirm the pause and game-over paths. |
| Shop, profile, or settings | Reload after changing a value and confirm local persistence behaves as expected. |
| Audio | Test mute, Music/SFX sliders, record cue, and pause/resume behavior. |
| Mobile controls | Test joystick movement, boost, safe-area spacing, and top-right controls on a narrow viewport. |
| Android wrapper | Run `pnpm run android:sync`; use JDK 21 and follow [APK_BUILD.md](./APK_BUILD.md) for a device build. |

## Android note

`android/local.properties`, copied web payloads, and Capacitor Cordova bridge files are machine-generated. Do not manually commit those outputs. Run this after changing web code:

```bash
pnpm run android:sync
```

## Commit messages

Use a concise imperative summary, such as `Refine mobile boost feedback` or `Repair Android startup configuration`. Include a short body when a change affects saved data, Android packaging, or platform controls.

## Reporting issues

When reporting a bug, include the device or browser, the route to reproduce it, what you expected, what happened, and a screenshot or error log when possible. Do not include keystore files, signing passwords, tokens, or personal player data.

