import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { Build } from '@/lib/build/model';
import { parseBuild } from '@/lib/build/parse-build';
import { loadFixture } from '../../../tests/fixtures/load';
import { ExportButton } from './ExportButton';

const fixture = loadFixture('chaos-dot-lich-starter-deadrabbit');
const BUILD: Build = parseBuild(fixture.build, fixture.staticData);
const URL = 'https://mobalytics.gg/poe-2/builds/chaos-dot-lich-starter-deadrabbit#gear_act-1';

function renderButton(build = BUILD, url = URL) {
  const save = vi.fn();
  render(<ExportButton build={build} url={url} save={save} />);
  return { save, button: screen.getByRole('button', { name: 'Save as a spreadsheet' }) };
}

describe('ExportButton', () => {
  it('saves the build as a workbook named after it', async () => {
    const { save, button } = renderButton();

    fireEvent.click(button);
    await vi.waitFor(() => expect(save).toHaveBeenCalled());

    const [bytes, name] = save.mock.calls[0]!;
    expect(name).toBe('chaos-dot-lich-starter-deadrabbit.xlsx');
    // Every zip, and so every .xlsx, starts with these two letters.
    expect([...(bytes as Uint8Array).subarray(0, 2)]).toEqual([0x50, 0x4b]);
    expect((bytes as Uint8Array).length).toBeGreaterThan(1000);
  });

  it('falls back to the build title when the address names no build', async () => {
    const { save, button } = renderButton(BUILD, 'https://mobalytics.gg/poe-2/builds');

    fireEvent.click(button);
    await vi.waitFor(() => expect(save).toHaveBeenCalled());

    expect(save.mock.calls[0]![1]).toBe('ed-contagion-lich-league-starter-level-1-to-endgame.xlsx');
  });

  it('says so when the file could not be written', async () => {
    const save = vi.fn(() => {
      throw new Error('no room');
    });
    render(<ExportButton build={BUILD} url={URL} save={save} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save as a spreadsheet' }));

    expect((await screen.findByRole('alert')).textContent).toBe("Couldn't save the spreadsheet");
  });
});
