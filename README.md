# 脑力测试小程序 🧠

你的脑子被 AI 吃掉了吗？测测就知道。

## 功能

- **数字记忆广度** — 依次展示数字序列，考验短期记忆能力
- **反应速度测试** — 屏幕变色瞬间点击，测神经反射速度
- **斯特鲁普干扰测试** — 文字颜色与含义冲突时的认知控制能力
- **序列记忆挑战** — Simon 风格灯光序列记忆
- **脑力报告** — 综合评分、分项评估、历史趋势图、个性化建议
- **海报生成** — 一键生成脑力报告海报并下载分享

## 快速开始

```bash
pnpm install
pnpm dev        # 开发模式
```

## 生产部署

```bash
pnpm build      # 构建
pnpm start      # 启动（默认端口 3000，可通过 PORT 环境变量覆盖）
```

部署到服务器时：

```bash
PORT=8080 pnpm start
```

或者使用 Docker：

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN pnpm install && pnpm build
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
```

## 技术栈

- 前端：React 19 + React Router + Tailwind CSS v4 + shadcn/ui + Framer Motion
- 后端：Hono (Node.js)
- 数据层：TypeORM（默认 SQLite）
- 图表：html-to-image（海报生成）
- 状态管理：React Query + localStorage

## 目录结构

```
.
├── client/               # 前端
│   └── src/
│       ├── components/   # 组件
│       ├── hooks/        # 自定义 hooks
│       ├── lib/          # 工具
│       └── pages/        # 页面
├── server/               # 后端
│   ├── controllers/      # HTTP 适配
│   ├── routes/           # 路由
│   ├── models/           # 数据模型
│   └── db/               # 数据库配置
├── shared/               # 前后端共享
│   ├── types/            # 类型
│   └── constants/        # 常量
└── dist/                 # 构建产物
```
