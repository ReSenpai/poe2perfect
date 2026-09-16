import { describe, expect, it } from 'vitest';
import type { RawBuildDocument } from '@/lib/data/types';
import { scrubBuildDocument } from './scrub';

const text = (value: string, format = 0) => ({ type: 'text', text: value, format, detail: 0, mode: 'normal', style: '', version: 1 });

function doc(): RawBuildDocument {
  return {
    id: 'doc-1',
    author: { name: 'DEADRABB1T' },
    data: {
      name: '[0.5.5] ED Contagion Lich',
      buildVariants: { values: [{ id: 'act-1', equipment: { helmet: { commonItem: { slug: 'helmet', name: 'Rusted Greathelm' } } } }] },
    },
    content: [
      {
        __typename: 'NgfDocumentCmWidgetRichTextSimplifiedV2',
        id: 'text-1',
        data: {
          title: 'How it Plays',
          simplifiedContent: {
            value: {
              root: {
                type: 'root',
                children: [
                  { type: 'heading', tag: 'h3', children: [text('Level 1 to 5:', 1)] },
                  {
                    type: 'paragraph',
                    children: [
                      text('Cast '),
                      { type: 'static-data-widget', id: 'gem-contagionplayer', label: 'Contagion', icon: 'https://cdn/contagion.webp' },
                      text(' on mobs and kill them.'),
                      { type: 'link', url: 'https://twitch.tv/author', children: [text('my stream')] },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      {
        __typename: 'NgfDocumentCmWidgetCommentsV1',
        id: 'comments',
        data: { isDisabled: false, payload: { data: { comments: [{ plainTextContent: 'Great build!', author: { name: 'someone' } }] } } },
      },
      {
        __typename: 'NgfDocumentCmWidgetDiscoveryPreviewCompactV2',
        id: 'featured',
        data: { title: 'Featured Builds', discovery: { items: { documents: [{ data: { name: 'Another Build' } }] } } },
      },
    ],
  } as unknown as RawBuildDocument;
}

type Node = { type: string; text?: string; label?: string; url?: string; children?: Node[] };
const nodes = (scrubbed: RawBuildDocument) => {
  const root = (scrubbed.content[0]!.data.simplifiedContent as { value: { root: { children: Node[] } } }).value.root;
  return root.children;
};

describe('scrubBuildDocument', () => {
  it("replaces the author's words with placeholders of the same length in words, keeping the text's shape", () => {
    const [heading, paragraph] = nodes(scrubBuildDocument(doc()));

    const headingText = heading!.children![0]!.text!;
    expect(headingText).not.toContain('Level');
    expect(headingText.split(' ')).toHaveLength(4);
    expect(headingText[0]).toBe(headingText[0]!.toUpperCase());

    const [before, chip, after, link] = paragraph!.children!;
    expect(before!.text).toMatch(/^\S+ $/);
    expect(before!.text).not.toBe('Cast ');
    expect(after!.text).toMatch(/^ \S+( \S+){4}$/);
    expect(chip).toEqual({ type: 'static-data-widget', id: 'gem-contagionplayer', label: 'Contagion', icon: 'https://cdn/contagion.webp' });
    expect(link!.url).toBe('https://twitch.tv/author');
    expect(link!.children![0]!.text).not.toBe('my stream');
  });

  it('removes comments and the other builds the page shows', () => {
    const scrubbed = scrubBuildDocument(doc());

    expect(scrubbed.content[1]!.data.payload).toBeNull();
    expect(scrubbed.content[2]!.data.discovery).toBeNull();
    expect(JSON.stringify(scrubbed)).not.toContain('Great build!');
    expect(JSON.stringify(scrubbed)).not.toContain('Another Build');
  });

  it('keeps the build itself and does not change the input', () => {
    const original = doc();
    const scrubbed = scrubBuildDocument(original);

    expect(scrubbed.data).toEqual(original.data);
    expect(scrubbed.author).toEqual({ name: 'DEADRABB1T' });
    expect(scrubbed.content[0]!.data.title).toBe('How it Plays');
    expect(nodes(original)[0]!.children![0]!.text).toBe('Level 1 to 5:');
  });
});
