/**
 * Dice rolling utilities for D&D-style dice expressions.
 *
 * Supported syntax:
 * - NdS    — Roll N dice with S sides (e.g., 3d6, 1d20, 2d8)
 * - NdS+M  — Roll with positive modifier (e.g., 3d6+1, 1d20+5)
 * - NdS-M  — Roll with negative modifier (e.g., 1d20-2)
 * - dS     — Shorthand for 1dS (e.g., d20 = 1d20)
 *
 * Limits:
 * - N (number of dice): 1–100
 * - S (sides): 1–1000
 * - M (modifier): -999 to +999
 */

export interface DiceExpression {
  count: number // Number of dice
  sides: number // Sides per die
  modifier: number // +/- modifier (0 if none)
  raw: string // Original expression string
}

export interface DiceResult {
  expression: DiceExpression
  rolls: number[] // Individual die results
  total: number // Sum of rolls + modifier
}

// Regex matches: optional count + 'd' + sides + optional modifier
// Examples: 3d6, d20, 2d8+1, 1d20-2
const DICE_REGEX = /^(\d+)?d(\d+)([+-]\d+)?$/i

/**
 * Parse a dice expression string.
 * Returns null if the string is not a valid dice expression.
 */
export function parseDice(input: string): DiceExpression | null {
  const trimmed = input.trim().toLowerCase()
  const match = trimmed.match(DICE_REGEX)
  if (!match) return null

  const count = match[1] ? parseInt(match[1], 10) : 1
  const sides = parseInt(match[2], 10)
  const modifier = match[3] ? parseInt(match[3], 10) : 0

  // Validate limits
  if (count < 1 || count > 100) return null
  if (sides < 1 || sides > 1000) return null
  if (modifier < -999 || modifier > 999) return null

  return { count, sides, modifier, raw: trimmed }
}

/**
 * Roll dice from a parsed expression.
 * Uses Math.random() — not cryptographically secure, fine for tabletop games.
 */
export function rollDice(expression: DiceExpression): DiceResult {
  const rolls: number[] = []
  for (let i = 0; i < expression.count; i++) {
    rolls.push(Math.floor(Math.random() * expression.sides) + 1)
  }
  const total = rolls.reduce((sum, r) => sum + r, 0) + expression.modifier
  return { expression, rolls, total }
}

/**
 * Format a dice result for display.
 * Example: "3d6+1: [4, 2, 6] + 1 = 13"
 */
export function formatDiceResult(result: DiceResult): string {
  const { expression, rolls, total } = result
  const rollsStr = `[${rolls.join(', ')}]`
  const modStr =
    expression.modifier > 0
      ? ` + ${expression.modifier}`
      : expression.modifier < 0
        ? ` - ${Math.abs(expression.modifier)}`
        : ''
  return `${expression.raw}: ${rollsStr}${modStr} = ${total}`
}

/**
 * Check if a message is a dice roll command.
 * Returns the dice expression if it starts with /roll, null otherwise.
 */
export function parseRollCommand(message: string): string | null {
  const trimmed = message.trim()
  if (!trimmed.toLowerCase().startsWith('/roll ')) return null
  return trimmed.substring(6).trim()
}

/**
 * Check if a d20 roll is a natural 20.
 */
export function isNatural20(result: DiceResult): boolean {
  return (
    result.expression.count === 1 &&
    result.expression.sides === 20 &&
    result.rolls[0] === 20
  )
}

/**
 * Check if a d20 roll is a natural 1.
 */
export function isNatural1(result: DiceResult): boolean {
  return (
    result.expression.count === 1 &&
    result.expression.sides === 20 &&
    result.rolls[0] === 1
  )
}
