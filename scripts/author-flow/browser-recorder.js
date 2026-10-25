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
    if (style.visibility === "hidden" || style.display === "none" || (style.pointerEvents === "none" && !element.disabled)) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    let left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right);
    let top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom);
    for (let ancestor = element.parentElement; ancestor && left < right && top < bottom; ancestor = ancestor.parentElement) {
      const overflow = getComputedStyle(ancestor);
      const box = ancestor.getBoundingClientRect();
      if (/hidden|clip|auto|scroll/.test(overflow.overflowX)) {
        left = Math.max(left, box.left); right = Math.min(right, box.right);
      }
      if (/hidden|clip|auto|scroll/.test(overflow.overflowY)) {
        top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom);
      }
    }
    if (left >= right || top >= bottom) return false;
    const points = [
      [(left + right) / 2, (top + bottom) / 2],
      [left + (right - left) * .25, top + (bottom - top) * .25],
      [left + (right - left) * .75, top + (bottom - top) * .75],
    ];
    return Boolean(element.disabled) || points.some(([x,y]) => {
      const hit = document.elementFromPoint(x,y);
      return hit && (hit === element || element.contains(hit));
    });
  }
  function scopeFor(element) {
    const region = element.closest("[data-author-ui-workspace],[data-author-ui-role],[data-task-id],.author-picker-surface,[role=dialog]") || document.body;
    const task = region.closest(".author-task-surface");
    const taskDepth = task ? Array.from(document.querySelectorAll(".author-task-surface")).indexOf(task) : -1;
    const scope = region.getAttribute("data-author-ui-workspace")
      || region.getAttribute("data-author-ui-role")
      || (taskDepth >= 0 ? "task-depth:" + taskDepth : "")
      || region.getAttribute("aria-label")
      || (typeof region.className === "string" ? region.className.split(" ")[0] : "")
      || "page";
    return { region, scope };
  }
  function describe(element) {
    const {region, scope} = scopeFor(element);
    const kind = element.tagName.toLowerCase();
    const identifier = element.id || element.getAttribute("aria-label") || element.getAttribute("name") || "";
    const ordinal = Array.from(document.body.querySelectorAll(selector)).indexOf(element);
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
  function scrollableRegions(roots) {
    const elements = [...new Set(roots.flatMap(root => [root, ...root.querySelectorAll("*")]))];
    const regions = [];
    // The actual rendered CSS and scroll dimensions determine this list.
    // Scrolling an element is recorded as an interaction, never inferred from its contents.
    for (const element of elements) {
      if (!(element instanceof HTMLElement)) continue;
      const style = getComputedStyle(element);
      if (!/^(auto|scroll)$/.test(style.overflowY)) continue;
      const max = element.scrollHeight - element.clientHeight;
      if (max < 12 || element.clientHeight < 56 || !visible(element)) continue;
      const {scope} = scopeFor(element);
      const ordinal = Array.from(document.body.querySelectorAll("*")).indexOf(element);
      const locator = JSON.stringify([scope, "scroll-y", element.tagName.toLowerCase(), ordinal]);
      element.setAttribute("data-author-flow-scroll-probe", locator);
      regions.push({
        locator, axis:"y", top:Math.round(element.scrollTop),
        max_top:Math.round(max), client_height:Math.round(element.clientHeight),
        label:(element.getAttribute("aria-label") || element.className?.toString().split(" ")[0] || element.tagName.toLowerCase()).slice(0,100),
      });
    }
    return regions;
  }
  function snapshot() {
    if (!fixture) throw new Error("Start the audit with a named fixture first.");
    const layer = document.querySelector(".author-workspace-layer");
    const root = layer || document.body;
    const roots = [root, ...document.querySelectorAll(".author-picker-surface,[role=dialog]")];
    // The master X is deliberately outside the Author workspace portal. It must
    // be inventoried as an actual visible control rather than omitted.
    const extraControls = [...document.querySelectorAll(".work-surface-close")];
    const controls = [...new Set([...roots.flatMap(r => Array.from(r.querySelectorAll(selector))),...extraControls])].filter(visible).map(describe);
    const trails = document.querySelectorAll(".author-task-trail");
    const task_stack = Array.from(trails[0]?.querySelectorAll("li") || []).map(li => ({
      label: li.textContent.trim(), current: li.getAttribute("aria-current") === "page",
    }));
    const ui = {
      visible_controls: controls,
      scrollable_regions: scrollableRegions(roots),
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