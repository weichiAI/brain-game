const VERSION = "2.0.0";
const HIGHLIGHT_COLOR = "#0079F2";
const HIGHLIGHT_BG = "#0079F210";
const METADATA_ATTR = "data-replit-metadata";
const COMPONENT_ATTR = "data-component-name";
const DIRTY_ATTR = "data-replit-dirty";
const DISABLED_ATTR = "data-replit-disabled";
const THEME_PREVIEW_STYLE_ID = "replit-theme-preview";
const MAX_SIBLING_HIGHLIGHTERS = 1000;

type SourceRef = {
  file: string;
  line: number;
  column: number;
  nodeKey: string;
  templateKey: string;
  componentName: string;
};

type SourceBinding =
  | {
      kind: "jsx-element";
      source: SourceRef;
    }
  | {
      kind: "jsx-text";
      source: SourceRef;
    }
  | {
      kind: "inline-style-property";
      field: string;
      source: SourceRef;
    };

type SourceBindings = Record<string, SourceBinding>;

type SelectionPayload = {
  pageUrl: string;
  selector: string;
  tagName: string;
  className: string;
  textContent: string;
  textSnippet: string;
  id: string;
  elementPath: string;
  elementName: string;
  originalTextContent?: string;
  srcAttribute: string;
  hasChildElements: boolean;
  attributes: Record<string, string>;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  computedStyles: Record<string, string>;
  textAlign: string;
  source?: SourceRef;
  editSource?: SourceRef & { kind: "host-jsx" };
  nodeId?: string;
  sourceFile?: string;
  sourceBindings?: SourceBindings;
  peerRects: Array<{
    nodeId: string;
    rect: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  siblingCount: number;
  editableFields: {
    textContent: boolean;
    fontSize: boolean;
    fontWeight: boolean;
    textAlign: boolean;
    color: boolean;
    backgroundColor: boolean;
    borderRadius: boolean;
    margin: boolean;
    padding: boolean;
    sortable: boolean;
  };
  computedStyleSnapshot: {
    textContent: string;
    fontSize: string;
    fontWeight: string;
    textAlign: string;
    color: string;
    backgroundColor: string;
    borderRadius: string;
    margin: string;
    padding: string;
  };
  relatedElements: {
    parent: BaseElement | null;
    nextSibling: BaseElement | null;
    grandParent: BaseElement | null;
    children: BaseElement[];
  };
};

type BaseElement = {
  tagName: string;
  className: string;
  textContent: string;
  id: string;
};

declare global {
  interface Window {
    REPLIT_BEACON_VERSION?: string;
    __IMAGICMA_PREVIEW_PICKER__?: ImagicmaBeacon;
  }
}

const PROD_PARENT_ORIGINS = new Set(["https://agentma.cn", "https://imagicma.cn"]);
const LOCAL_PARENT_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
const LOCAL_IMAGICMA_PARENT_RE = /^https?:\/\/([a-z0-9-]+\.)?(agentma\.cn|imagicma\.cn)(:\d+)?$/i;

const OVERLAY_CSS = `
  .beacon-highlighter {
    position: fixed;
    z-index: 2147483644;
    box-sizing: border-box;
    pointer-events: none;
    outline: 2px dashed ${HIGHLIGHT_COLOR} !important;
    outline-offset: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    transform: none !important;
    background: ${HIGHLIGHT_BG} !important;
    opacity: 0;
  }

  .beacon-hover-highlighter {
    z-index: 2147483647;
  }

  .beacon-selected-highlighter {
    z-index: 2147483646;
    outline: 2px solid ${HIGHLIGHT_COLOR} !important;
    outline-offset: 3px !important;
    background: transparent !important;
  }

  .beacon-label {
    position: fixed;
    z-index: 2147483647;
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
    background-color: ${HIGHLIGHT_COLOR};
    color: #fff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 13px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    line-height: 1;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
    pointer-events: none;
    opacity: 0;
  }

  .beacon-sibling-highlighter {
    z-index: 2147483645;
    outline: 2px dashed ${HIGHLIGHT_COLOR} !important;
    background: ${HIGHLIGHT_BG} !important;
  }
`;

const EDITING_CSS = `
  [contenteditable] {
    outline: none !important;
  }

  [contenteditable]:focus {
    outline: none !important;
  }
`;

function trimText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function truncate(value: unknown, max = 300): string {
  const text = String(value ?? "");
  return text.length <= max ? text : `${text.slice(0, max)}...`;
}

function getReferrerOrigin(): string {
  try {
    return document.referrer ? new URL(document.referrer).origin : "";
  } catch {
    return "";
  }
}

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  return (
    origin === window.location.origin ||
    PROD_PARENT_ORIGINS.has(origin) ||
    LOCAL_PARENT_RE.test(origin) ||
    LOCAL_IMAGICMA_PARENT_RE.test(origin)
  );
}

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
}

function visibleRect(element: HTMLElement): { top: number; left: number; width: number; height: number } | null {
  if (!element.isConnected) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const top = Math.max(0, rect.top);
  const bottom = Math.min(window.innerHeight, rect.bottom);
  const height = Math.max(0, bottom - top);
  if (height <= 0) return null;
  return {
    top,
    left: rect.left,
    width: rect.width,
    height,
  };
}

function componentName(element: HTMLElement): string {
  return truncate(element.getAttribute(COMPONENT_ATTR) || element.tagName.toLowerCase(), 80);
}

function selectorForElement(element: HTMLElement): string {
  const metadata = trimText(element.getAttribute(METADATA_ATTR));
  if (metadata) return `[${METADATA_ATTR}="${metadata.replace(/"/g, '\\"')}"]`;
  if (element.id && window.CSS?.escape) return `#${window.CSS.escape(element.id)}`;
  return element.tagName.toLowerCase();
}

function parseSource(metadata: string | null): SourceRef | null {
  const value = trimText(metadata);
  if (!value) return null;
  const match = /^(.+?):(\d+)(?::(\d+))?$/.exec(value);
  if (!match) return null;
  const line = Number(match[2]);
  const column = Number(match[3] || "1");
  if (!Number.isFinite(line) || !Number.isFinite(column)) return null;
  return {
    file: match[1],
    line,
    column,
    nodeKey: value,
    templateKey: value,
    componentName: "",
  };
}

function baseElement(element: Element | null): BaseElement | null {
  if (!(element instanceof HTMLElement)) return null;
  return {
    tagName: element.tagName.toLowerCase(),
    className: typeof element.className === "string" ? element.className : String(element.className ?? ""),
    textContent: element.textContent ?? "",
    id: element.id ?? "",
  };
}

function isPureTextElement(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase();
  if (["style", "script", "img", "svg", "canvas", "video", "iframe", "noscript"].includes(tagName)) return false;
  if (element.childElementCount > 0) return false;
  const inlineStyle = element.getAttribute("style");
  if (inlineStyle && inlineStyle.trim()) return false;
  return Array.from(element.childNodes).every((node) => node.nodeType === Node.TEXT_NODE);
}

function collectAttributes(element: HTMLElement): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    const name = trimText(attr.name).toLowerCase();
    if (!name) continue;
    if (
      ["id", "class", "href", "src", "alt", "title", "role", "aria-label", METADATA_ATTR, COMPONENT_ATTR].includes(name) ||
      name.startsWith("data-") ||
      name.startsWith("aria-")
    ) {
      attributes[name] = truncate(attr.value, 240);
    }
    if (Object.keys(attributes).length >= 40) break;
  }
  return attributes;
}

function siblingsFor(element: HTMLElement, visibleOnly = false): HTMLElement[] {
  const metadata = trimText(element.getAttribute(METADATA_ATTR));
  if (!metadata) return [];
  const selector = `[${METADATA_ATTR}="${metadata.replace(/"/g, '\\"')}"]`;
  const scope = element.parentElement && element.parentElement.childElementCount > 50 ? element.parentElement : document;
  const siblings: HTMLElement[] = [];
  for (const candidate of Array.from(scope.querySelectorAll(selector))) {
    if (!(candidate instanceof HTMLElement) || candidate === element) continue;
    if (visibleOnly && !isVisible(candidate)) continue;
    siblings.push(candidate);
    if (siblings.length >= MAX_SIBLING_HIGHLIGHTERS) break;
  }
  return siblings;
}

function buildSourceBindings(source: SourceRef, element: HTMLElement): SourceBindings {
  const baseSource = { ...source, componentName: componentName(element) };
  const bindings: SourceBindings = {
    remove: { kind: "jsx-element", source: baseSource },
    style: { kind: "jsx-element", source: baseSource },
    className: { kind: "jsx-element", source: baseSource },
    src: { kind: "jsx-element", source: baseSource },
    fontSize: { kind: "inline-style-property", field: "fontSize", source: baseSource },
    fontWeight: { kind: "inline-style-property", field: "fontWeight", source: baseSource },
    textAlign: { kind: "inline-style-property", field: "textAlign", source: baseSource },
    color: { kind: "inline-style-property", field: "color", source: baseSource },
    backgroundColor: { kind: "inline-style-property", field: "backgroundColor", source: baseSource },
    borderRadius: { kind: "inline-style-property", field: "borderRadius", source: baseSource },
    margin: { kind: "inline-style-property", field: "margin", source: baseSource },
    padding: { kind: "inline-style-property", field: "padding", source: baseSource },
  };
  if (isPureTextElement(element)) {
    bindings.textContent = { kind: "jsx-text", source: baseSource };
  }
  return bindings;
}

function buildSelectionPayload(element: HTMLElement, siblingCount: number): SelectionPayload {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  const parent = element.parentElement;
  const nextSibling = element.nextElementSibling;
  const grandParent = parent?.parentElement ?? null;
  const metadata = trimText(element.getAttribute(METADATA_ATTR));
  const source = parseSource(metadata);
  if (source) {
    source.componentName = componentName(element);
  }
  const siblings = siblingsFor(element);

  return {
    pageUrl: window.location.href,
    selector: selectorForElement(element),
    tagName: element.tagName.toLowerCase(),
    className: typeof element.className === "string" ? element.className : String(element.className ?? ""),
    textContent: element.textContent ?? "",
    textSnippet: trimText(element.textContent).slice(0, 240),
    id: element.id ?? "",
    elementPath: metadata,
    elementName: componentName(element),
    originalTextContent: element.hasAttribute("data-original-text")
      ? decodeURIComponent(element.getAttribute("data-original-text") || "")
      : undefined,
    srcAttribute: element.getAttribute("src") || "",
    hasChildElements: element.childElementCount > 0,
    attributes: collectAttributes(element),
    rect: {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    },
    computedStyles: {
      backgroundColor: style.backgroundColor,
      borderTopColor: style.borderTopColor,
      borderRightColor: style.borderRightColor,
      borderBottomColor: style.borderBottomColor,
      borderLeftColor: style.borderLeftColor,
      borderTopLeftRadius: style.borderTopLeftRadius,
      borderTopRightRadius: style.borderTopRightRadius,
      borderBottomRightRadius: style.borderBottomRightRadius,
      borderBottomLeftRadius: style.borderBottomLeftRadius,
      borderTopWidth: style.borderTopWidth,
      borderRightWidth: style.borderRightWidth,
      borderBottomWidth: style.borderBottomWidth,
      borderLeftWidth: style.borderLeftWidth,
      color: style.color,
      display: style.display,
      position: style.position,
      width: style.width,
      height: style.height,
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      margin: style.margin,
      padding: style.padding,
      opacity: style.opacity,
      textAlign: style.textAlign,
    },
    textAlign: style.textAlign,
    source: source ?? undefined,
    editSource: source ? { ...source, kind: "host-jsx" } : undefined,
    nodeId: metadata || undefined,
    sourceFile: source?.file,
    sourceBindings: source ? buildSourceBindings(source, element) : undefined,
    peerRects: siblings.map((sibling) => {
      const siblingRect = sibling.getBoundingClientRect();
      return {
        nodeId: trimText(sibling.getAttribute(METADATA_ATTR)) || selectorForElement(sibling),
        rect: {
          x: siblingRect.left,
          y: siblingRect.top,
          width: siblingRect.width,
          height: siblingRect.height,
        },
      };
    }),
    siblingCount,
    editableFields: {
      textContent: isPureTextElement(element),
      fontSize: Boolean(source),
      fontWeight: Boolean(source),
      textAlign: Boolean(source),
      color: Boolean(source),
      backgroundColor: Boolean(source),
      borderRadius: Boolean(source),
      margin: Boolean(source),
      padding: Boolean(source),
      sortable: false,
    },
    computedStyleSnapshot: {
      textContent: trimText(element.textContent),
      fontSize: trimText(style.fontSize),
      fontWeight: trimText(style.fontWeight),
      textAlign: trimText(style.textAlign),
      color: trimText(style.color),
      backgroundColor: trimText(style.backgroundColor),
      borderRadius: trimText(style.borderRadius),
      margin: trimText(style.margin),
      padding: trimText(style.padding),
    },
    relatedElements: {
      parent: baseElement(parent),
      nextSibling: baseElement(nextSibling),
      grandParent: baseElement(grandParent),
      children: Array.from(element.children)
        .slice(0, 20)
        .map((child) => baseElement(child))
        .filter((child): child is BaseElement => child !== null),
    },
  };
}

class ImagicmaBeacon {
  selectedElement: HTMLElement | null = null;
  selectedSiblingElements: HTMLElement[] = [];
  visibleSelectedSiblingElements: HTMLElement[] = [];
  isActive = false;
  enableEditing = false;
  lastHighlightedElement: HTMLElement | null = null;
  parentOrigin = isAllowedOrigin(getReferrerOrigin()) ? getReferrerOrigin() : "";
  shadowHost: HTMLDivElement | null = null;
  shadowRoot: ShadowRoot | null = null;
  hoverHighlighter: HTMLDivElement | null = null;
  hoverLabel: HTMLDivElement | null = null;
  selectedHighlighter: HTMLDivElement | null = null;
  selectedLabel: HTMLDivElement | null = null;
  hoverSiblingHighlighters: HTMLDivElement[] = [];
  selectedSiblingHighlighters: HTMLDivElement[] = [];
  mutationObserver: MutationObserver | null = null;
  darkModeObserver: MutationObserver | null = null;
  recalculate = this.throttleRAF(() => this.recalculateSelectedElement());

  constructor() {
    window.addEventListener("message", this.handleMessage);
    this.darkModeObserver = this.observeLightDarkModeSwitch();
    this.postMessageToParent({
      type: "SELECTOR_SCRIPT_LOADED",
      timestamp: Date.now(),
      version: VERSION,
    });
  }

  destroy(): void {
    this.toggleEventListeners(false);
    this.darkModeObserver?.disconnect();
    this.darkModeObserver = null;
    window.removeEventListener("message", this.handleMessage);
    if (window.__IMAGICMA_PREVIEW_PICKER__ === this) {
      delete window.__IMAGICMA_PREVIEW_PICKER__;
    }
  }

  throttleRAF(callback: () => void): () => void {
    let frame: number | null = null;
    return () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        callback();
      });
    };
  }

  postMessageToParent(message: Record<string, unknown>): void {
    if (window.parent === window) return;
    window.parent.postMessage(message, this.parentOrigin || "*");
  }

  isOverlayNode(node: Node | null): boolean {
    if (!node || !this.shadowRoot || !this.shadowHost) return false;
    return node === this.shadowHost || node.getRootNode() === this.shadowRoot;
  }

  getInteractiveTarget(event: MouseEvent): HTMLElement | null {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    for (const item of path) {
      if (item instanceof HTMLElement && !this.isOverlayNode(item)) {
        return item;
      }
    }
    const element = document.elementFromPoint(event.clientX, event.clientY);
    return element instanceof HTMLElement && !this.isOverlayNode(element) ? element : null;
  }

  initializeHighlighter(): void {
    if (this.shadowHost?.isConnected) return;

    this.shadowHost = document.createElement("div");
    this.shadowHost.style.all = "initial";
    this.shadowHost.style.position = "fixed";
    this.shadowHost.style.inset = "0";
    this.shadowHost.style.pointerEvents = "none";
    this.shadowHost.style.zIndex = "2147483647";
    this.shadowHost.setAttribute("data-imagicma-beacon-host", "true");
    this.shadowRoot = this.shadowHost.attachShadow({ mode: "open" });
    document.body.appendChild(this.shadowHost);

    const overlayStyle = document.createElement("style");
    overlayStyle.textContent = OVERLAY_CSS;
    this.shadowRoot.appendChild(overlayStyle);

    if (!document.querySelector('[data-imagicma-beacon-editing-style="true"]')) {
      const editingStyle = document.createElement("style");
      editingStyle.setAttribute("data-imagicma-beacon-editing-style", "true");
      editingStyle.textContent = EDITING_CSS;
      document.head.appendChild(editingStyle);
    }

    this.hoverHighlighter = this.createBox("beacon-highlighter beacon-hover-highlighter");
    this.hoverLabel = this.createLabel("beacon-label beacon-hover-label");
    this.selectedHighlighter = this.createBox("beacon-highlighter beacon-selected-highlighter");
    this.selectedLabel = this.createLabel("beacon-label beacon-selected-label");

    this.shadowRoot.appendChild(this.selectedHighlighter);
    this.shadowRoot.appendChild(this.selectedLabel);
    this.shadowRoot.appendChild(this.hoverHighlighter);
    this.shadowRoot.appendChild(this.hoverLabel);
  }

  createBox(className: string): HTMLDivElement {
    const box = document.createElement("div");
    box.className = className;
    return box;
  }

  createLabel(className: string): HTMLDivElement {
    const label = document.createElement("div");
    label.className = className;
    return label;
  }

  handleMouseMove = (event: MouseEvent): void => {
    if (!this.isActive || !this.hoverHighlighter) return;
    const target = this.getInteractiveTarget(event);
    if (
      !target ||
      target === this.shadowHost ||
      target === this.selectedElement ||
      this.isOverlayNode(target)
    ) {
      this.hideHighlight(this.hoverHighlighter, this.hoverLabel);
      this.lastHighlightedElement = null;
      this.clearHoverSiblingHighlighters();
      return;
    }

    if (this.lastHighlightedElement && this.lastHighlightedElement !== target && this.lastHighlightedElement !== this.selectedElement) {
      this.lastHighlightedElement.removeAttribute("contenteditable");
    }
    this.lastHighlightedElement = target;
    this.updateHighlighterPosition(target, this.hoverHighlighter, this.hoverLabel, "hover");
  };

  handleMouseLeave = (): void => {
    if (!this.isActive) return;
    this.hideHighlight(this.hoverHighlighter, this.hoverLabel);
    this.clearHoverSiblingHighlighters();
    if (this.lastHighlightedElement && this.lastHighlightedElement !== this.selectedElement) {
      this.lastHighlightedElement.removeAttribute("contenteditable");
    }
    this.lastHighlightedElement = null;
  };

  handleClick = async (event: MouseEvent): Promise<void> => {
    if (!this.isActive) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    let target = this.getInteractiveTarget(event);
    if ((!target || target === this.shadowHost || this.isOverlayNode(target)) && this.lastHighlightedElement) {
      target = this.lastHighlightedElement;
    }
    if (!target || target === this.selectedElement) return;

    this.unselectCurrentElement();
    this.selectedElement = target;
    this.ensureOriginalSnapshot(target);

    const siblingElements = siblingsFor(target);
    const hasSiblings = siblingElements.length > 0;
    if (!hasSiblings && this.enableEditing && isPureTextElement(target)) {
      target.setAttribute("contenteditable", "plaintext-only");
      target.focus();
    }

    this.updateHighlighterPosition(target, this.selectedHighlighter, this.selectedLabel, "selected");
    this.hideHighlight(this.hoverHighlighter, this.hoverLabel);
    this.clearHoverSiblingHighlighters();
    this.observeSelectedElement();
    this.postMessageToParent({
      type: "ELEMENT_SELECTED",
      payload: buildSelectionPayload(target, hasSiblings ? siblingElements.length : 0),
      timestamp: Date.now(),
    });
  };

  handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.isActive) return;
    if (event.key === "Escape" || event.key === "Esc") {
      this.handleVisualEditorToggle({
        type: "TOGGLE_REPLIT_VISUAL_EDITOR",
        enabled: false,
        timestamp: Date.now(),
      });
    }
  };

  calculateLabelPosition(rect: DOMRect): { top: string; left: string; transform: string } {
    const top = Math.max(0, rect.top);
    if (top < 28) {
      return {
        top: `${top + 2}px`,
        left: `${Math.max(0, rect.left)}px`,
        transform: "none",
      };
    }
    return {
      top: `${top - 4}px`,
      left: `${Math.max(0, rect.left)}px`,
      transform: "translateY(-100%)",
    };
  }

  updateHighlighterPosition(
    element: HTMLElement,
    box: HTMLDivElement | null,
    label: HTMLDivElement | null,
    variant: "hover" | "selected",
  ): void {
    if (!box || !label) return;
    const rect = visibleRect(element);
    if (!rect) {
      this.hideHighlight(box, label);
      return;
    }

    Object.assign(box.style, {
      opacity: "1",
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });

    label.textContent = componentName(element);
    Object.assign(label.style, {
      ...this.calculateLabelPosition(element.getBoundingClientRect()),
      opacity: "1",
    });

    if (variant === "selected") {
      this.highlightSelectedSiblings(element);
    } else {
      this.highlightHoverSiblings(element);
    }
  }

  hideHighlight(box: HTMLDivElement | null, label: HTMLDivElement | null): void {
    if (box) box.style.opacity = "0";
    if (label) label.style.opacity = "0";
    if (box === this.hoverHighlighter) this.clearHoverSiblingHighlighters();
    if (box === this.selectedHighlighter) this.clearSelectedSiblingHighlighters();
  }

  highlightElements(elements: HTMLElement[]): HTMLDivElement[] {
    if (!this.shadowRoot || elements.length === 0) return [];
    const highlighters: HTMLDivElement[] = [];
    for (const element of elements) {
      const rect = visibleRect(element);
      if (!rect) continue;
      const box = this.createBox("beacon-highlighter beacon-sibling-highlighter");
      Object.assign(box.style, {
        opacity: "1",
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
      this.shadowRoot.appendChild(box);
      highlighters.push(box);
    }
    return highlighters;
  }

  clearHighlighters(highlighters: HTMLDivElement[]): HTMLDivElement[] {
    highlighters.forEach((item) => item.remove());
    return [];
  }

  clearHoverSiblingHighlighters(): void {
    this.hoverSiblingHighlighters = this.clearHighlighters(this.hoverSiblingHighlighters);
  }

  clearSelectedSiblingHighlighters(): void {
    this.selectedSiblingElements.forEach((element) => element.removeAttribute("contenteditable"));
    this.selectedSiblingElements = [];
    this.visibleSelectedSiblingElements = [];
    this.selectedSiblingHighlighters = this.clearHighlighters(this.selectedSiblingHighlighters);
  }

  highlightHoverSiblings(element: HTMLElement): void {
    this.clearHoverSiblingHighlighters();
    this.hoverSiblingHighlighters = this.highlightElements(siblingsFor(element, true));
  }

  highlightSelectedSiblings(element: HTMLElement): void {
    this.clearSelectedSiblingHighlighters();
    const siblings = siblingsFor(element);
    const visibleSiblings = siblings.filter(isVisible);
    this.selectedSiblingElements = siblings;
    this.visibleSelectedSiblingElements = visibleSiblings;
    this.selectedSiblingHighlighters = this.highlightElements(visibleSiblings);
  }

  ensureOriginalSnapshot(element: HTMLElement): void {
    if (!element.hasAttribute("data-original-text")) {
      element.setAttribute("data-original-text", encodeURIComponent(element.textContent ?? ""));
    }
    if (!element.hasAttribute("data-original-style") && element.hasAttribute("style")) {
      element.setAttribute("data-original-style", encodeURIComponent(element.getAttribute("style") || ""));
    }
    if (!element.hasAttribute("data-original-src") && element.hasAttribute("src")) {
      element.setAttribute("data-original-src", encodeURIComponent(element.getAttribute("src") || ""));
    }
    if (!element.hasAttribute("data-original-class-name")) {
      element.setAttribute("data-original-class-name", encodeURIComponent(typeof element.className === "string" ? element.className : String(element.className ?? "")));
    }
  }

  rememberOriginalForUpdate(element: HTMLElement, attributes: Record<string, unknown>): void {
    if (attributes.textContent !== undefined && !element.hasAttribute("data-original-text")) {
      element.setAttribute("data-original-text", encodeURIComponent(element.textContent ?? ""));
    }
    if (attributes.style !== undefined && !element.hasAttribute("data-original-style")) {
      element.setAttribute("data-original-style", encodeURIComponent(element.getAttribute("style") || ""));
    }
    if (attributes.src !== undefined && !element.hasAttribute("data-original-src")) {
      element.setAttribute("data-original-src", encodeURIComponent(element.getAttribute("src") || ""));
    }
    if (attributes.className !== undefined && !element.hasAttribute("data-original-class-name")) {
      element.setAttribute("data-original-class-name", encodeURIComponent(typeof element.className === "string" ? element.className : String(element.className ?? "")));
    }
  }

  applyUpdatedAttributes(element: HTMLElement, attributes: Record<string, unknown>): void {
    this.rememberOriginalForUpdate(element, attributes);
    if (attributes.style !== undefined) {
      element.setAttribute("style", String(attributes.style));
      element.setAttribute(DIRTY_ATTR, "true");
    }
    if (attributes.textContent !== undefined) {
      element.textContent = String(attributes.textContent);
      element.setAttribute(DIRTY_ATTR, "true");
    }
    if (attributes.className !== undefined) {
      element.className = String(attributes.className);
      element.setAttribute(DIRTY_ATTR, "true");
    }
    if (attributes.src !== undefined) {
      element.setAttribute("src", String(attributes.src));
      element.setAttribute(DIRTY_ATTR, "true");
    }
  }

  clearOriginalSnapshot(element: HTMLElement): void {
    element.removeAttribute("data-original-text");
    element.removeAttribute("data-original-style");
    element.removeAttribute("data-original-src");
    element.removeAttribute("data-original-class-name");
  }

  restoreOriginalElement(element: HTMLElement): void {
    if (element.hasAttribute("data-original-text")) {
      element.textContent = decodeURIComponent(element.getAttribute("data-original-text") || "");
    }
    if (element.hasAttribute("data-original-style")) {
      element.setAttribute("style", decodeURIComponent(element.getAttribute("data-original-style") || ""));
    }
    if (element.hasAttribute("data-original-src")) {
      element.setAttribute("src", decodeURIComponent(element.getAttribute("data-original-src") || ""));
    }
    if (element.hasAttribute("data-original-class-name")) {
      element.className = decodeURIComponent(element.getAttribute("data-original-class-name") || "");
    }
    this.clearOriginalSnapshot(element);
    element.removeAttribute(DIRTY_ATTR);
  }

  restoreElements(): void {
    document.querySelectorAll(`[${DIRTY_ATTR}="true"]`).forEach((element) => {
      if (element instanceof HTMLElement) {
        this.restoreOriginalElement(element);
      }
    });
  }

  unselectCurrentElement(): void {
    this.restoreElements();
    if (this.selectedElement) {
      this.selectedElement.removeAttribute("contenteditable");
      this.clearOriginalSnapshot(this.selectedElement);
      this.selectedElement = null;
    }
    this.clearSelectedSiblingHighlighters();
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
  }

  observeSelectedElement(): void {
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    if (!this.selectedElement || !isPureTextElement(this.selectedElement)) return;

    this.mutationObserver = new MutationObserver((records) => {
      if (!records.some((record) => record.type === "characterData" || record.type === "childList")) return;
      if (!this.selectedElement) return;
      this.selectedElement.setAttribute(DIRTY_ATTR, "true");
      this.postMessageToParent({
        type: "ELEMENT_TEXT_CHANGED",
        payload: buildSelectionPayload(this.selectedElement, this.selectedSiblingElements.length),
        timestamp: Date.now(),
      });
      this.updateHighlighterPosition(this.selectedElement, this.selectedHighlighter, this.selectedLabel, "selected");
    });

    this.mutationObserver.observe(this.selectedElement, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  }

  observeLightDarkModeSwitch(): MutationObserver {
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type !== "attributes" || record.attributeName !== "class") return;
        this.postMessageToParent({
          type: document.documentElement.classList.contains("dark") ? "DARK_MODE_USED" : "LIGHT_MODE_USED",
          timestamp: Date.now(),
        });
      });
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return observer;
  }

  recalculateSelectedElement(): void {
    if (!this.isActive) return;
    if (this.selectedElement) {
      this.updateHighlighterPosition(this.selectedElement, this.selectedHighlighter, this.selectedLabel, "selected");
    }
    if (this.lastHighlightedElement && this.lastHighlightedElement !== this.selectedElement) {
      this.updateHighlighterPosition(this.lastHighlightedElement, this.hoverHighlighter, this.hoverLabel, "hover");
    }
    if (this.selectedSiblingElements.length > 0) {
      this.updateSiblingHighlighterPositions();
    }
  }

  updateSiblingHighlighterPositions(): void {
    for (let index = 0; index < this.selectedSiblingHighlighters.length; index += 1) {
      const highlighter = this.selectedSiblingHighlighters[index];
      const element = this.visibleSelectedSiblingElements[index];
      if (!highlighter || !element) continue;
      const rect = visibleRect(element);
      if (!rect) continue;
      Object.assign(highlighter.style, {
        opacity: "1",
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
    }
  }

  enableDisabledElements(): void {
    document
      .querySelectorAll("button[disabled], input[disabled], textarea[disabled], select[disabled]")
      .forEach((element) => {
        element.removeAttribute("disabled");
        element.setAttribute(DISABLED_ATTR, "");
      });
  }

  restoreDisabledElements(): void {
    document.querySelectorAll(`[${DISABLED_ATTR}]`).forEach((element) => {
      element.removeAttribute(DISABLED_ATTR);
      element.setAttribute("disabled", "");
    });
  }

  toggleEventListeners(enabled: boolean): void {
    if (enabled) {
      this.initializeHighlighter();
      this.enableDisabledElements();
      document.addEventListener("mousemove", this.handleMouseMove);
      document.addEventListener("mouseleave", this.handleMouseLeave);
      document.addEventListener("click", this.handleClick, true);
      document.addEventListener("keydown", this.handleKeyDown, true);
      window.addEventListener("resize", this.recalculate);
      window.addEventListener("scroll", this.recalculate, true);
      this.recalculate();
      return;
    }

    this.restoreDisabledElements();
    this.restoreElements();
    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("mouseleave", this.handleMouseLeave);
    document.removeEventListener("click", this.handleClick, true);
    document.removeEventListener("keydown", this.handleKeyDown, true);
    window.removeEventListener("resize", this.recalculate);
    window.removeEventListener("scroll", this.recalculate, true);
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    this.selectedElement?.removeAttribute("contenteditable");
    document.querySelectorAll('[contenteditable="plaintext-only"]').forEach((element) => {
      element.removeAttribute("contenteditable");
    });
    this.clearSelectedSiblingHighlighters();
    this.clearHoverSiblingHighlighters();
    this.shadowHost?.remove();
    document.querySelector('[data-imagicma-beacon-editing-style="true"]')?.remove();
    this.shadowHost = null;
    this.shadowRoot = null;
    this.hoverHighlighter = null;
    this.hoverLabel = null;
    this.selectedHighlighter = null;
    this.selectedLabel = null;
    this.selectedElement = null;
    this.lastHighlightedElement = null;
  }

  handleVisualEditorToggle(message: { type: string; enabled?: boolean; enableEditing?: boolean; timestamp?: number }): void {
    if (typeof message.enableEditing === "boolean") {
      this.enableEditing = message.enableEditing;
    }

    const enabled = Boolean(message.enabled);
    if (this.isActive === enabled) {
      this.postMessageToParent({
        type: enabled ? "REPLIT_VISUAL_EDITOR_ENABLED" : "REPLIT_VISUAL_EDITOR_DISABLED",
        timestamp: Date.now(),
      });
      return;
    }

    this.isActive = enabled;
    this.toggleEventListeners(enabled);
    this.postMessageToParent({
      type: enabled ? "REPLIT_VISUAL_EDITOR_ENABLED" : "REPLIT_VISUAL_EDITOR_DISABLED",
      timestamp: Date.now(),
    });
  }

  handleApplyThemePreview(message: { themeContent?: unknown }): void {
    let style = document.getElementById(THEME_PREVIEW_STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = THEME_PREVIEW_STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = String(message.themeContent ?? "");
  }

  handleClearThemePreview(): void {
    document.getElementById(THEME_PREVIEW_STYLE_ID)?.remove();
  }

  handleMessage = (event: MessageEvent): void => {
    if (event.source !== window.parent) return;
    if (!isAllowedOrigin(event.origin)) return;
    const message = event.data;
    if (!message || typeof message !== "object" || typeof (message as { type?: unknown }).type !== "string") return;
    this.parentOrigin = event.origin;

    switch ((message as { type: string }).type) {
      case "TOGGLE_REPLIT_VISUAL_EDITOR":
        this.handleVisualEditorToggle(message as { type: string; enabled?: boolean; enableEditing?: boolean; timestamp?: number });
        break;
      case "CLEAR_SELECTION":
        this.unselectCurrentElement();
        this.hideHighlight(this.selectedHighlighter, this.selectedLabel);
        this.postMessageToParent({
          type: "ELEMENT_UNSELECTED",
          timestamp: Date.now(),
        });
        break;
      case "UPDATE_SELECTED_ELEMENT": {
        if (!this.selectedElement) return;
        const attributes = (message as { attributes?: Record<string, unknown> }).attributes;
        if (!attributes || typeof attributes !== "object") return;
        [this.selectedElement, ...this.selectedSiblingElements].forEach((element) => {
          this.applyUpdatedAttributes(element, attributes);
        });
        this.updateHighlighterPosition(this.selectedElement, this.selectedHighlighter, this.selectedLabel, "selected");
        if (this.selectedSiblingElements.length > 0) {
          this.clearHighlighters(this.selectedSiblingHighlighters);
          this.selectedSiblingHighlighters = [];
          this.selectedSiblingHighlighters = this.highlightElements(this.visibleSelectedSiblingElements);
        }
        this.observeSelectedElement();
        break;
      }
      case "CLEAR_ELEMENT_DIRTY":
        this.selectedElement?.removeAttribute(DIRTY_ATTR);
        break;
      case "APPLY_THEME_PREVIEW":
        this.handleApplyThemePreview(message as { themeContent?: unknown });
        break;
      case "CLEAR_THEME_PREVIEW":
        this.handleClearThemePreview();
        break;
    }
  };
}

if (typeof window !== "undefined") {
  try {
    if (!window.__IMAGICMA_PREVIEW_PICKER__) {
      window.REPLIT_BEACON_VERSION ??= VERSION;
      window.__IMAGICMA_PREVIEW_PICKER__ = new ImagicmaBeacon();
    }
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        window.__IMAGICMA_PREVIEW_PICKER__?.destroy();
      });
    }
  } catch (error) {
    console.error("[imagicma-beacon] Failed to initialize:", error);
  }
}

export { ImagicmaBeacon, VERSION as IMAGICMA_PREVIEW_PICKER_VERSION };
