import { type Obj, obj, objs, str, strings } from '@/lib/data/coerce';
import type { RawBuildDocument, RawStaticData, RawWidget } from '@/lib/data/types';
import type { Build, EntityInfo, TextSection, Variant } from './model';
import { parseEquipment, socketableFromSlug, staticItem } from './parse-equipment';
import { parseAtlas } from './parse-atlas';
import { parsePassives, passiveFromSlug } from './parse-passives';
import { parseQuestRewards } from './parse-quests';
import { type EntityLabels, gemFromStatic, parseSkills } from './parse-skills';
import { collectEntityLabels, toRichText } from './rich-text-data';
import { createStaticIndex, type StaticIndex } from './static-index';

const WIDGET = {
  richText: 'NgfDocumentCmWidgetRichTextSimplifiedV2',
  strengthsAndWeaknesses: 'NgfDocumentCmWidgetStrengthsAndWeaknessesV1',
  video: 'NgfDocumentCmWidgetVideoV2',
  variants: 'NgfDocumentCmWidgetContentVariantsV1',
  equipment: 'Poe2DocumentUgWidgetEquipmentV1',
  skillGems: 'Poe2DocumentUgWidgetSkillGemsV1',
  passiveTree: 'Poe2DocumentUgWidgetPassiveTreeV1',
  atlasTree: 'Poe2DocumentUgWidgetAtlasTreeV1',
} as const;

const PATCH_MARKER = /^\s*\[([^\]]+)\]\s*/;

export function parseBuild(doc: RawBuildDocument, staticData: RawStaticData | null): Build {
  const index = createStaticIndex(staticData);
  const labels = collectEntityLabels(doc.content);
  const widgets = orderedWidgets(doc.content);
  const byId = new Map(widgets.map((widget) => [widget.id, widget]));
  const firstOf = (typename: string) => widgets.find((widget) => widget.__typename === typename);

  const tags = objs(obj(doc.tags)?.data);
  const tagsOf = (group: string) => tags.filter((tag) => tag.groupSlug === group);
  const classTag = tagsOf('class')[0];
  const ascendancyTag = tagsOf('ascendancy')[0];

  const patchMatch = PATCH_MARKER.exec(doc.data.name);
  const strengthsAndWeaknesses = firstOf(WIDGET.strengthsAndWeaknesses)?.data;

  const variants = parseVariants(doc, firstOf(WIDGET.variants), byId, index, labels);

  return {
    id: doc.id,
    name: doc.data.name,
    title: doc.data.name.replace(PATCH_MARKER, '').trim(),
    patch: patchMatch?.[1]?.trim() ?? str(tagsOf('patch')[0]?.name),
    className: str(classTag?.name),
    ascendancy: str(ascendancyTag?.name),
    headerImageUrl: headerImageUrl(doc, str(classTag?.slug), str(ascendancyTag?.slug)),
    buildTypes: tagsOf('build-type').flatMap((tag) => str(tag.name) ?? []),
    author: str(obj(doc.author)?.name) ?? str(obj(obj(doc.author)?.user)?.displayName),
    updatedAt: str(doc.updatedAt),
    sections: widgets.filter((widget) => widget.__typename === WIDGET.richText).flatMap(textSection),
    strengths: toRichText(obj(strengthsAndWeaknesses?.strengths)?.value),
    weaknesses: toRichText(obj(strengthsAndWeaknesses?.weaknesses)?.value),
    videoUrl: str(firstOf(WIDGET.video)?.data.videoUrl),
    variants,
    // The site opens the first variant; its "default-variant" id is just the oldest one.
    defaultVariantId: variants[0]?.id ?? null,
    questRewards: parseQuestRewards(doc.data.questRewards),
    entities: resolveEntities(labels, index),
    hasStaticData: index.available,
  };
}

function parseVariants(
  doc: RawBuildDocument,
  variantsWidget: RawWidget | undefined,
  byId: Map<string, RawWidget>,
  index: StaticIndex,
  labels: EntityLabels,
): Variant[] {
  const rawById = new Map(objs(doc.data.buildVariants?.values).flatMap((raw) => (str(raw.id) ? [[str(raw.id)!, raw]] : [])));
  const guideVariants = objs(variantsWidget?.data.childrenVariants);

  const entries: { id: string; title: string; meta: Obj | null }[] = variantsWidget
    ? guideVariants.flatMap((meta) => {
        const id = str(meta.id);
        return id && rawById.has(id) ? [{ id, title: str(meta.title) ?? id, meta }] : [];
      })
    : [...rawById.keys()].map((id, i) => ({ id, title: `Variant ${i + 1}`, meta: null }));

  return entries.map(({ id, title, meta }) => {
    const raw = rawById.get(id)!;
    const children = strings(meta?.childrenIds).flatMap((childId) => byId.get(childId) ?? []);
    const notes = (typename: string, field: string) =>
      toRichText(obj(children.find((widget) => widget.__typename === typename)?.data[field])?.value);

    const { slots, itemPriority } = parseEquipment(raw.equipment, index);
    const { skills, gemRequirements, gemPriority } = parseSkills(raw.skillGems, index, labels);

    return {
      id,
      title,
      description: toRichText(obj(meta?.description)?.value),
      equipment: slots,
      itemPriority,
      equipmentNotes: notes(WIDGET.equipment, 'descriptionPoeEquipment'),
      skills,
      gemRequirements,
      gemPriority,
      skillNotes: notes(WIDGET.skillGems, 'descriptionPoeSkillGems'),
      passives: parsePassives(raw.passiveTree, index),
      passiveNotes: notes(WIDGET.passiveTree, 'descriptionPoe2PassiveTree'),
      atlas: parseAtlas(raw.atlasTree, index),
      atlasNotes: notes(WIDGET.atlasTree, 'descriptionPoe2AtlasTree'),
    };
  });
}

function resolveEntities(labels: EntityLabels, index: StaticIndex): Record<string, EntityInfo> {
  // Slugs of different kinds never collide, so the first match wins.
  const resolvers: ((slug: string) => EntityInfo | null)[] = [
    (slug) => wrap(gemFromStatic(slug, index), (gem) => ({ kind: 'gem', gem })),
    (slug) => wrap(passiveFromSlug(slug, index), (passive) => ({ kind: 'passive', passive })),
    (slug) => wrap(socketableFromSlug(slug, index), (socketable) => ({ kind: 'socketable', socketable })),
    (slug) => wrap(staticItem(slug, index), (item) => ({ kind: 'item', item })),
  ];
  const entities: Record<string, EntityInfo> = {};
  for (const slug of labels.keys()) {
    for (const resolve of resolvers) {
      const info = resolve(slug);
      if (info) {
        entities[slug] = info;
        break;
      }
    }
  }
  return entities;
}

function wrap<T>(value: T | null, toInfo: (value: T) => EntityInfo): EntityInfo | null {
  return value === null ? null : toInfo(value);
}

function textSection(widget: RawWidget): TextSection[] {
  const content = toRichText(obj(widget.data.simplifiedContent)?.value);
  const title = str(widget.data.title);
  return content && title ? [{ id: widget.id, title, content }] : [];
}

/** Widgets in page layout order (depth-first from the root section), then any unreachable ones. */
function orderedWidgets(content: RawWidget[]): RawWidget[] {
  const byId = new Map(content.map((widget) => [widget.id, widget]));
  const ordered: RawWidget[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    const widget = byId.get(id);
    if (!widget || seen.has(id)) return;
    seen.add(id);
    ordered.push(widget);
    strings(widget.data.childrenIds).forEach(visit);
  };
  visit('root');
  return [...ordered, ...content.filter((widget) => !seen.has(widget.id))];
}

function headerImageUrl(doc: RawBuildDocument, classSlug: string | null, ascendancySlug: string | null): string | null {
  const pattern = str(obj(obj(doc.typeData)?.displayMetadata)?.coverImageUrlPattern);
  if (!pattern || !classSlug || !ascendancySlug) return null;
  return pattern.replace('{{class}}', classSlug).replace('{{ascendancy}}', ascendancySlug);
}
