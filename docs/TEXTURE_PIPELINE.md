# AI Texture Pipeline

The game now applies external hull/surface textures at runtime. Replace the files below with AI-generated images to update the look without changing model geometry.

## Texture Slots

Put your generated images here (keep the same names):

- `public/assets/textures/generated/smallcraft_hull_v1.svg`
- `public/assets/textures/generated/freighter_hull_v1.svg`
- `public/assets/textures/generated/pirate_hull_v1.svg`
- `public/assets/textures/generated/asteroid_scrapiron_v1.svg`
- `public/assets/textures/generated/asteroid_waterice_v1.svg`
- `public/assets/textures/generated/asteroid_cobaltdust_v1.svg`
- `public/assets/textures/generated/asteroid_xenocrystal_v1.svg`
- `public/assets/textures/generated/asteroid_fringerelic_v1.svg`
- `public/assets/textures/generated/asteroid_depleted_v1.svg`

You can use `.png` files instead of `.svg` if you prefer. If you switch extension, update the paths in `src/App.tsx`.

## Generation Recommendations

- Size: `1024x1024` (or `2048x2048` for higher fidelity).
- Style: gritty cassette futurism, rusted industrial plating, chipped paint, grease streaks, weld seams.
- Palette rule: avoid blue hues in all assets.
- Lighting: flat/albedo style texture (no baked strong directional shadows).
- Tileability: ask for seamless or near-seamless textures.

## Prompt Starters

### Smallcraft
`Seamless hand-painted sci-fi hull texture, gritty cassette futurism, rusted orange-brown plates, yellow warning markings, chipped paint, oil streaks, worn steel, no blue, no logos, no text, flat albedo texture, high detail`

### Freighter
`Seamless industrial freighter hull texture, heavy panel seams, oxidized red and steel tones, grime buildup, rivets, patched plating, cassette futurism salvage aesthetic, no blue, no text, flat albedo texture, high detail`

### Pirate Ship
`Seamless raider ship hull texture, scarred crimson and charcoal plating, hazard-strip accents in warm tones, soot and scorch marks, rough welded panels, no blue, no logos, flat albedo texture, high detail`

### Asteroid (Per Ore Class)
`Seamless rocky asteroid surface texture, fractured mineral strata, dusty brown-gray stone, ore hint for {scrap iron|water ice|cobalt dust|xeno crystal|fringe relic} using warm tones only, no blue, no text, physically plausible rock albedo, high detail`

### Asteroid (Depleted)
`Seamless exhausted asteroid texture, dark spent rock, cracked matte charcoal mineral, minimal reflective flecks, no blue, no text, physically plausible rock albedo, high detail`

## Apply Changes

1. Replace texture files in `public/assets/textures/generated/`.
2. Restart or refresh `npm run dev`.
3. If you regenerate models too, run `npm run assets:generate`.
