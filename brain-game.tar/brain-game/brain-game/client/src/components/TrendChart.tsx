"use client";

import { useMemo } from "react";
import type { TestResult } from "@shared/types/brain-test";
import { useBrainResults } from "@/hooks/use-brain-results";

const CHART_COLORS: Record<string, { line: string; fill: string; dot: string }> = {
  "digit-span": { line: "#7c3aed", fill: "rgba(124,58,237,0.08)", dot: "#7c3aed" },
  "reaction-time": { line: "#f59e0b", fill: "rgba(245,158,11,0.08)", dot: "#f59e0b" },
  stroop: { line: "#10b981", fill: "rgba(16,185,129,0.08)", dot: "#10b981" },
  "sequence-memory": { line: "#e11d48", fill: "rgba(225,29,72,0.08)", dot: "#e11d48" },
};

const INVERTED_TESTS = new Set(["reaction-time"]);

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getTrendText(testId: string, scores: number[]): { text: string; color: string; icon: string } {
  if (scores.length < 2) return { text: "首次测试，继续积累数据", color: "#64748b", icon: "—" };
  const first = scores[0];
  const last = scores[scores.length - 1];
  const inverted = INVERTED_TESTS.has(testId);
  const improved = inverted ? last < first : last > first;
  const same = last === first;

  if (same) return { text: "保持稳定，无变化", color: "#64748b", icon: "→" };
  if (improved) return { text: "持续进步中！", color: "#059669", icon: "↑" };
  return { text: "略有下降，建议加强训练", color: "#dc2626", icon: "↓" };
}

function getSuggestion(testId: string, avgScore: number): string {
  const suggestions: Record<string, Record<string, string>> = {
    "digit-span": {
      high: "你的短期记忆容量很好！试试挑战更多位数。",
      medium: "中等水平，可以通过日常记数字来提升。",
      low: "多用用脑子记东西，别什么都靠手机。",
    },
    "reaction-time": {
      high: "反应很敏捷！继续保持这种状态。",
      medium: "中等水平，试试节奏游戏来提升。",
      low: "反应偏慢，多运动有助于提升神经反射。",
    },
    stroop: {
      high: "认知控制能力很强！大脑处理冲突信息高效。",
      medium: "还可以，练习快速切换注意力能变得更好。",
      low: "斯特鲁普效应明显，试试冥想和专注力训练。",
    },
    "sequence-memory": {
      high: "工作记忆出色！你的序列记忆能力很强。",
      medium: "中等偏上，Simon 游戏多练几次会更好。",
      low: "序列记忆有待提高，坚持练习会改善。",
    },
  };

  const s = suggestions[testId] ?? { high: "", medium: "", low: "" };
  if (avgScore >= 70) return s.high;
  if (avgScore >= 40) return s.medium;
  return s.low;
}

export function TrendChart({
  testId,
  results,
  onClose,
}: {
  testId: string;
  results: TestResult[];
  onClose: () => void;
}) {
  const { normalizeScore, getTier } = useBrainResults();

  const chartData = useMemo(() => {
    const colors = CHART_COLORS[testId] ?? CHART_COLORS["digit-span"];
    const inverted = INVERTED_TESTS.has(testId);
    const scores = results.map((r) => r.score);
    const norms = results.map((r) => normalizeScore(testId, r.score));
    const maxScore = Math.max(...scores, 1);
    const minScore = Math.min(...scores, 0);
    const range = Math.max(maxScore - minScore, 1);
    const padding = range * 0.15;

    const yMin = Math.max(0, minScore - padding);
    const yMax = Math.max(maxScore + padding, yMin + 1);

    const W = 400;
    const H = 160;
    const padL = 40;
    const padR = 16;
    const padT = 12;
    const padB = 28;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const points = results.map((r, i) => ({
      x: padL + (i / Math.max(results.length - 1, 1)) * chartW,
      y: padT + chartH - ((r.score - yMin) / (yMax - yMin)) * chartH,
      score: r.score,
      scoreLabel: r.scoreLabel,
      date: r.timestamp,
      norm: norms[i],
    }));

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const areaPath = points.length > 0
      ? `${linePath} L${points[points.length - 1].x},${padT + chartH} L${points[0].x},${padT + chartH} Z`
      : "";

    // Y-axis ticks
    const yTicks = 4;
    const yTicksArr = Array.from({ length: yTicks }, (_, i) => {
      const val = yMin + ((yMax - yMin) * i) / (yTicks - 1);
      const y = padT + chartH - ((val - yMin) / (yMax - yMin)) * chartH;
      return { y, label: inverted ? `${Math.round(val)}ms` : String(Math.round(val)) };
    });

    const trend = getTrendText(testId, scores);
    const avgScore = Math.round(norms.reduce((a, b) => a + b, 0) / norms.length);
    const tier = getTier(avgScore);
    const suggestion = getSuggestion(testId, avgScore);

    return { points, linePath, areaPath, yTicksArr, trend, avgScore, tier, suggestion, colors, W, H };
  }, [testId, results, normalizeScore, getTier]);

  if (results.length === 0) return null;

  return (
    <div className="border-t border-border/50 pt-4 mt-3">
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">成绩趋势</span>
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                chartData.trend.text.includes("进步")
                  ? "text-green-600"
                  : chartData.trend.text.includes("下降")
                    ? "text-red-600"
                    : "text-muted-foreground"
              }`}
            >
              {chartData.trend.icon} {chartData.trend.text}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${chartData.tier.color} ${chartData.tier.bg}`}>
              综合 {chartData.avgScore}分 · {chartData.tier.label}
            </span>
            <span className="text-[10px] text-muted-foreground">
              共 {results.length} 次记录
            </span>
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="w-full overflow-clip rounded-lg bg-muted/20">
        <svg
          viewBox={`0 0 ${chartData.W} ${chartData.H}`}
          className="w-full h-auto"
          style={{ maxHeight: "180px" }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines */}
          {chartData.yTicksArr.map((tick, i) => (
            <g key={i}>
              <line
                x1={40}
                y1={tick.y}
                x2={chartData.W - 16}
                y2={tick.y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text x={36} y={tick.y + 3} textAnchor="end" fill="#94a3b8" fontSize="9">
                {tick.label}
              </text>
            </g>
          ))}

          {/* Area fill */}
          {chartData.areaPath && (
            <path d={chartData.areaPath} fill={chartData.colors.fill} />
          )}

          {/* Line */}
          <path d={chartData.linePath} fill="none" stroke={chartData.colors.line} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {/* Data points */}
          {chartData.points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill={chartData.colors.dot} stroke="#fff" strokeWidth="1.5" />
              {/* Score label above point */}
              <text x={p.x} y={p.y - 8} textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="600">
                {p.scoreLabel}
              </text>
              {/* Date below */}
              <text x={p.x} y={chartData.H - 6} textAnchor="middle" fill="#94a3b8" fontSize="8">
                {formatDate(p.date)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Suggestion */}
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50/70 px-3 py-2.5 text-xs text-blue-800/80">
        <span className="mt-0.5 shrink-0">💡</span>
        <span>{chartData.suggestion}</span>
      </div>
    </div>
  );
}
