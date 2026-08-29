import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
};

/**
 * A minimal, dependency-free static file server used only to serve a
 * build's `dist/` output to a real browser for E2E tests. Needed because
 * `search.mjs`'s `fetch("search-index.json")` requires http(s), not
 * file://.
 */
export function serveStatic(rootDir: string): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((req, res) => {
    const requestPath = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    let filePath = path.join(rootDir, requestPath);

    // Clean URL resolution (ADR-0018): a directory request (e.g. "/",
    // "/graph/", "/notes/note-a/") resolves to that directory's
    // index.html, mirroring GitHub Pages / `npx http-server` default
    // behavior — this project's own build output no longer writes
    // "<name>.html" files for anything but the root.
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    if (!filePath.startsWith(rootDir) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const contentType = CONTENT_TYPES[path.extname(filePath)] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}
