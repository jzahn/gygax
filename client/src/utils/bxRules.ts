/**
 * B/X D&D Rules Utilities
 * Based on Moldvay Basic (1981) ruleset
 */

import type { CharacterClass } from '@gygax/shared'

/**
 * Calculate ability score modifier from score (3-18)
 * Uses B/X modifier table
 */
export function getModifier(score: number): number {
  if (score <= 3) return -3
  if (score <= 5) return -2
  if (score <= 8) return -1
  if (score <= 12) return 0
  if (score <= 15) return 1
  if (score <= 17) return 2
  return 3
}

/**
 * Format modifier for display (+1, -2, etc.)
 */
export function formatModifier(mod: number): string {
  if (mod > 0) return `+${mod}`
  return mod.toString()
}

/**
 * Roll 3d6 (classic B/X method)
 */
export function roll3d6(): number {
  return (
    Math.floor(Math.random() * 6) +
    1 +
    Math.floor(Math.random() * 6) +
    1 +
    Math.floor(Math.random() * 6) +
    1
  )
}

/**
 * Roll 4d6 and drop lowest (common house rule)
 */
export function roll4d6DropLowest(): number {
  const rolls = [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
  ]
  rolls.sort((a, b) => b - a)
  return rolls[0] + rolls[1] + rolls[2]
}

/**
 * Calculate THAC0 based on class and level
 * B/X rules: THAC0 improves every 3 levels for most classes
 */
export function getThac0(charClass: CharacterClass, level: number): number {
  const baseThac0 = 19
  const improvement = Math.floor((level - 1) / 3)
  return Math.max(baseThac0 - improvement * 2, 10)
}

/**
 * Get class-specific title based on level
 * From B/X rulebook experience tables
 */
export function getTitle(charClass: CharacterClass, level: number): string {
  const titles: Record<CharacterClass, string[]> = {
    Fighter: [
      'Veteran',
      'Warrior',
      'Swordmaster',
      'Hero',
      'Swashbuckler',
      'Myrmidon',
      'Champion',
      'Superhero',
      'Lord',
    ],
    'Magic-User': [
      'Medium',
      'Seer',
      'Conjurer',
      'Theurgist',
      'Thaumaturgist',
      'Magician',
      'Enchanter',
      'Warlock',
      'Sorcerer',
      'Necromancer',
      'Wizard',
    ],
    Cleric: [
      'Acolyte',
      'Adept',
      'Priest',
      'Vicar',
      'Curate',
      'Elder',
      'Bishop',
      'Lama',
      'Patriarch',
    ],
    Thief: [
      'Apprentice',
      'Footpad',
      'Robber',
      'Burglar',
      'Cutpurse',
      'Sharper',
      'Pilferer',
      'Thief',
      'Master Thief',
    ],
    Elf: [
      'Veteran-Medium',
      'Warrior-Seer',
      'Swordmaster-Conjurer',
      'Hero-Theurgist',
      'Swashbuckler-Thaumaturgist',
      'Myrmidon-Magician',
      'Champion-Enchanter',
      'Superhero-Warlock',
      'Lord-Sorcerer',
      'Lord-Necromancer',
    ],
    Dwarf: [
      'Dwarven Veteran',
      'Dwarven Warrior',
      'Dwarven Swordmaster',
      'Dwarven Hero',
      'Dwarven Swashbuckler',
      'Dwarven Myrmidon',
      'Dwarven Champion',
      'Dwarven Superhero',
      'Dwarven Lord',
    ],
    Halfling: [
      'Halfling Veteran',
      'Halfling Warrior',
      'Halfling Swordmaster',
      'Halfling Hero',
      'Halfling Swashbuckler',
      'Halfling Myrmidon',
      'Halfling Champion',
      'Sheriff',
    ],
  }

  const classTitles = titles[charClass] || titles['Fighter']
  const index = Math.min(level - 1, classTitles.length - 1)
  return classTitles[Math.max(0, index)]
}

/**
 * Get base saving throws for a class at level 1
 * Returns object with all five B/X saving throw values
 */
export function getBaseSavingThrows(charClass: CharacterClass): {
  deathRay: number
  wands: number
  paralysis: number
  breath: number
  spells: number
} {
  const saves: Record<
    CharacterClass,
    { deathRay: number; wands: number; paralysis: number; breath: number; spells: number }
  > = {
    Fighter: { deathRay: 12, wands: 13, paralysis: 14, breath: 15, spells: 16 },
    'Magic-User': { deathRay: 13, wands: 14, paralysis: 13, breath: 16, spells: 15 },
    Cleric: { deathRay: 11, wands: 12, paralysis: 14, breath: 16, spells: 15 },
    Thief: { deathRay: 13, wands: 14, paralysis: 13, breath: 16, spells: 15 },
    Elf: { deathRay: 12, wands: 13, paralysis: 13, breath: 15, spells: 15 },
    Dwarf: { deathRay: 8, wands: 9, paralysis: 10, breath: 13, spells: 12 },
    Halfling: { deathRay: 8, wands: 9, paralysis: 10, breath: 13, spells: 12 },
  }

  return saves[charClass] || saves['Fighter']
}

/**
 * Experience points required for each level by class
 */
export function getXpForLevel(charClass: CharacterClass, level: number): number {
  const xpTables: Record<CharacterClass, number[]> = {
    Fighter: [0, 2000, 4000, 8000, 16000, 32000, 64000, 120000, 240000, 360000, 480000, 600000, 720000, 840000],
    'Magic-User': [0, 2500, 5000, 10000, 20000, 40000, 80000, 150000, 300000, 450000, 600000, 750000, 900000, 1050000],
    Cleric: [0, 1500, 3000, 6000, 12000, 25000, 50000, 100000, 200000, 300000, 400000, 500000, 600000, 700000],
    Thief: [0, 1200, 2400, 4800, 9600, 20000, 40000, 80000, 160000, 280000, 400000, 520000, 640000, 760000],
    Elf: [0, 4000, 8000, 16000, 32000, 64000, 120000, 250000, 400000, 600000],
    Dwarf: [0, 2200, 4400, 8800, 17000, 35000, 70000, 140000, 270000, 400000, 530000, 660000],
    Halfling: [0, 2000, 4000, 8000, 16000, 32000, 64000, 120000],
  }

  const table = xpTables[charClass] || xpTables['Fighter']
  const index = Math.min(level - 1, table.length - 1)
  return table[Math.max(0, index)]
}

/**
 * Hit dice by class (dX notation)
 */
export function getHitDie(charClass: CharacterClass): number {
  const hitDice: Record<CharacterClass, number> = {
    Fighter: 8,
    'Magic-User': 4,
    Cleric: 6,
    Thief: 4,
    Elf: 6,
    Dwarf: 8,
    Halfling: 6,
  }

  return hitDice[charClass] || 8
}
