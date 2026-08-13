# Android APK Build — Skybound Knight

Skybound Knight remains a normal, inspectable web application while also being prepared for an Android wrapper through Capacitor. The game bundle is produced at `dist/public`, which is the exact folder configured as the Android web payload.

## One-time Android setup

Install Android Studio with the Android SDK and a compatible JDK. The project uses Capacitor Android 8. The Capacitor command-line package is declared as a development-only dependency; run the dependency installation once before using the commands below.

```bash
pnpm install
pnpm run android:prepare
```

The first command creates the `android/` native project and copies the current web build into it. After that initial setup, use the sync command whenever the web game changes.

## Build an installable debug APK

```bash
pnpm run android:apk
```

The APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Build a release bundle

```bash
pnpm run android:release
```

For Google Play distribution, open the generated Android project in Android Studio and configure a signing key before generating the final signed AAB or APK.

## Web inspectability and offline data

The browser version keeps semantic controls and explicit `data-*` game-state attributes in the DOM for normal developer-tools inspection. Player names, height points, scores, unlocks, and style selections persist locally in browser or phone storage under `skybound-profile-v2`; no remote account or external database is required.
