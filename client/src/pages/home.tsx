"use client";

import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Zap,
  Eye,
  Grid3x3,
  RefreshCw,
  Trophy,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Timer,
  X,
  Loader2,
  Lightbulb,
  Target,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BRAIN_TESTS } from "@shared/types/brain-test";
import type { TestConfig } from "@shared/types/brain-test";
import { useBrainResults } from "@/hooks/use-brain-results";
import { usePoster } from "@/hooks/use-poster";
import { BrainReportPoster } from "@/components/BrainReportPoster";
import { TrendChart } from "@/components/TrendChart";

const ICON_MAP: Record<string, React.ElementType> = {
  Brain,
  Zap,
  Eye,
  Grid3x3,
};

const COLOR_MAP: Record<string, string> = {
  "digit-span": "border-l-violet-500",
  "reaction-time": "border-l-amber-500",
  stroop: "border-l-emerald-500",
  "sequence-memory": "border-l-rose-500",
};

function TestCard({ test, index }: { test: TestConfig; index: number }) {
  const navigate = useNavigate();
  const { getLatest, getPrevious } = useBrainResults();
  const latest = getLatest(test.id);
  const previous = getPrevious(test.id);

  const isInverted = test.id === "reaction-time";
  let delta: "up" | "down" | "same" | "none" = "none";
  if (latest && previous) {
    if (isInverted) {
      if (latest.score < previous.score) delta = "up";
      else if (latest.score > previous.score) delta = "down";
      else delta = "same";
    } else {
      if (latest.score > previous.score) delta = "up";
      else if (latest.score < previous.score) delta = "down";
      else delta = "same";
    }
  }

  const Icon = ICON_MAP[test.icon] ?? Brain;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.1 * index,
        duration: 0.5,
        ease: [0.2, 0.72, 0.24, 1],
      }}
    >
      <Card
        className="group cursor-pointer overflow-clip border-0 shadow-theme-raised transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
        onClick={() => navigate(test.route)}
      >
        <div className={`h-2 bg-linear-to-r ${test.color}`} />
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary-container">
              <Icon className="size-6 text-primary" />
            </div>
            <div className="flex items-center gap-1.5">
              {latest && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <Trophy className="size-3" />
                  {latest.scoreLabel}
                </span>
              )}
              {delta === "up" && (
                <Badge
                  variant="outline"
                  className="gap-0.5 border-green-200 bg-green-50 px-1.5 py-0 text-xs text-green-700"
                >
                  <TrendingUp className="size-3" />
                </Badge>
              )}
              {delta === "down" && (
                <Badge
                  variant="outline"
                  className="gap-0.5 border-red-200 bg-red-50 px-1.5 py-0 text-xs text-red-700"
                >
                  <TrendingDown className="size-3" />
                </Badge>
              )}
              {delta === "same" && (
                <Badge
                  variant="outline"
                  className="gap-0.5 border-gray-200 bg-gray-50 px-1.5 py-0 text-xs text-gray-500"
                >
                  <Minus className="size-3" />
                </Badge>
              )}
            </div>
          </div>
          <CardTitle className="mt-3 text-xl">{test.name}</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            {test.description}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex items-center justify-between border-t border-border/50 pt-4">
          <span className="text-xs text-muted-foreground">{test.duration}</span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-opacity duration-200 group-hover:opacity-100 opacity-0">
            开始测试 <ArrowRight className="size-4" />
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-opacity duration-200 group-hover:opacity-0 opacity-100">
            开始测试
          </span>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

function DeltaBadge({ delta }: { delta: "up" | "down" | "same" | "first" }) {
  if (delta === "first") {
    return (
      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
        首次
      </span>
    );
  }
  if (delta === "up") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
        <TrendingUp className="size-3" /> 进步
      </span>
    );
  }
  if (delta === "down") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
        <TrendingDown className="size-3" /> 下降
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
      <Minus className="size-3" /> 持平
    </span>
  );
}

function BrainReport({
  completedCount,
  comparisonMap,
  totalRecords,
  overallBrainScore,
  getTier,
  getAdvice,
  getResultsByTestId,
  onDownloadPoster,
  onClear,
  onShowPoster,
}: {
  completedCount: number;
  comparisonMap: ReturnType<typeof useBrainResults>["comparisonMap"];
  totalRecords: number;
  overallBrainScore: number;
  getTier: ReturnType<typeof useBrainResults>["getTier"];
  getAdvice: ReturnType<typeof useBrainResults>["getAdvice"];
  getResultsByTestId: ReturnType<typeof useBrainResults>["getResultsByTestId"];
  onDownloadPoster?: () => void;
  onClear?: () => void;
  onShowPoster?: () => void;
}) {
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);

  if (totalRecords === 0) return <></>;
  const tier = getTier(overallBrainScore);
  const advices = getAdvice();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="mb-10 rounded-2xl bg-card p-6 shadow-theme-raised"
    >
      {/* Header with overall score */}
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-100">
          <Trophy className="size-6 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-foreground">你的脑力报告</h3>
            {completedCount > 0 && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tier.color} ${tier.bg}`}>
                <Target className="size-3" />
                {overallBrainScore}分 · {tier.label}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            已完成 {completedCount}/{BRAIN_TESTS.length} 项测试 · 共 {totalRecords} 次记录
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          disabled={totalRecords === 0}
          onClick={onShowPoster}
        >
          <Download className="size-3.5" />
          海报
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground shrink-0"
          onClick={onClear}
        >
          <RefreshCw className="size-3.5" />
          清除
        </Button>
      </div>

      {/* Overall score bar */}
      {completedCount > 0 && (
        <div className="mt-4 rounded-xl bg-gradient-to-r from-muted/50 to-muted/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">综合脑力评分</span>
            <span className="text-xs text-muted-foreground">
              基于 {completedCount} 项测试结果
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-muted overflow-clip">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${overallBrainScore}%` }}
              transition={{ duration: 1, ease: [0.2, 0.72, 0.24, 1] }}
              className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary"
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-muted-foreground/60">0</span>
            <span className={`text-[10px] font-medium ${tier.color}`}>{overallBrainScore}分 {tier.label}</span>
            <span className="text-[10px] text-muted-foreground/60">100</span>
          </div>
        </div>
      )}

      {/* Comparison Grid — clickable to expand trend */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {comparisonMap.map((item) => {
          const Icon = ICON_MAP[BRAIN_TESTS.find((t) => t.id === item.testId)?.icon ?? "Brain"] ?? Brain;
          const hasData = !!item.latest;
          const isExpanded = expandedTestId === item.testId;
          const results = getResultsByTestId(item.testId);
          const resultCount = results.length;

          return (
            <div key={item.testId} className="overflow-clip">
              {/* Clickable header */}
              <div
                className={`rounded-xl bg-muted/30 p-3.5 border-l-2 cursor-pointer transition-all duration-200 hover:bg-muted/50 ${
                  COLOR_MAP[item.testId] ?? "border-l-muted"
                } ${isExpanded ? "rounded-b-none" : ""}`}
                onClick={() => setExpandedTestId(isExpanded ? null : item.testId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedTestId(isExpanded ? null : item.testId);
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {item.testName}
                    </span>
                    {resultCount > 1 && (
                      <span className="text-[10px] text-muted-foreground/60">
                        {resultCount}次
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <DeltaBadge delta={item.delta} />
                  </div>
                </div>
                {hasData ? (
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-bold text-foreground">
                      {item.latest!.scoreLabel}
                    </span>
                    {item.previous && (
                      <span className="text-xs text-muted-foreground">
                        上次: {item.previous.scoreLabel}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">尚未测试</p>
                )}
              </div>

              {/* Expanded chart area */}
              {isExpanded && resultCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: [0.2, 0.72, 0.24, 1] }}
                  className="rounded-b-xl border-x-2 border-b-2 border-l-violet-500/20 border-r-violet-500/20 bg-muted/10 px-3.5 pb-4"
                  style={{ borderLeftColor: "color-mix(in srgb, var(--color-violet-500) 20%, transparent)", borderRightColor: "color-mix(in srgb, var(--color-violet-500) 20%, transparent)" }}
                >
                  <TrendChart
                    testId={item.testId}
                    results={results}
                    onClose={() => setExpandedTestId(null)}
                  />
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* Personalized advice */}
      {advices.length > 0 && (
        <div className="mt-4 rounded-xl bg-gradient-to-r from-blue-50/80 to-indigo-50/50 border border-blue-100/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="size-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">个性化建议</span>
          </div>
          <ul className="space-y-2">
            {advices.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-blue-700/80">
                <Lightbulb className="size-3.5 mt-0.5 shrink-0 text-amber-500" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground/70">
            <Timer className="size-3.5" />
            <span>建议每周或每月测一次，追踪变化趋势。坚持训练，大脑会感谢你！</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function MITBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-auto mb-6 max-w-4xl"
    >
      <div className="rounded-xl border border-amber-200/30 bg-gradient-to-r from-amber-50/80 to-white px-5 py-3.5 shadow-sm">
        <div className="flex items-start gap-3">
          {/* Left accent */}
          <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-100">
            <span className="text-xs font-bold tracking-tight text-amber-700">MIT</span>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            {/* First paragraph */}
            <p className="text-left text-xs leading-relaxed text-amber-900/85">
              <span className="font-semibold text-amber-950">2025年重磅研究</span>
              ：长期使用 AI 辅助的人群，大脑神经连接数量从
              <span className="mx-0.5 rounded-md bg-red-50 px-1.5 py-0.5 font-semibold text-red-600">79 个降至 42 个</span>
              （降幅 47%），α波（创造力相关）活跃度下降。
            </p>
            {/* Second paragraph */}
            <div className="flex items-center gap-2 text-left text-xs text-amber-800/80">
              <div className="h-0.5 w-4 rounded-full bg-amber-300" />
              <span className="font-medium text-emerald-700">研究同时指出：每天 30 分钟针对性的脑力训练可有效逆转这一趋势。</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function PosterOverlay({
  visible,
  onClose,
  posterRef,
  onDownload,
  generating,
  posterData,
}: {
  visible: boolean;
  onClose: () => void;
  posterRef: React.RefObject<HTMLDivElement | null>;
  onDownload: () => void;
  generating: boolean;
  posterData: { comparisonMap: ReturnType<typeof useBrainResults>["comparisonMap"]; totalTestCount: number; completedCount: number };
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-4 backdrop-blur-sm pt-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.25, ease: [0.2, 0.72, 0.24, 1] }}
            className="relative my-auto rounded-2xl bg-white shadow-2xl"
          >
            {/* Poster rendered directly — no overflow wrapper */}
            <BrainReportPoster
              posterRef={posterRef}
              data={posterData}
            />

            {/* Action bar */}
            <div className="sticky bottom-0 flex items-center justify-between rounded-b-2xl border-t border-gray-100 bg-white px-5 py-3">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={onClose}
              >
                <X className="size-4" />
                关闭
              </Button>
              <Button
                size="sm"
                className="gap-1.5 rounded-xl"
                onClick={onDownload}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {generating ? "生成中…" : "下载海报"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FooterNote() {
  return (
    <footer className="border-t border-border/50 px-4 py-8 text-center text-sm text-muted-foreground">
      <p>脑力测试小程序 · 仅供娱乐参考，不构成任何医学建议</p>
      <p className="mt-1">
        觉得脑子不够用了？放下手机出去走走吧，或者来测测你的脑力还剩多少 🌿
      </p>
    </footer>
  );
}

export default function Home() {
  const { comparisonMap, completedCount, totalRecords, clearResults, overallBrainScore, getTier, getAdvice, getResultsByTestId } = useBrainResults();
  const { posterRef, generating, downloadPoster } = usePoster();
  const [posterVisible, setPosterVisible] = useState(false);
  const hasResults = totalRecords > 0;

  const handleShowPoster = useCallback(() => setPosterVisible(true), []);
  const handleClosePoster = useCallback(() => setPosterVisible(false), []);
  const handleDownloadPoster = useCallback(async () => {
    await downloadPoster();
    // Don't close automatically — user can keep previewing
  }, [downloadPoster]);

  return (
    <div className="min-h-screen bg-background">
      {/* MIT Banner above hero */}
      <div className="px-4 pt-6">
        <MITBanner />
      </div>

      {/* Hero Section */}
      <section className="relative overflow-clip px-4 pb-16 pt-8 sm:pt-16">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute -left-32 -top-32 size-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -right-32 top-1/3 size-80 rounded-full bg-amber-500/5 blur-3xl" />
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.2, 0.72, 0.24, 1] }}
          >
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary shadow-theme-raised">
              <Brain className="size-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              你的脑子
              <span className="block bg-linear-to-r from-primary to-amber-500 bg-clip-text text-transparent">
                被 AI 吃掉了吗？
              </span>
            </h1>
            {/* Provocation */}
            <div className="mx-auto mt-8 max-w-xl space-y-4">
              <p className="text-base leading-relaxed text-muted-foreground/70 italic">
                “天天让 ChatGPT 写东西、让 AI 画画、让算法推荐……”
              </p>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border/50" />
                <span className="text-sm font-medium text-foreground/90">
                  你的原始脑力还剩多少？
                </span>
                <div className="h-px flex-1 bg-border/50" />
              </div>
              {/* Invitation */}
              <p className="text-lg font-medium leading-relaxed text-foreground/85">
                花 5 分钟完成几项小测试，看看你的
                <span className="text-primary font-semibold">记忆力</span>、
                <span className="text-amber-600 font-semibold">反应速度</span>和
                <span className="text-emerald-600 font-semibold">认知能力</span>
                是否依然在线。
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                className="gap-2 rounded-xl px-8 text-base shadow-lg"
                onClick={() => {
                  document.getElementById("tests")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                开始脑力检测 <ArrowRight className="size-5" />
              </Button>
              {hasResults && (
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2 rounded-xl px-8 text-base"
                  onClick={() => {
                    document
                      .getElementById("brain-report")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <Trophy className="size-4" />
                  查看报告
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Brain Report */}
      <section id="brain-report" className="px-4">
        <div className="mx-auto max-w-5xl">
          <BrainReport
            completedCount={completedCount}
            comparisonMap={comparisonMap}
            totalRecords={totalRecords}
            overallBrainScore={overallBrainScore}
            getTier={getTier}
            getAdvice={getAdvice}
            getResultsByTestId={getResultsByTestId}
            onShowPoster={handleShowPoster}
            onClear={clearResults}
          />
        </div>
      </section>

      {/* Test Cards Grid */}
      <section id="tests" className="px-4 pb-24">
        <div className="mx-auto max-w-5xl">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-8 text-2xl font-bold text-foreground"
          >
            选择一项测试
          </motion.h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {BRAIN_TESTS.map((test, i) => (
              <TestCard key={test.id} test={test} index={i} />
            ))}
          </div>
        </div>
      </section>

      <FooterNote />

      {/* Poster Preview Overlay */}
      <PosterOverlay
        visible={posterVisible}
        onClose={handleClosePoster}
        posterRef={posterRef}
        onDownload={handleDownloadPoster}
        generating={generating}
        posterData={{ comparisonMap, totalTestCount: BRAIN_TESTS.length, completedCount }}
      />
    </div>
  );
}
