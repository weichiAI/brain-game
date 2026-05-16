"use client";

import { useCallback, useRef, useState } from "react";
import { toPng } from "html-to-image";

export function usePoster() {
  const posterRef = useRef<HTMLDivElement | null>(null);
  const [generating, setGenerating] = useState(false);

  const downloadPoster = useCallback(async () => {
    const node = posterRef.current;
    if (!node) return;

    setGenerating(true);
    try {
      // Wait a tick for rendering to settle
      await new Promise((r) => setTimeout(r, 100));
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
      });

      const link = document.createElement("a");
      link.download = `脑力报告_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("生成海报失败:", err);
    } finally {
      setGenerating(false);
    }
  }, []);

  return { posterRef, generating, downloadPoster };
}
