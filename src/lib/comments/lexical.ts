/** Lexical state for plain text, shaped like what the site's own comment editor sends: one paragraph per line. */
export function textToLexical(text: string): { root: { type: 'root'; children: unknown[]; [key: string]: unknown } } {
  const lines = text.trim().split(/\r?\n/).map((line) => line.trim());
  return {
    root: {
      type: 'root',
      version: 1,
      direction: 'ltr',
      format: '',
      indent: 0,
      children: lines.map((line) => ({
        type: 'paragraph',
        version: 1,
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        children: line ? [{ type: 'text', version: 1, text: line, detail: 0, format: 0, mode: 'normal', style: '' }] : [],
      })),
    },
  };
}
