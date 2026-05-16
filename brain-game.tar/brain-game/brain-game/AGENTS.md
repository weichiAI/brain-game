# web-app Agent 指南（Hono + Vite + React + TypeORM）

默认使用中文沟通与输出，除非用户明确要求其他语言。

## 核心原则

这是一个 Hono + Vite + React + TypeORM 的通用全栈应用项目。维护时始终把它当成用户正在使用的真实业务应用处理。

- 优先完成用户可见、可操作、可验证的业务结果。
- 新功能必须接入真实入口、真实数据流和真实交互，不能只停留在孤立组件、孤立接口或二级页面。
- `/` 与 `client/src/pages/home.tsx` 是第一验收入口。
- 修改 API、数据库、主题、路由、导航或启动逻辑后，必须回看首页是否仍可访问、可渲染、可交互。
- `dist/`、`artifacts/release/`、`.data/`、运行日志和其他生成物不是源码真相，不要手改生成物来修复问题。

## 首页最高优先级

`client/src/pages/home.tsx` 是项目访问入口、用户第一眼看到的体验入口，也是 `/` 路由的验收入口。

- `/` 必须路由到 `home.tsx` 或由它明确承接的首页组件。
- `home.tsx` 不允许为空文件、空组件、仅返回 `null`、仅展示 loading、仅展示技术说明或长期保留初始化占位文案。
- 首页首屏必须有真实业务语义、清晰视觉层级、核心操作入口和可见反馈。
- 首页必须覆盖桌面与移动端关键断点，不能横向溢出、遮挡、错位或出现不可点击主操作。
- 新增业务模块时，先让首页能看见、能进入、能演示核心流程，再补二级页面。
- 判断任务是否完成，优先看 `home.tsx` 和 `/`，不要只看后端、组件库或局部页面是否可用。

## 技术栈与关键入口

- 框架：Hono（Node runtime）+ Vite（单进程开发）
- 前端：React 19 + React Router + Tailwind v4 + shadcn/ui
- 请求层：React Query + fetch
- 契约：Zod（`shared/contracts/routes.ts`，兼容 `shared/routes.ts` re-export）
- 数据库：TypeORM（默认 `DB_TYPE=sqlite` + `./.data/app.db`；切到 Postgres 时使用 `DB_TYPE=postgres` + `DATABASE_URL`）
- 图标：优先使用 `lucide-react`
- 动效：已有 `framer-motion`，列表、弹层、状态切换可优先复用

关键文件：

- `client/src/pages/home.tsx`：首页与 `/` 路由交付入口，最高优先级体验入口
- `client/src/App.tsx`：路由声明入口
- `client/src/main.tsx`、`client/src/providers.tsx`：应用骨架与全局 Provider
- `client/src/theme.css`、`client/src/lib/theme/default-theme.ts`：Design System 落地位置
- `client/src/components/ui/`：shadcn/ui 基础组件，优先复用
- `client/src/hooks/`：客户端 hooks 与 API 查询
- `client/src/lib/imagicma-preview-*.ts`：imagicma 预览支撑代码，默认不要当业务逻辑修改
- `server/app.ts`：Hono 装配入口
- `server/routes/`、`server/controllers/`、`server/models/`、`server/db/`：服务端路由、HTTP 适配、业务与数据库层
- `shared/contracts/`、`shared/types/`、`shared/constants/`：前后端共享契约、纯类型与纯常量

## 任务路线与联动规则

UI 或业务页面：

- 先确认 `/` 首页是否需要承接新业务。
- 开发 UI 前读取 Design System 相关文件。
- 优先修改 `home.tsx`、`App.tsx` 和必要的 `client/src/components/`。
- 验证桌面与移动端，确认首页首屏、主按钮、跳转和异常状态正常。

API 或全栈功能：

- 先定义或更新 `shared/contracts/routes.ts` 的路径、请求、响应 Zod 契约。
- 再接 `server/routes/`、`controllers/`、`services/`、`repositories/`。
- 客户端通过 `client/src/hooks/` 或局部 query 调用共享契约，不要手写散落 path。
- 最后把核心数据流接回首页或明确的业务入口页面。

数据库或持久化：

- 先确认数据库类型。用户未指定且任务确实涉及数据库选型时，必须使用 `question` 工具询问；未获得明确答复时按默认 sqlite。
- Entity、repository、service 和运行时配置必须一致，禁止手写临时 SQL 与 ORM entity 并行漂移。
- 新增 entity 时，同步 repository、service、数据库初始化逻辑，并确认 sqlite 与 postgres 差异。

启动、端口、预览或发布：

- 先读 `scripts/imagicma-*.mjs`、`.imagicma/runtime.env`、`vite.config.ts`、`server/index.ts` 的现状。
- 默认不要修改受保护启动文件；只有用户明确要求修复启动、端口、预览、日志或发布流程时才可以动。
- 修改后必须验证 dev/start/build/release 相关路径，而不是只跑类型检查。

## 架构契约

典型请求链路：

```text
client page/component
  -> client hook / fetch helper
  -> shared/contracts/routes.ts
  -> server/routes
  -> server/controllers
  -> server/models/services
  -> server/models/repositories
  -> server/models/entities
```

分层职责：

- `routes/` 只做 URL 到 controller 的绑定。
- `controllers/` 只做 HTTP 适配、请求解析、响应 schema 校验和错误响应。
- `services/` 写业务规则、流程编排和跨 repository 协作。
- `repositories/` 写数据库访问，不承载业务决策。
- `entities/` 是 TypeORM 持久化结构真相。
- `shared/` 只能放浏览器和 Node 都能安全运行的契约、类型和常量。

禁止把 TypeORM entity、Node API、Hono Context、数据库连接、密钥读取等服务端专属代码放进 `shared/`。

## UI 与 Design System

- 若存在 `docs/designer/style_guide/DESIGN.md`，开发 UI 前必须先读取并遵循它；它是当前项目用户选择的 Design System。
- 若存在 `docs/designer/style_guide/theme.json`，优先使用其中的主题元数据，并结合 `docs/designer/style_guide/DESIGN.md` 落实视觉 token。
- Tailwind class 优先使用 `bg-primary`、`bg-primary-container`、`text-on-background`、`font-headline`、`font-body`、`font-label`、`rounded-xl`、`shadow-theme-raised` 等语义能力。
- 新增或修改页面时，至少让颜色、字体、圆角、间距、阴影中的三类视觉决策受当前 Design System 影响。
- 优先复用现有 token；只有新增明确语义视觉能力时才扩展 token，避免为一次性样式制造 token。
- 优先复用 `client/src/components/ui`、`client/src/hooks` 和已有布局模式，避免重复造基础控件。
- 交互状态要完整覆盖 hover、focus、disabled、loading、error、success。
- 不要退回默认 shadcn 黑白样式，不要把首页做成纯技术说明页。

## 数据、契约与安全

- API 请求参数、请求体和响应都应通过 `shared/contracts/routes.ts` 或其 re-export 中的 Zod schema 表达。
- 服务端返回成功响应前必须执行响应 schema 校验。
- 客户端读取 API 响应后必须按共享 schema parse，不要信任裸 JSON。
- 错误响应要有稳定结构，避免把堆栈、连接串、密钥或内部路径暴露给前端。
- 不要把密钥、数据库连接、服务端环境变量读取逻辑放入 `client/` 或 `shared/`。

## 启动、端口与预览

常用命令：

- `pnpm dev`：单进程开发（Vite + Hono dev middleware）
- `pnpm build`：构建前端并编译 server，同时准备 release artifact
- `pnpm start`：生产启动
- `pnpm check`：类型检查
- `pnpm lint`：ESLint

平台约束：

- 禁止修改 `package.json` 中 `scripts.dev` 与 `scripts.start`，以及对应 `predev`、`prestart`，除非用户明确要求修复启动流程。
- 禁止主动注入环境变量到 `process.env` 来绕过配置契约。
- 端口契约只允许使用大写 `PORT`。
- 运行时端口读取顺序固定为：外部环境变量 `PORT` -> 项目内 `.imagicma/runtime.env`。
- 预览地址规则固定为 `https://{port}.preview.imagicma.cn`，其中 `port` 为实际启动端口。
- 在 imagicma 平台环境中，如有 `restart_workflow`，启动项目应优先使用它；本地 Codex 或普通终端环境没有该工具时，可读取 `.imagicma/runtime.env` 后使用项目脚本启动，不要直接绕过脚本执行 `vite` 或 `node dist/server/index.js`。

## 慎改区域

- 默认不要修改 `scripts/imagicma-{common,guard,dev,start,runtime-logs}.mjs`。
- 默认不要删除、改名或混入业务状态到 `client/src/lib/imagicma-preview-*.ts`。
- 若维护 `docs/project_state.json`，每次写入前先读取最新版本；若写入报冲突或发现文件已变更，必须重新读取后重试。
- `quality_gates.typecheck=true` 仅在 `pnpm check` 真实通过后设置。
- `quality_gates.build=true` 仅在 `pnpm build` 真实通过后设置。

## 验证与完成标准

按任务类型选择验证，不要只跑一个命令就结束：

- TypeScript 或契约改动：运行 `pnpm check`。
- UI 或首页改动：运行 `pnpm run check:delivery`，并本地打开 `/`，检查桌面与移动端关键断点、主操作、跳转、loading/error/empty 状态。
- API 改动：验证共享 schema、服务端响应 parse、客户端调用和失败反馈。
- 数据库改动：验证 entity/repository/service 链路，确认默认 sqlite 可运行；涉及 Postgres 时说明是否已验证连接。
- 启动、端口、预览或发布改动：验证 `pnpm build`，并检查启动脚本、端口读取和 release artifact。

只有以下全部满足才允许结束：

- `/` 首页可访问，展示真实、可见、可交互的内容。
- `home.tsx` 没有退化为空白、占位说明页或不可演示状态。
- `pnpm run check:delivery` 通过，确认没有保留模板初始首页。
- 核心流程从首页可以进入并完成。
- 页面跳转后正常打开，非 404。
- 按钮、表单、列表等关键交互可点击并有反馈。
- 关键日志无阻塞级错误。
- UI 达到可演示级，且桌面与移动端无明显溢出或遮挡。
- 与本次改动匹配的验证命令已运行；通常至少包括 `pnpm check`，发布或启动相关改动还需要 `pnpm build`。
