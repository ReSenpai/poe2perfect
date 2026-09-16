/** The site's passive or atlas tree widget as rendered on a build page (atomic classes left out). */
export function treeWidgetHtml({
  variantIndex = 0,
  titles = ['ACT 1', 'ACT 2', 'ENDGAME'],
  withCanvas = true,
  kind = 'passive-tree',
}: { variantIndex?: number; titles?: string[]; withCanvas?: boolean; kind?: 'passive-tree' | 'atlas-tree' } = {}) {
  const tabs = titles
    .map((title, i) => `<div role="tab" data-key="${i + 1}" aria-selected="${i === variantIndex}"><div><span>${title}</span></div></div>`)
    .join('');
  const tree = withCanvas
    ? `<div class="tree-root"><div class="tree-stage"><div class="tree-canvas-wrap"><canvas></canvas></div><div class="tree-controls"><button><svg></svg></button><button><svg></svg></button></div></div></div>`
    : `<div class="tree-root"><div class="loader"><div></div><div></div></div></div>`;
  return `
    <section class="tree-section ${kind}">
      <span id="66cae2ce-9467-40b9-b0cb-ca75359b1557-${kind}-${variantIndex}"></span>
      <div class="card">
        <header><h2>Passive Tree</h2></header>
        <div><div role="tablist"><div role="tablist" aria-orientation="horizontal">${tabs}</div></div></div>
        <div class="tree-body">
          <div class="counters"><div>main:</div><div>103</div><div>123</div></div>
          <div class="tree-slot">${tree}</div>
          <div class="notables"><div>Notable Priority</div></div>
        </div>
      </div>
      <div class="notes"><p>Take the left side first.</p></div>
    </section>`;
}
