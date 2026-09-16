import type { ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';
import type { RichText as RichTextValue } from '@/lib/build/model';
import { type RichBlock, type RichEntity, type RichInline, type RichList, type RichTextRun, toRichBlocks } from '@/lib/rich-text/convert';

export interface RichTextProps {
  value: RichTextValue | null;
  /** Custom entity rendering, e.g. a chip with a tooltip. */
  renderEntity?: (entity: RichEntity) => ComponentChildren;
  class?: string;
}

type EntityRenderer = NonNullable<RichTextProps['renderEntity']>;

/** Guide text from the site's editor. Rendered through JSX only, so text can never become markup. */
export function RichText({ value, renderEntity = EntityChip, class: className }: RichTextProps) {
  const blocks = useMemo(() => toRichBlocks(value), [value]);
  if (blocks.length === 0) return null;
  return <div class={className ? `rt ${className}` : 'rt'}>{blocks.map((block, i) => renderBlock(block, i, renderEntity))}</div>;
}

export function EntityChip(entity: RichEntity) {
  return (
    <span class={`rt-entity rt-entity--${entity.group}`} data-slug={entity.slug}>
      {entity.iconUrl && <img class="rt-entity__icon" src={entity.iconUrl} alt="" loading="lazy" onError={hideImage} />}
      <span class="rt-entity__label">{entity.label}</span>
    </span>
  );
}

function hideImage(event: Event) {
  (event.currentTarget as HTMLImageElement).hidden = true;
}

function renderBlock(block: RichBlock, key: number, renderEntity: EntityRenderer) {
  switch (block.kind) {
    case 'paragraph':
      return <p key={key}>{renderInlines(block.children, renderEntity)}</p>;
    case 'heading': {
      const Heading = `h${block.level}` as 'h2' | 'h3' | 'h4';
      return <Heading key={key}>{renderInlines(block.children, renderEntity)}</Heading>;
    }
    case 'list':
      return renderList(block, key, renderEntity);
  }
}

function renderList(list: RichList, key: number, renderEntity: EntityRenderer) {
  const items = list.items.map((item, i) => (
    <li key={i}>
      {item.children.length > 0 && <span>{renderInlines(item.children, renderEntity)}</span>}
      {item.lists.map((nested, j) => renderList(nested, j, renderEntity))}
    </li>
  ));
  return list.ordered ? (
    <ol key={key} start={list.start === 1 ? undefined : list.start}>
      {items}
    </ol>
  ) : (
    <ul key={key}>{items}</ul>
  );
}

function renderInlines(nodes: RichInline[], renderEntity: EntityRenderer): ComponentChildren[] {
  return nodes.map((node, i) => {
    switch (node.kind) {
      case 'text':
        return <TextRun key={i} run={node} />;
      case 'linebreak':
        return <br key={i} />;
      case 'link':
        return (
          <a key={i} href={node.href} target="_blank" rel="noopener noreferrer">
            {renderInlines(node.children, renderEntity)}
          </a>
        );
      case 'entity':
        return <span key={i}>{renderEntity(node)}</span>;
    }
  });
}

function TextRun({ run }: { run: RichTextRun }) {
  let content: ComponentChildren = run.text;
  if (run.code) content = <code>{content}</code>;
  if (run.color) content = <span style={{ color: run.color }}>{content}</span>;
  if (run.strikethrough) content = <s>{content}</s>;
  if (run.underline) content = <u>{content}</u>;
  if (run.italic) content = <em>{content}</em>;
  if (run.bold) content = <strong>{content}</strong>;
  return <>{content}</>;
}
