export interface TestResult {
  testId: string;
  testName: string;
  score: number;
  scoreLabel: string;
  details: Record<string, number>;
  timestamp: number;
}

export interface TestConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  duration: string;
  color: string;
}

export const BRAIN_TESTS: TestConfig[] = [
  {
    id: "digit-span",
    name: "数字记忆广度",
    description: "依次展示一串数字，考验你的短期记忆能力。数字越多，难度越大！",
    icon: "Brain",
    route: "/test/digit-span",
    duration: "约 2 分钟",
    color: "from-violet-500 to-purple-600",
  },
  {
    id: "reaction-time",
    name: "反应速度测试",
    description: "屏幕变色瞬间点击，测测你的神经反射速度有多快。",
    icon: "Zap",
    route: "/test/reaction-time",
    duration: "约 1 分钟",
    color: "from-amber-500 to-orange-600",
  },
  {
    id: "stroop",
    name: "斯特鲁普干扰测试",
    description: "字的颜色和字义冲突时，你的大脑需要多少时间来做出正确判断？",
    icon: "Eye",
    route: "/test/stroop",
    duration: "约 2 分钟",
    color: "from-emerald-500 to-teal-600",
  },
  {
    id: "sequence-memory",
    name: "序列记忆挑战",
    description: "记住不断变长的灯光序列，像 Simon 游戏一样挑战你的工作记忆。",
    icon: "Grid3x3",
    route: "/test/sequence-memory",
    duration: "约 3 分钟",
    color: "from-rose-500 to-pink-600",
  },
];
