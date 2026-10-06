import { useEffect, useRef, useState } from 'preact/hooks';
import type { PostOutcome } from '@/lib/comments/controller';

/** The site's own limit for a comment. */
const MAX_LENGTH = 1000;
/** The remaining count shows once the text gets close to the limit. */
const COUNTER_FROM = 800;

type Failure = Extract<PostOutcome, { ok: false }>;

/**
 * A box to write a comment or an answer. Nothing leaves it until the reader presses the button or Ctrl+Enter; what was
 * typed stays when posting fails.
 */
export function CommentComposer({
  label,
  placeholder,
  submitLabel,
  onSubmit,
  onDone,
  onCancel,
  onSignIn,
  autoFocus = false,
  inline = false,
}: {
  /** Accessible name of the box, e.g. "Reply to FrostRunner". */
  label: string;
  placeholder: string;
  submitLabel: string;
  onSubmit: (text: string) => Promise<PostOutcome>;
  /** The site took the text. */
  onDone?: () => void;
  /** Shows a Cancel button; Escape does the same. */
  onCancel?: () => void;
  /** Where a signed-out visitor can sign in. */
  onSignIn?: () => void;
  autoFocus?: boolean;
  /** One line with the button beside it, for the box above the list. */
  inline?: boolean;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const empty = text.trim() === '';

  useEffect(() => {
    if (autoFocus) box.current?.focus();
  }, [autoFocus]);

  const submit = async () => {
    if (empty || sending) return;
    setSending(true);
    setFailure(null);
    const outcome = await onSubmit(text);
    setSending(false);
    if (!outcome.ok) {
      setFailure(outcome);
      return;
    }
    setText('');
    onDone?.();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void submit();
    } else if (event.key === 'Escape' && onCancel) {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div class={inline ? 'composer composer--inline' : 'composer'}>
      <textarea
        ref={box}
        class="composer__box"
        aria-label={label}
        placeholder={placeholder}
        maxLength={MAX_LENGTH}
        rows={inline ? 1 : 2}
        value={text}
        onInput={(event) => setText((event.target as HTMLTextAreaElement).value)}
        onKeyDown={onKeyDown}
      />
      <div class="composer__bar">
        {text.length >= COUNTER_FROM && <span class="composer__count">{`${MAX_LENGTH - text.length} characters left`}</span>}
        {onCancel && (
          <button type="button" class="button" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="button" class="button button--accent" disabled={empty || sending} onClick={() => void submit()}>
          {sending ? 'Posting…' : submitLabel}
        </button>
      </div>
      {failure && (
        <p class="composer__error" role="alert">
          {failureText(failure)}
          {failure.reason === 'signed-out' && onSignIn && (
            <button type="button" class="comment__link" onClick={onSignIn}>
              Sign in on Mobalytics
            </button>
          )}
        </p>
      )}
    </div>
  );
}

function failureText(failure: Failure): string {
  if (failure.reason === 'signed-out') return 'Sign in on Mobalytics to comment.';
  if (failure.reason === 'rejected') return `The site didn't publish it: ${failure.message}`;
  const wait = failure.retryAt !== null && failure.retryAt > Date.now() ? ` The site asked to wait ${Math.ceil((failure.retryAt - Date.now()) / 1000)} s.` : '';
  return `Couldn't post your comment (${failure.message}).${wait}`;
}
