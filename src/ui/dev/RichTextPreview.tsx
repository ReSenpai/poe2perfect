import type { Build, RichText as RichTextValue } from '@/lib/build/model';
import { RichText } from '@/ui/rich-text/RichText';

/** Dev-only panel listing every guide text of a build, for eyeballing rich text rendering. */
export function RichTextPreview({ build }: { build: Build }) {
  const texts: [string, RichTextValue | null][] = [
    ...build.sections.map((section): [string, RichTextValue] => [section.title, section.content]),
    ['Strengths', build.strengths],
    ['Weaknesses', build.weaknesses],
    ...build.variants.flatMap((variant): [string, RichTextValue | null][] => [
      [`${variant.title} · Description`, variant.description],
      [`${variant.title} · Equipment`, variant.equipmentNotes],
      [`${variant.title} · Skills`, variant.skillNotes],
      [`${variant.title} · Passives`, variant.passiveNotes],
    ]),
  ];

  return (
    <div class="preview">
      <h1 class="preview__title">{build.title}</h1>
      {texts
        .filter(([, value]) => value !== null)
        .map(([title, value]) => (
          <section class="preview__section" key={title}>
            <h2 class="preview__heading">{title}</h2>
            <RichText value={value} />
          </section>
        ))}
    </div>
  );
}
