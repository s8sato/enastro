/**
 * Client-side theme switcher (REQ-UX-011): lets a viewer pick one of 12
 * color themes, persisted in the browser's `localStorage` and applied via
 * `document.documentElement.dataset.theme` (read by the `[data-theme="..."]`
 * blocks in site.css). Entirely client-side, like the exploration-status
 * feature (ADR-0014) — the build never bakes in a specific theme
 * (REQ-BUILD-001), and theme choice is never written to any build artifact.
 *
 * Runs directly in the browser as an ES module; no bundler/build step
 * needed. The FOUC-prevention inline script in each page's `<head>`
 * (page.ts's `THEME_FOUC_SCRIPT`) already applies any stored theme before
 * this module loads — this module is only responsible for the switcher UI
 * itself and for keeping `data-theme` in sync going forward.
 *
 * `accent` here must be kept in sync with each theme's `--accent` value in
 * site.css's `:root[data-theme="..."]` blocks — it's only used to color
 * each dial point's preview dot in its own theme's accent, so a mismatch
 * is cosmetic (not a correctness bug), but should still be fixed if it
 * drifts.
 */
export const THEMES = [
  { id: "aurora", label: "Aurora", accent: "#7dffb3" },
  { id: "corona", label: "Corona", accent: "#eaf5f0" },
  { id: "ether", label: "Ether", accent: "#dff5ff" },
  { id: "flare", label: "Flare", accent: "#ff7a45" },
  { id: "graviton", label: "Graviton", accent: "#6a5cff" },
  { id: "moon", label: "Moon", accent: "#f2c879" },
  { id: "nebula", label: "Nebula", accent: "#ff8fc7" },
  { id: "nova", label: "Nova", accent: "#eaf2ff" },
  { id: "pulser", label: "Pulser", accent: "#7ffcff" },
  { id: "sirius", label: "Sirius", accent: "#b8d4ff" },
  { id: "venus", label: "Venus", accent: "#e0a86b" },
  { id: "void", label: "Void", accent: "#9aa0b8" },
];

export const STORAGE_KEY = "enastro:theme:v1";

export const DEFAULT_THEME = "moon";

/** @param {string} id */
export function isValidTheme(id) {
  return THEMES.some((theme) => theme.id === id);
}

/** Reads the persisted theme choice from localStorage, if any and valid. */
export function readStoredTheme() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw && isValidTheme(raw) ? raw : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Persists a theme choice to localStorage.
 * @param {string} id
 * @returns {boolean} whether the write succeeded (false e.g. on a
 *   QuotaExceededError — the caller may still apply the choice for the
 *   current page view, it just won't survive a reload).
 */
export function storeTheme(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
    return true;
  } catch {
    return false;
  }
}

/**
 * The angle (degrees) of the `index`-th of `total` evenly-spaced points
 * around a circle, with index 0 placed at the top (-90°) so the dial
 * reads like a clock/star-chart rather than starting at 3 o'clock.
 * @param {number} index
 * @param {number} total
 */
export function angleForIndex(index, total) {
  return (360 / total) * index - 90;
}

/**
 * Converts a `angleForIndex()`-style angle (degrees) into an {x, y} offset
 * on a circle of the given radius, for positioning dial points via CSS
 * `transform: translate(...)`.
 * @param {number} angleDegrees
 * @param {number} radius
 */
export function pointOnCircle(angleDegrees, radius) {
  const rad = (angleDegrees * Math.PI) / 180;
  return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) };
}

function main() {
  const root = document.getElementById("theme-switcher");
  const trigger = document.getElementById("theme-trigger");
  const dialog = document.getElementById("theme-dialog");
  if (!root || !trigger || !dialog) {
    // No shared header on this page (shouldn't happen for the three
    // generated page kinds, but keeps this module safe to load anywhere).
    return;
  }
  root.hidden = false;

  // Accessibility source of truth (REQ-UX-011): a native <select>, kept in
  // the DOM and focusable/readable by assistive tech, independent of the
  // dial's drag/hover interactions.
  const select = document.createElement("select");
  select.id = "theme-select";
  select.className = "theme-select-visually-hidden";
  select.setAttribute("aria-label", "Theme");
  for (const theme of THEMES) {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = theme.label;
    select.appendChild(option);
  }
  dialog.appendChild(select);

  // Rotary dial (visual layer only — decorative from an accessibility
  // standpoint, since `select` above is the actual control surface).
  const dial = document.createElement("div");
  dial.className = "theme-dial";
  dial.setAttribute("role", "presentation");

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  let committedTheme = readStoredTheme() ?? document.documentElement.dataset.theme ?? DEFAULT_THEME;
  let previewedTheme = null;

  function applyTheme(id) {
    document.documentElement.dataset.theme = id;
  }

  /** Shared commit logic: persists + applies, without touching `select.value`
   * (the caller is responsible for that, since the two call sites — the
   * dial and the select's own `change` event — need different handling to
   * avoid a change→commit→change dispatch loop). */
  function applyCommit(id) {
    committedTheme = id;
    previewedTheme = null;
    applyTheme(id);
    storeTheme(id);
    // Theme choice is a low-stakes preference (unlike exploration status),
    // so a failed persist just means it won't survive a reload — no
    // dedicated warning UI for that here.
    updateCurrentMarkers();
  }

  /** Commit path for dial interaction: programmatically setting
   * `select.value` does not fire a `change` event, so this path is safe
   * from the select's own `change` listener re-triggering. */
  function commitFromDial(id) {
    select.value = id;
    applyCommit(id);
  }

  function preview(id) {
    if (prefersReducedMotion) return;
    previewedTheme = id;
    applyTheme(id);
  }

  function cancelPreview() {
    if (previewedTheme === null) return;
    previewedTheme = null;
    applyTheme(committedTheme);
  }

  function updateCurrentMarkers() {
    for (const button of dial.querySelectorAll(".theme-dial-point")) {
      button.setAttribute("aria-current", String(button.dataset.theme === committedTheme));
    }
  }

  for (const [index, theme] of THEMES.entries()) {
    const angle = angleForIndex(index, THEMES.length);
    const { x, y } = pointOnCircle(angle, 88);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-dial-point";
    button.dataset.theme = theme.id;
    button.setAttribute("aria-hidden", "true");
    button.tabIndex = -1; // decorative; keyboard/SR users operate `select` instead
    button.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

    const dot = document.createElement("span");
    dot.className = "theme-dial-point-dot";
    dot.style.setProperty("--dial-accent", theme.accent);

    const label = document.createElement("span");
    label.textContent = theme.label;

    button.append(dot, label);
    button.addEventListener("mouseenter", () => preview(theme.id));
    button.addEventListener("mouseleave", cancelPreview);
    button.addEventListener("click", () => commitFromDial(theme.id));

    dial.appendChild(button);
  }

  dialog.appendChild(dial);

  select.value = committedTheme;
  applyTheme(committedTheme);
  updateCurrentMarkers();

  select.addEventListener("change", () => {
    applyCommit(select.value);
  });

  function openDialog() {
    dialog.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  }

  function closeDialog() {
    cancelPreview();
    dialog.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  trigger.setAttribute("aria-expanded", "false");
  trigger.addEventListener("click", () => {
    if (dialog.hidden) openDialog();
    else closeDialog();
  });

  document.addEventListener("click", (event) => {
    if (dialog.hidden) return;
    if (root.contains(event.target)) return;
    closeDialog();
  });

  document.addEventListener("keydown", (event) => {
    if (dialog.hidden) return;
    if (event.key === "Escape") {
      closeDialog();
    }
  });
}

// Guarded so this module can be imported for its pure theme/storage
// functions from a plain Node test environment (no `document` global)
// without triggering the DOM-wiring side effects above.
if (typeof document !== "undefined") {
  main();
}
