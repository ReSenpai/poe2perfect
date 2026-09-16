import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { BuildFixture, CaptureResult } from '@/lib/dev/fixture';
import { ExportPanel } from './ExportPanel';

const FIXTURE: BuildFixture = {
  meta: { slug: 'chaos-dot-lich', url: 'https://mobalytics.gg/poe-2/builds/chaos-dot-lich', capturedAt: '2026-09-15T10:00:00.000Z', staticCacheVersion: 'v1' },
  build: { id: 'doc', data: { name: 'Chaos Lich' }, content: [] },
  staticData: { poe2Gems: { data: [] } },
};

const SUCCESS: CaptureResult = { ok: true, fileName: 'chaos-dot-lich.json', fixture: FIXTURE, warnings: [] };

function clickExport() {
  fireEvent.click(screen.getByRole('button', { name: 'Экспорт фикстуры' }));
}

describe('ExportPanel', () => {
  it('saves the captured fixture as compact JSON', async () => {
    const save = vi.fn();
    render(<ExportPanel capture={async () => SUCCESS} save={save} />);

    clickExport();

    await screen.findByText('Сохранено: chaos-dot-lich.json');
    expect(save).toHaveBeenCalledWith('chaos-dot-lich.json', JSON.stringify(FIXTURE));
  });

  it('summarises what went into the fixture', async () => {
    const fixture: BuildFixture = {
      ...FIXTURE,
      build: { ...FIXTURE.build, data: { name: 'Chaos Lich', buildVariants: { values: [{}, {}, {}] } } },
      staticData: { poe2Gems: { data: [{}, {}] }, poe2Armours: { data: [{}] }, meta: { version: '1' } },
    };
    render(<ExportPanel capture={async () => ({ ...SUCCESS, fixture })} save={vi.fn()} />);

    clickExport();

    await screen.findByText('Chaos Lich · вариантов: 3 · записей справочника: 3');
  });

  it('disables the button while capturing', async () => {
    let finish!: (result: CaptureResult) => void;
    render(<ExportPanel capture={() => new Promise((resolve) => (finish = resolve))} save={vi.fn()} />);

    clickExport();

    const button = await screen.findByRole('button', { name: 'Собираю…' });
    expect(button).toHaveProperty('disabled', true);
    finish(SUCCESS);
    await screen.findByText('Сохранено: chaos-dot-lich.json');
  });

  it('shows capture warnings', async () => {
    const withWarning: CaptureResult = { ...SUCCESS, warnings: ['Справочник сайта недоступен — фикстура без staticData'] };
    render(<ExportPanel capture={async () => withWarning} save={vi.fn()} />);

    clickExport();

    await screen.findByText('Справочник сайта недоступен — фикстура без staticData');
  });

  it('shows a capture failure and saves nothing', async () => {
    const save = vi.fn();
    render(<ExportPanel capture={async () => ({ ok: false, message: 'Это не страница билда' })} save={save} />);

    clickExport();

    await screen.findByText('Это не страница билда');
    expect(save).not.toHaveBeenCalled();
  });

  it('shows an error when capture throws', async () => {
    render(
      <ExportPanel
        capture={async () => {
          throw new Error('Could not establish connection');
        }}
        save={vi.fn()}
      />,
    );

    clickExport();

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not establish connection'));
  });
});
