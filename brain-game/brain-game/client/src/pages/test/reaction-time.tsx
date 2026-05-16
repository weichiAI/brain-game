"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Zap, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TestResult } from "@shared/types/brain-test";

type Phase = "ready" | "waiting" | "green" | "too-soon" | "feedback" | "complete";

const TRIALS = 5;

function saveResult(result: TestResult) {
  try {
    const raw = localStorage.getItem("brain-test-results");
    const results: TestResult[] = raw ? JSON.parse(raw) : [];
    results.push(result);
    localStorage.setItem("brain-test-results", JSON.stringify(results));
  } catch { /* ignore */ }
}

const TEST_ID = "reaction-time";
const TEST_NAME = "反应速度测试";

export default function ReactionTimeTest() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("ready");
  const [trial, setTrial] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [message, setMessage] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const waitingRef = useRef(false);
  const greenRef = useRef(false);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    waitingRef.current = false;
    greenRef.current = false;
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startGreen = useCallback(() => {
    greenRef.current = true;
    startTimeRef.current = Date.now();
    setPhase("green");
    setMessage("点击！");
  }, []);

  const startWaiting = useCallback(() => {
    waitingRef.current = true;
    setPhase("waiting");
    setMessage("等待绿色…");
    const delay = 1500 + Math.random() * 4000; // 1.5-5.5s random delay
    timerRef.current = setTimeout(startGreen, delay);
  }, [startGreen]);

  const startTrial = useCallback(() => {
    cleanup();
    setCurrentTime(null);
    startWaiting();
  }, [cleanup, startWaiting]);

  const startTest = () => {
    setTrial(0);
    setTimes([]);
    setShowResult(false);
    startTrial();
  };

  const handleClick = () => {
    if (phase === "waiting") {
      // Clicked too soon!
      cleanup();
      waitingRef.current = false;
      setPhase("too-soon");
      setMessage("点得太早了！等待绿色再点");
      // Auto-retry after 1.2s
      setTimeout(() => startTrial(), 1200);
      return;
    }

    if (phase === "green") {
      const elapsed = Date.now() - startTimeRef.current;
      greenRef.current = false;
      cleanup();
      setCurrentTime(elapsed);

      const newTimes = [...times, elapsed];
      setTimes(newTimes);
      const newTrial = trial + 1;
      setTrial(newTrial);

      if (newTrial >= TRIALS) {
        setShowResult(true);
        const avg = Math.round(newTimes.reduce((a, b) => a + b, 0) / newTimes.length);
        const result: TestResult = {
          testId: TEST_ID,
          testName: TEST_NAME,
          score: avg,
          scoreLabel: `${avg}ms`,
          details: { averageMs: avg, trials: newTrial, bestMs: Math.min(...newTimes) },
          timestamp: Date.now(),
        };
        saveResult(result);
        setPhase("complete");
      } else {
        // Show the time briefly then start next trial
        setPhase("feedback");
        setTimeout(() => startTrial(), 1000);
      }
      return;
    }

    if (phase === "too-soon" || phase === "feedback") {
      // Ignore clicks during these phases
      return;
    }
  };

  const getFeedbackStyle = () => {
    if (currentTime === null) return "";
    if (currentTime < 200) return "text-green-600";
    if (currentTime < 300) return "text-amber-600";
    return "text-red-600";
  };

  const getAvgRating = (avg: number) => {
    if (avg < 200) return "你的反应速度堪比职业电竞选手！🏆";
    if (avg < 250) return "非常快！你的神经系统状态很好。";
    if (avg < 300) return "正常偏快，还不错！";
    if (avg < 400) return "在正常范围内。";
    return "反应有点慢……是不是该放下手机了？😅";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="absolute left-0 right-0 z-10 flex items-center gap-3 p-4">
        <Button
          variant="ghost"
          size="icon"
          className="bg-background/60 backdrop-blur-sm"
          onClick={() => {
            cleanup();
            navigate("/");
          }}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="rounded-lg bg-background/60 px-3 py-1.5 backdrop-blur-sm">
          <h1 className="text-sm font-bold text-foreground">{TEST_NAME}</h1>
        </div>
        {phase !== "ready" && phase !== "complete" && (
          <div className="ml-auto rounded-lg bg-background/60 px-3 py-1.5 backdrop-blur-sm">
            <span className="text-sm text-muted-foreground">
              {trial + (phase === "feedback" ? 0 : 1)}/{TRIALS}
            </span>
          </div>
        )}
      </div>

      {/* Click Area */}
      <div
        className="flex h-screen w-full cursor-pointer select-none items-center justify-center transition-colors duration-150"
        onClick={handleClick}
        style={{
          backgroundColor:
            phase === "waiting"
              ? "hsl(0, 70%, 45%)"
              : phase === "green"
                ? "hsl(142, 70%, 40%)"
                : phase === "too-soon"
                  ? "hsl(40, 80%, 50%)"
                  : "hsl(var(--background))",
        }}
      >
        <AnimatePresence mode="wait">
          {phase === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl bg-card p-8 text-center shadow-theme-raised"
            >
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-amber-100">
                <Zap className="size-8 text-amber-600" />
              </div>
              <h2 className="mb-3 text-xl font-bold text-foreground">反应速度测试</h2>
              <ul className="mb-6 space-y-2 text-left text-sm text-muted-foreground">
                <li>⚡ 屏幕会随机变绿</li>
                <li>⚡ 变绿的瞬间立刻点击屏幕</li>
                <li>⚡ 共测试 {TRIALS} 次，取平均成绩</li>
                <li>⚡ 不要在变绿之前点击</li>
              </ul>
              <Button
                size="lg"
                className="w-full gap-2 rounded-xl text-base"
                onClick={startTest}
              >
                开始测试
              </Button>
            </motion.div>
          )}

          {(phase === "waiting" || phase === "green" || phase === "too-soon") && (
            <motion.div
              key={phase}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <p className="text-2xl font-bold text-white drop-shadow-lg">
                {phase === "waiting" && "等待绿色…"}
                {phase === "green" && "点击！"}
                {phase === "too-soon" && "点早了！等待绿色"}
              </p>
              {phase === "green" && (
                <motion.p
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="mt-2 text-lg text-white/80"
                >
                  现在！
                </motion.p>
              )}
            </motion.div>
          )}

          {phase === "feedback" && (
            <motion.div
              key="feedback"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl bg-card p-8 text-center shadow-theme-raised"
            >
              <p className={`text-4xl font-bold ${getFeedbackStyle()}`}>
                {currentTime}ms
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {currentTime! < 200 ? "⚡ 闪电般快！" : currentTime! < 300 ? "👍 不错！" : "🐢 还能更快！"}
              </p>
            </motion.div>
          )}

          {phase === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl bg-card p-8 text-center shadow-theme-raised"
            >
              <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-amber-100">
                <Zap className="size-10 text-amber-600" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-foreground">测试完成！</h2>
              <p className="mb-6 text-muted-foreground">你的平均反应时间</p>

              <div className="mb-2">
                <span className="text-6xl font-extrabold text-amber-600">
                  {times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0}
                </span>
                <span className="ml-2 text-xl text-muted-foreground">ms</span>
              </div>

              <div className="mb-6 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-lg font-bold text-foreground">
                    {times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0}ms
                  </p>
                  <p className="text-xs text-muted-foreground">平均</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-lg font-bold text-green-600">
                    {times.length > 0 ? Math.min(...times) : 0}ms
                  </p>
                  <p className="text-xs text-muted-foreground">最快</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-lg font-bold text-red-600">
                    {times.length > 0 ? Math.max(...times) : 0}ms
                  </p>
                  <p className="text-xs text-muted-foreground">最慢</p>
                </div>
              </div>

              <p className="mb-6 text-sm text-muted-foreground">
                {getAvgRating(times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0)}
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 gap-2 rounded-xl"
                  onClick={startTest}
                >
                  <RotateCcw className="size-4" /> 再来一次
                </Button>
                <Button
                  className="flex-1 gap-2 rounded-xl"
                  onClick={() => navigate("/")}
                >
                  <Home className="size-4" /> 返回首页
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
