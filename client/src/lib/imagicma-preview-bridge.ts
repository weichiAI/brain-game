const PROD_PARENT_ORIGINS = new Set(["https://agentma.cn", "https://imagicma.cn"]);
const LOCAL_PARENT_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
const LOCAL_IMAGICMA_PARENT_RE = /^https?:\/\/([a-z0-9-]+\.)?local\.(agentma\.cn|imagicma\.cn)(:\d+)?$/i;
export const PREVIEW_PARENT_ORIGIN_CHANGE_EVENT = "imagicma:preview-parent-origin-change";

type PreviewBridgeState = {
  parentOrigin: string | null;
};

declare global {
  interface Window {
    __IMAGICMA_PREVIEW_BRIDGE__?: PreviewBridgeState;
  }
}

function getBridgeState(): PreviewBridgeState {
  if (typeof window === "undefined") {
    return { parentOrigin: null };
  }
  if (!window.__IMAGICMA_PREVIEW_BRIDGE__) {
    window.__IMAGICMA_PREVIEW_BRIDGE__ = {
      parentOrigin: null,
    };
  }
  return window.__IMAGICMA_PREVIEW_BRIDGE__;
}

function resolvePreviewParentOriginFromReferrer(): string | null {
  if (typeof window === "undefined" || typeof document === "undefined" || window.parent === window) {
    return null;
  }

  const referrer = document.referrer.trim();
  if (!referrer) return null;

  try {
    const origin = new URL(referrer).origin;
    return isAllowedPreviewParentOrigin(origin) ? origin : null;
  } catch {
    return null;
  }
}

function updatePreviewParentOrigin(origin: string | null): string | null {
  const state = getBridgeState();
  const nextOrigin = origin && isAllowedPreviewParentOrigin(origin) ? origin : null;
  if (state.parentOrigin === nextOrigin) {
    return state.parentOrigin;
  }

  state.parentOrigin = nextOrigin;
  window.dispatchEvent(
    new CustomEvent(PREVIEW_PARENT_ORIGIN_CHANGE_EVENT, {
      detail: { origin: nextOrigin },
    }),
  );
  return state.parentOrigin;
}

export function isAllowedPreviewParentOrigin(origin: string): boolean {
  if (!origin) return false;
  return PROD_PARENT_ORIGINS.has(origin) || LOCAL_PARENT_RE.test(origin) || LOCAL_IMAGICMA_PARENT_RE.test(origin);
}

export function bindPreviewParentOrigin(origin: string | null): string | null {
  if (!origin) {
    return updatePreviewParentOrigin(resolvePreviewParentOriginFromReferrer());
  }
  if (!isAllowedPreviewParentOrigin(origin)) {
    return getBoundPreviewParentOrigin();
  }
  return updatePreviewParentOrigin(origin);
}

export function getBoundPreviewParentOrigin(): string | null {
  const state = getBridgeState();
  if (state.parentOrigin && isAllowedPreviewParentOrigin(state.parentOrigin)) {
    return state.parentOrigin;
  }
  return updatePreviewParentOrigin(resolvePreviewParentOriginFromReferrer());
}

export function subscribePreviewParentOrigin(listener: (origin: string | null) => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => {
    listener(getBoundPreviewParentOrigin());
  };

  window.addEventListener(PREVIEW_PARENT_ORIGIN_CHANGE_EVENT, handleChange as EventListener);
  return () => {
    window.removeEventListener(PREVIEW_PARENT_ORIGIN_CHANGE_EVENT, handleChange as EventListener);
  };
}

export function postToBoundPreviewParent(message: unknown): boolean {
  if (typeof window === "undefined" || window.parent === window) return false;
  const parentOrigin = getBoundPreviewParentOrigin();
  if (!parentOrigin) return false;
  window.parent.postMessage(message, parentOrigin);
  return true;
}
