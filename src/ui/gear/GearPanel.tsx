import { useMemo } from 'preact/hooks';
import type { EntityInfo, EquipmentSlot, ItemRef, Variant } from '@/lib/build/model';
import { gemTooltip, itemTooltip, socketableTooltip } from '@/lib/tooltip/tooltip-model';
import { type SheetSlot, sheetSlots, slotLabel } from '@/lib/ui/slots';
import { RichText } from '@/ui/rich-text/RichText';
import { entityChipRenderer } from '@/ui/tooltip/EntityTooltipChip';
import { WithTooltip } from '@/ui/tooltip/Tooltip';

const EMPTY = "The author hasn't listed gear for this variant.";

export function GearPanel({ variant, entities }: { variant: Variant; entities: Record<string, EntityInfo> }) {
  const renderEntity = useMemo(() => entityChipRenderer(entities), [entities]);
  const hasEquipment = variant.equipment.length > 0;

  if (!hasEquipment && !variant.equipmentNotes) {
    return <p class="panel-empty">{EMPTY}</p>;
  }

  const { armour, other } = sheetSlots(variant.equipment);
  const key = (s: SheetSlot) => `${s.slot}${s.weaponSet ?? ''}`;

  return (
    <div class="gear">
      {hasEquipment ? (
        <div class="gear__columns">
          <section class="card gear__slots" aria-label="Equipment">
            <div class="gear__armour">
              {armour.map((s) => (
                <ItemSlotCard key={key(s)} sheetSlot={s} size="large" />
              ))}
            </div>
            <div class="gear__other">
              {other.map((s) => (
                <ItemSlotCard key={key(s)} sheetSlot={s} size="compact" />
              ))}
            </div>
          </section>
          {variant.itemPriority.length > 0 && <PriorityCard items={variant.itemPriority} equipment={variant.equipment} />}
        </div>
      ) : (
        <p class="panel-empty">{EMPTY}</p>
      )}
      {variant.equipmentNotes && (
        <section class="card gear__notes">
          <h2 class="card__title">Author's Notes</h2>
          <RichText value={variant.equipmentNotes} renderEntity={renderEntity} />
        </section>
      )}
    </div>
  );
}

function ItemSlotCard({ sheetSlot, size }: { sheetSlot: SheetSlot; size: 'large' | 'compact' }) {
  const label = slotLabel(sheetSlot.slot, sheetSlot.weaponSet);
  if (!sheetSlot.equipped) {
    return (
      <div class={`item-slot item-slot--${size} item-slot--empty`}>
        <div class="item-slot__art" />
        <div class="item-slot__body">
          <span class="item-slot__label">{label}</span>
          <span class="item-slot__placeholder">Empty</span>
        </div>
      </div>
    );
  }

  const { item, socketables } = sheetSlot.equipped;
  return (
    <WithTooltip model={itemTooltip(item, socketables)}>
      <div class={`item-slot item-slot--${size}`}>
        <div class="item-slot__art">{item.iconUrl && <img class="item-slot__icon" src={item.iconUrl} alt="" />}</div>
        <div class="item-slot__body">
          <span class="item-slot__label">{label}</span>
          <span class={`item-name item-name--${item.rarity}`}>{item.name}</span>
          {item.grantedSkills.map((skill) => (
            <WithTooltip key={skill.name} model={skill.gem ? gemTooltip(skill.gem) : null}>
              <span class="item-slot__grants">
                {skill.gem?.iconUrl && <img class="item-slot__grants-icon" src={skill.gem.iconUrl} alt="" />}
                {skill.name}
              </span>
            </WithTooltip>
          ))}
          {size === 'large' && item.modifiers.length > 0 && <span class="item-slot__mods">{item.modifiers.slice(0, 2).join(' · ')}</span>}
        </div>
        {socketables.length > 0 && (
          <span class="item-slot__sockets">
            {socketables.map((socketable, i) => (
              <WithTooltip key={i} model={socketableTooltip(socketable)}>
                {socketable.iconUrl ? (
                  <img class="item-slot__socket" src={socketable.iconUrl} alt={socketable.name ?? ''} />
                ) : (
                  <span class="item-slot__socket item-slot__socket--empty" />
                )}
              </WithTooltip>
            ))}
          </span>
        )}
      </div>
    </WithTooltip>
  );
}

function PriorityCard({ items, equipment }: { items: ItemRef[]; equipment: EquipmentSlot[] }) {
  return (
    <section class="card gear__priority">
      <h2 class="card__title">Gear Priority</h2>
      <ol class="priority" aria-label="Gear priority">
        {items.map((ref, i) => {
          // Priority entries point at the variant's own items; their tooltips come from the equipped slot.
          const equipped = equipment.find((slot) => slot.item.slug === ref.slug);
          return (
            <li key={`${ref.slug}-${i}`} class="priority__row">
              <span class="priority__number">{i + 1}</span>
              <WithTooltip model={equipped ? itemTooltip(equipped.item, equipped.socketables) : null}>
                <span class="priority__item">
                  {ref.iconUrl && <img class="priority__icon" src={ref.iconUrl} alt="" />}
                  <span class={`priority__name item-name item-name--${equipped?.item.rarity ?? 'normal'}`}>{ref.name}</span>
                </span>
              </WithTooltip>
              <span class="priority__slot">{slotLabel(ref.slot)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
