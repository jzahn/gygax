import type { ChatMessage } from '@gygax/shared'

interface DiceRollCardProps {
  message: ChatMessage
}

export function DiceRollCard({ message }: DiceRollCardProps) {
  const { sender, diceExpression, diceRolls, diceTotal, diceModifier } = message

  // Check for natural 20/1 on a d20
  const isNat20 =
    diceRolls &&
    diceRolls.length === 1 &&
    diceExpression?.includes('d20') &&
    diceRolls[0] === 20
  const isNat1 =
    diceRolls &&
    diceRolls.length === 1 &&
    diceExpression?.includes('d20') &&
    diceRolls[0] === 1

  return (
    <div className="dice-roll-card animate-chat-message">
      <div className="dice-roll-header">
        <span className="dice-roll-icon">&#9861;</span>
        <span className="chat-sender-name">{sender.name}</span>
        <span className="dice-roll-expression">rolled {diceExpression}</span>
      </div>
      <div className="dice-roll-results">
        {diceRolls?.map((roll, index) => (
          <div key={index} className="dice-roll-die animate-dice-tumble">
            {roll}
          </div>
        ))}
        {diceModifier !== undefined && diceModifier !== 0 && (
          <span className="dice-roll-modifier">
            {diceModifier > 0 ? `+ ${diceModifier}` : `- ${Math.abs(diceModifier)}`}
          </span>
        )}
        <span className="dice-roll-equals">=</span>
        <span
          className={`dice-roll-total ${isNat20 ? 'nat-20' : ''} ${isNat1 ? 'nat-1' : ''}`}
        >
          {diceTotal}
        </span>
      </div>
    </div>
  )
}
