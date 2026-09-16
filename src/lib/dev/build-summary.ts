import type { Build } from '@/lib/build/model';

export interface BuildSummary {
  title: string;
  patch: string | null;
  hero: string;
  hasStaticData: boolean;
  sections: string[];
  defaultVariant: string | null;
  variants: {
    title: string;
    items: number;
    helmet: string | null;
    weapon: string | null;
    skills: number;
    firstSkill: string | null;
    keyPassives: number;
    keystones: string[];
    ascendancy: string[];
  }[];
}

/** Dev report of a parsed build, small enough to read back through browser automation. */
export function summarizeBuild(build: Build): BuildSummary {
  return {
    title: build.title,
    patch: build.patch,
    hero: [build.className, build.ascendancy].filter(Boolean).join(' / '),
    hasStaticData: build.hasStaticData,
    sections: build.sections.map((section) => section.title),
    defaultVariant: build.variants.find((v) => v.id === build.defaultVariantId)?.title ?? null,
    variants: build.variants.map((variant) => {
      const first = variant.skills[0];
      return {
        title: variant.title,
        items: variant.equipment.length,
        helmet: variant.equipment.find((slot) => slot.slot === 'helmet')?.item.name ?? null,
        weapon: variant.equipment.find((slot) => slot.slot === 'mainHand')?.item.name ?? null,
        skills: variant.skills.length,
        firstSkill: first ? `${first.gem.name} (${first.supports.length} supports)` : null,
        keyPassives: variant.passives.keyPassives.length,
        keystones: variant.passives.keyPassives.filter((p) => p.kind === 'keystone').map((p) => p.name),
        ascendancy: variant.passives.ascendancy.map((p) => p.name),
      };
    }),
  };
}
