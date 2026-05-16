"use client";

import { type RefObject, useMemo } from "react";
import type { TestResult } from "@shared/types/brain-test";
import { BRAIN_TESTS } from "@shared/types/brain-test";

interface PosterData {
  comparisonMap: {
    testId: string;
    testName: string;
    latest: TestResult | undefined;
    previous: TestResult | undefined;
    delta: "up" | "down" | "same" | "first";
  }[];
  totalTestCount: number;
  completedCount: number;
}

const TEST_COLORS: Record<string, string> = {
  "digit-span": "#7c3aed",
  "reaction-time": "#f59e0b",
  stroop: "#10b981",
  "sequence-memory": "#e11d48",
};

function getAssessment(norm: number): { label: string; color: string; bg: string } {
  if (norm >= 80) return { label: "优秀", color: "#059669", bg: "#ecfdf5" };
  if (norm >= 60) return { label: "良好", color: "#2563eb", bg: "#eff6ff" };
  if (norm >= 40) return { label: "一般", color: "#d97706", bg: "#fffbeb" };
  return { label: "需锻炼", color: "#dc2626", bg: "#fef2f2" };
}

function getTips(data: PosterData): string[] {
  const tips: string[] = [];
  for (const item of data.comparisonMap) {
    if (!item.latest) continue;
    const norm = normalizeScore(item.testId, item.latest);
    if (norm < 50) {
      switch (item.testId) {
        case "digit-span": tips.push("数字记忆较弱：试试背电话号码来锻炼短期记忆。"); break;
        case "reaction-time": tips.push("反应速度偏慢：节奏类游戏或球类运动有助提升。"); break;
        case "stroop": tips.push("认知控制可加强：练习快速切换注意力。"); break;
        case "sequence-memory": tips.push("序列记忆待提高：Simon 游戏是很好的训练方式。"); break;
      }
    }
  }
  if (tips.length === 0) tips.push("各项表现良好，继续保持规律训练！");
  return tips;
}

/** Normalize test scores to 0-100 scale for radar chart */
function normalizeScore(testId: string, result: TestResult | undefined): number {
  if (!result) return 0;
  const s = result.score;
  switch (testId) {
    case "digit-span":
      return Math.min((s / 10) * 100, 100);
    case "reaction-time":
      // Lower is better: 100ms = 100%, 1000ms+ = 0%
      return Math.max(0, Math.min(100, ((1000 - s) / 900) * 100));
    case "stroop":
      return Math.min(s, 100);
    case "sequence-memory":
      return Math.min((s / 12) * 100, 100);
    default:
      return 0;
  }
}

function RadarChart({ data }: { data: PosterData }) {
  const cx = 180;
  const cy = 180;
  const r = 150;
  const labels = BRAIN_TESTS.map((t) => t.name);

  // angles: top, right, bottom, left
  const angles = useMemo(
    () => [
      (-90 * Math.PI) / 180,
      (0 * Math.PI) / 180,
      (90 * Math.PI) / 180,
      (180 * Math.PI) / 180,
    ],
    [],
  );

  const values = useMemo(
    () =>
      BRAIN_TESTS.map((t) => {
        const item = data.comparisonMap.find((c) => c.testId === t.id);
        return normalizeScore(t.id, item?.latest) / 100;
      }),
    [data],
  );

  const gridLevels = [0.25, 0.5, 0.75, 1];

  const getPoint = (angle: number, value: number) => ({
    x: cx + r * value * Math.cos(angle),
    y: cy + r * value * Math.sin(angle),
  });

  const dataPolygon = values
    .map((v, i) => {
      const p = getPoint(angles[i], v);
      return `${p.x},${p.y}`;
    })
    .join(" ");

  return (
    <svg width="360" height="360" viewBox="-40 -40 440 440" style={{ display: "block" }}>
      {/* Grid rings */}
      {gridLevels.map((level) => {
        const pts = angles
          .map((a) => {
            const p = getPoint(a, level);
            return `${p.x},${p.y}`;
          })
          .join(" ");
        return (
          <polygon
            key={level}
            points={pts}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        );
      })}

      {/* Axis lines */}
      {angles.map((a, i) => {
        const end = getPoint(a, 1);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={end.x}
            y2={end.y}
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        );
      })}

      {/* Data polygon */}
      <polygon points={dataPolygon} fill="rgba(167,139,250,0.2)" stroke="#a78bfa" strokeWidth="2.5" />

      {/* Data points */}
      {values.map((v, i) => {
        if (v <= 0) return null;
        const p = getPoint(angles[i], v);
        return (
          <circle key={i} cx={p.x} cy={p.y} r="5" fill={TEST_COLORS[BRAIN_TESTS[i].id] ?? "#a78bfa"} stroke="#fff" strokeWidth="2" />
        );
      })}

      {/* Labels */}
      {labels.map((label, i) => {
        const p = getPoint(angles[i], 1.22);
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#64748b"
            fontSize="11"
            fontFamily='"PingFang SC", "Microsoft YaHei", sans-serif'
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

export function BrainReportPoster({
  posterRef,
  data,
}: {
  posterRef: RefObject<HTMLDivElement | null>;
  data: PosterData;
}) {
  const { comparisonMap, completedCount, totalTestCount } = data;

  return (
    <div
      ref={posterRef}
      style={{
        width: "800px",
        minHeight: "1100px",
        background: "#ffffff",
        padding: "40px",
        fontFamily: '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif',
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
        overflow: "clip",
      }}
    >
      {/* Top accent */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "6px",
          background: "linear-gradient(90deg, #e11d48, #a78bfa, #f59e0b, #10b981)",
        }}
      />

      {/* Header */}
      <div style={{ textAlign: "center", marginTop: "32px", marginBottom: "24px" }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "0 auto 12px" }}>
          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
        </svg>
        <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px", margin: 0 }}>
          脑力检测报告
        </h1>
        <p style={{ fontSize: "13px", color: "#94a3b8", margin: "6px 0 0 0" }}>
          {new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Radar Chart + Summary side by side */}
      <div style={{ display: "flex", gap: "24px", width: "100%", maxWidth: "680px", marginBottom: "32px", alignItems: "center" }}>
        <div style={{ flexShrink: 0 }}>
          <RadarChart data={data} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
            综合完成度
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {comparisonMap.map((item) => {
              const color = TEST_COLORS[item.testId] ?? "#a78bfa";
              const hasData = !!item.latest;
              const norm = normalizeScore(item.testId, item.latest ?? undefined);
              return (
                <div key={item.testId} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: "12px", color: "#475569" }}>{item.testName}</div>
                  <div style={{ width: "100px", height: "6px", borderRadius: "3px", background: "#f1f5f9", overflow: "clip" }}>
                    <div style={{ width: `${Math.round(norm)}%`, height: "100%", borderRadius: "3px", background: color }} />
                  </div>
                  <div style={{ width: "52px", textAlign: "right", fontSize: "12px", fontWeight: 600, color: "#0f172a" }}>
                    {hasData ? item.latest!.scoreLabel : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: "100%", maxWidth: "680px", height: "1px", background: "#f1f5f9", marginBottom: "24px" }} />

      {/* Detailed results */}
      <div style={{ width: "100%", maxWidth: "680px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
          详细记录
        </div>
        {comparisonMap.map((item) => {
          const hasData = !!item.latest;
          const color = TEST_COLORS[item.testId] ?? "#a78bfa";
          const hasComparison = item.delta !== "first";
          const isUp = item.delta === "up";
          const isDown = item.delta === "down";
          const norm = hasData ? normalizeScore(item.testId, item.latest!) : 0;
          const assessment = getAssessment(norm);

          return (
            <div
              key={item.testId}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 16px",
                marginBottom: "8px",
                borderRadius: "10px",
                background: "#f8fafc",
                border: "1px solid #f1f5f9",
                borderLeft: `3px solid ${color}`,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a" }}>
                  {item.testName}
                </div>
                {hasData && (
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{item.latest!.scoreLabel}</span>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: assessment.color, background: assessment.bg, padding: "1px 6px", borderRadius: "4px" }}>
                      {assessment.label}
                    </span>
                    {item.previous && (
                      <span style={{ color: "#94a3b8" }}>
                        上次: {item.previous.scoreLabel}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {!hasData && (
                <span style={{ fontSize: "11px", color: "#94a3b8", padding: "3px 10px", borderRadius: "5px", background: "#f1f5f9" }}>
                  待测试
                </span>
              )}
              {hasComparison && (
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    padding: "3px 10px",
                    borderRadius: "6px",
                    color: isUp ? "#059669" : isDown ? "#dc2626" : "#64748b",
                    background: isUp ? "#ecfdf5" : isDown ? "#fef2f2" : "#f1f5f9",
                  }}
                >
                  {isUp ? "↑ 进步" : isDown ? "↓ 下降" : "→ 持平"}
                </span>
              )}
              {hasData && !hasComparison && (
                <span style={{ fontSize: "11px", color: "#94a3b8", padding: "3px 10px", borderRadius: "5px", background: "#f1f5f9" }}>
                  首次
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Tips Section */}
      <div style={{ width: "100%", maxWidth: "680px", marginTop: "16px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
          <span>💡</span> 个性化建议
        </div>
        {getTips(data).map((tip, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "6px", fontSize: "11px", color: "#475569", lineHeight: 1.5 }}>
            <span style={{ color: "#f59e0b", flexShrink: 0 }}>•</span>
            <span>{tip}</span>
          </div>
        ))}
      </div>

      {/* MIT Quote */}
      <div
        style={{
          width: "100%",
          maxWidth: "680px",
          marginTop: "24px",
          padding: "14px 18px",
          borderRadius: "10px",
          background: "#fffbeb",
          border: "1px solid #fde68a",
        }}
      >
        <div style={{ fontSize: "10px", fontWeight: 700, color: "#d97706", marginBottom: "4px", letterSpacing: "0.5px" }}>
          MIT 2025 · 神经科学研究
        </div>
        <p style={{ fontSize: "11px", color: "#92400e", lineHeight: 1.6, margin: 0 }}>
          长期使用 AI 辅助的人群，大脑神经连接数量从 79 个降至 42 个（降幅 47%），α波（创造力相关）活跃度下降。每天 30 分钟针对性的脑力训练可有效逆转这一趋势。
        </p>
      </div>

      {/* Footer */}
      <div style={{ marginTop: "auto", paddingTop: "28px", textAlign: "center" }}>
        <div style={{ width: "40px", height: "2px", borderRadius: "1px", background: "#e2e8f0", margin: "0 auto 14px" }} />
        <p style={{ fontSize: "10px", color: "#94a3b8", margin: 0 }}>
          脑力测试小程序 · 仅供娱乐参考 · 建议每周训练
        </p>
      </div>
    </div>
  );
}
