# 每页不同模板功能开发交接

> 交接日期：2026-06-22  
> 功能别名：per-page-template / 统一页级模板系统  
> 当前状态：有 PRD 和前端原型；后端持久化、真实生成链路、AI 解析与匹配尚未实现。

## 1. 资料在哪里

### 1.1 原始 PRD

原始设计资料在本机下载目录的压缩包里：

```bash
tar -xOzf ~/Downloads/per-page-template.tar.gz per-page-template-pack/docs/prd-per-page-template.md
```

压缩包结构：

```text
per-page-template-pack/
  docs/prd-per-page-template.md
  code/commits.txt
  code/changed-files.txt
  code/changes-vs-main.patch
  sessions/
```

注意：`code/changes-vs-main.patch` 是旧基线下导出的 diff，里面可能混入大量历史噪声。真正判断旧分支当前有效差异时，以远程分支对当前 `origin/main` 的三点 diff 为准。

### 1.2 旧实现分支

远程分支：

```bash
git fetch origin --prune
git show --no-patch --decorate --oneline origin/feat/per-page-template
git diff --name-status origin/main...origin/feat/per-page-template
```

当前远程 HEAD：

```text
8f940d4 origin/feat/per-page-template tmp commit
```

本机已检出的旧分支 worktree：

```text
/Users/davidyang/banana-slides-per-page-template
```

该 worktree 当前跟踪：

```text
feat/per-page-template -> origin/feat/per-page-template
```

### 1.3 旧分支中最相关的文件

当前相对 `origin/main` 的有效差异主要是这 8 个文件：

```text
frontend/src/components/preview/PageFineTuneDrawer.tsx
frontend/src/pages/SlidePreview.tsx
frontend/src/pages/Home.tsx
frontend/src/pages/DetailEditor.tsx
frontend/src/store/useProjectStore.ts
frontend/src/types/index.ts
frontend/e2e/fine-tune-drawer.spec.ts
frontend/e2e/drawer-screenshot.spec.ts
```

重点看：

- `PageFineTuneDrawer.tsx`：右侧“页面精调”抽屉原型，包含模板库、选择模板、描述编辑、附加字段编辑。
- `Home.tsx`：创建项目时选择单模板 / 多模板。
- `useProjectStore.ts`：创建项目后把 `template_mode_${projectId}` 写入 `localStorage`，只是临时 mock。
- `types/index.ts`：已经预留了 `TemplateAsset`、`TemplateMatchResult`、页级模板字段等前端类型。
- `fine-tune-drawer.spec.ts`：验证抽屉打开、模板上传/绑定、描述编辑持久化、单模板模式隐藏模板区。
- `drawer-screenshot.spec.ts`：用于人工视觉检查抽屉默认宽度、拖拽宽度、截图。

## 2. 当前 spec 已经确定了什么

已有 PRD 明确了产品方向和核心概念：

1. 从“项目级单模板”升级为“统一页级模板系统”。
2. 底层始终按“每页有自己的模板”建模；单模板只是批量赋值。
3. 模板不影响页面描述内容，只影响图片生成和展示样式。
4. 流程规划为：

```text
Home -> OutlineEditor -> DetailEditor -> TemplateSetupPage -> SlidePreview
```

5. 模板模式：
   - 单模板模式：一次选择模板，批量应用到所有页面。
   - 多模板模式：每页独立管理图片模板和文字模板。
   - 单模板可以升级为多模板；多模板不能降回单模板。
6. “无模板”不再是独立模式，归一为“只填文字模板”。
7. 每页有两个模板槽位：
   - `template_asset_id`：引用项目模板库中的图片模板。
   - `template_style_text`：页级文字风格描述。
8. 项目模板库模型为 `project_template_assets`，模板资产可被多页复用，每页最多选择一个图片模板。
9. 页面表计划新增：
   - `template_asset_id`
   - `template_style_text`
   - `template_selection_source`
   - `template_match_reason`
   - `template_match_confidence`
10. TemplateSetupPage 负责模板上传、模板解析、用户标记、自动匹配、手动修正、删除模板。
11. 自动匹配是全项目一次 LLM 调用，不逐页调用。
12. 删除被引用模板时，所有引用页清空该模板并进入未确认状态。
13. 图片生成时优先读取页级模板，再兼容项目级模板。

## 3. 当前 spec 尚未确定什么

PRD 明确列出的未决事项：

1. `TemplateSetupPage` 是否必经，是否允许跳过直接进入 `SlidePreview`。
2. 模板解析失败后的降级策略：解析失败的模板是否仍可手动选择。
3. PDF 拆页实现：复用 `file_parser_service.py`，还是新增专用解析链路。
4. 模板解析 prompt 设计，如何稳定输出固定 schema。
5. 自动匹配 prompt 设计，尤其是全项目上下文的 token 限制和截断策略。
6. 单模板模式下 `TemplateSetupPage` 的简化形态：展示简化版，还是直接跳过。

工程层面还缺少这些明确约定：

1. 后端 API 的 request/response schema。
2. 数据库 migration 和旧项目 backfill 策略。
3. 创建项目时何时把项目级模板批量写入页级模板字段。
4. 图片生成链路如何把页级图片模板和文字模板传给现有 AI provider。
5. 模板图片上传后的文件目录、URL 生成、缩略图生成、安全校验。
6. 旧前端原型的 `localStorage` 数据是否迁移；建议不迁移，只作为旧 demo。
7. 第一版 MVP 是否包含 AI 解析、自动匹配、PDF 拆页；建议第一版先不包含。
8. 后端、前端、E2E 的验收标准还没有写成正式工程 spec。

## 4. 已经做了什么

### 4.1 产品设计

已有一份 PRD，覆盖：

- 产品定位
- 页面流程
- 模板模式
- 项目模板库
- 页级模板字段
- TemplateSetupPage 职责
- 自动匹配与单页匹配
- 手动选择模板
- 删除模板
- 与现有功能兼容策略
- 未决事项

这份 PRD 是目前最完整的产品资料。

### 4.2 前端原型

旧分支已经做了一个可交互的前端原型：

- 首页可以选择“统一模板 / 多模板”。
- `SlidePreview` 里接入了右侧“页面精调”抽屉。
- 多模板模式下，抽屉展示：
  - 当前页模板选择
  - 文字风格要求
  - 项目模板库
  - 上传模板图片
  - 删除模板
  - 更换模板
- 抽屉总是展示：
  - 当前页描述编辑
  - 附加字段编辑
- 抽屉宽度可拖拽，并持久化宽度。
- 有 E2E smoke tests 覆盖原型基本交互。

### 4.3 临时存储方式

旧前端原型没有后端支持，使用 `localStorage` mock：

```text
template_mode_${projectId}
template_assets_${projectId}
page_template_assign_${projectId}
page_fine_tune_drawer_width
```

这些是 demo 方案，不应作为最终设计。

### 4.4 本机演示环境

旧分支 worktree 曾按以下端口启动过：

```text
frontend: http://localhost:3465
backend:  http://localhost:5465
```

screen 名称：

```text
banana-per-page-frontend
banana-per-page-backend
```

如果需要重新启动，建议先确认端口和 `.env`：

```bash
cd /Users/davidyang/banana-slides-per-page-template
rg -n '^(BACKEND_PORT|FRONTEND_PORT)=' .env
lsof -iTCP:5465 -sTCP:LISTEN -n -P
lsof -iTCP:3465 -sTCP:LISTEN -n -P
```

## 5. 还要做什么

建议不要直接 merge 旧分支。旧分支基线很老，且旧 tar 里的 patch 有大量历史噪声。推荐从最新 `main` 新开分支，然后按模块重做/摘取。

### 5.1 先补工程 spec

建议新增一份工程 spec，例如：

```text
docs/superpowers/specs/2026-06-22-per-page-template-backend-design.md
```

必须写清：

- MVP 范围
- 数据库模型
- API schema
- 文件存储策略
- 生成链路优先级
- 前端替换 localStorage 的方案
- 测试验收标准

建议 MVP 范围：

1. 持久化 `template_mode`。
2. 持久化项目模板库。
3. 持久化页级 `template_asset_id` / `template_style_text`。
4. 图片生成时真正读取页级模板。
5. 前端抽屉改为真实 API。

暂缓：

- AI 解析模板
- 自动匹配
- PDF 拆页上传
- TemplateSetupPage 完整新页面

### 5.2 后端数据模型

需要新增或调整：

- `projects.template_mode`
- `project_template_assets` 表
- `pages.template_asset_id`
- `pages.template_style_text`
- `pages.template_selection_source`
- `pages.template_match_reason`
- `pages.template_match_confidence`

建议约束：

- `template_asset_id` 外键指向 `project_template_assets.id`，删除模板时清空引用页。
- `template_mode` 默认为 `single`。
- 旧项目没有页级模板时，保持项目级模板兼容，不强制迁移。

### 5.3 后端 API

建议第一版 API：

```text
GET    /api/projects/:projectId/template-assets
POST   /api/projects/:projectId/template-assets
PATCH  /api/projects/:projectId/template-assets/:assetId
DELETE /api/projects/:projectId/template-assets/:assetId

PATCH  /api/projects/:projectId/template-mode
PATCH  /api/projects/:projectId/pages/:pageId/template
```

第一版不一定需要自动匹配 API。

后续再加：

```text
POST /api/projects/:projectId/template-assets/:assetId/analyze
POST /api/projects/:projectId/templates/auto-match
POST /api/projects/:projectId/pages/:pageId/template/auto-match
```

### 5.4 文件和缩略图

模板上传需要落地：

- 文件保存目录
- 图片类型校验
- 文件名安全处理
- 缩略图生成
- 返回可访问 URL
- 删除模板时删除对应文件和缩略图

可以复用现有 file/material/template 上传工具，但要避免把“用户模板”和“项目模板资产”混成一张表。

### 5.5 图片生成链路

生成图片时的模板优先级建议：

1. 当前页 `template_asset_id` 对应图片。
2. 当前页 `template_style_text`。
3. 项目级 `template_image_path`。
4. 项目级 `template_style`。
5. 无模板。

需要检查并修改：

- `backend/services/task_manager.py`
- `backend/services/ai_service.py`
- `backend/services/prompts.py`
- 相关 image provider 输入结构

目标是：重新生成单页图片时可以真正使用该页自己的模板图片和文字风格。

### 5.6 前端接 API

替换旧原型里的 `templateLocalStore`：

- `listAssets` -> `GET template-assets`
- `saveAssets` -> 上传 / PATCH / DELETE API
- `getAssignment` -> 从 `page` 字段读取
- `setAssignment` -> `PATCH page template`
- `template_mode_${projectId}` -> `project.template_mode`

保留旧抽屉 UX 时，要特别检查：

- 页面切换时状态刷新
- 上传模板后自动绑定当前页
- 删除模板后当前页 UI 清空
- 刷新页面后模板仍然存在
- 单模板模式隐藏或简化模板区

### 5.7 测试

项目要求真实验证，不能只写 mock。

建议测试分层：

后端单元 / 集成：

- 创建项目时保存 `template_mode`
- 上传模板资产并返回 URL
- 修改模板标记
- 删除模板时清空引用页
- PATCH 页级模板字段后重新 GET 项目能回显
- 图片生成任务读取页级模板优先级

前端 E2E：

- 首页选择多模板创建项目，预览页显示模板区。
- 上传模板图片，模板卡片出现。
- 给当前页选择模板，刷新后仍然选中。
- 修改页级文字模板，刷新后仍然存在。
- 删除被引用模板，引用页模板清空。
- 单模板模式下模板区按 spec 隐藏或简化。

真实生成链路：

- 至少跑一次真实后端任务，验证页级模板被送入生成逻辑。
- 如果成本高，可用小页数项目，但不能只依赖 mock。

## 6. 推荐实施顺序

1. 新建最新 `main` 分支，不直接 merge 旧分支。
2. 写工程 spec，确认 MVP 不含 AI 解析/自动匹配/PDF 拆页。
3. 后端 migration + model。
4. 后端 API。
5. 后端测试。
6. 接入生成链路。
7. 从旧分支移植/重写前端抽屉 API 接入。
8. E2E 覆盖持久化和刷新回显。
9. 再考虑 TemplateSetupPage、AI 解析、自动匹配。

## 7. 风险和注意事项

- 旧分支较老，不适合直接合并。
- 旧 tar 的 patch 不是干净实现，不能直接套。
- 旧前端原型把关键数据存在 `localStorage`，只适合 demo。
- PRD 规划了完整智能系统，但第一版最好先做稳定的后端闭环。
- 自动匹配和模板解析依赖 prompt 稳定性，应单独做一轮设计和真实测试。
- 删除模板、生成链路、旧项目兼容是最容易出数据一致性问题的地方。

## 8. 最小验收口径

第一版完成可以按以下标准验收：

1. 用户创建多模板项目。
2. 用户上传至少两张项目模板图。
3. 用户给不同页面选择不同模板图。
4. 用户给某页填写页级文字模板。
5. 刷新页面后模板选择和文字模板仍然存在。
6. 重新生成某一页时，后端实际读取该页模板。
7. 删除某模板后，引用它的页面模板字段被清空。
8. 单模板旧流程不被破坏。
9. 后端测试、前端测试、E2E 均通过。

