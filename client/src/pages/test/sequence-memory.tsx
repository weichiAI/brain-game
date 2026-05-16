"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Grid3x3, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TestResult } from "@shared/types/brain-test";

type Phase = "ready" | "showing" | "input" | "complete";

const GRID_SIZE = 4;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

function saveResult(result: TestResult) {
  try {
    const raw = localStorage.getItem("brain-test-results");
    const results: TestResult[] = raw ? JSON.parse(raw) : [];
    results.push(result);
    localStorage.setItem("brain-test-results", JSON.stringify(results));
  } catch { /* ignore */ }
}

const TEST_ID = "sequence-memory";
const TEST_NAME = "序列记忆挑战";

const CELL_COLORS = [
  "bg-red-400",
  "bg-blue-400",
  "bg-green-400",
  "bg-yellow-400",
];

export default function SequenceMemoryTest() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("ready");
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerSequence, setPlayerSequence] = useState<number[]>([]);
  const [highlightedCell, setHighlightedCell] = useState<number | null>(null);
  const [showIndex, setShowIndex] = useState(0);
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [isPlayerTurn, setIsPlayerTurn] = useState(false);
  const [message, setMessage] = useState("");
  const inputLockRef = useRef(false);

  const generateNextStep = useCallback((currentSeq: number[]): number[] => {
    let next: number;
    do {
      next = Math.floor(Math.random() * TOTAL_CELLS);
    } while (currentSeq.length > 0 && next === currentSeq[currentSeq.length - 1]);
    return [...currentSeq, next];
  }, []);

  // Show sequence
  useEffect(() => {
    if (phase !== "showing" || sequence.length === 0) return;

    if (showIndex >= sequence.length) {
      const timer = setTimeout(() => {
        setIsPlayerTurn(true);
        setPlayerSequence([]);
        setPhase("input");
        setMessage("现在轮到你！按顺序点击方块");
        inputLockRef.current = false;
      }, 500);
      return () => clearTimeout(timer);
    }

    const cell = sequence[showIndex];
    setHighlightedCell(cell);
    const timer = setTimeout(() => {
      setHighlightedCell(null);
      setShowIndex((i) => i + 1);
    }, 600);

    return () => clearTimeout(timer);
  }, [phase, sequence, showIndex]);

  const startGame = () => {
    const firstSeq = generateNextStep([]);
    setSequence(firstSeq);
    setPlayerSequence([]);
    setLevel(1);
    setScore(0);
    setShowIndex(0);
    setHighlightedCell(null);
    setIsPlayerTurn(false);
    setMessage("观察序列…");
    inputLockRef.current = false;
    setPhase("showing");
  };

  const handleCellClick = (cellIndex: number) => {
    if (phase !== "input" || !isPlayerTurn || inputLockRef.current) return;

    inputLockRef.current = true;
    setHighlightedCell(cellIndex);

    const newPlayerSeq = [...playerSequence, cellIndex];
    setPlayerSequence(newPlayerSeq);

    // Check if this step is correct
    const expectedIndex = playerSequence.length;
    if (cellIndex !== sequence[expectedIndex]) {
      // Wrong!
      setTimeout(() => {
        setHighlightedCell(null);
        endGame();
      }, 400);
      return;
    }

    // Check if sequence is complete
    if (newPlayerSeq.length === sequence.length) {
      setTimeout(() => {
        setHighlightedCell(null);
        // Correct! Advance to next level
        const nextLevel = level + 1;
        setLevel(nextLevel);
        setScore(nextLevel);
        const nextSeq = generateNextStep(sequence);
        setSequence(nextSeq);
        setPlayerSequence([]);
        setShowIndex(0);
        setIsPlayerTurn(false);
        setMessage(`第 ${level} 关通过！准备下一关…`);
        setTimeout(() => {
          setPhase("showing");
          inputLockRef.current = false;
        }, 800);
      }, 400);
    } else {
      setTimeout(() => {
        setHighlightedCell(null);
        inputLockRef.current = false;
      }, 250);
    }
  };

  const endGame = () => {
    setPhase("complete");
    const result: TestResult = {
      testId: TEST_ID,
      testName: TEST_NAME,
      score,
      scoreLabel: `第 ${score} 关`,
      details: { level: score, sequenceLength: score + 2 },
      timestamp: Date.now(),
    };
    saveResult(result);
  };

  const getPerformanceComment = (s: number) => {
    if (s >= 10) return "你的工作记忆超强！简直是记忆大师！🧠";
    if (s >= 7) return "非常厉害！你的序列记忆能力远超常人。";
    if (s >= 5) return "不错，在平均水平之上。";
    if (s >= 3) return "正常水平，还可以练得更好。";
    return "嗯……多练练也许能进步 😅";
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-md">
        {/* Top Bar */}
        <div className="mb-8 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">{TEST_NAME}</h1>
            <p className="text-sm text-muted-foreground">Simon 记忆挑战</p>
          </div>
          {phase !== "ready" && phase !== "complete" && (
            <div className="ml-auto rounded-lg bg-muted px-3 py-1.5">
              <span className="text-sm font-medium text-foreground">第 {level} 关</span>
            </div>
          )}
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
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-rose-100">
                  <Grid3x3 className="size-8 text-rose-600" />
                </div>
                <h2 className="mb-3 text-xl font-bold text-foreground">序列记忆挑战</h2>
                <ul className="mb-6 space-y-2 text-left text-sm text-muted-foreground">
                  <li>🔲 方块会按顺序闪烁</li>
                  <li>🔲 记住闪烁的顺序</li>
                  <li>🔲 按相同顺序点击方块</li>
                  <li>🔲 每过一关增加一步</li>
                  <li>🔲 点错则游戏结束</li>
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

          {(phase === "showing" || phase === "input") && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Message */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground">{message}</p>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: TOTAL_CELLS }).map((_, i) => (
                  <button
                    key={i}
                    className={`aspect-square rounded-xl border-2 transition-all duration-150 ${
                      highlightedCell === i
                        ? `${CELL_COLORS[i % CELL_COLORS.length]} scale-95 border-foreground/30 shadow-lg`
                        : "bg-muted/70 border-border/50 hover:border-primary/30"
                    } ${phase === "input" && isPlayerTurn ? "cursor-pointer hover:bg-muted" : "cursor-default"}`}
                    onClick={() => handleCellClick(i)}
                    disabled={phase !== "input" || !isPlayerTurn}
                  />
                ))}
              </div>

              {/* Progress */}
              <div className="flex justify-center gap-1">
                {sequence.map((_, i) => (
                  <div
                    key={i}
                    className={`size-2 rounded-full transition-colors ${
                      i < playerSequence.length ? "bg-primary" : "bg-muted"
                    }`}
                  />
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
                <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-rose-100">
                  <Grid3x3 className="size-10 text-rose-600" />
                </div>
                <h2 className="mb-2 text-2xl font-bold text-foreground">游戏结束！</h2>
                <p className="mb-6 text-muted-foreground">你的序列记忆成绩</p>

                <div className="mb-2">
                  <span className="text-6xl font-extrabold text-rose-600">{score}</span>
                  <span className="ml-2 text-xl text-muted-foreground">
                    关 ({(score > 0 ? score + 2 : 0)} 步)
                  </span>
                </div>

                <div className="mb-6">
                  <p className="text-sm text-muted-foreground">
                    {getPerformanceComment(score)}
                  </p>
                </div>

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
