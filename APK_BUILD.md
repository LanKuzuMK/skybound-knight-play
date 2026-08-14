# Android APK Build — Skybound Knight

Skybound Knight remains a normal, inspectable web application while also being packaged through Capacitor for Android. The game bundle is produced at `dist/public`, which is the exact folder copied into the Android WebView payload. The native `android/` project is included in this repository and the debug APK path has been verified locally.

## One-time Android setup

Install Android Studio with Android SDK Platform 36, Android Build Tools, and JDK 21. The project uses Capacitor Android 8 and already includes the Capacitor command-line package.

```bash
pnpm install --frozen-lockfile
pnpm run android:sync
```

Use `pnpm run android:sync` after every web-game change. If cloning an older branch without the native project, run `pnpm run android:add` once before syncing.

> **Why does GitHub not show every Android file?** Android SDK paths, copied web bundles, and the Capacitor Cordova bridge are generated for each local machine and intentionally ignored by Git. A successful `pnpm run android:sync` recreates them before Gradle builds the APK.

> **Signing security:** Keep `.jks` / `.keystore` files, `keystore.properties`, signing passwords, `.apk`, and `.aab` files outside Git. They are intentionally ignored and must never be committed to the public repository.

## Native launch safeguards

The Android wrapper locks the activity to portrait mode and uses a cutout-aware theme. In-game code also locks native orientation defensively, pauses when the app backgrounds, intercepts the Android Back action to pause or close overlays first, keeps the display awake only during an active climb when available, preloads visual assets before interaction, and applies restrained touch haptics for boost, landings, records, and falls.

The web build continues to work normally: these native-only features are guarded through Capacitor platform detection.

## Build an installable debug APK

```bash
pnpm run android:apk
```

The APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Build a release bundle

```bash
pnpm run android:release
```

For Google Play distribution, open the generated Android project in Android Studio, configure a signing key, increase `versionCode` and `versionName`, test on physical phones with a notch or punch-hole camera, and generate the signed AAB. The included debug APK is only for testing and must not be submitted to Google Play.

## Web inspectability and offline data

The browser version keeps semantic controls and explicit `data-*` game-state attributes in the DOM for normal developer-tools inspection. Player names, height points, scores, unlocks, and style selections persist locally in browser or phone storage under `skybound-profile-v2`; no remote account or external database is required.
