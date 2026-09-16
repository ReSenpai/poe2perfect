import { useState } from 'preact/hooks';
import { type CaptureResult, summarizeFixture } from '@/lib/dev/fixture';

export interface ExportPanelProps {
  capture: () => Promise<CaptureResult>;
  save: (fileName: string, content: string) => void;
}

type State =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'saved'; fileName: string; summary: string; warnings: string[] }
  | { kind: 'failed'; message: string };

export function ExportPanel({ capture, save }: ExportPanelProps) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function handleExport() {
    setState({ kind: 'busy' });
    try {
      const result = await capture();
      if (!result.ok) {
        setState({ kind: 'failed', message: result.message });
        return;
      }
      save(result.fileName, JSON.stringify(result.fixture));
      setState({ kind: 'saved', fileName: result.fileName, summary: summarizeFixture(result.fixture), warnings: result.warnings });
    } catch (error) {
      setState({ kind: 'failed', message: error instanceof Error ? error.message : String(error) });
    }
  }

  const busy = state.kind === 'busy';
  return (
    <main class="panel">
      <h1>Dev tools</h1>
      <button type="button" onClick={handleExport} disabled={busy}>
        {busy ? 'Собираю…' : 'Экспорт фикстуры'}
      </button>
      {state.kind === 'saved' && (
        <div class="result">
          <p>Сохранено: {state.fileName}</p>
          <p class="summary">{state.summary}</p>
          {state.warnings.map((warning) => (
            <p key={warning} class="warning">
              {warning}
            </p>
          ))}
        </div>
      )}
      {state.kind === 'failed' && (
        <p role="alert" class="error">
          {state.message}
        </p>
      )}
    </main>
  );
}
