"use client";

import { useState, useCallback, useEffect } from "react";
import type { TestResult } from "@shared/types/brain-test";
import { BRAIN_TESTS } from "@shared/types/brain-test";

const STORAGE_KEY = "brain-test-results";

/** Tests where lower score = better performance */
const INVERTED_TESTS = new Set(["reaction-time"]);

export function useBrainResults() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as TestResult[]) : [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    setResults(load());
  }, [load, refreshKey]);

  const saveResult = useCallback((result: TestResult) => {
    const current = load();
    current.push(result);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    setRefreshKey((k) => k + 1);
  }, [load]);

  const clearResults = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setRefreshKey((k) => k + 1);
  }, []);

  /** Get the latest result for a given test */
  const getLatest = useCallback(
    (testId: string): TestResult | undefined => {
      const all = load();
      return all
        .filter((r) => r.testId === testId)
        .sort((a, b) => b.timestamp - a.timestamp)[0];
    },
    [load],
  );

  /** Get the second-to-latest result for comparison */
  const getPrevious = useCallback(
    (testId: string): TestResult | undefined => {
      const all = load();
      const filtered = all
        .filter((r) => r.testId === testId)
        .sort((a, b) => b.timestamp - a.timestamp);
      return filtered.length >= 2 ? filtered[1] : undefined;
    },
    [load],
  );

  /** Get all results for a given test, sorted by time ascending */
  const getResultsByTestId = useCallback(
    (testId: string): TestResult[] => {
      const all = load();
      return all
        .filter((r) => r.testId === testId)
        .sort((a, b) => a.timestamp - b.timestamp);
    },
    [load],
  );

  /** Compare two scores respecting inverted tests */
  const compare = useCallback(
    (testId: string, latestScore: number, previousScore: number): "up" | "down" | "same" => {
      const inverted = INVERTED_TESTS.has(testId);
      if (inverted) {
        if (latestScore < previousScore) return "up";
        if (latestScore > previousScore) return "down";
      } else {
        if (latestScore > previousScore) return "up";
        if (latestScore < previousScore) return "down";
      }
      return "same";
    },
    [],
  );

  /** How many tests have at least one result */
  const completedCount = BRAIN_TESTS.filter((t) => getLatest(t.id)).length;

  /** Build a map of testId -> { latest, previous, delta } */
  const comparisonMap = BRAIN_TESTS.map((test) => {
    const latest = getLatest(test.id);
    const previous = getPrevious(test.id);
    let delta: "up" | "down" | "same" | "first" = "first";
    if (latest && previous) {
      delta = compare(test.id, latest.score, previous.score);
    }
    return { testId: test.id, testName: test.name, latest, previous, delta };
  });

  /** Normalize a test score to 0-100 for overall calculation */
  const normalizeScore = useCallback((testId: string, score: number): number => {
    switch (testId) {
      case "digit-span":
        return Math.min((score / 10) * 100, 100);
      case "reaction-time":
        return Math.max(0, Math.min(100, ((1000 - score) / 900) * 100));
      case "stroop":
        return Math.min(score, 100);
      case "sequence-memory":
        return Math.min((score / 12) * 100, 100);
      default:
        return 0;
    }
  }, []);

  /** Overall brain health score (average of normalized completed tests) */
  const overallBrainScore = BRAIN_TESTS.reduce((acc, test) => {
    const latest = getLatest(test.id);
    if (!latest) return acc;
    return acc + normalizeScore(test.id, latest.score);
  }, 0) / Math.max(completedCount, 1);

  const totalRecords = results.length;

  /** Get tier label and color based on score */
  const getTier = useCallback((normalizedScore: number): { label: string; color: string; bg: string } => {
    if (normalizedScore >= 80) return { label: "优秀", color: "text-green-700", bg: "bg-green-50" };
    if (normalizedScore >= 60) return { label: "良好", color: "text-blue-700", bg: "bg-blue-50" };
    if (normalizedScore >= 40) return { label: "一般", color: "text-amber-700", bg: "bg-amber-50" };
    return { label: "需锻炼", color: "text-red-700", bg: "bg-red-50" };
  }, []);

  /** Personalized advice based on test results */
  const getAdvice = useCallback((): string[] => {
    const tips: string[] = [];
    for (const test of BRAIN_TESTS) {
      const latest = getLatest(test.id);
      if (!latest) continue;
      const norm = normalizeScore(test.id, latest.score);
      if (norm < 50) {
        switch (test.id) {
          case "digit-span":
            tips.push("数字记忆较弱：试试背电话号码或车牌号来锻炼短期记忆。");
            break;
          case "reaction-time":
            tips.push("反应速度偏慢：玩一些节奏类游戏或球类运动有助提升。");
            break;
          case "stroop":
            tips.push("认知控制可加强：练习快速切换注意力，试试双任务训练。");
            break;
          case "sequence-memory":
            tips.push("序列记忆待提高：Simon 游戏和记忆翻牌是很好的训练方式。");
            break;
        }
      }
    }
    if (tips.length === 0) {
      tips.push("所有测试表现良好！继续保持规律训练，大脑会越来越灵活。");
    }
    return tips;
  }, [getLatest, normalizeScore]);

  return {
    results,
    totalRecords,
    completedCount,
    comparisonMap,
    overallBrainScore: Math.round(overallBrainScore),
    saveResult,
    clearResults,
    getLatest,
    getPrevious,
    getResultsByTestId,
    getTier,
    getAdvice,
    normalizeScore,
  };
}
