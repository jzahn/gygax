import type { Character, CharacterExportFile } from '@gygax/shared'

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
 * Export a Character to a JSON file and trigger download
 */
export function exportCharacter(character: Character): void {
  const exportData: CharacterExportFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    character: {
      name: character.name,
      class: character.class,
      level: character.level,
      alignment: character.alignment,
      title: character.title,
      strength: character.strength,
      intelligence: character.intelligence,
      wisdom: character.wisdom,
      dexterity: character.dexterity,
      constitution: character.constitution,
      charisma: character.charisma,
      hitPointsMax: character.hitPointsMax,
      hitPointsCurrent: character.hitPointsCurrent,
      armorClass: character.armorClass,
      saveDeathRay: character.saveDeathRay,
      saveWands: character.saveWands,
      saveParalysis: character.saveParalysis,
      saveBreath: character.saveBreath,
      saveSpells: character.saveSpells,
      experiencePoints: character.experiencePoints,
      goldPieces: character.goldPieces,
      equipment: character.equipment,
      spells: character.spells,
      notes: character.notes,
      // avatarUrl intentionally excluded - not portable
    },
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(character.name)}.character.gygax.json`
  a.click()

  URL.revokeObjectURL(url)
}
