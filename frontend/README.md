# 蕉幻 (Banana Slides) 前端

这个目录是 Banana Slides SaaS 的 Web 前端，负责账号体系、项目创建与编辑、积分购买、管理后台，以及最终导出流程的交互层。

## 当前前端定位

前端不是单页演示，而是一个完整的 SaaS 控制台，覆盖以下能力：

- 公开落地页与注册登录流程
- 受保护的项目工作台
- 大纲编辑、描述编辑、图片预览三阶段编辑流
- 积分与定价页面
- 邀请码入口
- 用户设置页
- 管理后台（用户、订单、交易、系统配置）
- 导出任务面板与异步任务状态反馈

## 技术栈

- React 18
- TypeScript
- Vite
- React Router 6
- Zustand
- Tailwind CSS
- Axios
- i18next
- @dnd-kit
- Vitest + Testing Library
- Playwright

## 前端架构

### 1. 路由层

入口在 `src/App.tsx`，按三类路由组织：

- 公开路由：`/`、`/login`、`/register`、`/forgot-password`、`/reset-password`、`/verify-email`
- 登录后路由：`/app`、`/history`、`/settings`、`/pricing`、`/credits`、`/invitation`
- 项目编辑路由：`/project/:projectId/outline`、`/project/:projectId/detail`、`/project/:projectId/preview`
- 管理后台路由：`/admin`、`/admin/users`、`/admin/transactions`、`/admin/orders`、`/admin/config`

`ProtectedRoute` 负责普通登录保护，`AdminRoute` 负责管理员权限保护。

### 2. 状态层

前端状态主要分成三块：

- `src/store/useAuthStore.ts`
  - 管理用户信息、access token、refresh token、remember me
  - token 会根据“记住我”存入 `localStorage` 或 `sessionStorage`
- `src/store/useProjectStore.ts`
  - 管理当前项目、页面编辑、本地乐观更新、异步任务轮询、导出触发
  - 聚合了创建项目、上传模板、生成大纲、生成描述、生成图片、图片编辑、导出等核心流程
- `src/store/useExportTasksStore.ts`
  - 管理导出任务面板中的 `pptx` / `pdf` / `editable-pptx`

### 3. API 层

`src/api/` 按职责拆分：

- `client.ts`：Axios 实例与基础拦截器
- `auth.ts`：登录、刷新 token、认证校验、积分刷新
- `endpoints.ts`：项目、页面、设置、参考文件、用户模板、导出、管理员接口
- `payment.ts`：支付相关接口
- `adminApi.ts`：管理端聚合接口

前端使用相对路径访问后端 API，开发环境通过 Vite 代理，生产环境通过 Nginx 反向代理。

### 4. 页面分层

- `src/pages/`
  - 面向最终路由页面
- `src/components/shared/`
  - 通用 UI 与跨页面业务组件
- `src/components/auth/`
  - 认证相关组件
- `src/components/admin/`
  - 管理后台组件
- `src/components/outline/`
  - 大纲编辑组件
- `src/components/preview/`
  - 预览与描述卡片组件

### 5. 国际化

- 文案定义在 `src/locales/zh.json` 和 `src/locales/en.json`
- i18n 初始化在 `src/i18n.ts`
- `App.tsx` 会根据语言同步页面标题和 `<html lang>`

## 关键业务流

### 1. 创建项目

`useProjectStore.initializeProject()` 支持三种输入方式：

- `idea`
- `outline`
- `description`

创建后会按需执行：

- 关联参考文件
- 上传模板图
- 从描述直接生成大纲和页面描述
- 拉取完整项目并写入本地状态

### 2. 项目编辑三阶段

- `OutlineEditor`
  - 编辑页面结构
  - 拖拽排序
  - 单次 AI refine 大纲
- `DetailEditor`
  - 批量或逐页生成描述
  - 手动修改描述
  - 二次 refine 描述
- `SlidePreview`
  - 生成与重生成图片
  - 使用自然语言编辑图片
  - 查看历史版本
  - 导出 PPTX / PDF / 可编辑 PPTX

### 3. 素材与参考文件

前端支持两类额外输入：

- 用户模板图：`/api/user-templates`
- 参考文件：`/api/reference-files/*`

参考文件可上传、解析、关联到项目，供后端生成流程使用。

### 4. 账号与商业化

前端已包含完整 SaaS 用户侧能力：

- 注册、登录、忘记密码、重置密码、邮箱验证码校验
- 定价页与积分历史页
- 支付下单
- 邀请码兑换
- 用户设置页

### 5. 管理后台

管理员界面包含：

- 仪表盘
- 用户管理
- 交易记录
- 订单管理
- 系统配置

系统配置不仅包含模型和生成参数，也包含积分成本和“普通用户允许修改哪些设置项”的策略。

## 项目结构

```text
frontend/
├── src/
│   ├── api/                    # 后端接口封装
│   ├── components/
│   │   ├── admin/             # 管理后台组件
│   │   ├── auth/              # 认证与路由保护
│   │   ├── history/           # 历史项目卡片
│   │   ├── outline/           # 大纲编辑组件
│   │   ├── preview/           # 预览与描述卡片
│   │   └── shared/            # 通用业务组件
│   ├── config/                # 预设风格等静态配置
│   ├── hooks/                 # 滚动、主题、翻译等 hooks
│   ├── locales/               # 中英文文案
│   ├── pages/                 # 路由页面
│   ├── store/                 # Zustand 状态管理
│   ├── tests/                 # 组件和 store 单测
│   ├── types/                 # 类型定义
│   ├── utils/                 # 工具函数
│   ├── App.tsx                # 路由入口
│   ├── i18n.ts                # 国际化初始化
│   └── main.tsx               # 挂载入口
├── public/                    # Logo、预设预览、默认模板
├── e2e/                       # Playwright 测试
├── vite.config.ts
└── nginx.conf
```

## 本地开发

### 1. 安装依赖

```bash
cd frontend
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

默认启动在 `http://localhost:3000`。

### 3. 构建生产包

```bash
npm run build
```

### 4. 代码检查与测试

```bash
npm run lint
npm run test:run
npm run test:e2e
```

## 与后端的约定

- 前端默认通过相对路径访问后端
- 登录态依赖 Bearer Token
- 项目与导出类操作大量使用异步任务，前端负责轮询任务状态并刷新项目数据
- 设置页会根据后端返回的 `_editable_fields` 动态决定普通用户可见和可编辑的配置项

## 维护重点

- 新增页面时，优先考虑放在 `pages/`，复用逻辑放入 `components/` 或 `store/`
- 涉及项目状态的改动，先检查 `useProjectStore.ts`
- 涉及登录态、token、记住我逻辑的改动，先检查 `useAuthStore.ts` 和 `api/auth.ts`
- 新增 API 时，优先补到 `src/api/endpoints.ts`，避免页面里直接写请求
