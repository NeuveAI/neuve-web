import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"

/**
 * Segmented control (Units/Files, Stacked/Split). The alternate modes are
 * deferred until their screens are designed, so only the current option is
 * enabled; the others render faithfully but are aria-disabled.
 */
export function Segmented({
  label,
  options,
  value,
}: {
  label: string
  options: ReadonlyArray<string>
  value: string
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      aria-label={label}
      spacing={0}
      variant="segment"
      size="segment"
      className="rounded-lg bg-raised p-[3px]"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          aria-disabled={option !== value ? true : undefined}
        >
          {option}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
