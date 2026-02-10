# Powerball Salvage Run

A 3D browser game prototype set in a gritty cassette-futurist asteroid field. You launch from a passing freighter, dodge drifting rock, grab and drill asteroids, and bring cargo back before the freighter clears the belt and pirate pressure ends the run. Inspired by the Fringe Drifters universe.

## Current Prototype Features
- 3D asteroid field with moving and colliding asteroids.
- Smallcraft flight model with 6-axis thrust and orientation control.
- Collision-based hull damage that degrades handling.
- Grabber (`G`) and drill (`F`) mining loop.
- Mixed-value cargo resources with storage-volume limits.
- Dock/unload at freighter (`E`) for scored value.
- Mobile freighter transit past the belt edge with mission countdown to departure.
- Pirate event with independent boarding countdown (does not speed freighter departure).
- Rare powerball asteroids (1% spawn chance per asteroid) with long-range purple aura and separate powerball score tracking.
- Win/loss conditions:
  - Win: remain docked with freighter when it clears the belt.
  - Lose: freighter leaves without you, pirates board freighter, or your craft vents atmosphere.

## Controls
- Throttle step up: `W`
- Throttle step down: `S`
- Emergency stop (zero throttle + stop ship): `X`
- Aim craft: `Arrow Keys`
- Launch cargo canister forward (uses cargo from hold): `Space`
- Grab/release asteroid: `G`
- Drill while grabbed: `F`
- Dock / undock toggle: `E`

## Docking Rules
- Docking is persistent: press `E` once to dock, press `E` again to undock.
- While docked, cargo unloads over time and credits increase continuously.
- While docked, hull repairs over time.
- You must be docked when the freighter departure countdown ends to win.

## Tech Stack
- `Vite` + `React` + `TypeScript`
- `three`, `@react-three/fiber`, `@react-three/drei`

See `docs/PROJECT_PLAN.md` for roadmap and milestones.
See `docs/TEXTURE_PIPELINE.md` for AI-generated texture workflow and prompt templates.

## Local Development
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Generate Prototype 3D Assets
The repo includes a procedural asset generator that exports `.glb` files for the freighter, smallcraft, and asteroid variants:

```bash
npm run assets:generate
```

Outputs are written to:
- `public/assets/models/freighter_v1.glb`
- `public/assets/models/pirate_v1.glb`
- `public/assets/models/smallcraft_v1.glb`
- `public/assets/models/asteroid_01_v1.glb` ... `asteroid_05_v1.glb`

## Ship/Asteroid Textures
Runtime texture slots are in:

- `public/assets/textures/generated/smallcraft_hull_v1.svg`
- `public/assets/textures/generated/freighter_hull_v1.svg`
- `public/assets/textures/generated/pirate_hull_v1.svg`
- `public/assets/textures/generated/asteroid_scrapiron_v1.svg`
- `public/assets/textures/generated/asteroid_waterice_v1.svg`
- `public/assets/textures/generated/asteroid_cobaltdust_v1.svg`
- `public/assets/textures/generated/asteroid_xenocrystal_v1.svg`
- `public/assets/textures/generated/asteroid_fringerelic_v1.svg`
- `public/assets/textures/generated/asteroid_depleted_v1.svg`

Replace these with your AI-generated versions to update appearance without changing game code.

## Cloudflare Worker Deployment (Static Assets)
This repo is configured to deploy as a Cloudflare Worker that serves static assets from `dist/`.

Config file:
- `wrangler.toml`
- Includes custom domain route for `powerball.sirsean.me`

Local Worker dev:
```bash
npm run cf:dev
```

Deploy:
```bash
npm run cf:deploy
```

After deploy, Cloudflare will bind the Worker to `powerball.sirsean.me` via the custom-domain route in `wrangler.toml`.

First-time auth:
```bash
npx wrangler login
```
