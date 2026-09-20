import { FileSpreadsheet } from 'lucide-preact';
import { useState } from 'preact/hooks';
import { getBuildSlug } from '@/lib/build-url';
import type { Build } from '@/lib/build/model';
import { buildSheets } from '@/lib/export/build-sheets';
import { workbook } from '@/lib/export/xlsx';

export interface ExportButtonProps {
  build: Build;
  /** The build's address: it names the file and goes into the workbook's first sheet. */
  url: string;
  /** Injected in tests; by default the file goes to the browser's downloads. */
  save?: (bytes: Uint8Array, name: string) => void;
}

/** Saves the build as an .xlsx workbook — the spreadsheet every PoE 2 player keeps their build in anyway. */
export function ExportButton({ build, url, save = download }: ExportButtonProps) {
  const [failed, setFailed] = useState(false);

  const onClick = () => {
    try {
      save(workbook(buildSheets(build, url.split('#')[0]!)), fileName(build, url));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  };

  return (
    <>
      <button type="button" class="icon-button" aria-label="Save as a spreadsheet" title="Save as a spreadsheet (.xlsx)" onClick={onClick}>
        <FileSpreadsheet size={16} aria-hidden="true" />
      </button>
      {failed && (
        <span class="tab-bar__error" role="alert">
          Couldn't save the spreadsheet
        </span>
      )}
    </>
  );
}

function fileName(build: Build, url: string): string {
  const slug =
    getBuildSlug(url) ??
    build.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  return `${slug || 'build'}.xlsx`;
}

function download(bytes: Uint8Array, name: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // The blob stays alive until the download has started; a moment is plenty.
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
