# Fringe Drifters Salvage Run - Project Plan

## Vision
Build a 3D browser game where a pilot launches from a freighter into a hazardous asteroid field, mines and returns cargo, and survives escalating threats before the freighter jumps.

## Chosen Stack
- Frontend/runtime: Vite + React + TypeScript
- 3D engine layer: Three.js via React Three Fiber (`@react-three/fiber`, `@react-three/drei`)
- Game architecture: deterministic frame-step simulation module (`src/game/runtime.ts`) separated from rendering
- Deploy target: Cloudflare Pages (static `dist/` output)

## Why This Stack
- Works directly in modern browsers with no plugin/runtime install.
- Fast local iteration with HMR for gameplay tuning.
- Three.js ecosystem is mature for custom 3D game mechanics and art direction.
- Cloudflare Pages serves a Vite static bundle with very low ops overhead.

## Milestones
1. Core Prototype (Completed)
- 3D asteroid field with moving/colliding asteroids of mixed size.
- Player craft movement, collision damage, and reduced maneuverability from hull damage.
- Grabber + drilling + finite asteroid ore reserve.
- Multi-resource cargo hold with value and capacity constraints.
- Freighter dock unload loop and score accumulation.
- Countdown, pirate event, freighter boarding risk, and full win/loss conditions.
- Cassette-futurist HUD and scene styling.

2. Content Depth (Planned)
- Distinct asteroid classes and richer mineral composition simulation.
- Pirate AI variants (interceptors, boarders, harassment fire).
- Freighter interior/crew interactions and mission modifiers.
- Audio design and adaptive tension layering.

3. Production Readiness (Planned)
- Save/load progression, run meta-progression, and balancing pass.
- Performance profiling across desktop/mobile tiers.
- Accessibility pass and control remapping.
- Art pipeline for final ship/asteroid assets.

4. Live Ops & Expansion (Planned)
- Daily contracts and leaderboard mode.
- Expanded Fringe faction encounters.
- Cloudflare analytics + A/B tuning loop.

## Immediate Next Sprint
1. Replace primitive meshes with optimized GLTF assets matching The Fringe visual language.
2. Add weapon/defense layer for pirate encounters.
3. Add upgrade economy for cargo, drill, hull, and thrusters.
4. Integrate audio and postprocessing polish.
