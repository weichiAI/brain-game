import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "@babel/parser";
import { transformWithEsbuild, type Plugin } from "vite";

const validExtensions = new Set([".jsx", ".tsx"]);
const r3fImportSources = new Set(["@react-three/fiber", "@react-three/drei", "react-three-fiber"]);
const r3fBailoutElements = new Set([
  "Canvas",
  "mesh",
  "group",
  "scene",
  "primitive",
  "points",
  "instancedMesh",
  "fog",
  "fogExp2",
  "object3D",
]);
const r3fBailoutPatterns = [/Geometry$/, /Material$/, /Light$/, /Camera$/, /Helper$/, /Control$/];

type ParserNode = {
  type: string;
  end?: number | null;
  loc?: { start?: { line?: number; column?: number } } | null;
  name?: unknown;
  source?: { value?: unknown };
  openingElement?: ParserNode;
  attributes?: unknown[];
  program?: { body?: unknown[] };
};

type JsxNameNode =
  | { type: "JSXIdentifier"; name: string; end?: number | null }
  | { type: "JSXMemberExpression"; object?: JsxNameNode; property?: JsxNameNode; end?: number | null }
  | { type: string; end?: number | null };

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function getJsxName(name: unknown): string | null {
  if (!name || typeof name !== "object") return null;
  const node = name as JsxNameNode;
  if (node.type === "JSXIdentifier" && "name" in node) return node.name;
  if (node.type === "JSXMemberExpression") {
    const objectName = "object" in node ? getJsxName(node.object) : null;
    const propertyName = "property" in node ? getJsxName(node.property) : null;
    return objectName && propertyName ? `${objectName}.${propertyName}` : null;
  }
  return null;
}

function getJsxNameEnd(name: unknown): number | null {
  return name && typeof name === "object" && typeof (name as JsxNameNode).end === "number"
    ? (name as JsxNameNode).end ?? null
    : null;
}

function shouldBailout(elementName: string): boolean {
  return r3fBailoutElements.has(elementName) || r3fBailoutPatterns.some((pattern) => pattern.test(elementName));
}

function usesReactThreeFiber(ast: ParserNode): boolean {
  const body = Array.isArray(ast.program?.body) ? ast.program.body : [];
  return body.some((node) => {
    if (!node || typeof node !== "object") return false;
    const item = node as ParserNode;
    return item.type === "ImportDeclaration"
      && typeof item.source?.value === "string"
      && r3fImportSources.has(item.source.value);
  });
}

function hasAttribute(openingElement: ParserNode, attrName: string): boolean {
  return (openingElement.attributes ?? []).some((attribute) => {
    if (!attribute || typeof attribute !== "object") return false;
    return getJsxName((attribute as ParserNode).name) === attrName;
  });
}

function walkJsx(node: unknown, visitor: (node: ParserNode) => void): void {
  if (!node || typeof node !== "object") return;
  const current = node as ParserNode;
  if (current.type === "JSXElement") visitor(current);

  for (const value of Object.values(current)) {
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      value.forEach((item) => walkJsx(item, visitor));
    } else {
      walkJsx(value, visitor);
    }
  }
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function applyInsertions(code: string, insertions: Array<{ position: number; text: string }>): string {
  return [...insertions]
    .sort((a, b) => b.position - a.position)
    .reduce((nextCode, insertion) => (
      `${nextCode.slice(0, insertion.position)}${insertion.text}${nextCode.slice(insertion.position)}`
    ), code);
}

export function imagicmaCartographer(options: { root?: string } = {}): Plugin {
  let viteRoot = "";
  let configuredRoot = "";
  let configuredRootName = "";
  let beaconClientFile = "";

  return {
    name: "imagicma-cartographer",
    enforce: "pre",
    configResolved(config) {
      viteRoot = normalizePath(config.root);
      configuredRoot = normalizePath(
        options.root
          ? path.isAbsolute(options.root)
            ? options.root
            : path.resolve(config.root, options.root)
          : config.root,
      );
      configuredRootName = path.basename(configuredRoot);
      beaconClientFile = path.join(configuredRoot, "src", "lib", "imagicma-preview-picker.ts");
    },
    transform(code, id) {
      if (!validExtensions.has(path.extname(id)) || id.includes("node_modules")) return null;

      try {
        const ast = parse(code, {
          sourceType: "module",
          plugins: ["jsx", "typescript"],
        }) as unknown as ParserNode;
        if (usesReactThreeFiber(ast)) return null;

        const normalizedId = normalizePath(id);
        const insertions: Array<{ position: number; text: string }> = [];
        let isR3FFile = false;
        walkJsx(ast, (jsxElement) => {
          if (isR3FFile) return;
          const openingElement = jsxElement.openingElement;
          if (!openingElement) return;
          const elementName = getJsxName(openingElement.name);
          if (!elementName || elementName === "line" || elementName === "Fragment" || elementName === "React.Fragment") return;
          if (shouldBailout(elementName)) {
            isR3FFile = true;
            return;
          }
          if (hasAttribute(openingElement, "data-replit-metadata")) return;

          const nameEnd = getJsxNameEnd(openingElement.name);
          if (typeof nameEnd !== "number") return;

          const line = openingElement.loc?.start?.line ?? 0;
          const column = openingElement.loc?.start?.column ?? 0;
          const relativeToConfigured = normalizePath(path.relative(configuredRoot, normalizedId));
          const relativePath = relativeToConfigured.startsWith("..")
            ? normalizePath(path.relative(viteRoot, normalizedId))
            : normalizePath(path.join(configuredRootName, relativeToConfigured));
          const metadata = column === 0 ? `${relativePath}:${line}` : `${relativePath}:${line}:${column}`;
          insertions.push({
            position: nameEnd,
            text: ` data-replit-metadata="${escapeAttribute(metadata)}" data-component-name="${escapeAttribute(elementName)}"`,
          });
        });

        if (isR3FFile || insertions.length === 0) return null;
        return { code: applyInsertions(code, insertions), map: null };
      } catch (error) {
        console.error(`[imagicma-cartographer] Error processing ${id}:`, error);
        return null;
      }
    },
    async transformIndexHtml() {
      const source = await fs.readFile(beaconClientFile, "utf8");
      const transformed = await transformWithEsbuild(source, beaconClientFile, {
        format: "esm",
        loader: "ts",
        target: "es2020",
      });

      return [
        {
          tag: "script",
          attrs: { type: "module" },
          children: transformed.code,
          injectTo: "head",
        },
      ];
    },
  };
}
