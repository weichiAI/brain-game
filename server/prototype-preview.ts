import fs from "node:fs/promises";
import path from "node:path";

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function resolveInside(root: string, relativePath: string) {
  if (path.isAbsolute(relativePath)) return null;

  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolvedPath);

  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return resolvedPath;
  }

  return null;
}

export async function readPrototypeAsset(prototypeRoot: string, urlPath: string) {
  if (!urlPath.startsWith("/prototype/")) return null;

  let relativePath: string;
  try {
    relativePath = decodeURIComponent(urlPath.slice("/prototype/".length));
  } catch {
    return null;
  }

  const assetPath = resolveInside(prototypeRoot, relativePath);
  if (!assetPath) return null;

  try {
    const stat = await fs.stat(assetPath);
    if (!stat.isFile()) return null;
    const ext = path.extname(assetPath).toLowerCase();
    return {
      contentType: contentTypes[ext] ?? "application/octet-stream",
      data: await fs.readFile(assetPath),
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
