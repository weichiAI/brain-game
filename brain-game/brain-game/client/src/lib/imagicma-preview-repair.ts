import {
  getBoundPreviewParentOrigin,
  isAllowedPreviewParentOrigin,
  postToBoundPreviewParent,
  subscribePreviewParentOrigin,
} from "@/lib/imagicma-preview-bridge";

export const PREVIEW_REPAIR_CHANNEL = "imagicma.preview-repair";
export const PREVIEW_REPAIR_VERSION = 1;

export type PreviewRepairAckStatus = "ok" | "error";

export interface PreviewRepairPayload {
  pageUrl: string;
  errorName: string;
  errorMessage: string;
  errorStack?: string;
  componentStack?: string;
  timestamp: number;
}

export interface PreviewRepairAck {
  status: PreviewRepairAckStatus;
  message?: string;
}

const DEFAULT_TIMEOUT_MS = 4000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `repair_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isInIframe(): boolean {
  return typeof window !== "undefined" && window.parent !== window;
}

export function isAllowedRepairParentOrigin(origin: string): boolean {
  return isAllowedPreviewParentOrigin(origin);
}

function isAckMessage(value: unknown): value is {
  channel: typeof PREVIEW_REPAIR_CHANNEL;
  version: typeof PREVIEW_REPAIR_VERSION;
  type: "IMAGICMA_PREVIEW_REPAIR_ACK";
  requestId: string;
  payload: PreviewRepairAck;
} {
  if (!isRecord(value)) return false;
  if (value.channel !== PREVIEW_REPAIR_CHANNEL) return false;
  if (value.version !== PREVIEW_REPAIR_VERSION) return false;
  if (value.type !== "IMAGICMA_PREVIEW_REPAIR_ACK") return false;
  if (typeof value.requestId !== "string" || value.requestId.length === 0) return false;
  if (!isRecord(value.payload)) return false;
  if (value.payload.status !== "ok" && value.payload.status !== "error") return false;
  if (value.payload.message !== undefined && typeof value.payload.message !== "string") return false;
  return true;
}

export function canUsePreviewRepair(): boolean {
  return isInIframe() && !!getBoundPreviewParentOrigin();
}

export function subscribePreviewRepairAvailability(
  listener: (available: boolean) => void,
): () => void {
  const notify = () => {
    listener(canUsePreviewRepair());
  };

  notify();
  return subscribePreviewParentOrigin(() => {
    notify();
  });
}

export function sendPreviewRepairRequest(
  payload: PreviewRepairPayload,
  options?: { timeoutMs?: number },
): Promise<PreviewRepairAck> {
  if (!isInIframe()) {
    return Promise.reject(new Error("当前页面不在 iframe 中"));
  }

  const parentOrigin = getBoundPreviewParentOrigin();
  if (!parentOrigin) {
    return Promise.reject(new Error("当前预览尚未与主界面完成握手，请稍后重试"));
  }

  const requestId = createRequestId();
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener("message", handleMessage);
      window.clearTimeout(timer);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      if (event.origin !== parentOrigin) return;
      if (!isAckMessage(event.data)) return;
      if (event.data.requestId !== requestId) return;
      cleanup();
      resolve(event.data.payload);
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("主界面响应超时，请稍后重试或手动刷新页面"));
    }, timeoutMs);

    window.addEventListener("message", handleMessage);

    try {
      const posted = postToBoundPreviewParent({
        channel: PREVIEW_REPAIR_CHANNEL,
        version: PREVIEW_REPAIR_VERSION,
        type: "IMAGICMA_PREVIEW_REPAIR_REQUEST",
        requestId,
        payload,
      });
      if (!posted) {
        throw new Error("当前预览尚未与主界面完成握手，请稍后重试");
      }
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error("发送修复请求失败"));
    }
  });
}
