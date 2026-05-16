"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Brain, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TestResult } from "@shared/types/brain-test";

type Phase = "ready" | "showing" | "input" | "feedback" | "complete";

function generateDigits(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10).toString()).join("");
}

function saveResult(result: TestResult) {
  try {
    const raw = localStorage.getItem("brain-test-results");
    const results: TestResult[] = raw ? JSON.parse(raw) : [];
    results.push(result);
    localStorage.setItem("brain-test-results", JSON.stringify(results));
  } catch { /* ignore */ }
}

const TEST_ID = "digit-span";
const TEST_NAME = "数字记忆广度";

export default function DigitSpanTest() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("ready");
  const [currentDigits, setCurrentDigits] = useState("");
  const [showingIndex, setShowingIndex] = useState(0);
  const [length, setLength] = useState(3);
  const [userInput, setUserInput] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [score, setScore] = useState(0); // max digits remembered
  const [roundsAtCurrentLength, setRoundsAtCurrentLength] = useState(0);
  const [failuresAtCurrentLength, setFailuresAtCurrentLength] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const showSequence = useCallback((digits: string) => {
    setCurrentDigits(digits);
    setShowingIndex(0);
    setPhase("showing");
  }, []);

  useEffect(() => {
    if (phase === "showing" && currentDigits) {
      if (showingIndex >= currentDigits.length) {
        const timer = setTimeout(() => {
          setPhase("input");
          setUserInput("");
        }, 400);
        return () => clearTimeout(timer);
      }
      const timer = setTimeout(() => {
        setShowingIndex((i) => i + 1);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [phase, showingIndex, currentDigits]);

  useEffect(() => {
    if (phase === "input") {
      inputRef.current?.focus();
    }
  }, [phase]);

  const startGame = () => {
    setLength(3);
    setScore(0);
    setRoundsAtCurrentLength(0);
    setFailuresAtCurrentLength(0);
    setTotalCorrect(0);
    setTotalAttempts(0);
    const digits = generateDigits(3);
    showSequence(digits);
  };

  const handleSubmit = () => {
    const isCorrect = userInput === currentDigits;
    setTotalAttempts((p) => p + 1);
    setFeedback(isCorrect ? "correct" : "wrong");

    if (isCorrect) {
      setTotalCorrect((p) => p + 1);
      const newRounds = roundsAtCurrentLength + 1;
      setRoundsAtCurrentLength(newRounds);
      // After 2 correct at this length, increase
      if (newRounds >= 2) {
        const newLength = length + 1;
        setLength(newLength);
        setScore(newLength);
        setRoundsAtCurrentLength(0);
        setFailuresAtCurrentLength(0);
      } else {
        setScore(length);
      }
    } else {
      const newFailures = failuresAtCurrentLength + 1;
      setFailuresAtCurrentLength(newFailures);
      // 2 failures at the same length -> game over
      if (newFailures >= 2) {
        setTimeout(() => endGame(), 1000);
        return;
      }
    }

    // Next round after delay
    setTimeout(() => {
      setFeedback(null);
      // If current level has 2 correct, next round will be +1 length
      // But we already handled that. For same length retry:
      const digits = generateDigits(length);
      showSequence(digits);
    }, 1200);
  };

  const endGame = () => {
    const result: TestResult = {
      testId: TEST_ID,
      testName: TEST_NAME,
      score,
      scoreLabel: `${score} 位数字`,
      details: { maxDigits: score, totalCorrect, totalAttempts },
      timestamp: Date.now(),
    };
    saveResult(result);
    setPhase("complete");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && userInput.length > 0) {
      handleSubmit();
    }
  };

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
            <p className="text-sm text-muted-foreground">测试你的短期记忆容量</p>
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
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-violet-100">
                  <Brain className="size-8 text-violet-600" />
                </div>
                <h2 className="mb-3 text-xl font-bold text-foreground">你会看到一串数字</h2>
                <ul className="mb-6 space-y-2 text-left text-sm text-muted-foreground">
                  <li>📌 数字会逐个快速闪过</li>
                  <li>📌 记住后按顺序输入</li>
                  <li>📌 每个长度连对 2 次，数字增加 1 位</li>
                  <li>📌 连错 2 次，测试结束</li>
                </ul>
                <Button
                  size="lg"
                  className="w-full gap-2 rounded-xl text-base"
                  onClick={startGame}
                >
                  开始测试
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "showing" && (
            <motion.div
              key="showing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center"
            >
              <div className="rounded-2xl bg-card p-16 text-center shadow-theme-raised">
                <p className="mb-4 text-xs text-muted-foreground">
                  记住这个数字… ({showingIndex + 1}/{currentDigits.length})
                </p>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={showingIndex}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.2 }}
                    transition={{ duration: 0.15 }}
                    className="text-7xl font-bold tracking-widest text-foreground"
                  >
                    {currentDigits[showingIndex] ?? ""}
                  </motion.span>
                </AnimatePresence>
                {/* Progress dots */}
                <div className="mt-8 flex justify-center gap-1.5">
                  {Array.from({ length: currentDigits.length }).map((_, i) => (
                    <div
                      key={i}
                      className={`size-2 rounded-full transition-colors ${
                        i <= showingIndex ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {phase === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="rounded-2xl bg-card p-8 text-center shadow-theme-raised">
                <p className="mb-6 text-sm text-muted-foreground">
                  请输入你刚才看到的数字序列
                </p>
                <div className="mb-4">
                  <Label htmlFor="digits-input" className="sr-only">
                    输入数字
                  </Label>
                  <Input
                    ref={inputRef}
                    id="digits-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={handleKeyDown}
                    placeholder="在此输入…"
                    className="text-center text-2xl tracking-widest"
                    maxLength={currentDigits.length + 1}
                    autoFocus
                  />
                </div>
                <Button
                  className="w-full gap-2 rounded-xl"
                  disabled={userInput.length === 0}
                  onClick={handleSubmit}
                >
                  确认
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "feedback" && (
            <motion.div
              key="feedback"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <div
                className={`rounded-2xl p-8 ${
                  feedback === "correct" ? "bg-green-50" : "bg-red-50"
                }`}
              >
                {feedback === "correct" ? (
                  <div>
                    <p className="text-2xl font-bold text-green-700">✓ 正确！</p>
                    <p className="mt-2 text-green-600">答案是 {currentDigits}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-2xl font-bold text-red-700">✗ 错了</p>
                    <p className="mt-2 text-red-600">
                      你的输入: {userInput}
                    </p>
                    <p className="text-red-600">正确答案: {currentDigits}</p>
                  </div>
                )}
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
                <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-violet-100">
                  <Brain className="size-10 text-violet-600" />
                </div>
                <h2 className="mb-2 text-2xl font-bold text-foreground">测试完成！</h2>
                <p className="mb-6 text-muted-foreground">你的数字记忆广度</p>

                <div className="mb-6">
                  <span className="text-6xl font-extrabold text-violet-600">{score}</span>
                  <span className="ml-2 text-xl text-muted-foreground">位数字</span>
                </div>

                <div className="mb-6 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-2xl font-bold text-foreground">{totalCorrect}</p>
                    <p className="text-xs text-muted-foreground">正确次数</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-2xl font-bold text-foreground">{totalAttempts}</p>
                    <p className="text-xs text-muted-foreground">总尝试</p>
                  </div>
                </div>

                <p className="mb-6 text-sm text-muted-foreground">
                  普通人平均能记住 5-9 位数字。{score >= 7 ? "你的记忆力非常出色！" : score >= 5 ? "在正常范围内。" : "也许该少用点 AI 了 😅"}
                </p>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 rounded-xl"
                    onClick={startGame}
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
