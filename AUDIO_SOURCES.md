# Skybound Knight audio sourcing

The shipped game uses an original Web Audio soundscape for clicks, boosts, landings, unlocks, records, falls, and a restrained ambient motif. Its compressor, master gain, per-sound cooldowns, and active-voice cap are designed to avoid clipping and noisy overlap without requiring a third-party audio download.

For future recorded effects, keep a short source ledger with the downloaded file, author, asset page, license, date, and any edit made. Use one of the following sources only after checking the individual asset page.

| Use case | Recommended source | Safe selection rule |
|---|---|---|
| Jump, landing, UI clicks | [Pixabay Sound Effects](https://pixabay.com/sound-effects/) | Pixabay permits free use, adaptation, and does not require attribution, subject to its content-license restrictions. Do not redistribute an asset as a standalone audio file. [1] |
| Arcane chimes, wind, cloud ambience | [Freesound](https://freesound.org/) | Filter for **CC0** for the least restrictive route. CC-BY needs credit; do not use CC-BY-NC in a commercial game. [2] |
| Game-ready effect packs | [OpenGameArt](https://opengameart.org/) | Prefer **CC0** assets. CC-BY / OGA-BY can be used commercially when attributed; read the asset-specific license before release. [3] |

For all selected recordings, export short one-shot SFX as mono 44.1 kHz `.ogg` or `.mp3`, leave 40–70 ms of clean tail, normalize conservatively, and keep individual source gains below the global master ceiling.

## References

[1]: https://pixabay.com/service/license-summary/ "Pixabay Content License summary"
[2]: https://freesound.org/help/faq/ "Freesound FAQ — licenses"
[3]: https://opengameart.org/content/faq "OpenGameArt FAQ — licenses and attribution"
