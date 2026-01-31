import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseDice,
  rollDice,
  formatDiceResult,
  parseRollCommand,
  isNatural20,
  isNatural1,
  DiceExpression,
} from './dice'

describe('parseDice', () => {
  it('parses basic dice expressions', () => {
    expect(parseDice('3d6')).toEqual({
      count: 3,
      sides: 6,
      modifier: 0,
      raw: '3d6',
    })
    expect(parseDice('1d20')).toEqual({
      count: 1,
      sides: 20,
      modifier: 0,
      raw: '1d20',
    })
    expect(parseDice('2d8')).toEqual({
      count: 2,
      sides: 8,
      modifier: 0,
      raw: '2d8',
    })
  })

  it('parses shorthand dS expressions', () => {
    expect(parseDice('d20')).toEqual({
      count: 1,
      sides: 20,
      modifier: 0,
      raw: 'd20',
    })
    expect(parseDice('d6')).toEqual({
      count: 1,
      sides: 6,
      modifier: 0,
      raw: 'd6',
    })
  })

  it('parses expressions with positive modifiers', () => {
    expect(parseDice('1d20+5')).toEqual({
      count: 1,
      sides: 20,
      modifier: 5,
      raw: '1d20+5',
    })
    expect(parseDice('3d6+1')).toEqual({
      count: 3,
      sides: 6,
      modifier: 1,
      raw: '3d6+1',
    })
  })

  it('parses expressions with negative modifiers', () => {
    expect(parseDice('1d20-2')).toEqual({
      count: 1,
      sides: 20,
      modifier: -2,
      raw: '1d20-2',
    })
    expect(parseDice('2d8-1')).toEqual({
      count: 2,
      sides: 8,
      modifier: -1,
      raw: '2d8-1',
    })
  })

  it('handles case insensitivity', () => {
    expect(parseDice('3D6')).toEqual({
      count: 3,
      sides: 6,
      modifier: 0,
      raw: '3d6',
    })
    expect(parseDice('D20')).toEqual({
      count: 1,
      sides: 20,
      modifier: 0,
      raw: 'd20',
    })
  })

  it('handles whitespace', () => {
    expect(parseDice('  3d6  ')).toEqual({
      count: 3,
      sides: 6,
      modifier: 0,
      raw: '3d6',
    })
  })

  it('returns null for invalid expressions', () => {
    expect(parseDice('')).toBeNull()
    expect(parseDice('abc')).toBeNull()
    expect(parseDice('3')).toBeNull()
    expect(parseDice('d')).toBeNull()
    expect(parseDice('3d')).toBeNull()
    expect(parseDice('3d6+')).toBeNull()
    expect(parseDice('3d6-')).toBeNull()
    expect(parseDice('hello world')).toBeNull()
  })

  it('enforces count limits (1-100)', () => {
    expect(parseDice('0d6')).toBeNull()
    expect(parseDice('101d6')).toBeNull()
    expect(parseDice('100d6')).not.toBeNull()
    expect(parseDice('1d6')).not.toBeNull()
  })

  it('enforces sides limits (1-1000)', () => {
    expect(parseDice('1d0')).toBeNull()
    expect(parseDice('1d1001')).toBeNull()
    expect(parseDice('1d1000')).not.toBeNull()
    expect(parseDice('1d1')).not.toBeNull()
  })

  it('enforces modifier limits (-999 to +999)', () => {
    expect(parseDice('1d20+1000')).toBeNull()
    expect(parseDice('1d20-1000')).toBeNull()
    expect(parseDice('1d20+999')).not.toBeNull()
    expect(parseDice('1d20-999')).not.toBeNull()
  })
})

describe('rollDice', () => {
  beforeEach(() => {
    // Mock Math.random for predictable tests
    vi.spyOn(Math, 'random')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rolls dice and returns results', () => {
    // Mock random to return 0.5 for each roll (gives 3 on a d6)
    vi.mocked(Math.random).mockReturnValue(0.5)

    const expression: DiceExpression = {
      count: 3,
      sides: 6,
      modifier: 0,
      raw: '3d6',
    }

    const result = rollDice(expression)

    expect(result.expression).toBe(expression)
    expect(result.rolls).toHaveLength(3)
    expect(result.rolls.every((r) => r >= 1 && r <= 6)).toBe(true)
  })

  it('calculates total with modifier', () => {
    // Mock to return 0.95 which gives max roll
    vi.mocked(Math.random).mockReturnValue(0.95)

    const expression: DiceExpression = {
      count: 1,
      sides: 20,
      modifier: 5,
      raw: '1d20+5',
    }

    const result = rollDice(expression)

    // 0.95 * 20 = 19, floor = 19, +1 = 20
    expect(result.rolls).toEqual([20])
    expect(result.total).toBe(25) // 20 + 5
  })

  it('handles negative modifiers', () => {
    vi.mocked(Math.random).mockReturnValue(0.5)

    const expression: DiceExpression = {
      count: 1,
      sides: 6,
      modifier: -2,
      raw: '1d6-2',
    }

    const result = rollDice(expression)

    // 0.5 * 6 = 3, floor = 3, +1 = 4
    expect(result.rolls).toEqual([4])
    expect(result.total).toBe(2) // 4 - 2
  })

  it('returns different rolls each time', () => {
    // Restore real Math.random for this test
    vi.restoreAllMocks()

    const expression: DiceExpression = {
      count: 10,
      sides: 6,
      modifier: 0,
      raw: '10d6',
    }

    const result1 = rollDice(expression)
    const result2 = rollDice(expression)

    // Very unlikely to be identical
    expect(result1.rolls.join()).not.toBe(result2.rolls.join())
  })
})

describe('formatDiceResult', () => {
  it('formats basic roll', () => {
    const result = {
      expression: { count: 3, sides: 6, modifier: 0, raw: '3d6' },
      rolls: [4, 2, 6],
      total: 12,
    }

    expect(formatDiceResult(result)).toBe('3d6: [4, 2, 6] = 12')
  })

  it('formats roll with positive modifier', () => {
    const result = {
      expression: { count: 1, sides: 20, modifier: 5, raw: '1d20+5' },
      rolls: [17],
      total: 22,
    }

    expect(formatDiceResult(result)).toBe('1d20+5: [17] + 5 = 22')
  })

  it('formats roll with negative modifier', () => {
    const result = {
      expression: { count: 1, sides: 20, modifier: -2, raw: '1d20-2' },
      rolls: [15],
      total: 13,
    }

    expect(formatDiceResult(result)).toBe('1d20-2: [15] - 2 = 13')
  })

  it('formats single die roll', () => {
    const result = {
      expression: { count: 1, sides: 20, modifier: 0, raw: 'd20' },
      rolls: [20],
      total: 20,
    }

    expect(formatDiceResult(result)).toBe('d20: [20] = 20')
  })
})

describe('parseRollCommand', () => {
  it('extracts dice expression from /roll command', () => {
    expect(parseRollCommand('/roll 3d6')).toBe('3d6')
    expect(parseRollCommand('/roll 1d20+5')).toBe('1d20+5')
    expect(parseRollCommand('/roll d20')).toBe('d20')
  })

  it('handles case insensitivity', () => {
    expect(parseRollCommand('/ROLL 3d6')).toBe('3d6')
    expect(parseRollCommand('/Roll 1d20')).toBe('1d20')
  })

  it('handles extra whitespace', () => {
    expect(parseRollCommand('  /roll   3d6  ')).toBe('3d6')
    expect(parseRollCommand('/roll  1d20+5')).toBe('1d20+5')
  })

  it('returns null for non-roll messages', () => {
    expect(parseRollCommand('hello')).toBeNull()
    expect(parseRollCommand('/command 3d6')).toBeNull()
    expect(parseRollCommand('3d6')).toBeNull()
    expect(parseRollCommand('/rolling dice')).toBeNull()
    expect(parseRollCommand('/rol 3d6')).toBeNull()
  })

  it('returns null for /roll without expression', () => {
    expect(parseRollCommand('/roll')).toBe('')
    expect(parseRollCommand('/roll ')).toBe('')
  })
})

describe('isNatural20', () => {
  it('returns true for natural 20 on d20', () => {
    const result = {
      expression: { count: 1, sides: 20, modifier: 0, raw: '1d20' },
      rolls: [20],
      total: 20,
    }
    expect(isNatural20(result)).toBe(true)
  })

  it('returns true for natural 20 on d20 with modifier', () => {
    const result = {
      expression: { count: 1, sides: 20, modifier: 5, raw: '1d20+5' },
      rolls: [20],
      total: 25,
    }
    expect(isNatural20(result)).toBe(true)
  })

  it('returns false for non-20 roll', () => {
    const result = {
      expression: { count: 1, sides: 20, modifier: 0, raw: '1d20' },
      rolls: [19],
      total: 19,
    }
    expect(isNatural20(result)).toBe(false)
  })

  it('returns false for multiple dice', () => {
    const result = {
      expression: { count: 2, sides: 20, modifier: 0, raw: '2d20' },
      rolls: [20, 20],
      total: 40,
    }
    expect(isNatural20(result)).toBe(false)
  })

  it('returns false for non-d20 dice', () => {
    const result = {
      expression: { count: 1, sides: 6, modifier: 0, raw: '1d6' },
      rolls: [6],
      total: 6,
    }
    expect(isNatural20(result)).toBe(false)
  })
})

describe('isNatural1', () => {
  it('returns true for natural 1 on d20', () => {
    const result = {
      expression: { count: 1, sides: 20, modifier: 0, raw: '1d20' },
      rolls: [1],
      total: 1,
    }
    expect(isNatural1(result)).toBe(true)
  })

  it('returns true for natural 1 on d20 with modifier', () => {
    const result = {
      expression: { count: 1, sides: 20, modifier: 5, raw: '1d20+5' },
      rolls: [1],
      total: 6,
    }
    expect(isNatural1(result)).toBe(true)
  })

  it('returns false for non-1 roll', () => {
    const result = {
      expression: { count: 1, sides: 20, modifier: 0, raw: '1d20' },
      rolls: [2],
      total: 2,
    }
    expect(isNatural1(result)).toBe(false)
  })

  it('returns false for multiple dice', () => {
    const result = {
      expression: { count: 2, sides: 20, modifier: 0, raw: '2d20' },
      rolls: [1, 1],
      total: 2,
    }
    expect(isNatural1(result)).toBe(false)
  })

  it('returns false for non-d20 dice', () => {
    const result = {
      expression: { count: 1, sides: 6, modifier: 0, raw: '1d6' },
      rolls: [1],
      total: 1,
    }
    expect(isNatural1(result)).toBe(false)
  })
})
