import { useEffect, useRef, useState } from 'preact/hooks';

/** The accessible name of a button that copies a name, e.g. a gem's or a rune's. */
export const copyLabel = (name: string) => `Copy “${name}”`;

/** Copies a name for the game's own search and says so for two seconds. */
export function useCopyName(copy: (text: string) => Promise<boolean>) {
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const copyName = async (name: string) => {
    const copied = await copy(name);
    setNotice(copied ? `Copied “${name}”` : "Couldn't copy the name");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), 2000);
  };

  return { notice, copyName };
}

/** Says the name is on the clipboard, at the window's corner. */
export function CopyNotice({ notice }: { notice: string | null }) {
  if (!notice) return null;
  return (
    <p class="copy-notice" role="status">
      {notice}
    </p>
  );
}
