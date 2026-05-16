import React from "react";
import {
  canUsePreviewRepair,
  sendPreviewRepairRequest,
  subscribePreviewRepairAvailability,
} from "@/lib/imagicma-preview-repair";

type AppErrorBoundaryState = {
  error: Error | null;
  componentStack: string;
  repairStatus: "idle" | "sending" | "failed";
  repairMessage: string;
  canRepair: boolean;
};

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  private readonly hotUpdateHandler = () => {
    window.__IMAGICMA_RUNTIME_ERROR_ACTIVE__ = false;
    this.setState((currentState) => (
      currentState.error
        ? {
            ...currentState,
            error: null,
            componentStack: "",
            repairStatus: "idle",
            repairMessage: "",
          }
        : currentState
    ));
  };

  state: AppErrorBoundaryState = {
    error: null,
    componentStack: "",
    repairStatus: "idle",
    repairMessage: "",
    canRepair: canUsePreviewRepair(),
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      error,
      componentStack: "",
      repairStatus: "idle",
      repairMessage: "",
      canRepair: canUsePreviewRepair(),
    };
  }

  private unsubscribeRepairAvailability: (() => void) | null = null;

  componentDidMount() {
    this.unsubscribeRepairAvailability = subscribePreviewRepairAvailability((canRepair) => {
      this.setState((currentState) => (
        currentState.canRepair === canRepair
          ? currentState
          : { ...currentState, canRepair }
      ));
    });
    import.meta.hot?.on("vite:afterUpdate", this.hotUpdateHandler);
  }

  componentWillUnmount() {
    this.unsubscribeRepairAvailability?.();
    import.meta.hot?.off("vite:afterUpdate", this.hotUpdateHandler);
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(error);
    window.__IMAGICMA_RUNTIME_ERROR_ACTIVE__ = true;
    this.setState({
      componentStack: info.componentStack || "",
      repairStatus: "idle",
      repairMessage: "",
    });
  }

  private handleRepair = async () => {
    const { error, componentStack } = this.state;
    if (!error) return;

    this.setState({
      repairStatus: "sending",
      repairMessage: "",
    });

    try {
      const ack = await sendPreviewRepairRequest({
        pageUrl: window.location.href,
        errorName: (error.name || "Error").trim(),
        errorMessage: (error.message || "发生未知错误").trim(),
        errorStack: error.stack || undefined,
        componentStack: componentStack || undefined,
        timestamp: Date.now(),
      });

      if (ack.status === "ok") {
        this.setState({
          repairStatus: "idle",
          repairMessage: "",
        });
        return;
      }

      this.setState({
        repairStatus: "failed",
        repairMessage: ack.message?.trim() || "同步失败，请稍后重试或手动刷新页面。",
      });
    } catch (error) {
      this.setState({
        repairStatus: "failed",
        repairMessage:
          error instanceof Error && error.message
            ? error.message
            : "同步失败，请稍后重试或手动刷新页面。",
      });
    }
  };

  render() {
    const { error, repairStatus, repairMessage, canRepair } = this.state;
    if (!error) {
      window.__IMAGICMA_RUNTIME_ERROR_ACTIVE__ = false;
      return this.props.children;
    }

    const errorDetails = [error.name?.trim(), error.message?.trim(), error.stack?.trim()]
      .filter(Boolean)
      .join("\n\n");
    return (
      <div
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-sky-600 px-6 py-16 text-white"
        role="alert"
      >
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_40%,rgba(255,255,255,0.20),transparent_60%)]" />
        <main className="relative w-full max-w-xl rounded-3xl border border-white/15 bg-white/10 p-10 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col items-center text-center">
            <h1 className="text-3xl font-semibold tracking-tight">预览暂时不可用</h1>
            <p className="mt-4 max-w-md text-base leading-7 text-white/80">
              检测到错误。你可以把错误信息同步回主界面并自动发起修复，或直接刷新页面。
            </p>

            {errorDetails ? (
              <pre className="mt-6 w-full max-h-80 overflow-auto rounded-2xl border border-white/10 bg-black/25 p-4 text-left text-sm leading-6 text-white/85 shadow-inner">
                <code>{errorDetails}</code>
              </pre>
            ) : null}

            {repairMessage ? (
              <p className="mt-4 max-w-md text-sm leading-6 text-white/80">{repairMessage}</p>
            ) : null}

            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
              {canRepair ? (
                <button
                  type="button"
                  className="inline-flex h-11 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/70 sm:w-auto"
                  onClick={this.handleRepair}
                  disabled={repairStatus === "sending"}
                >
                  一键修复
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 text-sm font-medium text-white transition-colors hover:bg-white/15 sm:w-auto"
                onClick={() => window.location.reload()}
              >
                刷新页面
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }
}
