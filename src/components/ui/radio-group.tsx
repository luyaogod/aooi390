import { cn } from '@/lib/utils'

interface RadioGroupProps {
  value: string
  onValueChange: (value: string) => void
  options: { label: string; value: string; description?: string }[]
  className?: string
}

function RadioGroup({ value, onValueChange, options, className }: RadioGroupProps) {
  return (
    <div className={cn('flex gap-4', className)}>
      {options.map((opt) => (
        <label
          key={opt.value}
          className={cn(
            'flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors',
            value === opt.value
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border hover:border-muted-foreground/30',
          )}
        >
          <input
            type="radio"
            className="sr-only"
            name="radio-group"
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onValueChange(opt.value)}
          />
          <span
            className={cn(
              'flex size-4 shrink-0 items-center justify-center rounded-full border-2',
              value === opt.value ? 'border-primary' : 'border-muted-foreground/40',
            )}
          >
            {value === opt.value && (
              <span className="size-2 rounded-full bg-primary" />
            )}
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{opt.label}</span>
            {opt.description && (
              <span className="text-xs text-muted-foreground">{opt.description}</span>
            )}
          </div>
        </label>
      ))}
    </div>
  )
}

export { RadioGroup }
