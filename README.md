# Stormfall Royale

A fast, mobile-first battle royale that runs entirely in the browser. Drop onto a stylized island, loot chests, outlast the shrinking storm, and be the last of 16 fighters standing. Built as an original game — no Fortnite assets, branding, or trademarks.

**Play:** open `index.html` through any static server, or run `PORT=3002 ./start.sh` from this folder.

## Features

- **16-player solo match** — you versus 15 bots with drop, loot, and combat AI.
- **Touch-first controls** — virtual joystick, drag-to-aim, and large action buttons with safe-area-aware HUD.
- **Optional tilt aiming** — lean your phone to fine-tune your shot. On iOS, motion access is requested from a user gesture (the tilt switch) and can be revoked at any time.
- **Desktop controls** — WASD movement, pointer-lock mouse aim, click to fire, plus full keyboard shortcuts.
- **Five points of interest** — each with its own silhouette, loot density, and chest placement.
- **Loot and rarities** — chests and floor loot grant weapons, shield potions, and building materials. Five rarity tiers from common to legendary.
- **Two weapon slots + pickaxe** — swap instantly, reload, and harvest wood with the pickaxe.
- **Building** — place walls and ramps in real time using harvested wood.
- **Shrinking storm** — multiple phases with escalating damage, visible storm wall, and a live minimap.
- **Original audiovisual style** — procedural low-poly island, stylized characters and gliders, synthesized WebAudio sound effects, and locally vendored fonts.
- **Full match flow** — menu, drop/glide intro, live HUD, killfeed, victory and defeat screens with stats, pause, settings, and instant rematch.
- **Performance options** — high and balanced quality presets; auto-pauses when the tab is hidden.

## Controls

### Desktop

| Action | Input |
| --- | --- |
| Move | `W` `A` `S` `D` or arrow keys |
| Sprint | `Shift` |
| Aim | Mouse (click the game to lock the pointer) |
| Fire | Left click |
| Aim down sights | Right click |
| Jump | `Space` |
| Reload | `R` |
| Build mode | `B` |
| Cycle build piece | `Q` |
| Place build | Left click or `F` |
| Switch weapon / pickaxe | `X` or `1` `2` `3` |
| Interact / open chest | `E` |
| Pause | `Esc` |

### Mobile / tablet

| Action | Input |
| --- | --- |
| Move | Left virtual joystick |
| Aim | Drag anywhere on the right side of the screen |
| Fire | Fire button (hold for automatic weapons) |
| Aim down sights | Aim button |
| Jump | Jump button |
| Reload | Reload button |
| Build / place | Build button, then tap the placement control |
| Switch weapon | Weapon slot buttons |
| Open chest | Interact button when prompted |
| Tilt aim | Settings → Tilt aiming (optional) |

The touch HUD appears automatically on coarse-pointer devices or narrow viewports, and respects display safe areas (notches, home indicators).

## Project layout

```
index.html          Markup, HUD, menus, modals, import map
styles.css          Responsive visual system and touch layout
src/main.js         Game boot, match loop, combat bridge, flow
src/player.js       Player controller, camera, shooting, building
src/bot.js          Bot models, drop, AI, combat
src/world.js        Island, POIs, colliders, chests, storm
src/character.js    Character, glider, and health-bar models
src/weapons.js      Weapon stats, rarities, procedural meshes
src/input.js        Touch, keyboard, mouse, and tilt input
src/ui.js           HUD, minimap, menus, killfeed, end screens
src/fx.js           Particles, tracers, muzzle flash
src/audio.js        Synthesized WebAudio sound effects
vendor/             Locally vendored Three.js
assets/             Locally vendored fonts
```

## Technical notes

- No build step and no framework; ES modules load directly via an import map.
- Three.js is vendored locally, so the game works offline once served.
- All geometry, textures, and sound effects are generated procedurally at runtime.
- Rendering falls back gracefully on software GPUs; use the Balanced quality preset for lower-end devices.

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
