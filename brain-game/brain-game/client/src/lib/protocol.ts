export const PREVIEW_NAV_CHANNEL = 'imagicma.preview-nav';
export const PREVIEW_NAV_VERSION = 1;

export type FrameToParentNavMessageType = 'IMAGICMA_PREVIEW_NAV_HEARTBEAT';
export type PreviewNavChangeKind = 'initial' | 'push' | 'replace' | 'traverse' | 'hash' | 'unknown';

export interface PreviewNavHeartbeatPayload {
  reporterInstanceId: string;
  url: string;
  historyLength: number;
  seq: number;
  ts: number;
  changeKind?: PreviewNavChangeKind;
}

export interface FrameToParentNavMessage {
  channel: typeof PREVIEW_NAV_CHANNEL;
  version: typeof PREVIEW_NAV_VERSION;
  type: FrameToParentNavMessageType;
  payload: PreviewNavHeartbeatPayload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function isPreviewNavMessage(value: unknown): value is FrameToParentNavMessage {
  if (!isRecord(value)) return false;
  if (value.channel !== PREVIEW_NAV_CHANNEL) return false;
  if (value.version !== PREVIEW_NAV_VERSION) return false;
  if (value.type !== 'IMAGICMA_PREVIEW_NAV_HEARTBEAT') return false;
  if (!isRecord(value.payload)) return false;

  const reporterInstanceId = value.payload.reporterInstanceId;
  const url = value.payload.url;
  const historyLength = toFiniteNumber(value.payload.historyLength);
  const seq = toFiniteNumber(value.payload.seq);
  const ts = toFiniteNumber(value.payload.ts);
  const changeKind = value.payload.changeKind;

  return typeof reporterInstanceId === 'string'
    && reporterInstanceId.trim().length > 0
    && typeof url === 'string'
    && url.trim().length > 0
    && historyLength !== null
    && historyLength > 0
    && seq !== null
    && seq >= 0
    && ts !== null
    && ts > 0
    && (
      changeKind === undefined
      || changeKind === 'initial'
      || changeKind === 'push'
      || changeKind === 'replace'
      || changeKind === 'traverse'
      || changeKind === 'hash'
      || changeKind === 'unknown'
    );
}
