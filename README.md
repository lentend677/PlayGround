# Minion Rush — Banana Dash

A Subway Surfers–style 3D endless runner built for phones and tablets. Sprint down three subway tracks, dodge trains and barriers, slide under warning bars, and hoover up every banana in sight. Four minion-inspired skins are included, along with magnet and shield power-ups.

**Play:** open `index.html` through any static web server (the PlayGround preview does this automatically).

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Change lane | Swipe left / right | `←` `→` / `A` `D` |
| Jump | Swipe up | `↑` / `W` / `Space` |
| Roll / fast-fall | Swipe down | `↓` / `S` |
| Pause | Pause button | `P` / `Esc` |
| Restart | Run Again | `R` / `Enter` |

- **Optional tilt steering:** turn on *Tilt steering* on the menu, then lean left or right. On iOS 13+ the page asks for motion permission the first time — the request is triggered directly by your tap and requires HTTPS (localhost is also fine).
- Jump and roll swipes keep working while tilt steering is enabled.
- Progress, the selected skin, sound, and best score are saved locally in the browser.

## Features

- Three-lane endless runner with a proper 3D camera, speed ramp, and distance-based difficulty.
- Procedural minion characters (no third-party art): Kevin, Stuart, Bob, and Evil, with animated running, jumping, rolling, waving, blinking, and crash poses.
- Trains, striped roadblocks, overhead “DUCK!” bars, banana trails, magnet and shield power-ups.
- Touch-first UI, safe-area support for notched phones, portrait and landscape layouts.
- Synthesised music and sound effects via WebAudio — no audio files to download.
- No build step and no runtime dependencies beyond the vendored Three.js module.

## Tech

- [Three.js](https://threejs.org/) r160 (MIT) vendored in `src/three.module.min.js`
- Canvas-generated textures for the track, city facades, signs, trains, and effects
- Fredoka and Nunito fonts (SIL Open Font License, see `assets/fonts/`)
- Plain ES modules, CSS, and HTML

This is a fan-made project with original procedural artwork. It is not affiliated with, endorsed by, or containing assets from Illumination, Universal, or the Subway Surfers franchise.

---

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/lentend677/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/lentend677/PlayGround)

- 🎮 [Open the project](https://omgithub.com/lentend677/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=lentend677%2FPlayGround).
- 💻 [Explore the source](https://github.com/lentend677/PlayGround).
- 🛠️ [Check build runs](https://github.com/lentend677/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/lentend677/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/lentend677).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->
