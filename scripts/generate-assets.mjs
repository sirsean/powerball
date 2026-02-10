import fs from 'node:fs/promises'
import path from 'node:path'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

class NodeFileReader {
  constructor() {
    this.result = null
    this.onloadend = null
    this.onerror = null
  }

  readAsArrayBuffer(blob) {
    blob
      .arrayBuffer()
      .then((buffer) => {
        this.result = buffer
        if (this.onloadend) this.onloadend()
      })
      .catch((error) => {
        if (this.onerror) this.onerror(error)
      })
  }

  readAsDataURL(blob) {
    blob
      .arrayBuffer()
      .then((buffer) => {
        this.result = `data:application/octet-stream;base64,${Buffer.from(buffer).toString('base64')}`
        if (this.onloadend) this.onloadend()
      })
      .catch((error) => {
        if (this.onerror) this.onerror(error)
      })
  }
}

globalThis.FileReader = NodeFileReader

function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 4294967296
  }
}

function material(color, roughness, metalness, emissive = '#000000', emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
  })
}

function part(geometry, meshMaterial, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  const mesh = new THREE.Mesh(geometry, meshMaterial)
  mesh.position.set(x, y, z)
  mesh.rotation.set(rx, ry, rz)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function relaxIndexedGeometry(geometry, strength = 0.2, iterations = 1) {
  const index = geometry.getIndex()
  const position = geometry.getAttribute('position')
  if (!index || !position) return

  const current = position.array
  const vertexCount = position.count

  const addNeighbor = (sum, counts, vertex, neighbor) => {
    const v3 = vertex * 3
    const n3 = neighbor * 3
    sum[v3] += current[n3]
    sum[v3 + 1] += current[n3 + 1]
    sum[v3 + 2] += current[n3 + 2]
    counts[vertex] += 1
  }

  for (let step = 0; step < iterations; step += 1) {
    const sum = new Float32Array(vertexCount * 3)
    const counts = new Uint16Array(vertexCount)

    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i)
      const b = index.getX(i + 1)
      const c = index.getX(i + 2)

      addNeighbor(sum, counts, a, b)
      addNeighbor(sum, counts, a, c)
      addNeighbor(sum, counts, b, a)
      addNeighbor(sum, counts, b, c)
      addNeighbor(sum, counts, c, a)
      addNeighbor(sum, counts, c, b)
    }

    for (let v = 0; v < vertexCount; v += 1) {
      const count = counts[v]
      if (!count) continue

      const v3 = v * 3
      const inv = 1 / count
      const avgX = sum[v3] * inv
      const avgY = sum[v3 + 1] * inv
      const avgZ = sum[v3 + 2] * inv

      current[v3] = THREE.MathUtils.lerp(current[v3], avgX, strength)
      current[v3 + 1] = THREE.MathUtils.lerp(current[v3 + 1], avgY, strength)
      current[v3 + 2] = THREE.MathUtils.lerp(current[v3 + 2], avgZ, strength)
    }
  }

  position.needsUpdate = true
}

function fract(value) {
  return value - Math.floor(value)
}

function seededVectorNoise(x, y, z, seed, phase = 0) {
  const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 0.123 + phase * 17.17) * 43758.5453123
  return fract(v) * 2 - 1
}

function createSmallcraft() {
  const group = new THREE.Group()
  group.name = 'smallcraft_v1'

  const hull = material('#8e5f43', 0.86, 0.34)
  const hullDark = material('#674738', 0.9, 0.28)
  const steel = material('#59656f', 0.7, 0.5)
  const steelDark = material('#434d55', 0.82, 0.38)
  const trim = material('#b08960', 0.58, 0.45)
  const canopy = material('#a6b4bd', 0.2, 0.68)
  const toolGlow = material('#d7b35a', 0.34, 0.62, '#d7b35a', 1.2)
  const engineFlame = material('#ff7a33', 0.28, 0.72, '#ff5a24', 0.24)
  const warning = material('#b35d44', 0.62, 0.35)
  toolGlow.name = 'smallcraft_tool_glow'
  engineFlame.name = 'player_engine_flame'

  // Core fuselage + cockpit block.
  group.add(part(new THREE.BoxGeometry(3.25, 1.05, 5.05), hull, { y: -0.02, z: 0.12 }))
  group.add(part(new THREE.BoxGeometry(1.75, 0.62, 2.05), steel, { y: 0.56, z: 0.82 }))
  group.add(part(new THREE.BoxGeometry(1.12, 0.3, 1.15), canopy, { y: 0.78, z: 1.23 }))
  group.add(part(new THREE.BoxGeometry(1.85, 0.18, 2.72), warning, { y: -0.39, z: 0.18 }))

  // Nose assembly.
  group.add(part(new THREE.BoxGeometry(1.9, 0.86, 1.46), hullDark, { y: -0.02, z: 2.6 }))
  group.add(part(new THREE.CylinderGeometry(0.34, 0.5, 1.18, 14), steelDark, { z: 3.75, rx: Math.PI / 2 }))
  group.add(part(new THREE.CylinderGeometry(0.1, 0.2, 0.56, 12), toolGlow, { z: 4.38, rx: Math.PI / 2 }))
  group.add(part(new THREE.BoxGeometry(0.62, 0.16, 0.3), steel, { x: 0.52, y: 0.22, z: 3.78 }))

  // Side pods / industrial outriggers.
  group.add(part(new THREE.BoxGeometry(0.55, 0.43, 3.48), hullDark, { x: -1.66, y: -0.12, z: 0.18 }))
  group.add(part(new THREE.BoxGeometry(0.55, 0.43, 3.3), hullDark, { x: 1.66, y: -0.12, z: 0.12 }))
  group.add(part(new THREE.BoxGeometry(0.34, 0.22, 2.68), steelDark, { x: -1.96, y: -0.04, z: -0.08 }))
  group.add(part(new THREE.BoxGeometry(0.34, 0.22, 2.34), steelDark, { x: 1.96, y: -0.04, z: -0.2 }))
  group.add(part(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8), steel, { x: -1.62, y: -0.36, z: -0.92, rz: 0.9 }))
  group.add(part(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8), steel, { x: 1.6, y: -0.36, z: -1.02, rz: -0.9 }))

  // Rear engine cluster.
  group.add(part(new THREE.BoxGeometry(1.95, 0.95, 1.55), steelDark, { y: -0.04, z: -2.24 }))
  group.add(part(new THREE.CylinderGeometry(0.36, 0.44, 0.92, 14), trim, { x: 0, y: -0.02, z: -3.23, rx: Math.PI / 2 }))
  group.add(part(new THREE.CylinderGeometry(0.11, 0.2, 0.56, 12), engineFlame, { x: 0, y: -0.03, z: -3.95, rx: Math.PI / 2 }))
  group.add(part(new THREE.CylinderGeometry(0.1, 0.16, 0.46, 12), steel, { x: -0.78, y: -0.2, z: -3.1, rx: Math.PI / 2 }))
  group.add(part(new THREE.CylinderGeometry(0.1, 0.16, 0.46, 12), steel, { x: 0.78, y: -0.2, z: -3.1, rx: Math.PI / 2 }))

  // Mining arm + grabber rig asymmetry.
  group.add(part(new THREE.BoxGeometry(0.2, 0.16, 1.32), steel, { x: 1.84, y: -0.02, z: 1.88 }))
  group.add(part(new THREE.CylinderGeometry(0.08, 0.12, 0.42, 10), trim, { x: 1.84, y: -0.03, z: 2.66, rx: Math.PI / 2 }))
  group.add(part(new THREE.CylinderGeometry(0.05, 0.1, 0.36, 10), toolGlow, { x: 1.84, y: -0.03, z: 3.08, rx: Math.PI / 2 }))
  group.add(part(new THREE.BoxGeometry(0.18, 0.16, 1.08), steel, { x: -1.92, y: 0.06, z: 1.56 }))
  group.add(part(new THREE.CylinderGeometry(0.06, 0.06, 0.74, 8), steel, { x: -1.98, y: 0.2, z: 2.18, rz: 1.1 }))

  return group
}

function createFreighter() {
  const group = new THREE.Group()
  group.name = 'freighter_v1'

  const hullRed = material('#8b4a3f', 0.86, 0.34)
  const hullDark = material('#6c3a33', 0.9, 0.26)
  const steel = material('#59656f', 0.68, 0.56)
  const steelDark = material('#404950', 0.84, 0.42)
  const plateLight = material('#c8c1b2', 0.56, 0.32)
  const deck = material('#50463b', 0.96, 0.15)
  const tank = material('#9f8c5f', 0.47, 0.52, '#7b6531', 0.16)
  const ringLight = material('#d7a669', 0.4, 0.64, '#9f7346', 0.42)
  const thrusterGlow = material('#e9b16f', 0.3, 0.7, '#cf844a', 0.75)

  // Main spine and lower keel.
  group.add(part(new THREE.BoxGeometry(23.2, 3.55, 6.95), hullRed, { x: 0.38, y: -0.04, z: 0 }))
  group.add(part(new THREE.BoxGeometry(24.8, 0.42, 7.3), deck, { x: 0.1, y: -1.92, z: 0 }))
  group.add(part(new THREE.BoxGeometry(12.4, 0.36, 6.2), steelDark, { x: -1.8, y: -1.3, z: 0 }))

  // Bow docking collar and forward command block.
  group.add(part(new THREE.TorusGeometry(4.05, 0.18, 12, 56), ringLight, { x: -11.58, y: -0.12, z: 0, rx: Math.PI / 2 }))
  group.add(part(new THREE.RingGeometry(3.25, 3.48, 52), material('#efc788', 0.24, 0.76, '#9d7142', 0.38), { x: -11.58, y: -0.07, z: 0, ry: Math.PI }))
  group.add(part(new THREE.BoxGeometry(7.3, 2.55, 4.48), plateLight, { x: -8.15, y: 0.24, z: 0 }))
  group.add(part(new THREE.BoxGeometry(2.7, 1.95, 3.15), steel, { x: -5.15, y: 1.18, z: 0.08 }))
  group.add(part(new THREE.BoxGeometry(1.65, 0.38, 2.05), steelDark, { x: -5.5, y: 1.96, z: -0.08 }))

  // Midship superstructure and dorsal rail.
  group.add(part(new THREE.BoxGeometry(10.6, 0.52, 6.45), steel, { x: 1.1, y: 2.08, z: 0 }))
  group.add(part(new THREE.BoxGeometry(3.35, 2.08, 7.5), hullDark, { x: 3.95, y: 1.0, z: 0 }))
  group.add(part(new THREE.BoxGeometry(2.15, 1.8, 3.05), steelDark, { x: -0.3, y: 1.35, z: 0 }))
  group.add(part(new THREE.BoxGeometry(11.7, 0.18, 0.34), steelDark, { x: 1.15, y: 2.75, z: -2.6 }))
  group.add(part(new THREE.BoxGeometry(11.7, 0.18, 0.34), steelDark, { x: 1.15, y: 2.75, z: 2.6 }))

  // Aft engine block.
  group.add(part(new THREE.BoxGeometry(3.9, 2.35, 5.2), steelDark, { x: 9.35, y: 0.25, z: 0 }))
  group.add(part(new THREE.CylinderGeometry(1.78, 1.62, 3.55, 20), steel, { x: 11.75, y: 0.1, z: 0, rz: Math.PI / 2 }))
  group.add(part(new THREE.CylinderGeometry(0.42, 0.6, 1.02, 14), thrusterGlow, { x: 13.4, y: 0.08, z: 0, rz: Math.PI / 2 }))
  group.add(part(new THREE.CylinderGeometry(0.2, 0.28, 0.62, 12), thrusterGlow, { x: 12.88, y: 0.92, z: 1.42, rz: Math.PI / 2 }))
  group.add(part(new THREE.CylinderGeometry(0.2, 0.28, 0.62, 12), thrusterGlow, { x: 12.88, y: -0.8, z: -1.42, rz: Math.PI / 2 }))

  // Exposed cargo pods and trusswork.
  group.add(part(new THREE.BoxGeometry(5.2, 1.15, 1.55), plateLight, { x: 0.9, y: 0.8, z: -3.82 }))
  group.add(part(new THREE.BoxGeometry(4.4, 1.05, 1.35), steel, { x: 1.25, y: 0.45, z: 3.78 }))
  group.add(part(new THREE.BoxGeometry(3.1, 0.58, 1.18), hullDark, { x: 5.7, y: 0.34, z: -3.68 }))
  group.add(part(new THREE.BoxGeometry(2.7, 0.5, 1.05), steelDark, { x: 6.15, y: -0.15, z: 3.6 }))
  group.add(part(new THREE.CylinderGeometry(0.09, 0.09, 1.8, 10), steelDark, { x: -1.25, y: 0.22, z: -3.24, rz: 0.52 }))
  group.add(part(new THREE.CylinderGeometry(0.09, 0.09, 1.72, 10), steelDark, { x: 2.85, y: 0.12, z: 3.2, rz: -0.54 }))

  // Dorsal tank cluster to echo cassette-futurist industrial kit.
  for (let i = 0; i < 8; i += 1) {
    group.add(
      part(new THREE.CylinderGeometry(0.24, 0.24, 0.62, 14), tank, {
        x: 0.5 + i * 0.96,
        y: 1.66 + (i % 2 === 0 ? 0.1 : -0.1),
        z: 2.36,
        rx: Math.PI / 2,
      }),
    )
  }

  // Antennae / utility masts.
  group.add(part(new THREE.CylinderGeometry(0.05, 0.05, 1.52, 8), steelDark, { x: -2.45, y: 2.45, z: -0.35 }))
  group.add(part(new THREE.BoxGeometry(0.78, 0.07, 0.26), steelDark, { x: -2.45, y: 3.06, z: -0.35 }))
  group.add(part(new THREE.CylinderGeometry(0.04, 0.04, 1.22, 8), steel, { x: 4.85, y: 2.28, z: 0.25, rz: 0.34 }))

  return group
}

function createPirate() {
  const group = new THREE.Group()
  group.name = 'pirate_v1'

  const hullRed = material('#93413e', 0.74, 0.44)
  const redDark = material('#6f3330', 0.82, 0.36)
  const darkHull = material('#3c4248', 0.84, 0.34)
  const plateGray = material('#9aa0a6', 0.56, 0.44)
  const plateWarm = material('#d6d1c8', 0.54, 0.32)
  const tank = material('#9a8452', 0.5, 0.48, '#725d2e', 0.16)
  const engineGlow = material('#dd6e5f', 0.33, 0.62, '#dd6e5f', 1.55)

  // Long red hull with rectangular nose and dense aft block.
  group.add(part(new THREE.BoxGeometry(10.9, 1.22, 2.24), hullRed, { x: 0.12, y: 0, z: 0 }))
  group.add(part(new THREE.BoxGeometry(3.1, 1, 1.86), redDark, { x: -5.95, y: -0.03, z: -0.02 }))
  group.add(part(new THREE.BoxGeometry(1.35, 0.86, 1.52), redDark, { x: -7.75, y: 0.01, z: 0.03 }))
  group.add(part(new THREE.BoxGeometry(2.2, 1.18, 2.1), darkHull, { x: 5.55, y: -0.04, z: 0 }))
  group.add(part(new THREE.BoxGeometry(1.95, 1.35, 1.95), darkHull, { x: 7.4, y: -0.05, z: 0.02 }))
  group.add(part(new THREE.CylinderGeometry(0.92, 1.22, 1.55, 16), darkHull, { x: 8.72, y: -0.05, z: 0.02, rz: Math.PI / 2 }))
  group.add(part(new THREE.CylinderGeometry(0.29, 0.43, 1.08, 14), engineGlow, { x: 9.6, y: -0.02, z: 0.02, rz: Math.PI / 2 }))
  group.add(part(new THREE.CylinderGeometry(0.14, 0.22, 0.42, 12), engineGlow, { x: 8.9, y: 0.38, z: 0.56, rz: Math.PI / 2 }))
  group.add(part(new THREE.CylinderGeometry(0.14, 0.22, 0.42, 12), engineGlow, { x: 8.9, y: 0.38, z: -0.54, rz: Math.PI / 2 }))

  // Dorsal rack / canister deck.
  group.add(part(new THREE.BoxGeometry(6.25, 0.42, 1.42), darkHull, { x: 0.85, y: 0.74, z: 0.42 }))
  group.add(part(new THREE.BoxGeometry(2.4, 0.36, 1.26), redDark, { x: -2.2, y: 0.9, z: 0.15 }))
  group.add(part(new THREE.BoxGeometry(2.1, 0.36, 1.16), redDark, { x: 2.9, y: 0.9, z: 0.16 }))
  group.add(part(new THREE.BoxGeometry(0.5, 0.18, 2.42), plateGray, { x: -0.2, y: 1.01, z: -0.49 }))
  group.add(part(new THREE.BoxGeometry(0.42, 0.12, 2.16), plateGray, { x: 0.78, y: 1.02, z: -0.45 }))

  // Signature dorsal canister cluster.
  for (let i = 0; i < 10; i += 1) {
    const rowOffset = i % 2 === 0 ? 0.77 : 1.03
    const zOffset = i % 2 === 0 ? 0.96 : 0.74
    group.add(
      part(new THREE.CylinderGeometry(0.18, 0.18, 0.56, 14), tank, {
        x: -1.58 + i * 0.52,
        y: rowOffset,
        z: zOffset,
        rx: Math.PI / 2,
      }),
    )
  }

  // Side trusses / exposed substructure with asymmetric appendages.
  group.add(part(new THREE.BoxGeometry(3.45, 0.12, 0.42), plateGray, { x: -2.5, y: -0.22, z: -1.25 }))
  group.add(part(new THREE.BoxGeometry(2.9, 0.12, 0.4), plateGray, { x: 1.45, y: -0.24, z: -1.22 }))
  group.add(part(new THREE.BoxGeometry(2.15, 0.11, 0.36), plateGray, { x: -0.7, y: -0.33, z: 1.2 }))
  group.add(part(new THREE.CylinderGeometry(0.06, 0.06, 1.15, 8), darkHull, { x: -1.8, y: -0.48, z: -1.1, rz: 0.94 }))
  group.add(part(new THREE.CylinderGeometry(0.06, 0.06, 1.15, 8), darkHull, { x: 1.02, y: -0.5, z: -1.08, rz: -0.9 }))
  group.add(part(new THREE.BoxGeometry(1.7, 0.16, 0.32), plateWarm, { x: -4.4, y: -0.36, z: 1.15 }))
  group.add(part(new THREE.CylinderGeometry(0.09, 0.09, 0.82, 10), plateWarm, { x: -5.25, y: -0.28, z: 1.15, rz: Math.PI / 2 }))

  // Nose spike + mast + antennae.
  group.add(part(new THREE.CylinderGeometry(0.05, 0.15, 0.96, 8), darkHull, { x: -8.55, y: -0.05, z: 0.02, rz: Math.PI / 2 }))
  group.add(part(new THREE.CylinderGeometry(0.04, 0.04, 1.15, 8), darkHull, { x: 1.28, y: 1.53, z: -0.22 }))
  group.add(part(new THREE.BoxGeometry(0.72, 0.06, 0.24), darkHull, { x: 1.28, y: 2.03, z: -0.22 }))
  group.add(part(new THREE.CylinderGeometry(0.02, 0.02, 0.74, 8), plateGray, { x: -0.42, y: 1.5, z: -0.52, rz: 0.46 }))
  group.add(part(new THREE.CylinderGeometry(0.02, 0.02, 0.64, 8), plateGray, { x: 2.25, y: 1.52, z: -0.54, rz: -0.36 }))

  // Window strip / paneling.
  group.add(part(new THREE.BoxGeometry(1.05, 0.22, 0.86), material('#d4d9de', 0.2, 0.68), { x: 3.05, y: 0.32, z: -0.17 }))
  group.add(part(new THREE.BoxGeometry(1.22, 0.14, 2.2), material('#a24b43', 0.62, 0.35), { x: 4.15, y: -0.38, z: 0.02 }))

  return group
}

function createAsteroid(seed, radius = 2.8, detail = 1) {
  const rng = seededRandom(seed)
  const geometry = mergeVertices(new THREE.IcosahedronGeometry(radius, Math.max(3, detail)), 1e-4)
  const pos = geometry.attributes.position
  const vector = new THREE.Vector3()
  const normal = new THREE.Vector3()

  const craters = Array.from({ length: 6 + Math.floor(rng() * 5) }, () => ({
    normal: new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize(),
    depth: 0.04 + rng() * 0.09,
    radius: 0.82 + rng() * 0.14,
  }))
  const stretch = new THREE.Vector3(
    0.86 + rng() * 0.42,
    0.86 + rng() * 0.42,
    0.86 + rng() * 0.42,
  )

  for (let i = 0; i < pos.count; i += 1) {
    vector.fromBufferAttribute(pos, i)
    normal.copy(vector).normalize()

    const phaseA = seededVectorNoise(normal.x * 1.4, normal.y * 1.6, normal.z * 1.2, seed, 1) * Math.PI
    const phaseB = seededVectorNoise(normal.x * 2.1, normal.y * 1.1, normal.z * 2.3, seed, 2) * Math.PI
    const jagNoise = seededVectorNoise(normal.x * 4.2, normal.y * 3.7, normal.z * 4.6, seed, 3)

    const ridge =
      Math.sin(normal.x * 5.4 + normal.y * 2.8 + normal.z * 4.4 + phaseA) * 0.1 +
      Math.cos(normal.x * 3.6 - normal.z * 5.1 + phaseB) * 0.075 +
      Math.sin(normal.y * 9.2 + normal.x * 4.1) * 0.03

    let craterInset = 0
    for (const crater of craters) {
      const alignment = normal.dot(crater.normal)
      if (alignment > crater.radius) {
        const t = (alignment - crater.radius) / (1 - crater.radius)
        craterInset += crater.depth * t * t
      }
    }

    const jag = jagNoise * 0.025
    const radial = Math.max(0.66, 1 + ridge + jag - craterInset)
    vector.copy(normal).multiplyScalar(radius * radial)
    vector.multiply(stretch)
    pos.setXYZ(i, vector.x, vector.y, vector.z)
  }

  relaxIndexedGeometry(geometry, 0.17, 2)
  relaxIndexedGeometry(geometry, 0.1, 1)

  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  geometry.computeBoundingBox()

  const mesh = new THREE.Mesh(
    geometry,
    material('#6c6358', 0.94, 0.2),
  )
  mesh.name = `asteroid_${seed}`
  return mesh
}

function createAsteroidVariant(index, seed) {
  const group = new THREE.Group()
  group.name = `asteroid_${String(index).padStart(2, '0')}_v1`
  const mesh = createAsteroid(seed, 1.8 + (index % 4) * 0.7, 3)
  mesh.rotation.set(seed * 0.004, seed * 0.003, seed * 0.0025)
  group.add(mesh)
  return group
}

async function writeGlb(root, outputPath) {
  const scene = new THREE.Scene()
  scene.name = path.basename(outputPath, '.glb')
  scene.add(root)

  const exporter = new GLTFExporter()
  const glb = await exporter.parseAsync(scene, { binary: true })
  await fs.writeFile(outputPath, Buffer.from(glb))
}

async function main() {
  const outDir = path.join(process.cwd(), 'public', 'assets', 'models')
  await fs.mkdir(outDir, { recursive: true })

  const targets = [
    { file: 'smallcraft_v1.glb', root: createSmallcraft() },
    { file: 'freighter_v1.glb', root: createFreighter() },
    { file: 'pirate_v1.glb', root: createPirate() },
    { file: 'asteroid_01_v1.glb', root: createAsteroidVariant(1, 911) },
    { file: 'asteroid_02_v1.glb', root: createAsteroidVariant(2, 922) },
    { file: 'asteroid_03_v1.glb', root: createAsteroidVariant(3, 933) },
    { file: 'asteroid_04_v1.glb', root: createAsteroidVariant(4, 944) },
    { file: 'asteroid_05_v1.glb', root: createAsteroidVariant(5, 955) },
  ]

  for (const target of targets) {
    const outputPath = path.join(outDir, target.file)
    await writeGlb(target.root, outputPath)
  }

  const files = await fs.readdir(outDir)
  console.log('Generated assets:')
  for (const file of files.filter((name) => name.endsWith('.glb')).sort()) {
    const fullPath = path.join(outDir, file)
    const stat = await fs.stat(fullPath)
    console.log(`- ${file} (${stat.size} bytes)`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
