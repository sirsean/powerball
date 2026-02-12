import { MathUtils, Vector3 } from 'three'

export type ResourceId =
  | 'scrapIron'
  | 'waterIce'
  | 'cobaltDust'
  | 'xenoCrystal'
  | 'fringeRelic'

export interface ResourceDef {
  id: ResourceId
  label: string
  value: number
  volume: number
  color: string
}

export interface CargoBin {
  resourceId: ResourceId
  units: number
  volume: number
  value: number
}

export interface EventEntry {
  id: number
  tone: 'info' | 'alert' | 'good'
  message: string
}

export type GameStatus = 'active' | 'won' | 'lost'

export type PirateState = 'quiet' | 'incoming' | 'disabled' | 'boarding'

export interface AsteroidSim {
  id: number
  radius: number
  position: Vector3
  velocity: Vector3
  rotationSpeed: Vector3
  oreReserve: number
  maxOreReserve: number
  primaryResourceId: ResourceId
  hasPowerball: boolean
  powerballRecovered: boolean
  composition: Array<{ resourceId: ResourceId; weight: number }>
  baseColor: string
}

export interface CargoShot {
  id: number
  shotType: 'cargo' | 'weapon'
  resourceId: ResourceId | null
  position: Vector3
  velocity: Vector3
  life: number
  radius: number
  damage: number
  delayBonus: number
  color: string
}

export interface GameRuntime {
  runId: number
  rng: () => number
  elapsed: number
  missionSeconds: number
  countdownRate: number
  freighterPosition: Vector3
  playerPosition: Vector3
  playerVelocity: Vector3
  throttleLevel: number
  thrusterMultiplier: number
  drillMultiplier: number
  docked: boolean
  dockedPosition: Vector3
  unloadAccumulator: number
  dockUnloadStartUnits: number
  dockRepairStartDeficit: number
  playerYaw: number
  playerPitch: number
  hull: number
  maxHull: number
  collisionGrace: number
  grabbedAsteroidId: number | null
  drillActive: boolean
  drillAccumulator: number
  asteroidDepletionSerial: number
  grabberRange: number
  cargoBins: Record<ResourceId, CargoBin>
  cargoUsed: number
  cargoCapacity: number
  cargoValue: number
  deliveredValue: number
  powerballCargo: number
  deliveredPowerballScore: number
  weaponAmmo: number
  weaponMaxAmmo: number
  weaponDamage: number
  rammerDamageMultiplier: number
  rammerSelfDamageMultiplier: number
  asteroids: AsteroidSim[]
  cargoShots: CargoShot[]
  cargoShotSerial: number
  pirateState: PirateState
  piratePosition: Vector3
  pirateVelocity: Vector3
  pirateOrbitAngle: number
  pirateTriggerAt: number
  pirateBoardTimer: number
  pirateHull: number
  pirateMaxHull: number
  pirateRamGrace: number
  pirateAsteroidGrace: number
  status: GameStatus
  outcomeReason: string
  events: EventEntry[]
  eventSerial: number
  prevKeys: Record<string, boolean>
  cargoFullWarned: boolean
}

export interface HudResourceBin {
  resourceId: ResourceId
  label: string
  units: number
  volume: number
  value: number
  color: string
}

export interface HudSnapshot {
  runId: number
  status: GameStatus
  outcomeReason: string
  elapsed: number
  missionSeconds: number
  hull: number
  maxHull: number
  throttleLevel: number
  cargoUsed: number
  cargoCapacity: number
  cargoValue: number
  deliveredValue: number
  powerballCargo: number
  deliveredPowerballScore: number
  distanceToFreighter: number
  freighterRelativeAngleDeg: number
  docked: boolean
  dockUnloadProgress: number
  dockRepairProgress: number
  dockUnloadRemainingUnits: number
  dockRepairRemainingHull: number
  grabbedAsteroidId: number | null
  drillActive: boolean
  grabberRange: number
  grabberReady: boolean
  grabberTargetId: number | null
  grabberTargetDistance: number | null
  pirateState: PirateState
  pirateBoardEta: number
  pirateHull: number
  pirateMaxHull: number
  weaponAmmo: number
  weaponMaxAmmo: number
  resourceBins: HudResourceBin[]
  events: EventEntry[]
}

export interface RunModifiers {
  grabberRange: number
  thrusterMultiplier: number
  drillMultiplier: number
  maxHull: number
  cargoCapacity: number
  weaponAmmo: number
  weaponDamage: number
  rammerDamageMultiplier: number
  rammerSelfDamageMultiplier: number
  pirateEncounterChance: number
}

export interface ControlInput {
  keys: Record<string, boolean>
}

const ASTEROID_FIELD_BOUNDS = {
  minX: -72,
  maxX: 82,
  minY: -35,
  maxY: 35,
  minZ: -68,
  maxZ: 68,
}

const FLIGHT_BOUNDS = {
  minX: -176,
  maxX: 176,
  minY: -72,
  maxY: 72,
  minZ: -176,
  maxZ: 176,
}

const ASTEROID_TRAVEL_BOUNDS = {
  minX: FLIGHT_BOUNDS.minX - 220,
  maxX: FLIGHT_BOUNDS.maxX + 220,
  minY: FLIGHT_BOUNDS.minY - 70,
  maxY: FLIGHT_BOUNDS.maxY + 70,
  minZ: FLIGHT_BOUNDS.minZ - 220,
  maxZ: FLIGHT_BOUNDS.maxZ + 220,
}

const ASTEROID_COUNT = 44
const PLAYER_RADIUS = 2.05
const ASTEROID_DRAG = 0.9992
const ASTEROID_COLLISION_RESTITUTION = 0.82
const TOTAL_MISSION_SECONDS = 320
const DOCK_RADIUS = 16
const DOCK_APPROACH_RADIUS = 30
const ORE_EXTRACT_RATE = 1.35
const THROTTLE_STEP = 0.2
const PIRATE_RADIUS = 2.8
const CARGO_SHOT_RADIUS = 0.72
const CARGO_SHOT_LIFETIME = 5
const CARGO_SHOT_SPEED = 34
const RAM_DELAY_MIN_IMPACT = 2.3
const ASTEROID_PIRATE_IMPACT_MIN_SPEED = 1.6
const ASTEROID_PIRATE_IMPACT_GRACE = 0.58
const DOCK_REPAIR_PER_SECOND = 14
const DOCK_UNLOAD_UNITS_PER_SECOND = 3.2
const GRABBER_ANCHOR_PULL = 4.4
const GRABBED_ASTEROID_DAMPING_RATE = 0.42
const ASTEROID_FLING_BASE_SPEED = 8.2
const ASTEROID_FLING_FORWARD_SCALE = 1.05
const ASTEROID_FLING_THROTTLE_BONUS = 7
const ASTEROID_FLING_PLAYER_VELOCITY_SHARE = 0.72
const BASE_GRABBER_RANGE = 7.5
const BASE_THRUSTER_MULTIPLIER = 1
const BASE_DRILL_MULTIPLIER = 1
const BASE_MAX_HULL = 100
const BASE_CARGO_CAPACITY = 130
const BASE_WEAPON_AMMO = 0
const BASE_WEAPON_DAMAGE = 0
const BASE_RAMMER_DAMAGE_MULTIPLIER = 1
const BASE_RAMMER_SELF_DAMAGE_MULTIPLIER = 1
const BASE_PIRATE_ENCOUNTER_CHANCE = 1

const FREIGHTER_EDGE_X = ASTEROID_FIELD_BOUNDS.minX - 24
const FREIGHTER_TRANSIT_START = new Vector3(FREIGHTER_EDGE_X, 0, ASTEROID_FIELD_BOUNDS.minZ)
const FREIGHTER_TRANSIT_END = new Vector3(FREIGHTER_EDGE_X, 0, ASTEROID_FIELD_BOUNDS.maxZ)
export const FREIGHTER_INITIAL_POSITION = FREIGHTER_TRANSIT_START.clone()
export const FREIGHTER_DOCK_RADIUS = DOCK_RADIUS
export const FREIGHTER_DOCK_APPROACH_RADIUS = DOCK_APPROACH_RADIUS
export const PIRATE_HULL_MAX = 120

const CONTROL_CODES = [
  'KeyW',
  'KeyS',
  'Space',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'KeyG',
  'KeyF',
  'KeyQ',
  'KeyE',
  'KeyX',
] as const

const RESOURCES: Record<ResourceId, ResourceDef> = {
  scrapIron: {
    id: 'scrapIron',
    label: 'Scrap Iron',
    value: 12,
    volume: 3,
    color: '#886e52',
  },
  waterIce: {
    id: 'waterIce',
    label: 'Water Ice',
    value: 18,
    volume: 5,
    color: '#c2c0b7',
  },
  cobaltDust: {
    id: 'cobaltDust',
    label: 'Cobalt Dust',
    value: 34,
    volume: 4,
    color: '#7c674f',
  },
  xenoCrystal: {
    id: 'xenoCrystal',
    label: 'Xeno Crystal',
    value: 88,
    volume: 2,
    color: '#a0ad7d',
  },
  fringeRelic: {
    id: 'fringeRelic',
    label: 'Fringe Relic',
    value: 240,
    volume: 6,
    color: '#d6bf7e',
  },
}

const MIN_RESOURCE_VOLUME = Math.min(...Object.values(RESOURCES).map((resource) => resource.volume))

function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 4294967296
  }
}

function randomRange(rng: () => number, min: number, max: number) {
  return min + (max - min) * rng()
}

function weightedPick<T extends string>(
  rng: () => number,
  weighted: Array<{ item: T; weight: number }>,
): T {
  let total = 0
  for (const candidate of weighted) total += candidate.weight
  let roll = rng() * total
  for (const candidate of weighted) {
    roll -= candidate.weight
    if (roll <= 0) return candidate.item
  }
  return weighted[weighted.length - 1].item
}

function createCargoBins(): Record<ResourceId, CargoBin> {
  return {
    scrapIron: { resourceId: 'scrapIron', units: 0, volume: 0, value: 0 },
    waterIce: { resourceId: 'waterIce', units: 0, volume: 0, value: 0 },
    cobaltDust: { resourceId: 'cobaltDust', units: 0, volume: 0, value: 0 },
    xenoCrystal: { resourceId: 'xenoCrystal', units: 0, volume: 0, value: 0 },
    fringeRelic: { resourceId: 'fringeRelic', units: 0, volume: 0, value: 0 },
  }
}

function getCargoUnitCount(runtime: GameRuntime) {
  return Object.values(runtime.cargoBins).reduce((sum, bin) => sum + bin.units, 0)
}

function toProgress(value: number) {
  return MathUtils.clamp(value, 0, 1)
}

function createAsteroid(rng: () => number, id: number, oreQualityBias: number): AsteroidSim {
  const qualityBias = MathUtils.clamp(oreQualityBias, 0, 1)
  const radius = randomRange(rng, 1.7, 5.4)
  const initialOre = Math.max(3, Math.floor((randomRange(rng, 6, 16) + radius * 1.5) * 0.5))
  const hasPowerball = rng() < 0.01
  const position = new Vector3(
    randomRange(rng, -54, 78),
    randomRange(rng, -30, 30),
    randomRange(rng, -60, 60),
  )

  const drift = randomRange(rng, 0.8, 2.9)
  const velocity = new Vector3(
    randomRange(rng, -1, 1),
    randomRange(rng, -1, 1),
    randomRange(rng, -1, 1),
  )
    .normalize()
    .multiplyScalar(drift)

  const primary = weightedPick(rng, [
    { item: 'scrapIron' as const, weight: Math.max(1, 46 * (1 - 0.5 * qualityBias)) },
    { item: 'waterIce' as const, weight: Math.max(1, 20 * (1 - 0.25 * qualityBias)) },
    { item: 'cobaltDust' as const, weight: Math.max(1, 18 * (1 + 0.22 * qualityBias)) },
    { item: 'xenoCrystal' as const, weight: Math.max(1, 12 * (1 + 0.9 * qualityBias)) },
    { item: 'fringeRelic' as const, weight: Math.max(1, 4 * (1 + 1.7 * qualityBias)) },
  ])

  const composition: Array<{ resourceId: ResourceId; weight: number }> = [
    { resourceId: primary, weight: 0.56 + qualityBias * 0.14 },
    { resourceId: 'scrapIron', weight: Math.max(0.08, 0.17 - qualityBias * 0.09) },
    { resourceId: 'waterIce', weight: Math.max(0.09, 0.13 - qualityBias * 0.04) },
    { resourceId: 'cobaltDust', weight: 0.08 + qualityBias * 0.03 },
    { resourceId: 'xenoCrystal', weight: 0.05 + qualityBias * 0.06 },
    { resourceId: 'fringeRelic', weight: 0.01 + qualityBias * 0.04 },
  ]

  return {
    id,
    radius,
    position,
    velocity,
    rotationSpeed: new Vector3(
      randomRange(rng, -0.32, 0.32),
      randomRange(rng, -0.32, 0.32),
      randomRange(rng, -0.32, 0.32),
    ),
    oreReserve: initialOre,
    maxOreReserve: initialOre,
    primaryResourceId: primary,
    hasPowerball,
    powerballRecovered: false,
    composition,
    baseColor: RESOURCES[primary].color,
  }
}

function addEvent(runtime: GameRuntime, message: string, tone: EventEntry['tone'] = 'info') {
  runtime.eventSerial += 1
  runtime.events.unshift({ id: runtime.eventSerial, tone, message })
  runtime.events = runtime.events.slice(0, 6)
}

const DEFAULT_RUN_MODIFIERS: RunModifiers = {
  grabberRange: BASE_GRABBER_RANGE,
  thrusterMultiplier: BASE_THRUSTER_MULTIPLIER,
  drillMultiplier: BASE_DRILL_MULTIPLIER,
  maxHull: BASE_MAX_HULL,
  cargoCapacity: BASE_CARGO_CAPACITY,
  weaponAmmo: BASE_WEAPON_AMMO,
  weaponDamage: BASE_WEAPON_DAMAGE,
  rammerDamageMultiplier: BASE_RAMMER_DAMAGE_MULTIPLIER,
  rammerSelfDamageMultiplier: BASE_RAMMER_SELF_DAMAGE_MULTIPLIER,
  pirateEncounterChance: BASE_PIRATE_ENCOUNTER_CHANCE,
}

export function createRuntime(seed = Date.now(), modifiers: Partial<RunModifiers> = {}): GameRuntime {
  const rng = seededRandom(seed)
  const runMods: RunModifiers = { ...DEFAULT_RUN_MODIFIERS, ...modifiers }
  const pirateEncounterChance = MathUtils.clamp(runMods.pirateEncounterChance, 0, 1)
  const pirateWillSpawn = rng() < pirateEncounterChance
  const oreQualityBias = MathUtils.clamp((pirateEncounterChance - 0.16) / 0.68, 0, 1)
  const asteroids = Array.from({ length: ASTEROID_COUNT }, (_, id) => createAsteroid(rng, id, oreQualityBias))
  const freighterPosition = FREIGHTER_TRANSIT_START.clone()

  const runtime: GameRuntime = {
    runId: seed,
    rng,
    elapsed: 0,
    missionSeconds: TOTAL_MISSION_SECONDS,
    countdownRate: 1,
    freighterPosition,
    playerPosition: freighterPosition.clone().add(new Vector3(17, 0, 6)),
    playerVelocity: new Vector3(0, 0, 0),
    throttleLevel: 0,
    thrusterMultiplier: runMods.thrusterMultiplier,
    drillMultiplier: runMods.drillMultiplier,
    docked: false,
    dockedPosition: new Vector3(17, 0, 0),
    unloadAccumulator: 0,
    dockUnloadStartUnits: 0,
    dockRepairStartDeficit: 0,
    playerYaw: Math.PI / 2,
    playerPitch: 0,
    hull: runMods.maxHull,
    maxHull: runMods.maxHull,
    collisionGrace: 0,
    grabbedAsteroidId: null,
    drillActive: false,
    drillAccumulator: 0,
    asteroidDepletionSerial: 0,
    grabberRange: runMods.grabberRange,
    cargoBins: createCargoBins(),
    cargoUsed: 0,
    cargoCapacity: runMods.cargoCapacity,
    cargoValue: 0,
    deliveredValue: 0,
    powerballCargo: 0,
    deliveredPowerballScore: 0,
    weaponAmmo: runMods.weaponAmmo,
    weaponMaxAmmo: runMods.weaponAmmo,
    weaponDamage: runMods.weaponDamage,
    rammerDamageMultiplier: Math.max(1, runMods.rammerDamageMultiplier),
    rammerSelfDamageMultiplier: MathUtils.clamp(runMods.rammerSelfDamageMultiplier, 0.2, 1),
    asteroids,
    cargoShots: [],
    cargoShotSerial: 0,
    pirateState: 'quiet',
    piratePosition: freighterPosition.clone().add(new Vector3(160, 16, -40)),
    pirateVelocity: new Vector3(),
    pirateOrbitAngle: randomRange(rng, 0, Math.PI * 2),
    pirateTriggerAt: pirateWillSpawn ? randomRange(rng, 70, 160) : Number.POSITIVE_INFINITY,
    pirateBoardTimer: Infinity,
    pirateHull: PIRATE_HULL_MAX,
    pirateMaxHull: PIRATE_HULL_MAX,
    pirateRamGrace: 0,
    pirateAsteroidGrace: 0,
    status: 'active',
    outcomeReason: '',
    events: [],
    eventSerial: 0,
    prevKeys: {},
    cargoFullWarned: false,
  }

  addEvent(runtime, 'Freighter hails: launch window open. Mine fast before we pass beyond the belt.', 'info')
  return runtime
}

function getForwardVector(yaw: number, pitch: number) {
  const cp = Math.cos(pitch)
  return new Vector3(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp).normalize()
}

export function getPlayerForward(runtime: GameRuntime) {
  return getForwardVector(runtime.playerYaw, runtime.playerPitch)
}

function isDown(keys: Record<string, boolean>, code: string) {
  return Boolean(keys[code])
}

function justPressed(runtime: GameRuntime, keys: Record<string, boolean>, code: string) {
  return isDown(keys, code) && !runtime.prevKeys[code]
}

function updatePrevKeys(runtime: GameRuntime, keys: Record<string, boolean>) {
  for (const code of CONTROL_CODES) {
    runtime.prevKeys[code] = isDown(keys, code)
  }
}

function clampPlayerToField(runtime: GameRuntime) {
  const p = runtime.playerPosition

  if (p.x < FLIGHT_BOUNDS.minX) {
    p.x = FLIGHT_BOUNDS.minX
    runtime.playerVelocity.x *= -0.45
  }
  if (p.x > FLIGHT_BOUNDS.maxX) {
    p.x = FLIGHT_BOUNDS.maxX
    runtime.playerVelocity.x *= -0.45
  }
  if (p.y < FLIGHT_BOUNDS.minY) {
    p.y = FLIGHT_BOUNDS.minY
    runtime.playerVelocity.y *= -0.45
  }
  if (p.y > FLIGHT_BOUNDS.maxY) {
    p.y = FLIGHT_BOUNDS.maxY
    runtime.playerVelocity.y *= -0.45
  }
  if (p.z < FLIGHT_BOUNDS.minZ) {
    p.z = FLIGHT_BOUNDS.minZ
    runtime.playerVelocity.z *= -0.45
  }
  if (p.z > FLIGHT_BOUNDS.maxZ) {
    p.z = FLIGHT_BOUNDS.maxZ
    runtime.playerVelocity.z *= -0.45
  }
}

function updateFreighterTransit(runtime: GameRuntime) {
  const progress = MathUtils.clamp((TOTAL_MISSION_SECONDS - runtime.missionSeconds) / TOTAL_MISSION_SECONDS, 0, 1)
  runtime.freighterPosition.lerpVectors(FREIGHTER_TRANSIT_START, FREIGHTER_TRANSIT_END, progress)
}

function applyFreighterDockActions(runtime: GameRuntime, keys: Record<string, boolean>) {
  if (!justPressed(runtime, keys, 'KeyE')) return

  if (runtime.docked) {
    runtime.docked = false
    runtime.unloadAccumulator = 0
    runtime.dockUnloadStartUnits = 0
    runtime.dockRepairStartDeficit = 0
    addEvent(runtime, 'Dock clamps released. You are clear to launch.', 'info')
    return
  }

  const distanceToFreighter = runtime.playerPosition.distanceTo(runtime.freighterPosition)
  if (distanceToFreighter > DOCK_APPROACH_RADIUS) {
    addEvent(runtime, 'Too far from freighter docking collar.', 'alert')
    return
  }

  const dockVector = runtime.playerPosition.clone().sub(runtime.freighterPosition)
  if (dockVector.lengthSq() < 0.0001) {
    dockVector.set(1, 0, 0)
  } else {
    dockVector.normalize()
  }

  if (distanceToFreighter > DOCK_RADIUS) {
    runtime.playerPosition.copy(runtime.freighterPosition).addScaledVector(dockVector, DOCK_RADIUS - 1.6)
    addEvent(runtime, 'Docking assist engaged. Clamp locks secured.', 'good')
  }

  runtime.docked = true
  runtime.dockedPosition.copy(runtime.playerPosition).sub(runtime.freighterPosition)
  runtime.playerVelocity.set(0, 0, 0)
  runtime.throttleLevel = 0
  runtime.grabbedAsteroidId = null
  runtime.unloadAccumulator = 0
  runtime.dockUnloadStartUnits = getCargoUnitCount(runtime) + runtime.powerballCargo
  runtime.dockRepairStartDeficit = Math.max(0, runtime.maxHull - runtime.hull)
  addEvent(runtime, 'Docking complete. Cargo transfer and repairs underway.', 'good')
}

function triggerPirateEvent(runtime: GameRuntime) {
  runtime.pirateState = 'incoming'
  runtime.pirateBoardTimer = randomRange(runtime.rng, 40, 68)
  runtime.pirateHull = runtime.pirateMaxHull
  runtime.pirateRamGrace = 0
  runtime.pirateAsteroidGrace = 0
  runtime.piratePosition.copy(runtime.freighterPosition).add(new Vector3(22, 9, -18))
  runtime.pirateVelocity.set(0, 0, 0)

  addEvent(runtime, 'Distress call: pirate raider inbound. Hold it off before boarding.', 'alert')
}

function updatePirate(runtime: GameRuntime, dt: number) {
  if (runtime.pirateState === 'quiet' && runtime.elapsed >= runtime.pirateTriggerAt) {
    triggerPirateEvent(runtime)
  }

  if (runtime.pirateState !== 'incoming') return

  runtime.pirateBoardTimer = Math.max(0, runtime.pirateBoardTimer - dt)

  runtime.pirateOrbitAngle += dt * 0.85
  const orbitRadius = 16 + Math.sin(runtime.elapsed * 0.55) * 2.8
  const pirateTarget = runtime.freighterPosition.clone().add(
    new Vector3(
      Math.cos(runtime.pirateOrbitAngle) * orbitRadius,
      2.4 + Math.sin(runtime.pirateOrbitAngle * 2.2) * 1.7,
      Math.sin(runtime.pirateOrbitAngle) * orbitRadius,
    ),
  )
  const toTarget = pirateTarget.sub(runtime.piratePosition)
  const distance = toTarget.length()

  if (distance > 0.001) {
    toTarget.normalize()
    runtime.pirateVelocity.lerp(toTarget.multiplyScalar(18), 1 - Math.exp(-dt * 2.3))
    runtime.piratePosition.addScaledVector(runtime.pirateVelocity, dt)
  }

  if (runtime.pirateBoardTimer <= 0) {
    runtime.pirateState = 'boarding'
    runtime.piratePosition.copy(runtime.freighterPosition).add(new Vector3(5, 0.2, -2))
    runtime.pirateVelocity.set(0, 0, 0)
    runtime.status = 'lost'
    runtime.outcomeReason = 'Pirates boarded the freighter before it cleared the belt.'
    addEvent(runtime, runtime.outcomeReason, 'alert')
  }
}

function disablePirate(runtime: GameRuntime) {
  runtime.pirateState = 'disabled'
  runtime.pirateVelocity.set(0, 0, 0)
  runtime.pirateBoardTimer = Infinity
  addEvent(runtime, 'Pirate drive core disabled. Boarding threat neutralized.', 'good')
}

function applyPirateDamage(runtime: GameRuntime, damage: number) {
  if (runtime.pirateState !== 'incoming' || damage <= 0) return false

  runtime.pirateHull = Math.max(0, runtime.pirateHull - damage)
  if (runtime.pirateHull > 0) return false

  disablePirate(runtime)
  return true
}

function smoothAxis(current: number, target: number, rate: number, dt: number) {
  const alpha = 1 - Math.exp(-rate * dt)
  return current + (target - current) * alpha
}

function updatePlayerControlWithInput(runtime: GameRuntime, dt: number, input: ControlInput) {
  const { keys } = input
  const hullFactor = MathUtils.clamp(runtime.hull / runtime.maxHull, 0.25, 1)

  const keyboardYaw = (isDown(keys, 'ArrowLeft') ? 1 : 0) - (isDown(keys, 'ArrowRight') ? 1 : 0)
  const keyboardPitch = (isDown(keys, 'ArrowUp') ? 1 : 0) - (isDown(keys, 'ArrowDown') ? 1 : 0)

  const yawRate = 1.7 * hullFactor + 0.35
  const pitchRate = 1.3 * hullFactor + 0.3
  runtime.playerYaw += keyboardYaw * yawRate * dt
  runtime.playerPitch += keyboardPitch * pitchRate * dt
  runtime.playerPitch = MathUtils.clamp(runtime.playerPitch, -1.1, 1.1)

  const forward = getPlayerForward(runtime)
  const brake = isDown(keys, 'KeyX')

  if (justPressed(runtime, keys, 'KeyW')) {
    runtime.throttleLevel = MathUtils.clamp(runtime.throttleLevel + THROTTLE_STEP, 0, 1)
  }

  if (justPressed(runtime, keys, 'KeyS')) {
    runtime.throttleLevel = MathUtils.clamp(runtime.throttleLevel - THROTTLE_STEP, 0, 1)
  }

  if (brake) {
    runtime.throttleLevel = 0
    runtime.playerVelocity.set(0, 0, 0)
    return
  }

  const targetForwardSpeed = 16 * hullFactor * runtime.throttleLevel * runtime.thrusterMultiplier
  const currentForwardSpeed = Math.max(0, runtime.playerVelocity.dot(forward))
  const lateralVelocity = runtime.playerVelocity
    .clone()
    .addScaledVector(forward, -runtime.playerVelocity.dot(forward))

  const accelRate = 10 * hullFactor + 4
  const coastDecelRate = 5 + (1 - runtime.throttleLevel) * 4
  const speedRate = targetForwardSpeed >= currentForwardSpeed ? accelRate : coastDecelRate
  const nextForwardSpeed = smoothAxis(currentForwardSpeed, targetForwardSpeed, speedRate, dt)

  lateralVelocity.multiplyScalar(Math.exp(-dt * 10))

  runtime.playerVelocity.copy(forward).multiplyScalar(nextForwardSpeed).add(lateralVelocity)

  const maxSpeed = (6 + hullFactor * 13) * runtime.thrusterMultiplier
  if (runtime.playerVelocity.lengthSq() > maxSpeed * maxSpeed) {
    runtime.playerVelocity.setLength(maxSpeed)
  }

  runtime.playerPosition.addScaledVector(runtime.playerVelocity, dt)
  clampPlayerToField(runtime)
}

function updateAsteroidBody(asteroid: AsteroidSim, dt: number) {
  asteroid.position.addScaledVector(asteroid.velocity, dt)
  asteroid.velocity.multiplyScalar(Math.pow(ASTEROID_DRAG, dt * 60))

  const minX = ASTEROID_TRAVEL_BOUNDS.minX + asteroid.radius
  const maxX = ASTEROID_TRAVEL_BOUNDS.maxX - asteroid.radius
  const minY = ASTEROID_TRAVEL_BOUNDS.minY + asteroid.radius
  const maxY = ASTEROID_TRAVEL_BOUNDS.maxY - asteroid.radius
  const minZ = ASTEROID_TRAVEL_BOUNDS.minZ + asteroid.radius
  const maxZ = ASTEROID_TRAVEL_BOUNDS.maxZ - asteroid.radius

  if (asteroid.position.x < minX) {
    asteroid.position.x = minX
    if (asteroid.velocity.x < 0) asteroid.velocity.x = 0
  }
  if (asteroid.position.x > maxX) {
    asteroid.position.x = maxX
    if (asteroid.velocity.x > 0) asteroid.velocity.x = 0
  }
  if (asteroid.position.y < minY) {
    asteroid.position.y = minY
    if (asteroid.velocity.y < 0) asteroid.velocity.y = 0
  }
  if (asteroid.position.y > maxY) {
    asteroid.position.y = maxY
    if (asteroid.velocity.y > 0) asteroid.velocity.y = 0
  }
  if (asteroid.position.z < minZ) {
    asteroid.position.z = minZ
    if (asteroid.velocity.z < 0) asteroid.velocity.z = 0
  }
  if (asteroid.position.z > maxZ) {
    asteroid.position.z = maxZ
    if (asteroid.velocity.z > 0) asteroid.velocity.z = 0
  }
}

function updateGrabber(runtime: GameRuntime, keys: Record<string, boolean>) {
  if (!justPressed(runtime, keys, 'KeyG')) return

  if (runtime.grabbedAsteroidId !== null) {
    const asteroid = runtime.asteroids.find((candidate) => candidate.id === runtime.grabbedAsteroidId)
    if (asteroid) {
      const forward = getPlayerForward(runtime)
      const forwardSpeed = Math.max(0, runtime.playerVelocity.dot(forward))
      const flingSpeed =
        ASTEROID_FLING_BASE_SPEED +
        forwardSpeed * ASTEROID_FLING_FORWARD_SCALE +
        runtime.throttleLevel * ASTEROID_FLING_THROTTLE_BONUS
      asteroid.velocity.addScaledVector(forward, flingSpeed)
      asteroid.velocity.addScaledVector(runtime.playerVelocity, ASTEROID_FLING_PLAYER_VELOCITY_SHARE)
      const maxFlingSpeed = 46 + asteroid.radius * 4.5
      if (asteroid.velocity.lengthSq() > maxFlingSpeed * maxFlingSpeed) {
        asteroid.velocity.setLength(maxFlingSpeed)
      }
      addEvent(runtime, `Grabber disengaged. Asteroid #${asteroid.id} slung forward.`, 'info')
    } else {
      addEvent(runtime, 'Grabber disengaged.', 'info')
    }
    runtime.grabbedAsteroidId = null
    return
  }

  const nearest = findNearestAsteroidForGrabber(runtime)

  if (nearest && nearest.surfaceDistance <= runtime.grabberRange) {
    runtime.grabbedAsteroidId = nearest.asteroid.id
    runtime.drillAccumulator = 0
    addEvent(runtime, `Grabber latched asteroid #${nearest.asteroid.id}.`, 'good')
  } else {
    addEvent(runtime, 'No asteroid in grabber range.', 'alert')
  }
}

function findNearestAsteroidForGrabber(runtime: GameRuntime) {
  let nearest: AsteroidSim | null = null
  let nearestDistance = Infinity

  for (const asteroid of runtime.asteroids) {
    const surfaceDistance = asteroid.position.distanceTo(runtime.playerPosition) - asteroid.radius
    if (surfaceDistance < nearestDistance) {
      nearestDistance = surfaceDistance
      nearest = asteroid
    }
  }

  if (!nearest) return null

  return {
    asteroid: nearest,
    surfaceDistance: nearestDistance,
  }
}

function moveGrabbedAsteroid(runtime: GameRuntime, dt: number) {
  if (runtime.grabbedAsteroidId === null) return

  const asteroid = runtime.asteroids.find((candidate) => candidate.id === runtime.grabbedAsteroidId)
  if (!asteroid) {
    runtime.grabbedAsteroidId = null
    return
  }

  const forward = getPlayerForward(runtime)
  const anchorPoint = runtime.playerPosition.clone().addScaledVector(forward, asteroid.radius + 4.2)
  const toAnchor = anchorPoint.sub(asteroid.position)
  asteroid.velocity.addScaledVector(toAnchor, dt * GRABBER_ANCHOR_PULL)
  asteroid.velocity.multiplyScalar(Math.exp(-dt * GRABBED_ASTEROID_DAMPING_RATE))
}

function sampleAsteroidResource(runtime: GameRuntime, asteroid: AsteroidSim): ResourceId {
  const roll = runtime.rng()
  let cursor = 0
  for (const candidate of asteroid.composition) {
    cursor += candidate.weight
    if (roll <= cursor) return candidate.resourceId
  }
  return asteroid.composition[asteroid.composition.length - 1].resourceId
}

function addCargo(runtime: GameRuntime, resourceId: ResourceId, units: number) {
  const def = RESOURCES[resourceId]
  const remainingCapacity = Math.max(0, runtime.cargoCapacity - runtime.cargoUsed)
  const maxUnitsByCapacity = Math.floor(remainingCapacity / def.volume)
  const acceptedUnits = Math.min(units, maxUnitsByCapacity)

  if (acceptedUnits <= 0) {
    if (!runtime.cargoFullWarned) {
      addEvent(runtime, 'Cargo hold at capacity. Return to freighter to unload.', 'alert')
      runtime.cargoFullWarned = true
    }
    return 0
  }

  const volume = acceptedUnits * def.volume
  const bin = runtime.cargoBins[resourceId]
  bin.units += acceptedUnits
  bin.volume += volume
  bin.value += acceptedUnits * def.value

  runtime.cargoUsed += volume
  runtime.cargoValue += acceptedUnits * def.value
  return acceptedUnits
}

function takeCargoUnitForLaunch(runtime: GameRuntime): ResourceId | null {
  const candidate = Object.values(runtime.cargoBins)
    .filter((bin) => bin.units > 0)
    .sort((a, b) => b.value / Math.max(1, b.units) - a.value / Math.max(1, a.units))[0]

  if (!candidate) return null

  const def = RESOURCES[candidate.resourceId]
  candidate.units -= 1
  candidate.volume = Math.max(0, candidate.volume - def.volume)
  candidate.value = Math.max(0, candidate.value - def.value)

  runtime.cargoUsed = Math.max(0, runtime.cargoUsed - def.volume)
  runtime.cargoValue = Math.max(0, runtime.cargoValue - def.value)
  runtime.cargoFullWarned = false
  return candidate.resourceId
}

function takeCargoUnitForUnload(runtime: GameRuntime): ResourceId | null {
  const candidate = Object.values(runtime.cargoBins)
    .filter((bin) => bin.units > 0)
    .sort((a, b) => RESOURCES[b.resourceId].value - RESOURCES[a.resourceId].value)[0]

  if (!candidate) return null

  const def = RESOURCES[candidate.resourceId]
  candidate.units -= 1
  candidate.volume = Math.max(0, candidate.volume - def.volume)
  candidate.value = Math.max(0, candidate.value - def.value)

  runtime.cargoUsed = Math.max(0, runtime.cargoUsed - def.volume)
  runtime.cargoValue = Math.max(0, runtime.cargoValue - def.value)
  runtime.cargoFullWarned = false
  return candidate.resourceId
}

function updateDockedSystems(runtime: GameRuntime, dt: number) {
  if (!runtime.docked) return

  runtime.playerPosition.copy(runtime.freighterPosition).add(runtime.dockedPosition)
  runtime.playerVelocity.set(0, 0, 0)
  runtime.throttleLevel = 0
  runtime.grabbedAsteroidId = null
  runtime.drillActive = false

  const hadCargoBefore = runtime.cargoValue > 0 || runtime.powerballCargo > 0
  runtime.unloadAccumulator += dt * DOCK_UNLOAD_UNITS_PER_SECOND

  while (runtime.unloadAccumulator >= 1) {
    if (runtime.powerballCargo > 0) {
      runtime.powerballCargo -= 1
      runtime.deliveredPowerballScore += 1
      runtime.unloadAccumulator -= 1
      addEvent(runtime, 'Powerball transferred to freighter vault. Delivered score +1.', 'good')
      continue
    }

    const resourceId = takeCargoUnitForUnload(runtime)
    if (!resourceId) break

    runtime.unloadAccumulator -= 1
    runtime.deliveredValue += RESOURCES[resourceId].value
  }

  if (hadCargoBefore && runtime.cargoValue <= 0 && runtime.powerballCargo <= 0) {
    addEvent(runtime, 'Cargo unload complete. Hold is now empty.', 'good')
  }

  const hullBefore = runtime.hull
  runtime.hull = Math.min(runtime.maxHull, runtime.hull + DOCK_REPAIR_PER_SECOND * dt)
  if (hullBefore < runtime.maxHull && runtime.hull >= runtime.maxHull) {
    addEvent(runtime, 'Hull repairs complete.', 'good')
  }
}

function launchCargoShot(runtime: GameRuntime, keys: Record<string, boolean>) {
  if (!justPressed(runtime, keys, 'Space')) return

  const resourceId = takeCargoUnitForLaunch(runtime)
  if (!resourceId) {
    addEvent(runtime, 'Cargo launch failed. Hold is empty.', 'alert')
    return
  }

  runtime.cargoShotSerial += 1
  const forward = getPlayerForward(runtime)
  const def = RESOURCES[resourceId]
  const damage = 8 + def.value / 12

  runtime.cargoShots.push({
    id: runtime.cargoShotSerial,
    shotType: 'cargo',
    resourceId,
    position: runtime.playerPosition.clone().addScaledVector(forward, PLAYER_RADIUS + 1.1),
    velocity: forward.multiplyScalar(CARGO_SHOT_SPEED).add(runtime.playerVelocity.clone()),
    life: CARGO_SHOT_LIFETIME,
    radius: CARGO_SHOT_RADIUS,
    damage,
    delayBonus: 2 + damage * 0.16,
    color: def.color,
  })

  addEvent(runtime, `${def.label} canister launched.`, 'info')
}

function launchWeaponShot(runtime: GameRuntime, keys: Record<string, boolean>) {
  if (!justPressed(runtime, keys, 'KeyQ')) return
  if (runtime.weaponMaxAmmo <= 0 || runtime.weaponDamage <= 0) {
    addEvent(runtime, 'No weapon system installed.', 'alert')
    return
  }
  if (runtime.weaponAmmo <= 0) {
    addEvent(runtime, 'Weapon ammo depleted.', 'alert')
    return
  }

  runtime.weaponAmmo -= 1
  runtime.cargoShotSerial += 1
  const forward = getPlayerForward(runtime)
  const damage = runtime.weaponDamage

  runtime.cargoShots.push({
    id: runtime.cargoShotSerial,
    shotType: 'weapon',
    resourceId: null,
    position: runtime.playerPosition.clone().addScaledVector(forward, PLAYER_RADIUS + 1.1),
    velocity: forward.multiplyScalar(CARGO_SHOT_SPEED * 1.25).add(runtime.playerVelocity.clone()),
    life: CARGO_SHOT_LIFETIME,
    radius: CARGO_SHOT_RADIUS * 0.85,
    damage,
    delayBonus: 1.2 + damage * 0.06,
    color: '#ff955a',
  })
}

function updateDrill(runtime: GameRuntime, dt: number, keys: Record<string, boolean>) {
  if (!isDown(keys, 'KeyF') || runtime.grabbedAsteroidId === null) {
    runtime.drillActive = false
    return
  }

  const remainingCapacity = runtime.cargoCapacity - runtime.cargoUsed
  if (remainingCapacity < MIN_RESOURCE_VOLUME) {
    if (!runtime.cargoFullWarned) {
      addEvent(runtime, 'Cargo hold has no usable space left. Return to freighter to unload.', 'alert')
      runtime.cargoFullWarned = true
    }
    runtime.drillActive = false
    return
  }

  const asteroid = runtime.asteroids.find((candidate) => candidate.id === runtime.grabbedAsteroidId)
  if (!asteroid) {
    runtime.grabbedAsteroidId = null
    runtime.drillActive = false
    return
  }

  if (asteroid.oreReserve <= 0) {
    runtime.grabbedAsteroidId = null
    runtime.drillActive = false
    addEvent(runtime, 'Target asteroid depleted. Seek another vein.', 'info')
    return
  }

  runtime.drillActive = true
  runtime.drillAccumulator += dt * ORE_EXTRACT_RATE * runtime.drillMultiplier
  while (runtime.drillAccumulator >= 1) {
    runtime.drillAccumulator -= 1

    const resourceId = sampleAsteroidResource(runtime, asteroid)
    const units = resourceId === 'fringeRelic' ? 1 : 1 + Math.floor(runtime.rng() * 2)
    const minedUnits = addCargo(runtime, resourceId, units)
    if (minedUnits <= 0) {
      runtime.drillActive = false
      break
    }

    if (asteroid.hasPowerball && !asteroid.powerballRecovered) {
      asteroid.powerballRecovered = true
      runtime.powerballCargo += 1
      addEvent(runtime, 'Powerball recovered. Stowed aboard for delivery.', 'good')
    }

    asteroid.oreReserve -= 1
    if (asteroid.oreReserve <= 0) {
      asteroid.oreReserve = 0
      runtime.asteroidDepletionSerial += 1
      runtime.grabbedAsteroidId = null
      addEvent(runtime, 'Target asteroid depleted. Grabber auto-released.', 'info')
      break
    }
  }
}

function resolveAsteroidCollisions(runtime: GameRuntime) {
  for (let i = 0; i < runtime.asteroids.length; i += 1) {
    const a = runtime.asteroids[i]
    for (let j = i + 1; j < runtime.asteroids.length; j += 1) {
      const b = runtime.asteroids[j]

      const delta = a.position.clone().sub(b.position)
      const distance = Math.max(delta.length(), 0.0001)
      const minDistance = a.radius + b.radius
      if (distance >= minDistance) continue

      const normal = delta.multiplyScalar(1 / distance)
      const overlap = minDistance - distance
      a.position.addScaledVector(normal, overlap * 0.5)
      b.position.addScaledVector(normal, -overlap * 0.5)

      const relativeSpeed = a.velocity.clone().sub(b.velocity).dot(normal)
      if (relativeSpeed < 0) {
        const impulse = (-(1 + ASTEROID_COLLISION_RESTITUTION) * relativeSpeed) / 2
        a.velocity.addScaledVector(normal, impulse)
        b.velocity.addScaledVector(normal, -impulse)
      }
    }
  }
}

function resolveAsteroidPirateImpacts(runtime: GameRuntime, dt: number) {
  if (runtime.pirateState !== 'incoming') return

  runtime.pirateAsteroidGrace = Math.max(0, runtime.pirateAsteroidGrace - dt)

  for (const asteroid of runtime.asteroids) {
    const delta = asteroid.position.clone().sub(runtime.piratePosition)
    const distance = Math.max(delta.length(), 0.0001)
    const minDistance = asteroid.radius + PIRATE_RADIUS

    if (distance >= minDistance) continue

    const normal = delta.multiplyScalar(1 / distance)
    const overlap = minDistance - distance
    asteroid.position.addScaledVector(normal, overlap * 0.72)
    runtime.piratePosition.addScaledVector(normal, -overlap * 0.28)

    const relative = asteroid.velocity.clone().sub(runtime.pirateVelocity)
    const impact = Math.max(0, -relative.dot(normal))

    if (runtime.pirateAsteroidGrace <= 0 && impact > ASTEROID_PIRATE_IMPACT_MIN_SPEED) {
      const massFactor = 0.7 + asteroid.radius * 0.32
      const pirateDamage = impact * randomRange(runtime.rng, 14, 21) * massFactor
      const pirateDisabled = applyPirateDamage(runtime, pirateDamage)

      if (pirateDisabled) {
        addEvent(
          runtime,
          `Asteroid strike shredded pirate hull (-${pirateDamage.toFixed(0)}). Boarding threat ended.`,
          'good',
        )
      } else {
        const delay = Math.min(18, 4 + impact * 1.85 + asteroid.radius * 0.55)
        runtime.pirateBoardTimer += delay
        addEvent(
          runtime,
          `Asteroid impact on pirate: -${pirateDamage.toFixed(0)} hull, boarding delayed +${delay.toFixed(1)}s.`,
          'good',
        )
      }

      runtime.pirateAsteroidGrace = ASTEROID_PIRATE_IMPACT_GRACE
    }

    asteroid.velocity.addScaledVector(normal, impact * 0.45)
    if (runtime.pirateState === 'incoming') {
      runtime.pirateVelocity.addScaledVector(normal, -impact * 0.9)
    } else {
      break
    }
  }
}

function resolvePlayerAsteroidImpacts(runtime: GameRuntime, dt: number) {
  runtime.collisionGrace = Math.max(0, runtime.collisionGrace - dt)

  for (const asteroid of runtime.asteroids) {
    const delta = runtime.playerPosition.clone().sub(asteroid.position)
    const distance = Math.max(delta.length(), 0.0001)
    const minDistance = PLAYER_RADIUS + asteroid.radius

    if (distance >= minDistance) continue

    const normal = delta.multiplyScalar(1 / distance)
    const overlap = minDistance - distance
    runtime.playerPosition.addScaledVector(normal, overlap + 0.05)

    const relative = runtime.playerVelocity.clone().sub(asteroid.velocity)
    const impact = Math.max(0, -relative.dot(normal))

    if (runtime.collisionGrace <= 0 && impact > 0.75) {
      const damage = impact * randomRange(runtime.rng, 6.4, 9.8)
      runtime.hull = Math.max(0, runtime.hull - damage)
      runtime.collisionGrace = 0.33
      addEvent(runtime, `Hull impact registered (-${damage.toFixed(0)}).`, 'alert')
    }

    runtime.playerVelocity.addScaledVector(normal, impact * 0.45)
  }
}

function resolvePlayerPirateImpact(runtime: GameRuntime, dt: number) {
  if (runtime.pirateState !== 'incoming') return

  runtime.pirateRamGrace = Math.max(0, runtime.pirateRamGrace - dt)

  const delta = runtime.playerPosition.clone().sub(runtime.piratePosition)
  const distance = Math.max(delta.length(), 0.0001)
  const minDistance = PLAYER_RADIUS + PIRATE_RADIUS

  if (distance >= minDistance) return

  const normal = delta.multiplyScalar(1 / distance)
  const overlap = minDistance - distance
  runtime.playerPosition.addScaledVector(normal, overlap * 0.65)
  runtime.piratePosition.addScaledVector(normal, -overlap * 0.35)

  const relative = runtime.playerVelocity.clone().sub(runtime.pirateVelocity)
  const impact = Math.max(0, -relative.dot(normal))

  if (runtime.pirateRamGrace <= 0 && impact > RAM_DELAY_MIN_IMPACT) {
    const playerDamage = impact * randomRange(runtime.rng, 4.6, 7.2) * runtime.rammerSelfDamageMultiplier
    runtime.hull = Math.max(0, runtime.hull - playerDamage)

    const pirateDamage = impact * randomRange(runtime.rng, 7.8, 11.2) * runtime.rammerDamageMultiplier
    const pirateDisabled = applyPirateDamage(runtime, pirateDamage)

    const delay = Math.min(12, 3 + impact * 1.4)
    runtime.pirateBoardTimer += delay
    runtime.pirateRamGrace = 0.75
    const delayLabel = pirateDisabled ? 'Boarding threat ended.' : `Boarding delayed +${delay.toFixed(1)}s.`
    addEvent(
      runtime,
      `Ramming impact: pirate -${pirateDamage.toFixed(0)} hull, you -${playerDamage.toFixed(0)} hull. ${delayLabel}`,
      pirateDisabled ? 'good' : 'alert',
    )
  }

  runtime.playerVelocity.addScaledVector(normal, impact * 0.6)
  if (runtime.pirateState === 'incoming') {
    runtime.pirateVelocity.addScaledVector(normal, -impact * 0.5)
  }
}

function updateCargoShots(runtime: GameRuntime, dt: number) {
  const activeShots: CargoShot[] = []

  for (const shot of runtime.cargoShots) {
    shot.life -= dt
    shot.position.addScaledVector(shot.velocity, dt)

    const inBounds =
      shot.position.x >= FLIGHT_BOUNDS.minX - 28 &&
      shot.position.x <= FLIGHT_BOUNDS.maxX + 28 &&
      shot.position.y >= FLIGHT_BOUNDS.minY - 28 &&
      shot.position.y <= FLIGHT_BOUNDS.maxY + 28 &&
      shot.position.z >= FLIGHT_BOUNDS.minZ - 28 &&
      shot.position.z <= FLIGHT_BOUNDS.maxZ + 28

    if (shot.life <= 0 || !inBounds) continue

    let hitPirate = false
    if (runtime.pirateState === 'incoming') {
      const distance = shot.position.distanceTo(runtime.piratePosition)
      if (distance <= shot.radius + PIRATE_RADIUS) {
        const pirateDisabled = applyPirateDamage(runtime, shot.damage)
        runtime.pirateBoardTimer += shot.delayBonus
        if (shot.shotType === 'weapon') {
          addEvent(runtime, `Weapon hit confirmed. Boarding delayed +${shot.delayBonus.toFixed(1)}s.`, 'good')
        } else if (shot.resourceId) {
          addEvent(
            runtime,
            `Pirate hit with ${RESOURCES[shot.resourceId].label}. Boarding delayed +${shot.delayBonus.toFixed(1)}s.`,
            'good',
          )
        }
        if (pirateDisabled) runtime.pirateBoardTimer = Infinity
        hitPirate = true
      }
    }

    if (!hitPirate) {
      activeShots.push(shot)
    }
  }

  runtime.cargoShots = activeShots
}

function evaluateMissionOutcome(runtime: GameRuntime) {
  if (runtime.status !== 'active') return

  if (runtime.hull <= 0) {
    runtime.status = 'lost'
    runtime.outcomeReason = 'Your mining craft vented atmosphere and went dark.'
    addEvent(runtime, runtime.outcomeReason, 'alert')
    return
  }

  if (runtime.missionSeconds <= 0) {
    if (runtime.docked) {
      runtime.status = 'won'
      runtime.outcomeReason = 'Freighter cleared the belt with you secured in docking clamps. You survived this run.'
      addEvent(runtime, runtime.outcomeReason, 'good')
    } else {
      runtime.status = 'lost'
      runtime.outcomeReason = 'Freighter cleared the belt while you were undocked. You were left in the rocks.'
      addEvent(runtime, runtime.outcomeReason, 'alert')
    }
  }
}

export function stepRuntime(runtime: GameRuntime, dtRaw: number, controlInput: ControlInput) {
  const { keys } = controlInput
  if (runtime.status !== 'active') {
    updatePrevKeys(runtime, keys)
    return
  }

  const dt = Math.min(dtRaw, 0.05)
  runtime.elapsed += dt
  runtime.missionSeconds -= dt * runtime.countdownRate
  runtime.drillActive = false
  updateFreighterTransit(runtime)

  applyFreighterDockActions(runtime, keys)

  if (runtime.docked) {
    updateDockedSystems(runtime, dt)
  } else {
    updatePlayerControlWithInput(runtime, dt, controlInput)
    updateGrabber(runtime, keys)
    moveGrabbedAsteroid(runtime, dt)
    launchCargoShot(runtime, keys)
    launchWeaponShot(runtime, keys)
  }

  for (const asteroid of runtime.asteroids) {
    updateAsteroidBody(asteroid, dt)
  }

  resolveAsteroidCollisions(runtime)
  resolveAsteroidPirateImpacts(runtime, dt)
  if (!runtime.docked) {
    resolvePlayerAsteroidImpacts(runtime, dt)
    resolvePlayerPirateImpact(runtime, dt)
    updateDrill(runtime, dt, keys)
  }
  updateCargoShots(runtime, dt)
  updatePirate(runtime, dt)
  evaluateMissionOutcome(runtime)

  updatePrevKeys(runtime, keys)
}

function createHudResourceBins(runtime: GameRuntime): HudResourceBin[] {
  return Object.values(runtime.cargoBins)
    .filter((bin) => bin.units > 0)
    .sort((a, b) => b.value - a.value)
    .map((bin) => ({
      resourceId: bin.resourceId,
      label: RESOURCES[bin.resourceId].label,
      units: bin.units,
      volume: bin.volume,
      value: bin.value,
      color: RESOURCES[bin.resourceId].color,
    }))
}

export function createHudSnapshot(runtime: GameRuntime): HudSnapshot {
  const pirateBoardEta =
    runtime.pirateState === 'incoming' ? Math.max(0, runtime.pirateBoardTimer) : Infinity
  const cargoUnits = getCargoUnitCount(runtime) + runtime.powerballCargo
  const currentHullDeficit = Math.max(0, runtime.maxHull - runtime.hull)
  const dockUnloadProgress =
    runtime.dockUnloadStartUnits <= 0
      ? 1
      : toProgress((runtime.dockUnloadStartUnits - cargoUnits) / runtime.dockUnloadStartUnits)
  const dockRepairProgress =
    runtime.dockRepairStartDeficit <= 0
      ? 1
      : toProgress((runtime.dockRepairStartDeficit - currentHullDeficit) / runtime.dockRepairStartDeficit)
  const toFreighterFlat = runtime.freighterPosition.clone().sub(runtime.playerPosition).setY(0)
  const playerForwardFlat = getPlayerForward(runtime).setY(0)
  let freighterRelativeAngleDeg = 0
  if (toFreighterFlat.lengthSq() > 0.0001 && playerForwardFlat.lengthSq() > 0.0001) {
    toFreighterFlat.normalize()
    playerForwardFlat.normalize()
    const crossY = playerForwardFlat.x * toFreighterFlat.z - playerForwardFlat.z * toFreighterFlat.x
    const dot = MathUtils.clamp(playerForwardFlat.dot(toFreighterFlat), -1, 1)
    freighterRelativeAngleDeg = Math.atan2(crossY, dot) * (180 / Math.PI)
  }

  const nearestGrabberTarget = findNearestAsteroidForGrabber(runtime)
  const grabberReady = nearestGrabberTarget !== null && nearestGrabberTarget.surfaceDistance <= runtime.grabberRange

  return {
    runId: runtime.runId,
    status: runtime.status,
    outcomeReason: runtime.outcomeReason,
    elapsed: runtime.elapsed,
    missionSeconds: Math.max(0, runtime.missionSeconds),
    hull: runtime.hull,
    maxHull: runtime.maxHull,
    throttleLevel: runtime.throttleLevel,
    cargoUsed: runtime.cargoUsed,
    cargoCapacity: runtime.cargoCapacity,
    cargoValue: runtime.cargoValue,
    deliveredValue: runtime.deliveredValue,
    powerballCargo: runtime.powerballCargo,
    deliveredPowerballScore: runtime.deliveredPowerballScore,
    distanceToFreighter: runtime.playerPosition.distanceTo(runtime.freighterPosition),
    freighterRelativeAngleDeg,
    docked: runtime.docked,
    dockUnloadProgress,
    dockRepairProgress,
    dockUnloadRemainingUnits: cargoUnits,
    dockRepairRemainingHull: currentHullDeficit,
    grabbedAsteroidId: runtime.grabbedAsteroidId,
    drillActive: runtime.drillActive,
    grabberRange: runtime.grabberRange,
    grabberReady,
    grabberTargetId: nearestGrabberTarget?.asteroid.id ?? null,
    grabberTargetDistance: nearestGrabberTarget ? Math.max(0, nearestGrabberTarget.surfaceDistance) : null,
    pirateState: runtime.pirateState,
    pirateBoardEta,
    pirateHull: runtime.pirateHull,
    pirateMaxHull: runtime.pirateMaxHull,
    weaponAmmo: runtime.weaponAmmo,
    weaponMaxAmmo: runtime.weaponMaxAmmo,
    resourceBins: createHudResourceBins(runtime),
    events: runtime.events,
  }
}

export function getResourceDefinitions() {
  return RESOURCES
}
