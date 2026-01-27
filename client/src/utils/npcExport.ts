import type { NPC, NPCExportFile } from '@gygax/shared'

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
 * Export an NPC to a JSON file and trigger download
 */
export function exportNPC(npc: NPC): void {
  const exportData: NPCExportFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    npc: {
      name: npc.name,
      description: npc.description,
      class: npc.class,
      level: npc.level,
      alignment: npc.alignment,
      title: npc.title,
      strength: npc.strength,
      intelligence: npc.intelligence,
      wisdom: npc.wisdom,
      dexterity: npc.dexterity,
      constitution: npc.constitution,
      charisma: npc.charisma,
      hitPointsMax: npc.hitPointsMax,
      hitPointsCurrent: npc.hitPointsCurrent,
      armorClass: npc.armorClass,
      saveDeathRay: npc.saveDeathRay,
      saveWands: npc.saveWands,
      saveParalysis: npc.saveParalysis,
      saveBreath: npc.saveBreath,
      saveSpells: npc.saveSpells,
      experiencePoints: npc.experiencePoints,
      goldPieces: npc.goldPieces,
      equipment: npc.equipment,
      spells: npc.spells,
      notes: npc.notes,
      // avatarUrl intentionally excluded - not portable
    },
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(npc.name)}.npc.gygax.json`
  a.click()

  URL.revokeObjectURL(url)
}
