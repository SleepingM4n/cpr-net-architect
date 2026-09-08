import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve(import.meta.dirname, "..");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml"
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost"),
      path = resolve(root, "." + decodeURIComponent(url.pathname === "/" ? "/tests/preview.html" : url.pathname));
    if (!path.startsWith(root + sep)) throw Error("Outside preview directory");
    const data = await readFile(path);
    res.writeHead(200, {
      "Content-Type": types[extname(path)] ?? "text/plain"
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(18771, "127.0.0.1", () => console.log("NET Architect UI harness: http://127.0.0.1:18771/tests/preview.html"));
