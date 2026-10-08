import { Scale } from 'lucide-preact';
import { useMemo } from 'preact/hooks';
import type { EntityInfo, EquipmentSlot, ItemRef, Variant } from '@/lib/build/model';
import { gemTooltip, itemTooltip, socketableTooltip } from '@/lib/tooltip/tooltip-model';
import { copyText } from '@/lib/ui/clipboard';
import { type SheetSlot, sheetSlots, slotIconKind, slotLabel } from '@/lib/ui/slots';
import { CopyNotice, copyLabel, useCopyName } from '@/ui/common/copy-name';
import { Icon } from '@/ui/common/Icon';
import { RichText } from '@/ui/rich-text/RichText';
import { entityChipRenderer } from '@/ui/tooltip/EntityTooltipChip';
import { WithTooltip } from '@/ui/tooltip/Tooltip';

const EMPTY = "The author hasn't listed gear for this variant.";

/** An item can grant a handful of skills; the rest are counted, so one item cannot stretch the whole grid. */
const GRANTS_SHOWN = 2;

export function GearPanel({
  variant,
  entities,
  besideComments = false,
  copy = copyText,
}: {
  variant: Variant;
  entities: Record<string, EntityInfo>;
  /** The comments panel takes Gear Priority's column for the time being. */
  besideComments?: boolean;
  /** Injected in tests; a rune's name goes to the clipboard, ready for the game's own search. */
  copy?: (text: string) => Promise<boolean>;
}) {
  const renderEntity = useMemo(() => entityChipRenderer(entities), [entities]);
  const { notice, copyName } = useCopyName(copy);
  const hasEquipment = variant.equipment.length > 0;

  if (!hasEquipment && !variant.equipmentNotes) {
    return <p class="panel-empty">{EMPTY}</p>;
  }

  const { armour, other } = sheetSlots(variant.equipment);
  const key = (s: SheetSlot) => `${s.slot}${s.weaponSet ?? ''}`;

  return (
    <div class="gear">
      {hasEquipment ? (
        <div class={besideComments ? 'gear__columns gear__columns--single' : 'gear__columns'}>
          <section class="card gear__slots" aria-label="Equipment">
            <div class="gear__armour">
              {armour.map((s) => (
                <ItemSlotCard key={key(s)} sheetSlot={s} size="large" onCopy={copyName} />
              ))}
            </div>
            <div class="gear__other">
              {other.map((s) => (
                <ItemSlotCard key={key(s)} sheetSlot={s} size="compact" onCopy={copyName} />
              ))}
            </div>
          </section>
          {!besideComments && variant.itemPriority.length > 0 && <PriorityCard items={variant.itemPriority} equipment={variant.equipment} />}
        </div>
      ) : (
        <p class="panel-empty">{EMPTY}</p>
      )}
      <CopyNotice notice={notice} />
      {variant.equipmentNotes && (
        <section class="card gear__notes">
          <h2 class="card__title">Author's Notes</h2>
          <RichText value={variant.equipmentNotes} renderEntity={renderEntity} />
        </section>
      )}
    </div>
  );
}

function ItemSlotCard({ sheetSlot, size, onCopy }: { sheetSlot: SheetSlot; size: 'large' | 'compact'; onCopy: (name: string) => void }) {
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
        <div class="item-slot__art">
          <Icon src={item.iconUrl} class="item-slot__icon" kind={slotIconKind(sheetSlot.slot)} />
          {item.tradeUrl && (
            <a
              class="item-slot__trade"
              href={item.tradeUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Find ${item.name} on the trade site`}
              title="Find on the official trade site"
              onClick={(event) => event.stopPropagation()}
            >
              <Scale size={12} aria-hidden="true" />
            </a>
          )}
        </div>
        <div class="item-slot__body">
          <span class="item-slot__label">{label}</span>
          <span class={`item-name item-name--${item.rarity}`}>{item.name}</span>
          {item.grantedSkills.slice(0, GRANTS_SHOWN).map((skill) => (
            <WithTooltip key={skill.name} model={skill.gem ? gemTooltip(skill.gem) : null}>
              <span class="item-slot__grants">
                <Icon src={skill.gem?.iconUrl} class="item-slot__grants-icon" kind="gem" />
                {skill.name}
              </span>
            </WithTooltip>
          ))}
          {item.grantedSkills.length > GRANTS_SHOWN && (
            <span class="item-slot__grants item-slot__grants--rest">+{item.grantedSkills.length - GRANTS_SHOWN} more</span>
          )}
          {size === 'large' && item.modifiers.length > 0 && <span class="item-slot__mods">{item.modifiers.slice(0, 2).join(' · ')}</span>}
        </div>
        {socketables.length > 0 && (
          <span class="item-slot__sockets">
            {socketables.map((socketable, i) => {
              const icon = (
                <Icon
                  src={socketable.iconUrl}
                  class={`item-slot__socket${socketable.iconUrl ? '' : ' item-slot__socket--empty'}`}
                  alt=""
                  kind={socketable.iconUrl ? 'rune' : undefined}
                />
              );
              const name = socketable.name;
              return (
                <WithTooltip key={i} model={socketableTooltip(socketable)}>
                  {name ? (
                    // A click copies the rune's name for the game's own search; it doesn't reach the item card.
                    <button
                      type="button"
                      class="item-slot__socket-copy"
                      aria-label={copyLabel(name)}
                      onClick={(event) => {
                        event.stopPropagation();
                        onCopy(name);
                      }}
                    >
                      {icon}
                    </button>
                  ) : (
                    icon
                  )}
                </WithTooltip>
              );
            })}
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
                  <Icon src={ref.iconUrl} class="priority__icon" kind={slotIconKind(ref.slot)} />
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
