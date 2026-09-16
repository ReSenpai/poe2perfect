import type { EntityInfo } from '@/lib/build/model';
import type { RichEntity } from '@/lib/rich-text/convert';
import { entityTooltip } from '@/lib/tooltip/tooltip-model';
import { EntityChip } from '@/ui/rich-text/RichText';
import { WithTooltip } from './Tooltip';

/** `renderEntity` for guide texts: chips of entities known to static data get a tooltip. */
export function entityChipRenderer(entities: Record<string, EntityInfo>) {
  return (entity: RichEntity) => {
    const info = entities[entity.slug];
    return <WithTooltip model={info ? entityTooltip(info) : null}>{EntityChip(entity)}</WithTooltip>;
  };
}
