import type { TextSize } from '@gygax/shared'

const TEXT_SIZES: TextSize[] = ['small', 'medium', 'large', 'xlarge']

const SIZE_LABELS: Record<TextSize, { short: string; long: string; fontSize: string }> = {
  small: { short: 'Sm', long: 'Small', fontSize: 'text-xs' },
  medium: { short: 'Md', long: 'Medium', fontSize: 'text-sm' },
  large: { short: 'Lg', long: 'Large', fontSize: 'text-base' },
  xlarge: { short: 'Xl', long: 'Extra Large', fontSize: 'text-lg' },
}

interface TextSizeSelectorProps {
  selectedSize: TextSize
  onSizeChange: (size: TextSize) => void
  onHover?: (size: TextSize | null) => void
}

interface SizeButtonProps {
  size: TextSize
  isSelected: boolean
  onClick: () => void
  onHover?: (size: TextSize | null) => void
}

function SizeButton({ size, isSelected, onClick, onHover }: SizeButtonProps) {
  const { short, fontSize } = SIZE_LABELS[size]

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => onHover?.(size)}
      onMouseLeave={() => onHover?.(null)}
      className={`
        flex h-[32px] w-[68px] items-center justify-center border-2 transition-all
        ${
          isSelected
            ? '-translate-y-0.5 border-ink bg-white shadow-brutal'
            : 'border-ink bg-parchment-100 shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal'
        }
      `}
    >
      <span className={`font-fell ${fontSize}`}>{short}</span>
    </button>
  )
}

export function TextSizeSelector({ selectedSize, onSizeChange, onHover }: TextSizeSelectorProps) {
  return (
    <div className="flex flex-col gap-1 p-2">
      {TEXT_SIZES.map((size) => (
        <SizeButton
          key={size}
          size={size}
          isSelected={selectedSize === size}
          onClick={() => onSizeChange(size)}
          onHover={onHover}
        />
      ))}
      <div className="mt-1 border-t border-ink-faded pt-1 text-center font-mono text-xs text-ink-faded">
        1-4 to select
      </div>
    </div>
  )
}
