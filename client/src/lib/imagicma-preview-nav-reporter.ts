import {
    PREVIEW_NAV_CHANNEL,
    PREVIEW_NAV_VERSION,
    type FrameToParentNavMessage,
    type PreviewNavChangeKind,
  } from './protocol';
  
  interface PreviewNavReporterOptions {
    targetOrigin?: string;
  }
  
  class PreviewNavReporter {
    private seq = 0;
    private targetOrigin = '*';
    private reporterInstanceId = '';
    private running = false;
    private lastSentUrl: string | null = null;
    private originalPushState: History['pushState'] | null = null;
    private originalReplaceState: History['replaceState'] | null = null;
    private boundEmitTraverse = () => {
      this.emitIfUrlChanged('traverse');
    };
    private boundEmitHash = () => {
      this.emitIfUrlChanged('hash');
    };
  
    start(options?: PreviewNavReporterOptions): void {
      if (typeof window === 'undefined' || window.parent === window) return;
  
      if (typeof options?.targetOrigin === 'string' && options.targetOrigin.trim()) {
        this.targetOrigin = options.targetOrigin.trim();
      }
  
      if (this.running) {
        this.stop();
      }
  
      this.seq = 0;
      this.reporterInstanceId = this.createReporterInstanceId();
      this.running = true;
      this.lastSentUrl = null;
      this.patchHistoryMethods();
      window.addEventListener('popstate', this.boundEmitTraverse);
      window.addEventListener('hashchange', this.boundEmitHash);
      this.emitIfUrlChanged('initial');
    }
  
    stop(): void {
      if (typeof window === 'undefined') return;
      this.running = false;
      window.removeEventListener('popstate', this.boundEmitTraverse);
      window.removeEventListener('hashchange', this.boundEmitHash);
      this.restoreHistoryMethods();
    }
  
    destroy(): void {
      this.stop();
    }
  
    private patchHistoryMethods(): void {
      if (this.originalPushState || this.originalReplaceState) return;
      this.originalPushState = window.history.pushState.bind(window.history);
      this.originalReplaceState = window.history.replaceState.bind(window.history);
  
      window.history.pushState = ((...args: Parameters<History['pushState']>) => {
        this.originalPushState?.(...args);
        this.emitIfUrlChanged('push');
      }) as History['pushState'];
  
      window.history.replaceState = ((...args: Parameters<History['replaceState']>) => {
        this.originalReplaceState?.(...args);
        this.emitIfUrlChanged('replace');
      }) as History['replaceState'];
    }
  
    private restoreHistoryMethods(): void {
      if (this.originalPushState) {
        window.history.pushState = this.originalPushState;
        this.originalPushState = null;
      }
      if (this.originalReplaceState) {
        window.history.replaceState = this.originalReplaceState;
        this.originalReplaceState = null;
      }
    }
  
    private emitIfUrlChanged(changeKind: PreviewNavChangeKind): void {
      if (typeof window === 'undefined' || window.parent === window) return;
      const href = window.location.href;
      if (!href) return;
      if (href === this.lastSentUrl) return;
  
      this.lastSentUrl = href;
      this.seq += 1;
      const message: FrameToParentNavMessage = {
        channel: PREVIEW_NAV_CHANNEL,
        version: PREVIEW_NAV_VERSION,
        type: 'IMAGICMA_PREVIEW_NAV_HEARTBEAT',
        payload: {
          reporterInstanceId: this.reporterInstanceId,
          url: href,
          historyLength: Math.max(1, window.history.length || 1),
          seq: this.seq,
          ts: Date.now(),
          changeKind,
        },
      };
      window.parent.postMessage(message, this.targetOrigin);
    }
  
    private createReporterInstanceId(): string {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      return `nav_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    }
  }
  
  let singleton: PreviewNavReporter | null = null;
  
  export function getPreviewNavReporter(): PreviewNavReporter {
    if (!singleton) {
      singleton = new PreviewNavReporter();
    }
    return singleton;
  }
  
  
  setTimeout(() => {
    getPreviewNavReporter().start()
  });