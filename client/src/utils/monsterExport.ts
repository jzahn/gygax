import type { Monster, MonsterExportFile } from '@gygax/shared'

/**
 * Sanitize a filename by removing invalid characters
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid chars
    .replace(/\s+/g, '-') // Spaces to hyphens
    .toLowerCase()
    .slice(0, 100) // Limit length
}

/**
 * Export a Monster to a JSON file and trigger download
 */
export function exportMonster(monster: Monster): void {
  const exportData: MonsterExportFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    monster: {
      name: monster.name,
      description: monster.description,
      class: monster.class,
      level: monster.level,
      alignment: monster.alignment,
      title: monster.title,
      strength: monster.strength,
      intelligence: monster.intelligence,
      wisdom: monster.wisdom,
      dexterity: monster.dexterity,
      constitution: monster.constitution,
      charisma: monster.charisma,
      hitPointsMax: monster.hitPointsMax,
      hitPointsCurrent: monster.hitPointsCurrent,
      armorClass: monster.armorClass,
      saveDeathRay: monster.saveDeathRay,
      saveWands: monster.saveWands,
      saveParalysis: monster.saveParalysis,
      saveBreath: monster.saveBreath,
      saveSpells: monster.saveSpells,
      experiencePoints: monster.experiencePoints,
      goldPieces: monster.goldPieces,
      equipment: monster.equipment,
      spells: monster.spells,
      notes: monster.notes,
      // avatarUrl intentionally excluded - not portable
    },
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(monster.name)}.monster.gygax.json`
  a.click()

  URL.revokeObjectURL(url)
}
