/**
 * Click-to-copy behavior for the note id shown at the top of each note page
 * (ADR-0009). Runs directly in the browser as an ES module; no
 * bundler/build step needed.
 *
 * Uses the async Clipboard API when available (secure contexts only), and
 * falls back to a hidden `<textarea>` + `document.execCommand("copy")`
 * otherwise, so this still works when the site is opened over plain http
 * or via the file:// protocol.
 */
function copyText(text) {
  if (window.isSecureContext && navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    textarea.remove();
  }
  return Promise.resolve();
}

function main() {
  for (const button of document.querySelectorAll("[data-copy]")) {
    button.addEventListener("click", () => {
      copyText(button.dataset.copy ?? "");
    });
  }
}

main();
