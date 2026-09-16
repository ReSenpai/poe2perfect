import { useMemo, useState } from 'preact/hooks';
import type { Attributes, EntityInfo, Gem, GemPriorityEntry, Skill, Variant } from '@/lib/build/model';
import { gemAttribute, gemTooltip } from '@/lib/tooltip/tooltip-model';
import { RichText } from '@/ui/rich-text/RichText';
import { entityChipRenderer } from '@/ui/tooltip/EntityTooltipChip';
import { WithTooltip } from '@/ui/tooltip/Tooltip';

const EMPTY = "The author hasn't listed skills for this variant.";

/** Active skills of a variant with their supports, and details of the selected skill. */
export function SkillsPanel({ variant, entities }: { variant: Variant; entities: Record<string, EntityInfo> }) {
  const renderEntity = useMemo(() => entityChipRenderer(entities), [entities]);
  const [selected, setSelected] = useState(0);
  const skill = variant.skills[selected] ?? variant.skills[0];

  if (!skill && !variant.skillNotes) {
    return <p class="panel-empty">{EMPTY}</p>;
  }

  return (
    <div class="skills">
      {skill ? (
        <div class="skills__columns">
          <div class="skills__main">
            <section class="card skills__list">
              <div class="skills__heading">
                <h2 class="card__title">Active Skills</h2>
                {variant.gemRequirements && <span class="skills__requirements">{formatAttributes(variant.gemRequirements)}</span>}
              </div>
              <ul class="skill-rows" aria-label="Active skills">
                {variant.skills.map((entry, i) => (
                  <SkillRow key={`${entry.gem.slug}-${i}`} skill={entry} selected={entry === skill} onSelect={() => setSelected(i)} />
                ))}
              </ul>
            </section>
            {variant.gemPriority.length > 0 && <GemPriorityCard entries={variant.gemPriority} currentSkillSlug={skill.gem.slug} />}
          </div>
          <SkillDetails skill={skill} />
        </div>
      ) : (
        <p class="panel-empty">{EMPTY}</p>
      )}
      {variant.skillNotes && (
        <section class="card skills__notes">
          <h2 class="card__title">Author's Notes</h2>
          <RichText value={variant.skillNotes} renderEntity={renderEntity} />
        </section>
      )}
    </div>
  );
}

function SkillRow({ skill, selected, onSelect }: { skill: Skill; selected: boolean; onSelect: () => void }) {
  const { gem, supports } = skill;
  return (
    <li class={selected ? 'skill-row skill-row--selected' : 'skill-row'}>
      <button type="button" class="skill-row__main" aria-pressed={selected} onClick={onSelect}>
        <GemIcon gem={gem} class="skill-row__icon" />
        <span class="skill-row__text">
          <span class="skill-row__name">{gem.name}</span>
          {gem.details && gem.details.tags.length > 0 && <span class="skill-row__tags">{gem.details.tags.join(' · ')}</span>}
        </span>
      </button>
      {supports.length > 0 && (
        <span class="skill-row__supports">
          {supports.map((support, i) => (
            <WithTooltip key={`${support.slug}-${i}`} model={gemTooltip(support)}>
              <GemIcon gem={support} class={`skill-row__support gem-socket gem-socket--${gemAttribute(support) ?? 'none'}`} />
            </WithTooltip>
          ))}
        </span>
      )}
    </li>
  );
}

function GemPriorityCard({ entries, currentSkillSlug }: { entries: GemPriorityEntry[]; currentSkillSlug: string }) {
  return (
    <section class="card gem-priority">
      <h2 class="card__title">Gem Priority</h2>
      <ol class="gem-priority__list" aria-label="Gem priority">
        {entries.map((entry, i) => (
          <li
            key={`${entry.gem.slug}-${i}`}
            class={entry.parentSlug === currentSkillSlug ? 'gem-priority__row gem-priority__row--current' : 'gem-priority__row'}
          >
            <span class="gem-priority__number">{i + 1}</span>
            <WithTooltip model={gemTooltip(entry.gem)}>
              <span class="gem-priority__gem">
                <GemIcon gem={entry.gem} class={`gem-priority__icon gem-socket gem-socket--${gemAttribute(entry.gem) ?? 'none'}`} />
                <span class="gem-priority__text">
                  <span class="gem-priority__name">{entry.gem.name}</span>
                  {entry.parentName && (
                    <span class="gem-priority__parent" title={entry.parentName}>
                      {entry.parentName}
                    </span>
                  )}
                </span>
              </span>
            </WithTooltip>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SkillDetails({ skill }: { skill: Skill }) {
  const { gem, supports } = skill;
  const details = gem.details;
  return (
    <section class="card skill-details" aria-label="Skill details">
      <div class="skill-details__header">
        <GemIcon gem={gem} class="skill-details__icon" />
        <div>
          <h2 class="skill-details__name">{gem.name}</h2>
          {details && details.tags.length > 0 && (
            <ul class="skill-details__tags">
              {details.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {!details && <p class="panel-empty">No details available for this gem.</p>}
      {details && details.stats.length > 0 && (
        <dl class="skill-details__stats">
          {details.stats.map(({ name, value }) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {details && details.requirements.length > 0 && (
        <p class="skill-details__requirements">Requires: {details.requirements.map(({ name, value }) => `${name} ${value}`).join(', ')}</p>
      )}
      {details?.description && <p class="skill-details__description">{details.description}</p>}
      {details && details.effects.length > 0 && (
        <ul class="skill-details__effects">
          {details.effects.flatMap((effect) => effect.split('\n')).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      {details && details.qualityEffects.length > 0 && (
        <div class="skill-details__quality">
          <p class="skill-details__section-title">Additional Effects From Quality</p>
          <ul>
            {details.qualityEffects.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      {supports.length > 0 && (
        <div class="skill-details__supports">
          <p class="skill-details__section-title">Support Gems</p>
          <ul>
            {supports.map((support, i) => (
              <li key={`${support.slug}-${i}`}>
                <WithTooltip model={gemTooltip(support)}>
                  <span class="skill-details__support">
                    <GemIcon gem={support} class={`skill-details__support-icon gem-socket gem-socket--${gemAttribute(support) ?? 'none'}`} />
                    <span class="skill-details__support-name">{support.name}</span>
                  </span>
                </WithTooltip>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function GemIcon({ gem, class: className }: { gem: Gem; class: string }) {
  return gem.iconUrl ? <img class={className} src={gem.iconUrl} alt="" /> : <span class={`${className} gem-icon--missing`} />;
}

function formatAttributes({ str, dex, int }: Attributes): string {
  return `Str ${str} · Dex ${dex} · Int ${int}`;
}
