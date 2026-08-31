const TERMINAL_INPUT_SELECTOR = ".terminal-input";
const CARET_READY_ATTRIBUTE = "data-terminal-caret-ready";

let measureCanvas: HTMLCanvasElement | null = null;

function terminalInputFromTarget(target: EventTarget | null) {
  return target instanceof HTMLInputElement && target.matches(TERMINAL_INPUT_SELECTOR) ? target : null;
}

function measureCharacterWidth(input: HTMLInputElement) {
  const style = window.getComputedStyle(input);
  measureCanvas ??= document.createElement("canvas");
  const context = measureCanvas.getContext("2d");
  if (!context) return parseFloat(style.fontSize) * 0.6;
  context.font = style.font;
  return context.measureText("0").width || parseFloat(style.fontSize) * 0.6;
}

function caretIndex(input: HTMLInputElement) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  if (start === end) return start;
  return input.selectionDirection === "backward" ? start : end;
}

function syncTerminalCaret(input: HTMLInputElement) {
  const form = input.closest<HTMLFormElement>(".prompt-input-row");
  if (!form) return;

  const formRect = form.getBoundingClientRect();
  const inputRect = input.getBoundingClientRect();
  const style = window.getComputedStyle(input);
  const paddingLeft = parseFloat(style.paddingLeft) || 0;
  const left = inputRect.left - formRect.left + paddingLeft
    + caretIndex(input) * measureCharacterWidth(input)
    - input.scrollLeft;

  form.style.setProperty("--terminal-caret-left", `${Math.max(0, left)}px`);
  form.setAttribute(CARET_READY_ATTRIBUTE, "true");
}

function queueTerminalCaretSync(input: HTMLInputElement) {
  window.requestAnimationFrame(() => syncTerminalCaret(input));
}

function syncTerminalCarets(root: ParentNode = document) {
  root.querySelectorAll<HTMLInputElement>(TERMINAL_INPUT_SELECTOR).forEach(syncTerminalCaret);
}

const delegatedEvents = ["input", "select", "keyup", "click", "focus", "pointerup", "scroll"] as const;
delegatedEvents.forEach((eventName) => {
  document.addEventListener(eventName, (event) => {
    const input = terminalInputFromTarget(event.target);
    if (input) queueTerminalCaretSync(input);
  }, true);
});

document.addEventListener("selectionchange", () => {
  const input = terminalInputFromTarget(document.activeElement);
  if (input) queueTerminalCaretSync(input);
});

const observer = new MutationObserver((records) => {
  records.forEach((record) => {
    record.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.matches(TERMINAL_INPUT_SELECTOR)) syncTerminalCaret(node as HTMLInputElement);
      syncTerminalCarets(node);
    });
  });
});
observer.observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener("resize", () => syncTerminalCarets());
document.fonts?.ready.then(() => syncTerminalCarets()).catch(() => undefined);
syncTerminalCarets();
