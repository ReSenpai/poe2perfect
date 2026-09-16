import type { Variant } from '@/lib/build/model';

/** Build variant chips (Act 1 … Endgame); hidden for single-variant builds. */
export function VariantPicker({ variants, selectedId, onChange }: { variants: Variant[]; selectedId: string | null; onChange: (id: string) => void }) {
  if (variants.length < 2) return null;
  return (
    <div class="variants" role="group" aria-label="Build variant">
      {variants.map((variant) => (
        <button key={variant.id} type="button" class="chip" aria-pressed={variant.id === selectedId} onClick={() => onChange(variant.id)}>
          {variant.title}
        </button>
      ))}
    </div>
  );
}
