# Deployment QA notes

- Cloudflare Pages loaded successfully at `https://skybound-knight-play.pages.dev` after commit `b34b363`.
- The public Skyward Armory lists **Aether Mage** as style 03 with a 120-height-point unlock requirement.
- A temporary browser-local test profile was prepared with 150 height points for the Mage transaction. The browser session became unavailable during the reload, so the final click-through confirmation relies on the validated transaction code and production build.
- GitHub repository visibility was confirmed as public on 2026-08-14 after commit `ba90303`; the landing page shows the proprietary All Rights Reserved notice, live-game homepage, README, license, Android guide, and contributor workflow.
- A tracked-file and full-history scan found no signing keys, environment files, keystore properties, or common plaintext secret patterns. Root ignore rules now block signing keys, keystore files, Android local configuration, and APK/AAB artifacts.
