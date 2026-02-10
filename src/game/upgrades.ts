import type { RunModifiers } from './runtime'

export type UpgradeKey = 'grabber' | 'thruster' | 'drill' | 'hull' | 'cargo' | 'weapons'

export interface UpgradeDefinition {
  key: UpgradeKey
  label: string
  description: string
  maxLevel: number
  baseCost: number
  costScale: number
  powerballGateByLevel: number[]
}

export type UpgradeLevels = Record<UpgradeKey, number>

export const UPGRADE_ORDER: UpgradeKey[] = ['grabber', 'thruster', 'drill', 'hull', 'cargo', 'weapons']

export const UPGRADE_DEFINITIONS: Record<UpgradeKey, UpgradeDefinition> = {
  grabber: {
    key: 'grabber',
    label: 'Grabber Reach',
    description: 'Extends latch range for safer asteroid capture.',
    maxLevel: 5,
    baseCost: 2800,
    costScale: 1.9,
    powerballGateByLevel: [0, 0, 2, 5, 9, 13],
  },
  thruster: {
    key: 'thruster',
    label: 'Thruster Stack',
    description: 'Improves acceleration and top speed.',
    maxLevel: 5,
    baseCost: 3400,
    costScale: 1.95,
    powerballGateByLevel: [0, 0, 2, 5, 9, 13],
  },
  drill: {
    key: 'drill',
    label: 'Drill Rig',
    description: 'Boosts extraction speed while the drill is active.',
    maxLevel: 5,
    baseCost: 3200,
    costScale: 1.92,
    powerballGateByLevel: [0, 0, 2, 5, 9, 13],
  },
  hull: {
    key: 'hull',
    label: 'Hull Plating',
    description: 'Raises maximum hull integrity.',
    maxLevel: 5,
    baseCost: 3600,
    costScale: 1.92,
    powerballGateByLevel: [0, 1, 3, 6, 10, 14],
  },
  cargo: {
    key: 'cargo',
    label: 'Cargo Frames',
    description: 'Expands storage hold capacity.',
    maxLevel: 5,
    baseCost: 3000,
    costScale: 1.88,
    powerballGateByLevel: [0, 0, 1, 4, 8, 12],
  },
  weapons: {
    key: 'weapons',
    label: 'Raider Countermeasures',
    description: 'Adds dedicated anti-pirate weapon ammo and damage.',
    maxLevel: 5,
    baseCost: 4600,
    costScale: 2.02,
    powerballGateByLevel: [0, 2, 4, 7, 11, 16],
  },
}

export function createBaseUpgradeLevels(): UpgradeLevels {
  return {
    grabber: 0,
    thruster: 0,
    drill: 0,
    hull: 0,
    cargo: 0,
    weapons: 0,
  }
}

export function getUpgradeCost(definition: UpgradeDefinition, nextLevel: number) {
  return Math.round(definition.baseCost * Math.pow(definition.costScale, Math.max(0, nextLevel - 1)))
}

export function getUpgradePowerballRequirement(definition: UpgradeDefinition, nextLevel: number) {
  return definition.powerballGateByLevel[nextLevel] ?? Number.POSITIVE_INFINITY
}

export function getUpgradeStatSummary(key: UpgradeKey, level: number) {
  const safeLevel = Math.max(0, Math.floor(level))
  switch (key) {
    case 'grabber':
      return `${(7.5 + safeLevel * 1.3).toFixed(1)}m range`
    case 'thruster':
      return `${(1 + safeLevel * 0.13).toFixed(2)}x thrust`
    case 'drill':
      return `${(1 + safeLevel * 0.17).toFixed(2)}x extraction`
    case 'hull':
      return `${Math.round(100 + safeLevel * 18)} max hull`
    case 'cargo':
      return `${Math.round(130 + safeLevel * 26)} hold capacity`
    case 'weapons':
      if (safeLevel <= 0) return 'offline'
      return `${Math.round(6 + safeLevel * 6)} ammo / ${Math.round(14 + safeLevel * 10)} damage`
  }
}

export function buildRunModifiers(levels: UpgradeLevels): RunModifiers {
  const weaponLevel = levels.weapons

  return {
    grabberRange: 7.5 + levels.grabber * 1.3,
    thrusterMultiplier: 1 + levels.thruster * 0.13,
    drillMultiplier: 1 + levels.drill * 0.17,
    maxHull: 100 + levels.hull * 18,
    cargoCapacity: 130 + levels.cargo * 26,
    weaponAmmo: weaponLevel > 0 ? 6 + weaponLevel * 6 : 0,
    weaponDamage: weaponLevel > 0 ? 14 + weaponLevel * 10 : 0,
    pirateEncounterChance: 1,
  }
}
