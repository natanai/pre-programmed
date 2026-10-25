/* Read-only browser instrument for disposable Author audit sessions.
 * Exposes observed DOM states and probe locators to an external test runner.
 * It never clicks controls, persists data, or changes application state.
 */
(() => {
  if (window.__authorFlowAudit) return;
  const selector = "button,input,textarea,select,summary,a[href]";
  let fixture = null;
  const hash = text => {
    let h = 0xcbf29ce484222325n;
    for (let i = 0; i < text.length; i++) h = BigInt.asUintN(64, (h ^ BigInt(text.charCodeAt(i))) * 0x100000001b3n);
    return h.toString(16).padStart(16, "0");
  };
  function visible(element) {
    if (!element.isConnected || element.closest("[aria-hidden=true],[inert]")) return false;
    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && element.getClientRects().length > 0;
  }
  function scopeFor(element) {
    const region = element.closest("[data-author-ui-workspace],[data-author-ui-role],[data-task-id],.author-picker-surface,[role=dialog]") || document.body;
    const scope = region.getAttribute("data-author-ui-workspace")
      || region.getAttribute("data-author-ui-role")
      || region.getAttribute("data-task-id")
      || region.getAttribute("aria-label")
      || (typeof region.className === "string" ? region.className.split(" ")[0] : "")
      || "page";
    return { region, scope };
  }
  function describe(element) {
    const {region, scope} = scopeFor(element);
    const kind = element.tagName.toLowerCase();
    const identifier = element.id || element.getAttribute("aria-label") || element.getAttribute("name") || "";
    const ordinal = Array.from(region.querySelectorAll(selector)).indexOf(element);
    const locator = JSON.stringify([scope, kind, identifier, ordinal]);
    element.setAttribute("data-author-flow-probe", locator);
    const label = (element.getAttribute("aria-label")
      || element.labels?.[0]?.textContent || element.innerText || element.textContent || "")
      .replace(/\s+/g, " ").trim().slice(0, 180);
    const value = kind === "select" || kind === "textarea" || (kind === "input" && !["checkbox", "radio"].includes(element.type))
      ? element.value
      : ["checkbox", "radio"].includes(element.type) ? Boolean(element.checked)
      : element.hasAttribute("aria-pressed") ? element.getAttribute("aria-pressed") === "true" : null;
    const options = kind === "select" ? Array.from(element.options).map(option => ({
      label: option.textContent.trim(), value: option.value, enabled: !option.disabled,
    })) : [];
    return {
      locator, kind, label, enabled: !element.disabled, value, options,
      expanded: element.getAttribute("aria-expanded"),
      selected: element.getAttribute("aria-selected"),
      open: kind === "summary" ? element.parentElement.open : null,
    };
  }
  function snapshot() {
    if (!fixture) throw new Error("Start the audit with a named fixture first.");
    const layer = document.querySelector(".author-workspace-layer");
    const root = layer || document.querySelector(".author-input-surface") || document.body;
    const roots = [root, ...document.querySelectorAll(".author-picker-surface,[role=dialog]")];
    const controls = [...new Set(roots.flatMap(r => Array.from(r.querySelectorAll(selector))))].filter(visible).map(describe);
    const trails = document.querySelectorAll(".author-task-trail");
    const task_stack = Array.from(trails[0]?.querySelectorAll("li") || []).map(li => ({
      label: li.textContent.trim(), current: li.getAttribute("aria-current") === "page",
    }));
    const ui = {
      visible_controls: controls,
      workspace: document.querySelector(".author-task-surface.is-active [data-author-ui-workspace]")?.getAttribute("data-author-ui-workspace")
        || (document.querySelector(".author-tool-index") ? "author-tools" : null),
      overlay_open: Boolean(layer),
    };
    const id = "state:" + hash(JSON.stringify({ui, task_stack}));
    return {
      id, fixture: fixture.id, ui, task_stack,
      draft_state: { observed: false }, run_state: { observed: false },
    };
  }
  window.__authorFlowAudit = Object.freeze({
    start(value) {
      if (!value?.id || !value?.project_fixture || !value?.viewport || !value?.initial_run) throw new Error("Incomplete fixture.");
      fixture = value;
      return snapshot();
    },
    snapshot,
    stop() { fixture = null; },
    version: "2",
  });
})();