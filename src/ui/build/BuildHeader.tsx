import { Flag, Tag, User } from 'lucide-preact';
import { useMemo } from 'preact/hooks';
import type { Build } from '@/lib/build/model';
import { richTextSummary } from '@/lib/rich-text/summary';

/** Build identity and meta; purely informational — page controls live in the tab bar. */
export function BuildHeader({ build }: { build: Build }) {
  const summary = useMemo(() => richTextSummary(build.sections[0]?.content ?? null), [build]);

  return (
    <header class="build-header">
      {build.headerImageUrl && <img class="build-header__art" src={build.headerImageUrl} alt="" />}
      <div class="build-header__identity">
        <h1 class="build-header__title">{build.title}</h1>
        {(build.className || build.ascendancy) && (
          <p class="build-header__hero">
            {build.className && <span>{build.className}</span>}
            {build.className && build.ascendancy && <span class="build-header__separator">/</span>}
            {build.ascendancy && <span class="build-header__ascendancy">{build.ascendancy}</span>}
          </p>
        )}
        <ul class="build-header__meta">
          {build.patch && (
            <li>
              <Tag size={14} aria-hidden="true" />
              <span>{build.patch}</span>
            </li>
          )}
          {build.buildTypes.length > 0 && (
            <li>
              <Flag size={14} aria-hidden="true" />
              <span>{build.buildTypes.join(' · ')}</span>
            </li>
          )}
          {build.author && (
            <li>
              <User size={14} aria-hidden="true" />
              <span>{build.author}</span>
            </li>
          )}
        </ul>
      </div>
      {summary && <p class="build-header__summary">{summary}</p>}
    </header>
  );
}
