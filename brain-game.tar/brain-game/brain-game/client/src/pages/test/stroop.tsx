"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Eye, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TestResult } from "@shared/types/brain-test";

type Phase = "ready" | "playing" | "complete";

interface StroopTrial {
  word: string;
  inkColor: string;
  correctAnswer: string;
}

const COLORS = [
  { name: "红", value: "#ef4444" },
  { name: "蓝", value: "#3b82f6" },
  { name: "绿", value: "#22c55e" },
  { name: "黄", value: "#eab308" },
];

const TOTAL_TRIALS = 15;
const TIME_LIMIT_SECONDS = 30;

function generateTrial(): StroopTrial {
  const colorNames = COLORS.map((c) => c.name);
  const inkIndex = Math.floor(Math.random() * COLORS.length);
  let wordIndex = Math.floor(Math.random() * COLORS.length);
  // Ensure word differs from ink color at least some of the time (80% incongruent)
  const isCongruent = Math.random() < 0.2;
  if (isCongruent) {
    wordIndex = inkIndex;
  } else {
    while (wordIndex === inkIndex) {
      wordIndex = Math.floor(Math.random() * COLORS.length);
    }
  }

  return {
    word: colorNames[wordIndex],
    inkColor: COLORS[inkIndex].name,
    correctAnswer: COLORS[inkIndex].name,
  };
}

function saveResult(result: TestResult) {
  try {
    const raw = localStorage.getItem("brain-test-results");
    const results: TestResult[] = raw ? JSON.parse(raw) : [];
    results.push(result);
    localStorage.setItem("brain-test-results", JSON.stringify(results));
  } catch { /* ignore */ }
}

const TEST_ID = "stroop";
const TEST_NAME = "斯特鲁普干扰测试";

export default function StroopTest() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("ready");
  const [trial, setTrial] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [trialData, setTrialData] = useState<StroopTrial | null>(null);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT_SECONDS);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const trialStartRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const nextTrial = useCallback(() => {
    setTrialData(generateTrial());
    trialStartRef.current = Date.now();
  }, []);

  const startTest = () => {
    setTrial(0);
    setCorrect(0);
    setWrong(0);
    setReactionTimes([]);
    setTimeLeft(TIME_LIMIT_SECONDS);
    nextTrial();
    setPhase("playing");

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Detect when time runs out
  useEffect(() => {
    if (phase === "playing" && timeLeft <= 0) {
      endGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, phase]);

  const endGame = () => {
    setPhase("complete");
    if (timerRef.current) clearInterval(timerRef.current);

    const totalTrials = correct + wrong;
    const accuracy = totalTrials > 0 ? Math.round((correct / totalTrials) * 100) : 0;
    const avgReaction = reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 0;

    // Efficiency score: accuracy weighted by speed factor
    // speedFactor ranges from 0.5 (slow, 2500ms) to 1.0 (fast, 500ms)
    const speedFactor = Math.max(0.5, Math.min(1, (2500 - avgReaction) / 2000));
    const efficiency = Math.round(accuracy * speedFactor);

    const result: TestResult = {
      testId: TEST_ID,
      testName: TEST_NAME,
      score: efficiency,
      scoreLabel: `${efficiency}分`,
      details: { accuracy, efficiency, correct, wrong, avgReactionMs: avgReaction, totalTrialsDone: totalTrials },
      timestamp: Date.now(),
    };
    saveResult(result);
  };

  const handleAnswer = (answer: string) => {
    if (!trialData || phase !== "playing") return;

    const rt = Date.now() - trialStartRef.current;
    const isCorrect = answer === trialData.correctAnswer;

    if (isCorrect) {
      setCorrect((p) => p + 1);
    } else {
      setWrong((p) => p + 1);
    }
    setReactionTimes((p) => [...p, rt]);
    setTrial((p) => p + 1);

    if (trial + 1 >= TOTAL_TRIALS) {
      endGame();
    } else {
      nextTrial();
    }
  };

  const getInkColorHex = (colorName: string): string => {
    return COLORS.find((c) => c.name === colorName)?.value ?? "#000000";
  };

  const getPerformanceComment = (acc: number, avgRt: number) => {
    if (acc >= 90 && avgRt < 1200) return "你的认知控制能力很强！大脑处理冲突信息非常高效。";
    if (acc >= 80) return "表现不错，斯特鲁普干扰对你影响不大。";
    if (acc >= 60) return "嗯……斯特鲁普效应开始显现了。";
    return "AI 用多了果然会影响大脑处理冲突的能力 😅";
  };

  const totalDone = correct + wrong;
  const accuracy = totalDone > 0 ? Math.round((correct / totalDone) * 100) : 0;
  const avgReaction = reactionTimes.length > 0
    ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
    : 0;
  const speedFactor = Math.max(0.5, Math.min(1, (2500 - avgReaction) / 2000));
  const efficiencyScore = Math.round(accuracy * speedFactor);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-lg">
        {/* Top Bar */}
        <div className="mb-8 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">{TEST_NAME}</h1>
            <p className="text-sm text-muted-foreground">文字颜色 vs 文字含义</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {phase === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="rounded-2xl bg-card p-8 text-center shadow-theme-raised">
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-emerald-100">
                  <Eye className="size-8 text-emerald-600" />
                </div>
                <h2 className="mb-3 text-xl font-bold text-foreground">颜色 vs 文字</h2>
                <ul className="mb-6 space-y-2 text-left text-sm text-muted-foreground">
                  <li>🎯 你会看到一个颜色词（如"红"）</li>
                  <li>🎯 但文字的墨水颜色可能不同</li>
                  <li>🎯 请判断墨水的颜色，而不是文字本身</li>
                  <li>🎯 限时 {TIME_LIMIT_SECONDS} 秒，越快越准越好</li>
                </ul>
                <Button
                  size="lg"
                  className="w-full gap-2 rounded-xl text-base"
                  onClick={startTest}
                >
                  开始测试
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "playing" && trialData && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Timer and progress */}
              <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3 shadow-theme-raised">
                <div className="flex items-center gap-2">
                  <div
                    className={`size-3 rounded-full ${
                      timeLeft > 10 ? "bg-green-500" : timeLeft > 5 ? "bg-amber-500" : "bg-red-500 animate-pulse"
                    }`}
                  />
                  <span className={`font-mono text-lg font-bold ${timeLeft <= 5 ? "text-red-500" : "text-foreground"}`}>
                    {timeLeft}s
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-600">✓ {correct}</span>
                  <span className="text-red-500">✗ {wrong}</span>
                  <span className="text-muted-foreground">
                    {trial}/{TOTAL_TRIALS}
                  </span>
                </div>
              </div>

              {/* Stimulus */}
              <div className="flex items-center justify-center">
                <div className="w-full rounded-2xl bg-card p-12 text-center shadow-theme-raised">
                  <p
                    className="text-6xl font-bold sm:text-7xl"
                    style={{ color: getInkColorHex(trialData.inkColor) }}
                  >
                    {trialData.word}
                  </p>
                  <p className="mt-4 text-sm text-muted-foreground">
                    字的颜色是什么？
                  </p>
                </div>
              </div>

              {/* Answer buttons */}
              <div className="grid grid-cols-2 gap-3">
                {COLORS.map((color) => (
                  <Button
                    key={color.name}
                    className="h-16 gap-3 rounded-xl text-lg font-bold transition-all duration-150 active:scale-95"
                    style={{
                      backgroundColor: color.value,
                      color: color.name === "黄" ? "#000" : "#fff",
                    }}
                    onClick={() => handleAnswer(color.name)}
                  >
                    {color.name}
                  </Button>
                ))}
              </div>
            </motion.div>
          )}

          {phase === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="rounded-2xl bg-card p-8 text-center shadow-theme-raised">
                <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-emerald-100">
                  <Eye className="size-10 text-emerald-600" />
                </div>
                <h2 className="mb-2 text-2xl font-bold text-foreground">测试完成！</h2>
                <p className="mb-6 text-muted-foreground">你的斯特鲁普测试结果</p>

                <div className="mb-2">
                  <span className="text-6xl font-extrabold text-emerald-600">{efficiencyScore}</span>
                  <span className="ml-2 text-xl text-muted-foreground">效率分</span>
                </div>
                <p className="mb-4 text-xs text-muted-foreground">
                  综合正确率 {accuracy}% · 平均反应 {avgReaction}ms
                </p>

                <div className="mb-6 grid grid-cols-4 gap-2">
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-lg font-bold text-green-600">{correct}</p>
                    <p className="text-xs text-muted-foreground">正确</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-lg font-bold text-red-500">{wrong}</p>
                    <p className="text-xs text-muted-foreground">错误</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-lg font-bold text-foreground">{avgReaction}ms</p>
                    <p className="text-xs text-muted-foreground">平均反应</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-lg font-bold text-emerald-600">{accuracy}%</p>
                    <p className="text-xs text-muted-foreground">正确率</p>
                  </div>
                </div>

                <p className="mb-6 text-sm text-muted-foreground">
                  {getPerformanceComment(accuracy, avgReaction)}
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
