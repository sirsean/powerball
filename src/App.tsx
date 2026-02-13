import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Sparkles, Stars, useGLTF, useTexture } from '@react-three/drei'
import type { Group, Mesh, MeshStandardMaterial, Object3D, PointLight, Texture } from 'three'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { BackSide, Color, MathUtils, Quaternion, RepeatWrapping, SRGBColorSpace, Vector3 } from 'three'
import './App.css'
import {
  FREIGHTER_DOCK_APPROACH_RADIUS,
  FREIGHTER_DOCK_RADIUS,
  canDisembarkEarly,
  createHudSnapshot,
  createRuntime,
  getPlayerForward,
  stepRuntime,
  triggerEarlyDisembark,
  type GameRuntime,
  type HudSnapshot,
  type ResourceId,
} from './game/runtime'
import { useKeyboard } from './game/useKeyboard'
import { GameAudioEngine } from './audio/gameAudio'
import {
  addUpgradeInventoryItem,
  UPGRADE_DEFINITIONS,
  UPGRADE_ORDER,
  buildRunModifiers,
  createUpgradeInventory,
  createUpgradeLoadout,
  getUpgradeInventoryCount,
  getUpgradeCost,
  getUpgradePowerballRequirement,
  getUpgradeStatSummary,
  loadoutToUpgradeLevels,
  removeUpgradeInventoryItem,
  type UpgradeKey,
  type UpgradeInventory,
  type UpgradeLoadout,
} from './game/upgrades'

const ASTEROID_GLB_PATHS: string[] = [
  '/assets/models/asteroid_01_v1.glb',
  '/assets/models/asteroid_02_v1.glb',
  '/assets/models/asteroid_03_v1.glb',
  '/assets/models/asteroid_04_v1.glb',
  '/assets/models/asteroid_05_v1.glb',
]
const SMOKE_PUFF_COUNT = 9
const GRABBER_ARM_TARGET_OVERREACH = 0.35
const CAPTAIN_IMAGE_PATH = '/assets/references/captain-roddard-harbarth.png'
const HANGAR_BACKDROP_SEED = 0x4f726531
const HANGAR_BACKDROP_ASTEROID_COUNT = 22
const HANGAR_BAY_DOOR_X = 44
const HANGAR_BAY_DOOR_Z = -56
const HANGAR_BACKDROP_TRAVEL_BOUNDS = {
  minX: HANGAR_BAY_DOOR_X - 190,
  maxX: HANGAR_BAY_DOOR_X + 190,
  nearZ: HANGAR_BAY_DOOR_Z - 120,
  farZ: HANGAR_BAY_DOOR_Z - 520,
  wrapPadding: 28,
}

const ASTEROID_TEXTURE_PATHS: Record<ResourceId | 'depleted', string> = {
  scrapIron: '/assets/textures/generated/asteroid_scrapiron_v1.svg',
  waterIce: '/assets/textures/generated/asteroid_waterice_v1.svg',
  cobaltDust: '/assets/textures/generated/asteroid_cobaltdust_v1.svg',
  xenoCrystal: '/assets/textures/generated/asteroid_xenocrystal_v1.svg',
  fringeRelic: '/assets/textures/generated/asteroid_fringerelic_v1.svg',
  depleted: '/assets/textures/generated/asteroid_depleted_v1.svg',
}
const HANGAR_INTERIOR_TEXTURE_PATHS = {
  rustBrown: '/assets/textures/generated/hangar_rustbrown_v1.svg',
  steelGray: '/assets/textures/generated/hangar_steelgray_v1.svg',
}

interface CareerState {
  credits: number
  deliveredPowerballs: number
  inventory: UpgradeInventory
  loadout: UpgradeLoadout
  runsCompleted: number
}

interface DebriefReport {
  status: 'won' | 'lost'
  message: string
  creditsDelta: number
  powerballsDelta: number
}

interface PirateDangerProfile {
  level: number
  label: string
  encounterChance: number
}

const PIRATE_DANGER_LEVELS: Array<{ level: number; label: string; maxChance: number }> = [
  { level: 1, label: 'Low', maxChance: 0.27 },
  { level: 2, label: 'Guarded', maxChance: 0.43 },
  { level: 3, label: 'Elevated', maxChance: 0.59 },
  { level: 4, label: 'High', maxChance: 0.75 },
  { level: 5, label: 'Critical', maxChance: 1 },
]
const HULL_BREACH_OUTCOME_REASON = 'Your mining craft vented atmosphere and went dark.'
const HANGAR_ASTEROID_RESOURCES: ResourceId[] = [
  'scrapIron',
  'waterIce',
  'cobaltDust',
  'xenoCrystal',
  'fringeRelic',
]
const HANGAR_ASTEROID_BASE_COLORS: Record<ResourceId, string> = {
  scrapIron: '#886e52',
  waterIce: '#c2c0b7',
  cobaltDust: '#7c674f',
  xenoCrystal: '#a0ad7d',
  fringeRelic: '#d6bf7e',
}

interface HangarBackdropAsteroid {
  id: number
  radius: number
  position: Vector3
  velocity: Vector3
  spin: Vector3
  resourceId: ResourceId
  modelIndex: number
}

function seededBackdropRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 4294967296
  }
}

function backdropRange(rng: () => number, min: number, max: number) {
  return min + (max - min) * rng()
}

function createHangarBackdropAsteroids(count: number): HangarBackdropAsteroid[] {
  const rng = seededBackdropRandom(HANGAR_BACKDROP_SEED)

  return Array.from({ length: count }, (_, id) => {
    const radius = backdropRange(rng, 2.4, 7.1)
    const lane = id % 2 === 0 ? -1 : 1
    return {
      id,
      radius,
      position: new Vector3(
        backdropRange(rng, HANGAR_BACKDROP_TRAVEL_BOUNDS.minX + 24, HANGAR_BACKDROP_TRAVEL_BOUNDS.maxX - 24),
        backdropRange(rng, -18, 20),
        backdropRange(rng, HANGAR_BACKDROP_TRAVEL_BOUNDS.farZ + 36, HANGAR_BACKDROP_TRAVEL_BOUNDS.nearZ - 18),
      ),
      velocity: new Vector3(
        backdropRange(rng, 2.2, 5.4) * lane,
        backdropRange(rng, -0.45, 0.45),
        backdropRange(rng, -0.58, 0.72),
      ),
      spin: new Vector3(
        backdropRange(rng, -0.32, 0.32),
        backdropRange(rng, -0.32, 0.32),
        backdropRange(rng, -0.32, 0.32),
      ),
      resourceId: HANGAR_ASTEROID_RESOURCES[Math.floor(rng() * HANGAR_ASTEROID_RESOURCES.length)],
      modelIndex: Math.floor(rng() * ASTEROID_GLB_PATHS.length),
    }
  })
}

function getTimeDrivenPirateDangerProfile(nowMs: number): PirateDangerProfile {
  const now = new Date(nowMs)
  const seconds =
    now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000
  const dayPhase = (seconds / 86400) * Math.PI * 2

  const primaryWave = (Math.sin(dayPhase * 2 - 0.65) + 1) * 0.5
  const secondaryWave = (Math.sin(dayPhase * 5 + 1.15) + 1) * 0.5
  const blendedIntensity = primaryWave * 0.68 + secondaryWave * 0.32

  const encounterChance = MathUtils.clamp(0.16 + blendedIntensity * 0.68, 0.16, 0.84)
  const matchingLevel =
    PIRATE_DANGER_LEVELS.find((candidate) => encounterChance <= candidate.maxChance) ??
    PIRATE_DANGER_LEVELS[PIRATE_DANGER_LEVELS.length - 1]

  return {
    level: matchingLevel.level,
    label: matchingLevel.label,
    encounterChance,
  }
}

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function cloneModelWithShadows(scene: Object3D) {
  const model = scene.clone(true)
  model.traverse((node) => {
    const mesh = node as Mesh
    if (mesh.isMesh) {
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((mat) => mat.clone())
      } else if (mesh.material) {
        mesh.material = mesh.material.clone()
      }
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
  })
  return model
}

function createRepeatingTexture(source: Texture, repeatX: number, repeatY: number) {
  const texture = source.clone()
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function paintModelTexture(model: Object3D, texture: Texture, skipMaterialNames: Set<string> = new Set()) {
  model.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh || !mesh.material) return

    const applyTexture = (candidate: unknown) => {
      const material = candidate as MeshStandardMaterial
      if (!material || skipMaterialNames.has(material.name)) return
      material.map = texture
      material.needsUpdate = true
    }

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(applyTexture)
    } else {
      applyTexture(mesh.material)
    }
  })
}

function configureTriplanarMaterial(material: MeshStandardMaterial, texture: Texture, scale = 0.34) {
  material.userData.triplanarTexture = texture
  material.userData.triplanarScale = scale

  if (!material.userData.triplanarConfigured) {
    material.userData.triplanarConfigured = true

    material.onBeforeCompile = (shader) => {
      shader.uniforms.triMap = { value: material.userData.triplanarTexture }
      shader.uniforms.triScale = { value: material.userData.triplanarScale }
      material.userData.triplanarShader = shader

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vTriPos;
varying vec3 vTriNormal;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vTriPos = position;
vTriNormal = normalize(normal);`,
        )

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform sampler2D triMap;
uniform float triScale;
varying vec3 vTriPos;
varying vec3 vTriNormal;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
vec3 triBlend = pow(abs(normalize(vTriNormal)), vec3(4.0));
triBlend /= max(triBlend.x + triBlend.y + triBlend.z, 0.0001);
vec2 triUvX = vTriPos.yz * triScale;
vec2 triUvY = vTriPos.xz * triScale;
vec2 triUvZ = vTriPos.xy * triScale;
vec3 triSample = texture2D(triMap, triUvX).rgb * triBlend.x
               + texture2D(triMap, triUvY).rgb * triBlend.y
               + texture2D(triMap, triUvZ).rgb * triBlend.z;
diffuseColor.rgb *= triSample;`,
        )
    }

    material.customProgramCacheKey = () => 'asteroid-triplanar-v1'
    material.map = null
    material.needsUpdate = true
  }

  const shader = material.userData.triplanarShader as
    | { uniforms?: { triMap?: { value: Texture }; triScale?: { value: number } } }
    | undefined
  if (shader?.uniforms?.triMap) {
    shader.uniforms.triMap.value = texture
  }
  if (shader?.uniforms?.triScale) {
    shader.uniforms.triScale.value = scale
  }
}

function AsteroidField({
  runtime,
  groupRefs,
  meshRefs,
}: {
  runtime: GameRuntime
  groupRefs: React.MutableRefObject<Array<Group | null>>
  meshRefs: React.MutableRefObject<Array<Mesh | null>>
}) {
  const assets = useGLTF(ASTEROID_GLB_PATHS) as Array<{ scene: Object3D }>
  const asteroidTextureSources = useTexture([
    ASTEROID_TEXTURE_PATHS.scrapIron,
    ASTEROID_TEXTURE_PATHS.waterIce,
    ASTEROID_TEXTURE_PATHS.cobaltDust,
    ASTEROID_TEXTURE_PATHS.xenoCrystal,
    ASTEROID_TEXTURE_PATHS.fringeRelic,
    ASTEROID_TEXTURE_PATHS.depleted,
  ]) as Texture[]
  const asteroidTextures = useMemo(
    () => ({
      scrapIron: createRepeatingTexture(asteroidTextureSources[0], 1.15, 1.15),
      waterIce: createRepeatingTexture(asteroidTextureSources[1], 1.15, 1.15),
      cobaltDust: createRepeatingTexture(asteroidTextureSources[2], 1.15, 1.15),
      xenoCrystal: createRepeatingTexture(asteroidTextureSources[3], 1.15, 1.15),
      fringeRelic: createRepeatingTexture(asteroidTextureSources[4], 1.15, 1.15),
      depleted: createRepeatingTexture(asteroidTextureSources[5], 1.15, 1.15),
    }),
    [asteroidTextureSources],
  )
  const asteroidModels = useMemo(
    () =>
      runtime.asteroids.map((asteroid) => {
        const asset = assets[asteroid.id % assets.length]
        const model = cloneModelWithShadows(asset.scene)
        const richTexture = asteroidTextures[asteroid.primaryResourceId]
        const depletedTexture = asteroidTextures.depleted
        model.traverse((node) => {
          const mesh = node as Mesh
          if (!mesh.isMesh) return
          const material = mesh.material as MeshStandardMaterial
          if (!material) return
          material.userData.richMap = richTexture
          material.userData.depletedMap = depletedTexture
          material.userData.activeTriMap = richTexture
          configureTriplanarMaterial(material, richTexture)
        })
        return model
      }),
    [assets, asteroidTextures, runtime.asteroids],
  )

  return (
    <>
      {runtime.asteroids.map((asteroid, index) => (
        <group
          key={asteroid.id}
          ref={(node) => {
            groupRefs.current[index] = node
            if (!node) {
              meshRefs.current[index] = null
              return
            }
            const mesh = node.getObjectByProperty('isMesh', true) as Mesh | undefined
            meshRefs.current[index] = mesh ?? null
          }}
          position={[asteroid.position.x, asteroid.position.y, asteroid.position.z]}
          scale={[asteroid.radius / 2.7, asteroid.radius / 2.7, asteroid.radius / 2.7]}
        >
          <primitive object={asteroidModels[index]} />
        </group>
      ))}
    </>
  )
}

function HangarBackdropScene() {
  const asteroidRefs = useRef<Array<Group | null>>([])
  const wrapRng = useRef(seededBackdropRandom(HANGAR_BACKDROP_SEED ^ 0x9e3779b9))
  const asteroidMotionRef = useRef<HangarBackdropAsteroid[]>(
    createHangarBackdropAsteroids(HANGAR_BACKDROP_ASTEROID_COUNT),
  )
  const asteroidSlots = useMemo(
    () => createHangarBackdropAsteroids(HANGAR_BACKDROP_ASTEROID_COUNT),
    [],
  )
  const assets = useGLTF(ASTEROID_GLB_PATHS) as Array<{ scene: Object3D }>
  const asteroidTextureSources = useTexture([
    ASTEROID_TEXTURE_PATHS.scrapIron,
    ASTEROID_TEXTURE_PATHS.waterIce,
    ASTEROID_TEXTURE_PATHS.cobaltDust,
    ASTEROID_TEXTURE_PATHS.xenoCrystal,
    ASTEROID_TEXTURE_PATHS.fringeRelic,
  ]) as Texture[]
  const hangarTextureSources = useTexture([
    HANGAR_INTERIOR_TEXTURE_PATHS.rustBrown,
    HANGAR_INTERIOR_TEXTURE_PATHS.steelGray,
  ]) as Texture[]
  const asteroidTextures = useMemo(
    () => ({
      scrapIron: createRepeatingTexture(asteroidTextureSources[0], 1.15, 1.15),
      waterIce: createRepeatingTexture(asteroidTextureSources[1], 1.15, 1.15),
      cobaltDust: createRepeatingTexture(asteroidTextureSources[2], 1.15, 1.15),
      xenoCrystal: createRepeatingTexture(asteroidTextureSources[3], 1.15, 1.15),
      fringeRelic: createRepeatingTexture(asteroidTextureSources[4], 1.15, 1.15),
    }),
    [asteroidTextureSources],
  )
  const hangarTextures = useMemo(
    () => ({
      rustBrown: createRepeatingTexture(hangarTextureSources[0], 2.8, 2.8),
      steelGray: createRepeatingTexture(hangarTextureSources[1], 3.4, 3.4),
    }),
    [hangarTextureSources],
  )
  const asteroidModels = useMemo(
    () =>
      asteroidSlots.map((asteroid) => {
        const asset = assets[asteroid.modelIndex % assets.length]
        const model = cloneModelWithShadows(asset.scene)
        const richTexture = asteroidTextures[asteroid.resourceId]
        model.traverse((node) => {
          const mesh = node as Mesh
          if (!mesh.isMesh) return
          const material = mesh.material as MeshStandardMaterial
          if (!material) return
          material.userData.activeTriMap = richTexture
          configureTriplanarMaterial(material, richTexture, 0.32)
          material.color.set(HANGAR_ASTEROID_BASE_COLORS[asteroid.resourceId])
          material.roughness = 0.66
          material.metalness = 0.08
          material.emissive.set('#2b241b')
          material.emissiveIntensity = 0.2
        })
        return model
      }),
    [assets, asteroidTextures, asteroidSlots],
  )

  useFrame((state, delta) => {
    const asteroids = asteroidMotionRef.current
    const { minX, maxX, nearZ, farZ, wrapPadding } = HANGAR_BACKDROP_TRAVEL_BOUNDS
    const now = state.clock.elapsedTime
    for (let i = 0; i < asteroids.length; i += 1) {
      const asteroid = asteroids[i]
      const node = asteroidRefs.current[i]
      asteroid.position.addScaledVector(asteroid.velocity, delta)

      if (asteroid.position.x > maxX + wrapPadding) {
        asteroid.position.x = minX - backdropRange(wrapRng.current, 12, 44)
        asteroid.position.y = backdropRange(wrapRng.current, -24, 24)
        asteroid.position.z = backdropRange(wrapRng.current, farZ + 28, nearZ - 28)
      } else if (asteroid.position.x < minX - wrapPadding) {
        asteroid.position.x = maxX + backdropRange(wrapRng.current, 12, 44)
        asteroid.position.y = backdropRange(wrapRng.current, -24, 24)
        asteroid.position.z = backdropRange(wrapRng.current, farZ + 28, nearZ - 28)
      }

      if (asteroid.position.z > nearZ + wrapPadding) {
        asteroid.position.x = backdropRange(wrapRng.current, minX + 16, maxX - 16)
        asteroid.position.y = backdropRange(wrapRng.current, -24, 24)
        asteroid.position.z = farZ - backdropRange(wrapRng.current, 18, 90)
      } else if (asteroid.position.z < farZ - wrapPadding) {
        asteroid.position.x = backdropRange(wrapRng.current, minX + 16, maxX - 16)
        asteroid.position.y = backdropRange(wrapRng.current, -24, 24)
        asteroid.position.z = nearZ - backdropRange(wrapRng.current, 24, 110)
      }

      if (!node) continue
      node.position.set(
        asteroid.position.x,
        asteroid.position.y + Math.sin(now * 0.45 + asteroid.id * 0.9) * 0.45,
        asteroid.position.z,
      )
      node.scale.setScalar(asteroid.radius / 2.7)
      node.rotation.x += asteroid.spin.x * delta
      node.rotation.y += asteroid.spin.y * delta
      node.rotation.z += asteroid.spin.z * delta
    }
  })

  return (
    <>
      <color attach="background" args={['#020305']} />

      <ambientLight intensity={0.76} color="#d7cab5" />
      <hemisphereLight intensity={0.62} color="#a4bfd8" groundColor="#2f2923" />
      <pointLight position={[2, 11, -20]} intensity={120} distance={260} color="#efd0a8" />
      <pointLight position={[HANGAR_BAY_DOOR_X, 8, HANGAR_BAY_DOOR_Z - 82]} intensity={170} distance={340} color="#9dbcd8" />
      <pointLight position={[-34, 6, -6]} intensity={38} distance={180} color="#aab4c2" />
      <pointLight position={[58, 6, -8]} intensity={34} distance={180} color="#aab4c2" />
      <pointLight position={[12, -8, -34]} intensity={30} distance={170} color="#8798ab" />

      <mesh position={[0, -14.5, -12]}>
        <boxGeometry args={[132, 1, 116]} />
        <meshStandardMaterial map={hangarTextures.steelGray} color="#d2dae0" roughness={0.65} metalness={0.2} />
      </mesh>
      <mesh position={[0, 16, -12]}>
        <boxGeometry args={[132, 1.4, 116]} />
        <meshStandardMaterial map={hangarTextures.steelGray} color="#c8d2db" roughness={0.6} metalness={0.22} />
      </mesh>
      <mesh position={[-66, 1, -12]}>
        <boxGeometry args={[1.8, 31, 116]} />
        <meshStandardMaterial map={hangarTextures.rustBrown} color="#ccb59d" roughness={0.68} metalness={0.14} />
      </mesh>
      <mesh position={[66, 1, -12]}>
        <boxGeometry args={[1.8, 31, 116]} />
        <meshStandardMaterial map={hangarTextures.rustBrown} color="#ccb59d" roughness={0.68} metalness={0.14} />
      </mesh>

      <mesh position={[HANGAR_BAY_DOOR_X - 24, 1, HANGAR_BAY_DOOR_Z]}>
        <boxGeometry args={[18, 30, 2.2]} />
        <meshStandardMaterial map={hangarTextures.rustBrown} color="#d1baa4" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[HANGAR_BAY_DOOR_X + 24, 1, HANGAR_BAY_DOOR_Z]}>
        <boxGeometry args={[18, 30, 2.2]} />
        <meshStandardMaterial map={hangarTextures.rustBrown} color="#d1baa4" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[HANGAR_BAY_DOOR_X, 14, HANGAR_BAY_DOOR_Z]}>
        <boxGeometry args={[30, 4, 2.2]} />
        <meshStandardMaterial map={hangarTextures.steelGray} color="#cbd5df" roughness={0.55} metalness={0.24} />
      </mesh>
      <mesh position={[HANGAR_BAY_DOOR_X, -11.8, HANGAR_BAY_DOOR_Z]}>
        <boxGeometry args={[30, 3.2, 2.2]} />
        <meshStandardMaterial map={hangarTextures.steelGray} color="#c2ccd6" roughness={0.6} metalness={0.2} />
      </mesh>

      <mesh position={[HANGAR_BAY_DOOR_X, 12.7, HANGAR_BAY_DOOR_Z + 0.45]}>
        <boxGeometry args={[27.6, 0.42, 0.8]} />
        <meshStandardMaterial color="#8096ad" emissive="#6a8cae" emissiveIntensity={0.68} metalness={0.26} />
      </mesh>

      <pointLight position={[11, -3, -20]} intensity={30} distance={64} color="#afbac7" />
      <HangarDockedSmallcraft />

      <Stars radius={520} depth={320} count={6800} factor={5.2} saturation={0} fade={false} speed={0.18} />
      <group position={[HANGAR_BAY_DOOR_X, 1, HANGAR_BAY_DOOR_Z - 136]}>
        <Stars radius={220} depth={130} count={1400} factor={6.4} saturation={0} fade={false} speed={0} />
        <Sparkles count={110} size={5.2} speed={0.05} opacity={0.78} noise={0.2} color="#e7efff" scale={[76, 46, 92]} />
      </group>
      {asteroidSlots.map((asteroid, index) => (
        <group
          key={`hangar-asteroid-${asteroid.id}`}
          ref={(node) => {
            asteroidRefs.current[index] = node
          }}
          position={[asteroid.position.x, asteroid.position.y, asteroid.position.z]}
          scale={[asteroid.radius / 2.7, asteroid.radius / 2.7, asteroid.radius / 2.7]}
        >
          <primitive object={asteroidModels[index]} />
        </group>
      ))}
    </>
  )
}

function Freighter({ freighterRef }: { freighterRef: React.RefObject<Group | null> }) {
  const gltf = useGLTF('/assets/models/freighter_v1.glb')
  const freighterBaseTexture = useTexture('/assets/textures/generated/freighter_hull_v1.svg')
  const freighterTexture = useMemo(() => createRepeatingTexture(freighterBaseTexture, 1.5, 1.5), [freighterBaseTexture])
  const model = useMemo(() => {
    const cloned = cloneModelWithShadows(gltf.scene)
    paintModelTexture(cloned, freighterTexture)
    return cloned
  }, [freighterTexture, gltf.scene])

  return (
    <group ref={freighterRef} scale={1.25}>
      <primitive object={model} />
    </group>
  )
}

function PlayerCraft({ playerRef }: { playerRef: React.RefObject<Group | null> }) {
  const gltf = useGLTF('/assets/models/smallcraft_v1.glb')
  const smallcraftBaseTexture = useTexture('/assets/textures/generated/smallcraft_hull_v1.svg')
  const smallcraftTexture = useMemo(
    () => createRepeatingTexture(smallcraftBaseTexture, 1.9, 1.9),
    [smallcraftBaseTexture],
  )
  const model = useMemo(() => {
    const cloned = cloneModelWithShadows(gltf.scene)
    paintModelTexture(cloned, smallcraftTexture, new Set(['player_engine_flame', 'smallcraft_tool_glow']))
    return cloned
  }, [smallcraftTexture, gltf.scene])

  return (
    <group ref={playerRef} position={[-77, 0, 0]}>
      <primitive object={model} />
    </group>
  )
}

function HangarDockedSmallcraft() {
  const gltf = useGLTF('/assets/models/smallcraft_v1.glb')
  const smallcraftBaseTexture = useTexture('/assets/textures/generated/smallcraft_hull_v1.svg')
  const smallcraftTexture = useMemo(
    () => createRepeatingTexture(smallcraftBaseTexture, 1.9, 1.9),
    [smallcraftBaseTexture],
  )
  const model = useMemo(() => {
    const cloned = cloneModelWithShadows(gltf.scene)
    paintModelTexture(cloned, smallcraftTexture, new Set(['player_engine_flame', 'smallcraft_tool_glow']))
    cloned.traverse((node) => {
      const mesh = node as Mesh
      if (!mesh.isMesh || !mesh.material) return
      const tuneMaterial = (candidate: unknown) => {
        const material = candidate as MeshStandardMaterial
        if (!material) return
        if (material.name === 'player_engine_flame') {
          material.color.set('#5f6672')
          material.emissive.set('#1f2731')
          material.emissiveIntensity = 0.06
        } else if (material.name === 'smallcraft_tool_glow') {
          material.color.set('#7b838d')
          material.emissive.set('#2a3038')
          material.emissiveIntensity = 0.08
        }
      }

      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(tuneMaterial)
      } else {
        tuneMaterial(mesh.material)
      }
    })
    return cloned
  }, [gltf.scene, smallcraftTexture])

  return (
    <group position={[11, -8.7, -20]} rotation={[Math.PI / 36, Math.PI * 1.7333333333, 0]} scale={3.24}>
      <primitive object={model} />
    </group>
  )
}

function PirateCraft({
  pirateRef,
  disabled,
}: {
  pirateRef: React.RefObject<Group | null>
  disabled: boolean
}) {
  const gltf = useGLTF('/assets/models/pirate_v1.glb')
  const pirateBaseTexture = useTexture('/assets/textures/generated/pirate_hull_v1.svg')
  const pirateTexture = useMemo(() => createRepeatingTexture(pirateBaseTexture, 1.5, 1.5), [pirateBaseTexture])
  const model = useMemo(() => {
    const cloned = cloneModelWithShadows(gltf.scene)
    paintModelTexture(cloned, pirateTexture)
    return cloned
  }, [gltf.scene, pirateTexture])

  useEffect(() => {
    model.traverse((node) => {
      const mesh = node as Mesh
      if (!mesh.isMesh) return
      const material = mesh.material as MeshStandardMaterial
      if (!material) return

      if (!material.userData.baseColor) {
        material.userData.baseColor = `#${material.color.getHexString()}`
        material.userData.baseEmissive = `#${material.emissive.getHexString()}`
        material.userData.baseEmissiveIntensity = material.emissiveIntensity
      }

      if (disabled) {
        material.color.lerp(new Color('#5a5148'), 0.45)
        material.emissive.set('#3c322b')
        material.emissiveIntensity = 0.35
      } else {
        material.color.set(material.userData.baseColor)
        material.emissive.set(material.userData.baseEmissive)
        material.emissiveIntensity = material.userData.baseEmissiveIntensity
      }
    })
  }, [disabled, model])

  return (
    <group ref={pirateRef} position={[90, 16, -84]}>
      <primitive object={model} />
    </group>
  )
}

function WorldSimulation({ runtime }: { runtime: GameRuntime }) {
  const asteroidGroupRefs = useRef<Array<Group | null>>([])
  const asteroidMeshRefs = useRef<Array<Mesh | null>>([])
  const cargoShotRefs = useRef<Array<Mesh | null>>([])
  const smokeRefs = useRef<Array<Mesh | null>>([])
  const playerRef = useRef<Group>(null)
  const freighterRef = useRef<Group>(null)
  const pirateRef = useRef<Group>(null)
  const freighterDockRingRef = useRef<Mesh>(null)
  const freighterLightRef = useRef<PointLight>(null)
  const pirateLightRef = useRef<PointLight>(null)
  const playerEngineLightRef = useRef<PointLight>(null)
  const playerEngineMaterials = useRef<MeshStandardMaterial[]>([])
  const grabberBeamRef = useRef<Mesh>(null)
  const keys = useKeyboard()
  const { camera } = useThree()

  const tempForward = useMemo(() => new Vector3(), [])
  const tempRight = useMemo(() => new Vector3(), [])
  const tempTarget = useMemo(() => new Vector3(), [])
  const tempCamera = useMemo(() => new Vector3(), [])
  const tempEnginePos = useMemo(() => new Vector3(), [])
  const tempSmokeForward = useMemo(() => new Vector3(), [])
  const tempShake = useMemo(() => new Vector3(), [])
  const tempUp = useMemo(() => new Vector3(0, 1, 0), [])
  const tempQuaternion = useMemo(() => new Quaternion(), [])
  const depletedAsteroidColor = useMemo(() => new Color('#2c3136'), [])
  const powerballAsteroidColor = useMemo(() => new Color('#7c4ca6'), [])
  const tempAsteroidColor = useMemo(() => new Color(), [])
  const tempAsteroidBaseColor = useMemo(() => new Color(), [])
  const tempGrabberGlowColor = useMemo(() => new Color(), [])
  const grabberLockGlowTint = useMemo(() => new Color('#cf9f6d'), [])
  const playerEngineBaseColor = useMemo(() => new Color('#702411'), [])
  const playerEngineHotColor = useMemo(() => new Color('#ffab52'), [])
  const playerEngineColor = useMemo(() => new Color(), [])

  useFrame((_, delta) => {
    stepRuntime(runtime, delta, { keys: keys.current })
    const hullRatio = MathUtils.clamp(runtime.hull / Math.max(1, runtime.maxHull), 0, 1)
    const structuralStress = MathUtils.clamp((0.74 - hullRatio) / 0.74, 0, 1)

    if (playerRef.current) {
      playerRef.current.position.copy(runtime.playerPosition)
      tempForward.copy(getPlayerForward(runtime))
      if (runtime.playerVelocity.lengthSq() > 0.4) {
        tempForward.copy(runtime.playerVelocity).normalize()
      }
      tempTarget.copy(runtime.playerPosition).add(tempForward)
      playerRef.current.lookAt(tempTarget)

      if (playerEngineMaterials.current.length === 0) {
        const found = new Set<MeshStandardMaterial>()
        playerRef.current.traverse((node) => {
          const mesh = node as Mesh
          if (!mesh.isMesh || !mesh.material) return
          const register = (candidate: unknown) => {
            const material = candidate as MeshStandardMaterial
            if (!material || material.name !== 'player_engine_flame') return
            found.add(material)
          }
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(register)
          } else {
            register(mesh.material)
          }
        })
        playerEngineMaterials.current = [...found]
      }

      const thrustLevel = MathUtils.clamp(runtime.throttleLevel, 0, 1)
      playerEngineColor.copy(playerEngineBaseColor).lerp(playerEngineHotColor, thrustLevel)
      const flameIntensity = 0.18 + thrustLevel * 2.45
      for (const material of playerEngineMaterials.current) {
        material.color.copy(playerEngineColor)
        material.emissive.copy(playerEngineColor)
        material.emissiveIntensity = flameIntensity
      }

      if (playerEngineLightRef.current) {
        tempEnginePos.copy(runtime.playerPosition).addScaledVector(tempForward, -3.4).addScaledVector(tempUp, -0.18)
        playerEngineLightRef.current.position.copy(tempEnginePos)
        playerEngineLightRef.current.color.copy(playerEngineColor)
        playerEngineLightRef.current.intensity = 0.45 + thrustLevel * 15
        playerEngineLightRef.current.distance = 9 + thrustLevel * 22
      }

      tempSmokeForward.copy(getPlayerForward(runtime))
      if (runtime.playerVelocity.lengthSq() > 0.4) {
        tempSmokeForward.copy(runtime.playerVelocity).normalize()
      }
      tempRight.crossVectors(tempSmokeForward, tempUp).normalize()

      for (let i = 0; i < SMOKE_PUFF_COUNT; i += 1) {
        const puff = smokeRefs.current[i]
        if (!puff) continue
        if (structuralStress <= 0.01) {
          puff.visible = false
          continue
        }

        const phase = (runtime.elapsed * (0.6 + structuralStress * 1.35) + i / SMOKE_PUFF_COUNT) % 1
        const trailDistance = 2.4 + phase * (6.2 + structuralStress * 4.8)
        const lateralOffset = Math.sin(runtime.elapsed * 2.9 + i * 1.6) * (0.22 + phase * 1.1)
        const verticalOffset = Math.cos(runtime.elapsed * 3.4 + i * 2.1) * 0.18 + phase * (0.42 + structuralStress * 0.6)
        const scale = 0.35 + phase * (1.2 + structuralStress * 1.8)
        const opacity = (1 - phase) * (0.08 + structuralStress * 0.38)

        tempEnginePos
          .copy(runtime.playerPosition)
          .addScaledVector(tempSmokeForward, -trailDistance)
          .addScaledVector(tempRight, lateralOffset)
          .addScaledVector(tempUp, verticalOffset)
          .addScaledVector(runtime.playerVelocity, phase * 0.06)
        puff.position.copy(tempEnginePos)
        puff.scale.setScalar(scale)
        puff.visible = true

        const puffMaterial = puff.material as MeshStandardMaterial
        puffMaterial.opacity = opacity
        puffMaterial.emissiveIntensity = 0.02 + structuralStress * 0.08
      }
    }

    for (let i = 0; i < runtime.asteroids.length; i += 1) {
      const asteroid = runtime.asteroids[i]
      const group = asteroidGroupRefs.current[i]
      let mesh = asteroidMeshRefs.current[i]
      if (!mesh && group) {
        const found = group.getObjectByProperty('isMesh', true) as Mesh | undefined
        if (found) {
          asteroidMeshRefs.current[i] = found
          mesh = found
        }
      }
      if (!group || !mesh) continue

      group.position.copy(asteroid.position)
      group.scale.setScalar(asteroid.radius / 2.7)

      mesh.rotation.x += asteroid.rotationSpeed.x * delta
      mesh.rotation.y += asteroid.rotationSpeed.y * delta
      mesh.rotation.z += asteroid.rotationSpeed.z * delta

      const material = mesh.material as MeshStandardMaterial
      const oreRatio = MathUtils.clamp(asteroid.oreReserve / Math.max(1, asteroid.maxOreReserve), 0, 1)
      const depletion = 1 - oreRatio
      const richMap = material.userData.richMap as Texture | undefined
      const depletedMap = material.userData.depletedMap as Texture | undefined
      const targetMap = oreRatio <= 0.04 ? depletedMap : richMap
      if (targetMap && material.userData.activeTriMap !== targetMap) {
        material.userData.activeTriMap = targetMap
        configureTriplanarMaterial(material, targetMap)
      }

      // Keep ore color aligned with Mining Ops listing; darken only as reserves are exhausted.
      tempAsteroidBaseColor.set(asteroid.baseColor)
      if (asteroid.hasPowerball && !asteroid.powerballRecovered) {
        tempAsteroidBaseColor.lerp(powerballAsteroidColor, 0.78)
      }
      tempAsteroidColor.copy(tempAsteroidBaseColor)
      tempAsteroidColor.lerp(depletedAsteroidColor, depletion * 0.72)
      material.color.copy(tempAsteroidColor)
      material.roughness = 0.76 + depletion * 0.2
      material.metalness = 0.18 - depletion * 0.1

      if (runtime.grabbedAsteroidId === asteroid.id) {
        const lockPulse = (Math.sin(runtime.elapsed * 7.2 + asteroid.id * 0.9) + 1) * 0.5
        const baseGlow = oreRatio <= 0.01 ? 0.12 : 0.08
        tempGrabberGlowColor.copy(tempAsteroidColor).lerp(grabberLockGlowTint, 0.26)
        material.emissive.copy(tempGrabberGlowColor)
        material.emissiveIntensity = baseGlow + lockPulse * 0.08
      } else if (oreRatio <= 0.01) {
        material.emissive.set('#221a18')
        material.emissiveIntensity = 0.26
      } else if (asteroid.hasPowerball && !asteroid.powerballRecovered) {
        material.emissive.set('#5a2f7c')
        material.emissiveIntensity = 0.42
      } else {
        material.emissive.set('#000000')
        material.emissiveIntensity = 0.2
      }
    }

    if (pirateRef.current) {
      pirateRef.current.position.copy(runtime.piratePosition)
      pirateRef.current.visible = runtime.pirateState !== 'quiet'
      if (runtime.pirateState === 'disabled') {
        pirateRef.current.rotation.z += delta * 0.55
      } else if (runtime.pirateVelocity.lengthSq() > 0.02) {
        tempTarget.copy(runtime.piratePosition).add(runtime.pirateVelocity)
        pirateRef.current.lookAt(tempTarget)
      }
    }

    if (pirateLightRef.current) {
      pirateLightRef.current.position.copy(runtime.piratePosition)
    }

    if (freighterRef.current) {
      freighterRef.current.position.copy(runtime.freighterPosition)
    }

    if (freighterDockRingRef.current) {
      freighterDockRingRef.current.position.copy(runtime.freighterPosition)
    }

    if (freighterLightRef.current) {
      freighterLightRef.current.position.copy(runtime.freighterPosition)
    }

    for (let i = 0; i < runtime.cargoShots.length; i += 1) {
      const shot = runtime.cargoShots[i]
      const mesh = cargoShotRefs.current[i]
      if (!mesh) continue
      mesh.position.copy(shot.position)
    }

    if (grabberBeamRef.current) {
      const grabbed = runtime.asteroids.find((candidate) => candidate.id === runtime.grabbedAsteroidId)
      if (!grabbed) {
        grabberBeamRef.current.visible = false
      } else {
        grabberBeamRef.current.visible = true

        tempForward.copy(grabbed.position).sub(runtime.playerPosition)
        const distance = Math.max(0.05, tempForward.length())
        const armLength = Math.max(0.25, distance + GRABBER_ARM_TARGET_OVERREACH)

        tempForward.normalize()
        tempTarget.copy(runtime.playerPosition).addScaledVector(tempForward, armLength * 0.5)
        grabberBeamRef.current.position.copy(tempTarget)
        tempQuaternion.setFromUnitVectors(tempUp, tempForward)
        grabberBeamRef.current.quaternion.copy(tempQuaternion)
        grabberBeamRef.current.scale.set(0.13, armLength * 0.5, 0.13)
      }
    }

    tempForward.copy(getPlayerForward(runtime))
    if (runtime.playerVelocity.lengthSq() > 1) {
      tempForward.copy(runtime.playerVelocity).normalize()
    }

    tempRight.crossVectors(tempForward, tempUp).normalize()
    tempCamera
      .copy(runtime.playerPosition)
      .addScaledVector(tempForward, -12.5)
      .addScaledVector(tempRight, 1.6)
      .addScaledVector(tempUp, 4.3)

    const collisionJolt = MathUtils.clamp(runtime.collisionGrace / 0.33, 0, 1)
    const shakeStrength = structuralStress * 0.45 + collisionJolt * 0.42
    if (shakeStrength > 0.001) {
      tempShake
        .set(
          Math.sin(runtime.elapsed * 37.2) + Math.sin(runtime.elapsed * 19.4 + 1.3) * 0.55,
          Math.cos(runtime.elapsed * 33.1 + 0.8) + Math.sin(runtime.elapsed * 23.6) * 0.4,
          Math.sin(runtime.elapsed * 28.5 + 2.4) * 0.65,
        )
        .multiplyScalar(shakeStrength * 0.26)
      tempCamera.add(tempShake)
    }

    const cameraLerp = 1 - Math.exp(-delta * 5.2)
    camera.position.lerp(tempCamera, cameraLerp)
    tempTarget.copy(runtime.playerPosition).addScaledVector(tempForward, 5).addScaledVector(tempUp, 1)
    camera.lookAt(tempTarget)
  })

  return (
    <>
      <color attach="background" args={['#070d0f']} />
      <fog attach="fog" args={['#0a1216', 34, 190]} />

      <mesh scale={280}>
        <sphereGeometry args={[1, 46, 42]} />
        <meshBasicMaterial color="#1b1713" side={BackSide} />
      </mesh>
      <mesh scale={220} position={[0, 20, 0]}>
        <sphereGeometry args={[1, 40, 36]} />
        <meshBasicMaterial color="#25211b" side={BackSide} transparent opacity={0.45} />
      </mesh>

      <ambientLight intensity={0.36} color="#958877" />
      <directionalLight
        position={[40, 60, 40]}
        intensity={1.2}
        color="#d2bea2"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight ref={freighterLightRef} intensity={24} distance={48} color="#d7a260" />
      <pointLight ref={pirateLightRef} intensity={12} distance={44} color="#d7635e" />
      <pointLight position={[12, -8, 26]} intensity={7} distance={90} color="#5e4a33" />

      <Stars radius={250} depth={140} count={5600} factor={4.8} saturation={0} fade speed={0.55} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6, -35, 0]} receiveShadow>
        <circleGeometry args={[130, 72]} />
        <meshStandardMaterial color="#141e21" roughness={1} metalness={0.08} />
      </mesh>

      <Freighter freighterRef={freighterRef} />
      <PlayerCraft playerRef={playerRef} />
      {Array.from({ length: SMOKE_PUFF_COUNT }).map((_, index) => (
        <mesh
          key={`hull-smoke-${index}`}
          ref={(node) => {
            smokeRefs.current[index] = node
          }}
          visible={false}
        >
          <sphereGeometry args={[0.45, 12, 12]} />
          <meshStandardMaterial
            color="#4a4d4e"
            emissive="#2a2d30"
            transparent
            opacity={0}
            depthWrite={false}
            roughness={1}
            metalness={0}
          />
        </mesh>
      ))}
      <pointLight ref={playerEngineLightRef} intensity={0.45} distance={9} color="#ff7a33" />
      <PirateCraft pirateRef={pirateRef} disabled={runtime.pirateState === 'disabled'} />
      <AsteroidField runtime={runtime} groupRefs={asteroidGroupRefs} meshRefs={asteroidMeshRefs} />
      {runtime.cargoShots.map((shot, index) => (
        <mesh
          key={shot.id}
          ref={(node) => {
            cargoShotRefs.current[index] = node
          }}
          position={[shot.position.x, shot.position.y, shot.position.z]}
        >
          <sphereGeometry args={[0.55, 10, 10]} />
          <meshStandardMaterial color={shot.color} emissive={shot.color} emissiveIntensity={1.1} />
        </mesh>
      ))}

      <mesh ref={grabberBeamRef} visible={false}>
        <cylinderGeometry args={[1, 1, 1, 10]} />
        <meshStandardMaterial
          color="#8b939c"
          emissive="#1d2228"
          emissiveIntensity={0.08}
          roughness={0.42}
          metalness={0.88}
        />
      </mesh>

      <mesh ref={freighterDockRingRef}>
        <ringGeometry args={[FREIGHTER_DOCK_RADIUS - 0.5, FREIGHTER_DOCK_RADIUS + 0.15, 48]} />
        <meshBasicMaterial color="#c99952" transparent opacity={0.35} side={2} />
      </mesh>

      <EffectComposer multisampling={0}>
        <Bloom intensity={0.62} luminanceThreshold={0.2} luminanceSmoothing={0.18} mipmapBlur />
        <Noise opacity={0.045} />
        <Vignette eskil={false} offset={0.21} darkness={0.8} />
      </EffectComposer>
    </>
  )
}

function HudPanel({
  hud,
  pirateDanger,
  onDisembarkEarly,
}: {
  hud: HudSnapshot
  pirateDanger: PirateDangerProfile | null
  onDisembarkEarly: () => void
}) {
  const playerHullPercent = Math.max(0, Math.min(100, (hud.hull / hud.maxHull) * 100))
  const pirateHullPercent =
    hud.pirateMaxHull > 0 ? Math.max(0, Math.min(100, (hud.pirateHull / hud.pirateMaxHull) * 100)) : 0
  const boardingThreatSeconds = hud.pirateState === 'incoming' ? hud.pirateBoardEta : Infinity
  const countdownDriver =
    hud.pirateState === 'boarding' || hud.pirateState === 'incoming' ? 'Pirate Boarding' : 'Freighter Departure'
  const criticalCountdownSeconds =
    hud.pirateState === 'boarding'
      ? 0
      : countdownDriver === 'Pirate Boarding'
        ? boardingThreatSeconds
        : hud.missionSeconds
  const unloadPercent = Math.round(hud.dockUnloadProgress * 100)
  const repairPercent = Math.round(hud.dockRepairProgress * 100)
  const absBearing = Math.abs(hud.freighterRelativeAngleDeg)
  const freighterBearingLabel = hud.docked
    ? 'Docked'
    : absBearing < 20
      ? 'Ahead'
      : absBearing < 65
        ? hud.freighterRelativeAngleDeg > 0
          ? 'Right'
          : 'Left'
        : absBearing < 125
          ? hud.freighterRelativeAngleDeg > 0
            ? 'Rear-Right'
            : 'Rear-Left'
          : 'Behind'
  const showRiskPanel = hud.status === 'active'
  const showDockingPanel = hud.status === 'active'
  const showOpsPanel = !hud.docked || hud.resourceBins.length > 0 || hud.cargoUsed > 0
  const showControlsPanel = hud.status === 'active' && hud.elapsed < 95
  const grabberRange = hud.grabberRange
  const grabberProximityPercent =
    hud.grabbedAsteroidId !== null
      ? 100
      : hud.grabberTargetDistance === null
        ? 0
        : Math.max(0, Math.min(100, (1 - hud.grabberTargetDistance / grabberRange) * 100))
  const grabberStatusTone =
    hud.grabbedAsteroidId !== null ? 'locked' : hud.grabberReady ? 'ready' : 'alert'
  const grabberStatusLabel =
    hud.grabbedAsteroidId !== null
      ? `LOCKED: #${hud.grabbedAsteroidId}`
      : hud.grabberReady
        ? `READY: #${hud.grabberTargetId ?? '--'}`
        : 'OUT OF RANGE'
  const grabberDistanceLabel =
    hud.grabberTargetDistance === null ? '--' : `${hud.grabberTargetDistance.toFixed(1)}m`

  return (
    <div className="hud-layout">
      <aside className="hud-card hud-card-nav">
        <h2>Freighter Nav</h2>
        <div className="nav-grid">
          <div className="nav-metric">
            <label>Distance</label>
            <strong>{hud.distanceToFreighter.toFixed(1)}m</strong>
          </div>
        </div>
      </aside>
      <div className="hud-nav-compass" role="presentation">
        <span className="bearing-forward">FWD</span>
        <div className="bearing-compass">
          <span className="bearing-ring" />
          <span
            className="bearing-pointer"
            style={{ transform: `translate(-50%, -50%) rotate(${hud.freighterRelativeAngleDeg}deg)` }}
          />
        </div>
        <strong className="bearing-label">{freighterBearingLabel}</strong>
      </div>

      <div className="hud-stack hud-stack-left">
        <aside className="hud-card hud-card-core">
          <h1>FRINGE DRIFTERS: SALVAGE RUN</h1>
          <div className="metric-grid">
            <div className="countdown-cell">
              <label>Critical Countdown</label>
              <strong>{formatClock(criticalCountdownSeconds)}</strong>
              <span className="subtle">Driver: {countdownDriver}</span>
            </div>
            <div className="hull-cell">
              <label>Hull Integrity</label>
              <strong>{Math.max(0, hud.hull).toFixed(0)}%</strong>
              <div className="status-bar" role="presentation">
                <div className="status-fill hull-fill" style={{ width: `${playerHullPercent}%` }} />
              </div>
            </div>
            <div className="throttle-cell">
              <label>Throttle</label>
              <strong>{Math.round(hud.throttleLevel * 100)}%</strong>
              <div className="status-bar" role="presentation">
                <div className="status-fill throttle-fill" style={{ width: `${hud.throttleLevel * 100}%` }} />
              </div>
            </div>
            <div>
              <label>Delivered</label>
              <strong>{hud.deliveredValue.toLocaleString()} cr</strong>
            </div>
            <div>
              <label>Powerballs Delivered</label>
              <strong>{hud.deliveredPowerballScore}</strong>
            </div>
            <div>
              <label>Dock State</label>
              <strong>{hud.docked ? 'DOCKED' : 'UN-DOCKED'}</strong>
            </div>
            <div>
              <label>Weapon Ammo</label>
              <strong>
                {hud.weaponAmmo} / {hud.weaponMaxAmmo}
              </strong>
            </div>
          </div>
        </aside>

        {showControlsPanel && (
          <aside className="hud-card hud-card-controls">
            <h2>Flight Controls</h2>
            <p className="subtle">
              Throttle step up: W
              <br />
              Throttle step down: S
              <br />
              Emergency stop: X
              <br />
              Aim craft: Arrow keys
              <br />
              Launch cargo canister: Space
              <br />
              Weapon shot: Q
              <br />
              Grabber: G | Drill: F | Dock/Undock: E
              {hud.docked && (
                <>
                  <br />
                  Disembark Early: Enter
                </>
              )}
            </p>
          </aside>
        )}

        <aside className="hud-card hud-card-comms hud-card-scroll">
          <h2>Comms Log</h2>
          {hud.events.map((entry) => (
            <p key={entry.id} className={`event-${entry.tone}`}>
              {entry.message}
            </p>
          ))}
        </aside>
      </div>

      <div className="hud-stack hud-stack-right">
        <aside className="hud-card hud-card-cargo">
          <h2>Cargo Status</h2>
          <div>
            <label>Cargo Value</label>
            <strong>{hud.cargoValue.toLocaleString()} cr</strong>
          </div>
          <div className="dock-progress-row">
            <label>Powerballs Aboard</label>
            <strong>{hud.powerballCargo}</strong>
          </div>
          <div className="dock-progress-row">
            <label>Cargo Hold</label>
            <strong>
              {hud.cargoUsed.toFixed(0)} / {hud.cargoCapacity}
            </strong>
          </div>
          <div className="status-bar" role="presentation">
            <div
              className="status-fill cargo-fill"
              style={{ width: `${Math.min(100, (hud.cargoUsed / hud.cargoCapacity) * 100)}%` }}
            />
          </div>
        </aside>

        {showDockingPanel && (
          <aside className="hud-card hud-card-docking">
            <h2>Docking</h2>
            <p>
              {hud.docked &&
                'Docked. Cargo is unloading over time and hull repairs are in progress. Press E to undock.'}
              {!hud.docked &&
                hud.distanceToFreighter <= FREIGHTER_DOCK_RADIUS &&
                'Docking collar in range. Press E to dock.'}
              {!hud.docked &&
                hud.distanceToFreighter > FREIGHTER_DOCK_RADIUS &&
                hud.distanceToFreighter <= FREIGHTER_DOCK_APPROACH_RADIUS &&
                'Dock assist in range. Press E to dock.'}
              {!hud.docked &&
                hud.distanceToFreighter > FREIGHTER_DOCK_APPROACH_RADIUS &&
                'Too far for dock assist. Return toward freighter and press E.'}
            </p>
            {hud.docked && (
              <>
                <div className="dock-progress-row">
                  <label>Unload Progress</label>
                  <strong>
                    {unloadPercent}% ({hud.dockUnloadRemainingUnits} units left)
                  </strong>
                </div>
                <div className="status-bar" role="presentation">
                  <div className="status-fill unload-fill" style={{ width: `${unloadPercent}%` }} />
                </div>
                <div className="dock-progress-row">
                  <label>Repair Progress</label>
                  <strong>
                    {repairPercent}% ({Math.ceil(hud.dockRepairRemainingHull)} hull left)
                  </strong>
                </div>
                <div className="status-bar" role="presentation">
                  <div className="status-fill repair-fill" style={{ width: `${repairPercent}%` }} />
                </div>
                <p className="subtle">Command available while docked: Disembark Early (Enter).</p>
                <button className="hangar-upgrade-btn" onClick={onDisembarkEarly}>
                  Disembark Early
                </button>
              </>
            )}
          </aside>
        )}

        {showRiskPanel && (
          <aside className="hud-card hud-card-risk">
            <h2>Mission Risks</h2>
            {pirateDanger && (
              <>
                <div className="dock-progress-row">
                  <label>Pirate Danger</label>
                  <strong>
                    {pirateDanger.label} (L{pirateDanger.level})
                  </strong>
                </div>
                <div className="dock-progress-row">
                  <label>Contact Odds</label>
                  <strong>{Math.round(pirateDanger.encounterChance * 100)}%</strong>
                </div>
              </>
            )}
            {hud.pirateState !== 'quiet' && (
              <>
                <p>
                  {hud.pirateState === 'incoming' && 'Pirate raider circling freighter. Delay or disable it.'}
                  {hud.pirateState === 'disabled' && 'Pirate ship disabled. Boarding threat neutralized.'}
                  {hud.pirateState === 'boarding' && 'Pirates are boarding the freighter.'}
                </p>
                {hud.pirateState !== 'boarding' && (
                  <>
                    <p className="subtle">
                      Pirate hull: {Math.max(0, hud.pirateHull).toFixed(0)} / {hud.pirateMaxHull}
                    </p>
                    <div className="status-bar" role="presentation">
                      <div className="status-fill pirate-fill" style={{ width: `${pirateHullPercent}%` }} />
                    </div>
                  </>
                )}
              </>
            )}
            {hud.pirateState === 'quiet' && <p className="subtle">No active raider contact on local sensors.</p>}
          </aside>
        )}

        {showOpsPanel && (
          <aside className="hud-card hud-card-ops hud-card-scroll">
            <h2>Mining Ops</h2>
            <div className={`grabber-indicator grabber-state-${grabberStatusTone}`}>
              <div className="dock-progress-row">
                <label>Grabber Status</label>
                <strong>{grabberStatusLabel}</strong>
              </div>
              <div className="dock-progress-row">
                <label>Nearest Surface Distance</label>
                <strong>{grabberDistanceLabel}</strong>
              </div>
              <div className="status-bar" role="presentation">
                <div className="status-fill grabber-fill" style={{ width: `${grabberProximityPercent}%` }} />
              </div>
            </div>
            <p>
              {hud.docked
                ? 'Mining systems idle while docked.'
                : hud.grabbedAsteroidId !== null
                  ? `Grabber locked to asteroid #${hud.grabbedAsteroidId}. Hold F to drill.`
                  : hud.grabberReady
                    ? `Asteroid #${hud.grabberTargetId ?? '--'} is in grab range. Press G to latch.`
                    : 'No grabber lock. Close in and press G.'
              }
            </p>
            <p className="subtle">Space launches cargo canisters. Q fires weapon ammo (if installed).</p>

            <h2>Cargo Manifest</h2>
            {hud.resourceBins.length === 0 && <p className="subtle">Cargo hold empty.</p>}
            {hud.resourceBins.map((bin) => (
              <div className="cargo-row" key={bin.resourceId}>
                <span style={{ color: bin.color }}>{bin.label}</span>
                <span>
                  {bin.units}u | {bin.volume} vol | {bin.value} cr
                </span>
              </div>
            ))}
          </aside>
        )}
      </div>
    </div>
  )
}

function LoadingBriefingView({
  loadingProgress,
  loadingReady,
  onContinue,
}: {
  loadingProgress: number
  loadingReady: boolean
  onContinue: () => void
}) {
  return (
    <div className="loading-view">
      <section className="hud-card loading-briefing">
        <h1>POWERBALL // SHIPBOARD INTAKE</h1>
        <h2>Captain&apos;s Briefing</h2>
        <p className="subtle">Captain Roddard K Harbarth, commanding freighter captain on this longhaul.</p>
        <p>
          Glad you&apos;re aboard, but we don&apos;t waste berth space or kit on dead weight. Like every other kip here,
          you&apos;ll be working.
        </p>
        <p>
          Hear tell you&apos;re a pilot. Good. We pass asteroid fields on route, and every time we do, you&apos;ll head out in
          a mine-quipt smallcraft and pull in whatever haul is floating out there.
        </p>
        <p>
          And if you come across powerballs, all the better. The crew will be pleased to add more to the vault.
        </p>
        <p>
          One more thing: the freighter won&apos;t stop for you if you dawdle, and you&apos;d best watch out for pirates lurking
          in the rocks.
        </p>
        <div className="loading-actions">
          <div className="loading-progress">
            <label>Freighter Systems Link</label>
            <strong>{Math.round(loadingProgress)}%</strong>
            <div className="status-bar" role="presentation">
              <div className="status-fill throttle-fill" style={{ width: `${loadingProgress}%` }} />
            </div>
          </div>
          <button className="hangar-launch-btn" onClick={onContinue} disabled={!loadingReady}>
            {loadingReady ? 'Report To Hangar' : 'Syncing Systems...'}
          </button>
        </div>
      </section>
      <section className="hud-card captain-portrait-card">
        <img src={CAPTAIN_IMAGE_PATH} alt="Captain Roddard K Harbarth" className="captain-portrait" />
      </section>
    </div>
  )
}

function HangarView({
  career,
  debrief,
  pirateDanger,
  onLaunch,
  onBuyUpgrade,
  onEquipUpgrade,
  onUnequipUpgrade,
}: {
  career: CareerState
  debrief: DebriefReport | null
  pirateDanger: PirateDangerProfile
  onLaunch: () => void
  onBuyUpgrade: (key: UpgradeKey, level: number) => void
  onEquipUpgrade: (key: UpgradeKey, level: number) => void
  onUnequipUpgrade: (key: UpgradeKey) => void
}) {
  const equippedLevels = loadoutToUpgradeLevels(career.loadout)
  const runMods = buildRunModifiers(equippedLevels)

  return (
    <div className="hangar-view">
      <div className="hangar-column-left">
        <section className="hud-card hangar-header">
          <h1>POWERBALL // FREIGHTER HANGAR</h1>
          <div className="metric-grid">
            <div>
              <label>Credits</label>
              <strong>{career.credits.toLocaleString()} cr</strong>
            </div>
            <div>
              <label>Powerballs Delivered</label>
              <strong>{career.deliveredPowerballs}</strong>
            </div>
            <div>
              <label>Runs Completed</label>
              <strong>{career.runsCompleted}</strong>
            </div>
            <div>
              <label>Launch Profile</label>
              <strong>
                GR {runMods.grabberRange.toFixed(1)}m | H {runMods.maxHull.toFixed(0)} | C {runMods.cargoCapacity} | RM{' '}
                {runMods.rammerDamageMultiplier.toFixed(2)}x / {Math.round(runMods.rammerSelfDamageMultiplier * 100)}%
              </strong>
            </div>
            <div>
              <label>Pirate Danger</label>
              <strong>
                {pirateDanger.label} (L{pirateDanger.level})
              </strong>
            </div>
            <div>
              <label>Pirate Contact Odds</label>
              <strong>{Math.round(pirateDanger.encounterChance * 100)}%</strong>
            </div>
          </div>
        </section>

        {debrief && (
          <section className="hud-card hangar-debrief">
            <h2>{debrief.status === 'won' ? 'Run Debrief: Success' : 'Run Debrief: Failure'}</h2>
            <p>{debrief.message}</p>
            {debrief.status === 'won' && (
              <p className="subtle">
                Banked this run: +{debrief.creditsDelta.toLocaleString()} credits, +{debrief.powerballsDelta} powerballs
              </p>
            )}
            {debrief.status === 'lost' && (
              <p className="subtle">Equipped loadout hardware was lost. Unequipped inventory remains in storage.</p>
            )}
          </section>
        )}

        <section className="hud-card hangar-launch">
          <h2>Ready Bay</h2>
          <p className="subtle">Launch when ready. Loadout locks for the next asteroid run.</p>
          <button className="hangar-launch-btn" onClick={onLaunch}>
            Launch Smallcraft
          </button>
        </section>

        <section className="hud-card hangar-inventory-notes">
          <div className="dock-progress-row">
            <label>Loadout Outcome Risk</label>
            <strong>Only equipped modules are lost on failed runs</strong>
          </div>
          <div className="dock-progress-row">
            <label>Inventory Notes</label>
            <strong>Stored modules survive mission failure</strong>
          </div>
        </section>

        <section className="hangar-upgrades">
          {UPGRADE_ORDER.map((key) => {
            const def = UPGRADE_DEFINITIONS[key]
            const equippedLevel = career.loadout[key]

            return (
              <article className="hud-card hangar-upgrade-card" key={def.key}>
                <div className="hangar-upgrade-layout">
                  <div className="hangar-upgrade-copy">
                    <h2>{def.label}</h2>
                    <p>{def.description}</p>
                    <div className="dock-progress-row">
                      <label>Equipped</label>
                      <strong>{equippedLevel ? `Level ${equippedLevel}` : 'Unequipped'}</strong>
                    </div>
                    {equippedLevel && (
                      <button className="hangar-upgrade-btn" onClick={() => onUnequipUpgrade(def.key)}>
                        Unequip
                      </button>
                    )}
                  </div>
                  <div className="hangar-upgrade-stats">
                    <div className="hangar-upgrade-level-list">
                      {Array.from({ length: def.maxLevel }, (_, index) => {
                        const level = index + 1
                        const ownedCount = getUpgradeInventoryCount(career.inventory, key, level)
                        const isEquipped = equippedLevel === level
                        const cost = getUpgradeCost(def, level)
                        const requiredPowerballs = getUpgradePowerballRequirement(def, level)
                        const lockedByPowerballs = career.deliveredPowerballs < requiredPowerballs
                        const lockedByCredits = career.credits < cost
                        const canBuy = !lockedByPowerballs && !lockedByCredits
                        const canEquip = ownedCount > 0

                        let buyLabel = `Buy L${level}`
                        if (lockedByPowerballs) buyLabel = 'Locked'
                        else if (lockedByCredits) buyLabel = 'Need Credits'

                        let equipLabel = 'Equip'
                        if (isEquipped) equipLabel = 'Equipped'
                        else if (!canEquip) equipLabel = 'No Stock'

                        return (
                          <div className="hangar-upgrade-level-row" key={`${def.key}-level-${level}`}>
                            <div className="hangar-upgrade-level-meta">
                              <strong className="hangar-upgrade-level-title">Level {level}</strong>
                              <span>{getUpgradeStatSummary(def.key, level)}</span>
                            </div>
                            <div className="hangar-upgrade-level-economy">
                              <span>{ownedCount}x owned</span>
                              <span>{cost.toLocaleString()} cr</span>
                              <span>
                                PB {career.deliveredPowerballs} / {requiredPowerballs}
                              </span>
                            </div>
                            <div className="hangar-upgrade-level-actions">
                              <button
                                className="hangar-upgrade-btn"
                                onClick={() => onBuyUpgrade(def.key, level)}
                                disabled={!canBuy}
                              >
                                {buyLabel}
                              </button>
                              <button
                                className="hangar-upgrade-btn"
                                onClick={() => onEquipUpgrade(def.key, level)}
                                disabled={!canEquip || isEquipped}
                              >
                                {equipLabel}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </section>
      </div>
    </div>
  )
}

function App() {
  const [screen, setScreen] = useState<'loading' | 'hangar' | 'flight'>('loading')
  const [career, setCareer] = useState<CareerState>({
    credits: 0,
    deliveredPowerballs: 0,
    inventory: createUpgradeInventory(),
    loadout: createUpgradeLoadout(),
    runsCompleted: 0,
  })
  const [debrief, setDebrief] = useState<DebriefReport | null>(null)
  const [runtime, setRuntime] = useState<GameRuntime | null>(null)
  const [hud, setHud] = useState<HudSnapshot | null>(null)
  const [hangarClockMs, setHangarClockMs] = useState(() => Date.now())
  const [activeRunDanger, setActiveRunDanger] = useState<PirateDangerProfile | null>(null)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingReady, setLoadingReady] = useState(false)
  const [showHullBreachModal, setShowHullBreachModal] = useState(false)
  const audioRef = useRef<GameAudioEngine | null>(null)
  const pirateDanger = useMemo(() => getTimeDrivenPirateDangerProfile(hangarClockMs), [hangarClockMs])

  useEffect(() => {
    const audio = new GameAudioEngine()
    audioRef.current = audio

    return () => {
      audio.dispose()
      if (audioRef.current === audio) {
        audioRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const tickInterfaceAudio = () => {
      audioRef.current?.updateInterfaceAudio(screen)
    }
    tickInterfaceAudio()
    const timer = window.setInterval(tickInterfaceAudio, 140)
    return () => window.clearInterval(timer)
  }, [screen])

  useEffect(() => {
    if (screen !== 'loading') return

    let progress = 0
    const timer = window.setInterval(() => {
      progress = Math.min(100, progress + 6 + Math.random() * 10)
      const rounded = Math.round(progress)
      setLoadingProgress(rounded)
      if (rounded >= 100) {
        setLoadingReady(true)
        window.clearInterval(timer)
      }
    }, 130)

    return () => window.clearInterval(timer)
  }, [screen])

  useEffect(() => {
    if (screen !== 'hangar') return
    const timer = window.setInterval(() => {
      setHangarClockMs(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [screen])

  useEffect(() => {
    if (!runtime) return
    const timer = window.setInterval(() => {
      const nextHud = createHudSnapshot(runtime)
      audioRef.current?.update(runtime, nextHud)

      if (screen === 'flight' && nextHud.status !== 'active') {
        if (nextHud.status === 'won') {
          const creditsDelta = nextHud.deliveredValue
          const powerballsDelta = nextHud.deliveredPowerballScore
          setCareer((prev) => ({
            ...prev,
            credits: prev.credits + creditsDelta,
            deliveredPowerballs: prev.deliveredPowerballs + powerballsDelta,
            runsCompleted: prev.runsCompleted + 1,
          }))
          setDebrief({
            status: 'won',
            message: nextHud.outcomeReason,
            creditsDelta,
            powerballsDelta,
          })
        } else {
          setCareer((prev) => ({
            ...prev,
            inventory: UPGRADE_ORDER.reduce((nextInventory, key) => {
              const equippedLevel = prev.loadout[key]
              if (!equippedLevel || equippedLevel <= 0) return nextInventory
              return removeUpgradeInventoryItem(nextInventory, key, equippedLevel, 1)
            }, prev.inventory),
            loadout: createUpgradeLoadout(),
            runsCompleted: prev.runsCompleted + 1,
          }))
          setDebrief({
            status: 'lost',
            message: nextHud.outcomeReason,
            creditsDelta: 0,
            powerballsDelta: 0,
          })
        }

        const isHullBreachLoss =
          nextHud.status === 'lost' && nextHud.outcomeReason === HULL_BREACH_OUTCOME_REASON
        if (isHullBreachLoss) {
          setHud(nextHud)
          setShowHullBreachModal(true)
          window.clearInterval(timer)
          return
        }

        setRuntime(null)
        setHud(null)
        setActiveRunDanger(null)
        setShowHullBreachModal(false)
        setHangarClockMs(Date.now())
        setScreen('hangar')
        window.clearInterval(timer)
        return
      }

      setHud(nextHud)
    }, 100)

    return () => window.clearInterval(timer)
  }, [runtime, screen])

  const launchRun = () => {
    const launchDanger = pirateDanger
    const loadoutLevels = loadoutToUpgradeLevels(career.loadout)
    const nextRuntime = createRuntime(Date.now(), {
      ...buildRunModifiers(loadoutLevels),
      pirateEncounterChance: launchDanger.encounterChance,
    })
    setActiveRunDanger(launchDanger)
    setRuntime(nextRuntime)
    setHud(createHudSnapshot(nextRuntime))
    setDebrief(null)
    setShowHullBreachModal(false)
    setScreen('flight')
  }

  const buyUpgrade = (key: UpgradeKey, level: number) => {
    const definition = UPGRADE_DEFINITIONS[key]
    setCareer((prev) => {
      if (level <= 0 || level > definition.maxLevel) return prev

      const cost = getUpgradeCost(definition, level)
      const requiredPowerballs = getUpgradePowerballRequirement(definition, level)
      if (prev.credits < cost || prev.deliveredPowerballs < requiredPowerballs) return prev

      return {
        ...prev,
        credits: prev.credits - cost,
        inventory: addUpgradeInventoryItem(prev.inventory, key, level, 1),
      }
    })
  }

  const equipUpgrade = (key: UpgradeKey, level: number) => {
    setCareer((prev) => {
      if (getUpgradeInventoryCount(prev.inventory, key, level) <= 0) return prev
      return {
        ...prev,
        loadout: {
          ...prev.loadout,
          [key]: level,
        },
      }
    })
  }

  const unequipUpgrade = (key: UpgradeKey) => {
    setCareer((prev) => ({
      ...prev,
      loadout: {
        ...prev.loadout,
        [key]: null,
      },
    }))
  }

  const enterHangarFromLoading = () => {
    if (!loadingReady) return
    setHangarClockMs(Date.now())
    setScreen('hangar')
  }

  const disembarkEarly = () => {
    if (!runtime || !canDisembarkEarly(runtime)) return
    if (triggerEarlyDisembark(runtime)) {
      setHud(createHudSnapshot(runtime))
    }
  }

  const returnToHangarFromHullBreach = () => {
    setRuntime(null)
    setHud(null)
    setActiveRunDanger(null)
    setShowHullBreachModal(false)
    setHangarClockMs(Date.now())
    setScreen('hangar')
  }

  if (screen === 'loading') {
    return (
      <main className="game-shell">
        <div className="hangar-background" />
        <div className="crt-overlay" />
        <LoadingBriefingView
          loadingProgress={loadingProgress}
          loadingReady={loadingReady}
          onContinue={enterHangarFromLoading}
        />
      </main>
    )
  }

  if (screen === 'hangar') {
    return (
      <main className="game-shell">
        <div className="hangar-scene hangar-scene-right">
          <Canvas
            camera={{ position: [-12, 0, 26], fov: 52, near: 0.1, far: 650 }}
            dpr={[1, 1.5]}
            onCreated={({ gl }) => {
              gl.toneMappingExposure = 1.55
            }}
          >
            <HangarBackdropScene />
          </Canvas>
        </div>
        <div className="hangar-left-shade" />
        <div className="hangar-split-divider" />
        <div className="hangar-background" />
        <div className="crt-overlay hangar-crt-overlay" />
        <HangarView
          career={career}
          debrief={debrief}
          pirateDanger={pirateDanger}
          onLaunch={launchRun}
          onBuyUpgrade={buyUpgrade}
          onEquipUpgrade={equipUpgrade}
          onUnequipUpgrade={unequipUpgrade}
        />
      </main>
    )
  }

  if (!runtime || !hud) return null

  return (
    <main className="game-shell">
      <Canvas shadows camera={{ position: [-96, 8, 18], fov: 58, near: 0.1, far: 500 }} dpr={[1, 1.5]}>
        <WorldSimulation key={runtime.runId} runtime={runtime} />
      </Canvas>

      <div className="crt-overlay" />
      <HudPanel hud={hud} pirateDanger={activeRunDanger} onDisembarkEarly={disembarkEarly} />
      {showHullBreachModal && (
        <div className="outcome-overlay">
          <section className="outcome-card">
            <h2>Hull Breach // Atmosphere Lost</h2>
            <p>Your craft took critical damage and lost atmo. You are now adrift.</p>
            <p className="subtle">Return to hangar for debrief and replacement loadout.</p>
            <button onClick={returnToHangarFromHullBreach}>Return To Hangar</button>
          </section>
        </div>
      )}
    </main>
  )
}

useGLTF.preload('/assets/models/freighter_v1.glb')
useGLTF.preload('/assets/models/smallcraft_v1.glb')
useGLTF.preload('/assets/models/pirate_v1.glb')
ASTEROID_GLB_PATHS.forEach((path) => useGLTF.preload(path))
useTexture.preload('/assets/textures/generated/freighter_hull_v1.svg')
useTexture.preload('/assets/textures/generated/smallcraft_hull_v1.svg')
useTexture.preload('/assets/textures/generated/pirate_hull_v1.svg')
useTexture.preload('/assets/textures/generated/asteroid_scrapiron_v1.svg')
useTexture.preload('/assets/textures/generated/asteroid_waterice_v1.svg')
useTexture.preload('/assets/textures/generated/asteroid_cobaltdust_v1.svg')
useTexture.preload('/assets/textures/generated/asteroid_xenocrystal_v1.svg')
useTexture.preload('/assets/textures/generated/asteroid_fringerelic_v1.svg')
useTexture.preload('/assets/textures/generated/asteroid_depleted_v1.svg')
useTexture.preload('/assets/textures/generated/hangar_rustbrown_v1.svg')
useTexture.preload('/assets/textures/generated/hangar_steelgray_v1.svg')

export default App
