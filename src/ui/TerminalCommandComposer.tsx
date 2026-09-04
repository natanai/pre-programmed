import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

export type TerminalCommandChoice = {
  id: string;
  text: string;
};

export type TerminalCommandAnchor = {
  text: string;
  onEdit?: () => void;
};

export type TerminalCommandComposerHandle = {
  focus: () => void;
};

type TerminalCommandComposerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  secret?: boolean;
  immediateChoices?: TerminalCommandChoice[];
  menuChoices?: TerminalCommandChoice[];
  anchor?: TerminalCommandAnchor | null;
  ariaLabel: string;
};

const MAX_VISIBLE_LINES = 4;
const COARSE_POINTER_QUERY = "(pointer: coarse)";

export function normalizeTerminalDraft(value: string) {
  return value.replace(/\r\n?|\n/g, " ");
}

function mergeChoices(
  immediateChoices: TerminalCommandChoice[],
  menuChoices: TerminalCommandChoice[],
  menuOpen: boolean,
) {
  const seen = new Set<string>();
  return [...immediateChoices, ...(menuOpen ? menuChoices : [])].filter((choice) => {
    if (!choice.text || seen.has(choice.id)) return false;
    seen.add(choice.id);
    return true;
  });
}

function activeCaretIndex(field: HTMLInputElement | HTMLTextAreaElement) {
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? start;
  if (start === end) return start;
  return field.selectionDirection === "backward" ? start : end;
}

export const TerminalCommandComposer = forwardRef<TerminalCommandComposerHandle, TerminalCommandComposerProps>(
  function TerminalCommandComposer({
    label,
    value,
    onChange,
    onSubmit,
    secret = false,
    immediateChoices = [],
    menuChoices = [],
    anchor = null,
    ariaLabel,
  }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const secretInputRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);
    const caretMarkerRef = useRef<HTMLSpanElement>(null);
    const composingRef = useRef(false);
    const caretFrameRef = useRef(0);
    const [menuOpen, setMenuOpen] = useState(false);
    const [caretIndex, setCaretIndex] = useState(0);

    const field = () => secret ? secretInputRef.current : textareaRef.current;

    useImperativeHandle(ref, () => ({
      focus: () => field()?.focus({ preventScroll: true }),
    }), [secret]);

    const choices = useMemo(
      () => mergeChoices(immediateChoices, menuChoices, menuOpen),
      [immediateChoices, menuChoices, menuOpen],
    );

    const syncSelection = () => {
      const current = field();
      if (!current) return;
      setCaretIndex(Math.min(current.value.length, activeCaretIndex(current)));
    };

    const syncCaret = () => {
      const current = field();
      const editor = editorRef.current;
      const mirror = mirrorRef.current;
      const marker = caretMarkerRef.current;
      if (!current || !editor || !mirror || !marker) return;

      mirror.style.width = `${current.clientWidth}px`;
      const markerRect = marker.getBoundingClientRect();
      const mirrorRect = mirror.getBoundingClientRect();
      const style = window.getComputedStyle(current);
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) || 16;
      const caretHeight = Math.max(2, (parseFloat(style.fontSize) || 16) * 0.125);
      const left = markerRect.left - mirrorRect.left - current.scrollLeft;
      const top = markerRect.top - mirrorRect.top - current.scrollTop + lineHeight - caretHeight;

      editor.style.setProperty("--terminal-command-caret-x", `${Math.max(0, left)}px`);
      editor.style.setProperty("--terminal-command-caret-y", `${Math.max(0, top)}px`);
      editor.dataset.caretReady = "true";
    };

    const queueCaretSync = () => {
      window.cancelAnimationFrame(caretFrameRef.current);
      caretFrameRef.current = window.requestAnimationFrame(() => {
        syncSelection();
        syncCaret();
      });
    };

    useLayoutEffect(() => {
      if (secret) return;
      const textarea = textareaRef.current;
      if (!textarea) return;

      const style = window.getComputedStyle(textarea);
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) || 16;
      const paddingTop = parseFloat(style.paddingTop) || 0;
      const paddingBottom = parseFloat(style.paddingBottom) || 0;
      const maxHeight = lineHeight * MAX_VISIBLE_LINES + paddingTop + paddingBottom;

      textarea.style.height = "auto";
      const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${nextHeight}px`;
      textarea.style.overflowY = textarea.scrollHeight > maxHeight + 1 ? "auto" : "hidden";
    }, [secret, value]);

    useLayoutEffect(() => {
      const current = field();
      if (!current) return;
      const next = Math.min(value.length, activeCaretIndex(current));
      if (next !== caretIndex) setCaretIndex(next);
      queueCaretSync();
      return () => window.cancelAnimationFrame(caretFrameRef.current);
    }, [secret, value, caretIndex]);

    useLayoutEffect(() => {
      const handleResize = () => queueCaretSync();
      window.addEventListener("resize", handleResize);
      document.fonts?.ready.then(handleResize).catch(() => undefined);
      return () => window.removeEventListener("resize", handleResize);
    }, []);

    const submit = () => {
      if (composingRef.current) return;
      setMenuOpen(false);
      onSubmit(value);
    };

    const handleSubmit = (event: FormEvent) => {
      event.preventDefault();
      submit();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.nativeEvent.isComposing || composingRef.current) return;
      event.preventDefault();
      submit();
    };

    const insertChoice = (choice: TerminalCommandChoice) => {
      const next = normalizeTerminalDraft(choice.text);
      onChange(next);
      setMenuOpen(false);
      window.requestAnimationFrame(() => {
        const current = field();
        if (!current) return;
        const coarsePointer = window.matchMedia(COARSE_POINTER_QUERY).matches;
        if (!coarsePointer || document.activeElement === current) {
          current.focus({ preventScroll: true });
        }
        current.setSelectionRange(next.length, next.length);
        setCaretIndex(next.length);
        queueCaretSync();
      });
    };

    const toggleMenu = () => {
      setMenuOpen((open) => !open);
      window.requestAnimationFrame(() => {
        const current = field();
        if (current && !window.matchMedia(COARSE_POINTER_QUERY).matches) {
          current.focus({ preventScroll: true });
        }
        queueCaretSync();
      });
    };

    const mirrorValue = secret ? "•".repeat(value.length) : value;
    const mirrorCaret = Math.min(caretIndex, mirrorValue.length);

    return <div className="terminal-command-stack">
      <form
        className="prompt-line terminal-command-composer"
        onSubmit={handleSubmit}
        onPointerDown={(event) => event.stopPropagation()}
        data-secret={secret ? "true" : "false"}
      >
        <span className="terminal-command-label">{label}</span>
        <div className="terminal-command-control">
          <div
            className={`terminal-command-shell${menuOpen ? " menu-open" : ""}`}
            data-has-menu={menuChoices.length ? "true" : "false"}
          >
            <div className="terminal-command-editor" ref={editorRef}>
              {secret ? <input
                ref={secretInputRef}
                className="terminal-command-field terminal-command-secret"
                type="password"
                value={value}
                onChange={(event) => onChange(normalizeTerminalDraft(event.target.value))}
                onKeyDown={handleKeyDown}
                onSelect={queueCaretSync}
                onKeyUp={queueCaretSync}
                onClick={queueCaretSync}
                onPointerUp={queueCaretSync}
                onScroll={queueCaretSync}
                onFocus={queueCaretSync}
                onCompositionStart={() => { composingRef.current = true; }}
                onCompositionEnd={() => { composingRef.current = false; queueCaretSync(); }}
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="send"
                aria-label={ariaLabel}
              /> : <textarea
                ref={textareaRef}
                className="terminal-command-field terminal-command-textarea"
                rows={1}
                value={value}
                onChange={(event) => onChange(normalizeTerminalDraft(event.target.value))}
                onKeyDown={handleKeyDown}
                onSelect={queueCaretSync}
                onKeyUp={queueCaretSync}
                onClick={queueCaretSync}
                onPointerUp={queueCaretSync}
                onScroll={queueCaretSync}
                onFocus={queueCaretSync}
                onCompositionStart={() => { composingRef.current = true; }}
                onCompositionEnd={() => { composingRef.current = false; queueCaretSync(); }}
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="send"
                aria-label={ariaLabel}
              />}
              <div ref={mirrorRef} className="terminal-command-mirror" aria-hidden="true">
                <span>{mirrorValue.slice(0, mirrorCaret)}</span>
                <span ref={caretMarkerRef} className="terminal-command-caret-marker">​</span>
                <span>{mirrorValue.slice(mirrorCaret) || "​"}</span>
              </div>
              <span className="terminal-command-caret" aria-hidden="true" />
            </div>

            {!secret && menuChoices.length ? <button
              type="button"
              className="terminal-command-toggle"
              aria-label={menuOpen ? "Hide available options" : "Show available options"}
              aria-expanded={menuOpen}
              onPointerDown={(event) => {
                event.stopPropagation();
                if (!window.matchMedia(COARSE_POINTER_QUERY).matches) event.preventDefault();
              }}
              onClick={toggleMenu}
            >{menuOpen ? "▲" : "▼"}</button> : null}

            {!secret && choices.length ? <div className="terminal-command-choices" aria-label="Available commands">
              {choices.map((choice) => <button
                type="button"
                key={choice.id}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => insertChoice(choice)}
              >{choice.text}</button>)}
            </div> : null}
          </div>

          {!secret ? <button
            type="button"
            className="terminal-command-submit"
            aria-label="Submit command"
            title="Submit command"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={submit}
          >↵</button> : null}
        </div>
      </form>

      {!secret && anchor?.text ? anchor.onEdit
        ? <button
          type="button"
          className="terminal-node-anchor terminal-node-anchor-editable"
          aria-label="Edit anchor source"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={anchor.onEdit}
        >{anchor.text}</button>
        : <div className="terminal-node-anchor">{anchor.text}</div>
      : null}
    </div>;
  },
);
