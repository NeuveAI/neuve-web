import type { LucideIcon } from "lucide-react"

import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
  /** Unavailable right now (shown, not selectable). */
  disabled?: boolean
  /** Why it is unavailable (title + accessible description). */
  description?: string
}

/**
 * Segmented control (Stacked/Split). With `onValueChange` every option is
 * live; without it only the current option is enabled and the others render
 * faithfully but aria-disabled (a mode not designed yet).
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onValueChange,
}: {
  label: string
  options: ReadonlyArray<SegmentedOption<T> | T>
  value: T
  onValueChange?: (value: T) => void
}) {
  const items = options.map((option) =>
    typeof option === "string"
      ? {
          value: option,
          label: option,
          icon: undefined,
          disabled: false,
          description: undefined,
        }
      : option
  )
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        // Radix clears the value when the active item is pressed again; a
        // segmented control always has one option on.
        if (next && onValueChange) onValueChange(next as T)
      }}
      aria-label={label}
      spacing={0}
      variant="segment"
      size="segment"
      className="rounded-lg bg-raised p-[3px]"
    >
      {items.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          title={option.description}
          aria-description={option.description}
          aria-disabled={
            !onValueChange && option.value !== value ? true : undefined
          }
          className="disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-50"
        >
          {option.icon && (
            <option.icon aria-hidden="true" className="size-[13px]" />
          )}
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
