import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { DEFAULT_THEME_STYLE } from "@/lib/theme/default-theme";
import "@/lib/imagicma-preview-nav-reporter";
import { App } from "./App";
import { AppErrorBoundary } from "./components/ErrorBoundary";
import "./globals.css";
import "./theme.css";
import { Providers } from "./providers";

declare global {
  interface Window {
    __IMAGICMA_RUNTIME_ERROR_ACTIVE__?: boolean;
  }
}

if (!document.documentElement.dataset.themeStyle) {
  document.documentElement.dataset.themeStyle = DEFAULT_THEME_STYLE;
}

if (import.meta.hot) {
  import.meta.hot.on("vite:afterUpdate", () => {
    if (!window.__IMAGICMA_RUNTIME_ERROR_ACTIVE__) return;
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <Providers>
          <App />
        </Providers>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
);
