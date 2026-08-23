/**
 * Client-side search & tag filter UI (REQ-UX-001, REQ-UX-002). Runs directly
 * in the browser as an ES module; no bundler/build step needed. Fetches the
 * already-public search-index.json (same directory as index.html) and wires
 * up the search box / tag checkboxes generated in renderIndexPage().
 *
 * Note: `fetch()` of a same-origin JSON file requires the page to be served
 * over http(s); it will not work when index.html is opened directly via the
 * file:// protocol due to browser CORS restrictions.
 */
import { filterEntries } from "./filter.mjs";

async function main() {
  const searchBox = document.getElementById("search-box");
  const tagFilters = document.getElementById("tag-filters");
  const noteList = document.getElementById("note-list");
  const noResults = document.getElementById("no-results");
  if (!searchBox || !tagFilters || !noteList) {
    return;
  }

  const response = await fetch("search-index.json");
  const entries = await response.json();

  const allTags = [...new Set(entries.flatMap((entry) => entry.tags))].sort();

  for (const tag of allTags) {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = tag;
    checkbox.addEventListener("change", update);
    label.appendChild(checkbox);
    label.append(` #${tag}`);
    tagFilters.appendChild(label);
  }

  function selectedTags() {
    return [...tagFilters.querySelectorAll("input:checked")].map((checkbox) => checkbox.value);
  }

  function update() {
    const visibleIds = new Set(filterEntries(entries, searchBox.value, selectedTags()));
    let anyVisible = false;
    for (const item of noteList.querySelectorAll("li[data-id]")) {
      const visible = visibleIds.has(item.dataset.id);
      item.hidden = !visible;
      if (visible) {
        anyVisible = true;
      }
    }
    if (noResults) {
      noResults.hidden = anyVisible;
    }
  }

  searchBox.addEventListener("input", update);

  // Deep-link support (REQ-UX-008): a note page's `#tag` links to
  // `../index.html?tags=<tag>` so that clicking it lands here with the
  // corresponding tag checkbox already selected. Unknown tag values (e.g. a
  // stale/mistyped link) are silently ignored rather than treated as an
  // error, since there is no checkbox to check for them.
  const requestedTags = new URLSearchParams(location.search).getAll("tags");
  for (const tag of requestedTags) {
    const checkbox = tagFilters.querySelector(`input[value="${CSS.escape(tag)}"]`);
    if (checkbox) {
      checkbox.checked = true;
    }
  }
  update();
}

main();
