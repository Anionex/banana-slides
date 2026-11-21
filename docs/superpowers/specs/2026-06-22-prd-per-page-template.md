# PRD：每页不同模板功能（统一模板系统改造）

> 来源：2026-03-22 ~ 03-23 Codex session 设计讨论整理，以最终确认的方案为准。

---

## 1. 功能定位

将当前"项目级单模板"方案升级为**统一的页级模板系统**。底层始终按"每页有自己的模板"建模；单模板模式只是批量赋值的语法糖。

### 核心原则

- **内容优先**：模板不影响页面描述内容，只影响图片生成和展示样式
- **AI 先做，用户有主导权**：AI 负责解析和匹配，用户可查看、纠正、覆盖所有 AI 产出

---

## 2. 流程总览

```
Home → OutlineEditor → DetailEditor → TemplateSetupPage（新增） → SlidePreview
```

- `Home`：内容输入、创建项目、选择模板模式（单模板 / 多模板）
- `OutlineEditor`：大纲编辑
- `DetailEditor`：描述编辑（内容层）
- **`TemplateSetupPage`**：模板资产管理 + 模板匹配（新增页面，本功能核心）
- `SlidePreview`：最终预览与导出

### 为什么放在 DetailEditor 之后

- 模板自动匹配依赖页面真实内容和信息密度，DetailEditor 结束时这些信息才稳定
- 用户此时最能判断模板库是否充足、AI 标签是否准确
- 符合"内容优先"原则：先定内容，再选模板

---

## 3. 模板模式

### 3.1 两种模式

| 模式 | 说明 |
|------|------|
| **单模板模式** | 用户选择一次模板（图片 + 文字），自动应用到所有页面的模板字段 |
| **多模板模式** | 每页各自管理自己的模板（图片模板 + 文字模板） |

**底层数据语义**：无论何种模式，数据库始终以"每页一个 `template_asset_id` + `template_style_text`"形态存储。**单模板模式仅表示当前所有页面的两个字段恰好取同一组值**——它是 UI hint，不是独立的数据形态。这意味着模式切换不需要数据结构迁移，只是覆盖或同步页级字段。

### 3.2 模式切换规则（决策 7，2026-06-22）

> 本节修订自原 PRD"多模板 → 单模板不允许"的规则，改为全阶段双向可切。

**候选方案：**
- A) 维持原 PRD：单→多允许，多→单禁止
- B) 单→多允许，多→单允许；多→单时让用户从现有模板里选一个作统一模板，其余页级数据被覆盖
- C) 全阶段双向切换；多→单时让用户从现有模板里选一个作统一模板，其余页级数据被覆盖；数据层始终是"每页一个模板"，模式只是 UI hint
- D) 全阶段双向切换；多→单时清空所有页级数据，要求用户重新选一个统一模板
- E) 全阶段双向切换；多→单时保留页级数据，仅 UI 层屏蔽，切回多模板时数据原样恢复

**选择：C**

**理由：**
- 选 C：与 PRD 第 1 节"底层始终按每页有自己的模板建模"的核心原则保持一致；让用户选一张现有模板作为统一模板，既避免丢失模板库，又把覆盖动作显式化。
- 不选 A：用户在多模板模式下工作了一阵才发现"想统一"被锁定无法回退；且既然底层每页一份，UI 切换不应有不可逆约束。
- 不选 B：与 C 相比少了"数据语义统一"的声明，工程实施时仍会困惑"切到单模板时是否要写项目级 `template_image_path`"。
- 不选 D：强制清空粗暴；用户可能就是想"统一成现在的某一张"，清空让操作成本变高。
- 不选 E：UI 隐藏但数据保留，切回多模板时"突然冒出一堆模板"对用户是惊吓，违背"模式只是 UI hint"原则。

**切换规则：**
- 项目创建时可选单模板或多模板
- **单 → 多**：仅切换 `template_mode = 'multi'`，所有页继承当前已选模板（保持现状）
- **多 → 单**：弹"选择统一模板"弹层（可从模板库选 / 新上传） → 用户确认 → 后端把所选模板批量写入所有页 `template_asset_id` 和 `template_style_text`（覆盖已有页级值） → `template_mode = 'single'`
- **已生成的图片不受切换影响**：切换只改字段，已生成的 `generated_image_url` 保留；用户重新生成该页时才使用新模板

**切换入口：**
- 单模板用户：`DetailEditor` / `SlidePreview` 顶部模板控制区有 `转为多模板` 按钮
- 多模板用户：`TemplateSetupPage` / `SlidePreview` 顶部模板控制区有 `转为单模板` 按钮（对称）

**数据层约定：** `projects.template_mode` 字段只控制 UI 渲染分支，不影响 `pages.template_asset_id` / `pages.template_style_text` 的读写。

### 3.3 "无模板"不再独立存在

旧的"无模板模式"统一为"只填文字模板"的状态。三种模式归一：
- 单模板 = 批量赋同一组模板值
- 多模板 = 逐页管理
- 无模板 = 所有页只有文字模板

---

## 4. 每页模板输入定义

每页有两个模板槽位：

| 字段 | 说明 |
|------|------|
| 图片模板 | 引用项目模板库中的一个模板资产（`template_asset_id`） |
| 文字模板 | 页级文字风格描述（`template_style_text`） |

### 合法状态（至少选一个）

1. 仅图片模板
2. 仅文字模板
3. 图片模板 + 文字模板

**禁止状态**：图片和文字都为空

### 多模板模式门禁

- 多模板模式下，**所有页面都必须选择了模板（非未确认状态），才能进入下一步**（SlidePreview）

---

## 5. 项目模板库

### 5.1 数据模型：`project_template_assets`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 主键 |
| `project_id` | string | 所属项目 |
| `image_path` | string | 模板图片路径 |
| `thumb_path` | string | 缩略图路径 |
| `analysis_status` | enum | `pending / processing / completed / failed` |
| `analysis_json` | json | 结构化解析结果（见 5.3） |
| `analysis_notes` | string | AI 自由文本补充 |
| `user_label` | string | 用户手动标记（如"封面图""对比页""目录模板"） |
| `sort_order` | int | 排序 |
| `created_at` | datetime | 创建时间 |

### 5.2 核心关系

- 一个项目有多个模板资产
- **一个模板资产可被多个页面复用**（非 1:1 绑定）
- 每页最多选一个图片模板

### 5.3 模板解析结果 schema

上传后 AI 自动异步解析，输出结构化 JSON：

```json
{
  "summary": "顶部标题 + 中部双栏正文 + 底部结论",
  "template_type": "content",
  "layout_structure": "title-top-two-column",
  "content_capacity": "medium",
  "text_regions": [
    { "role": "title", "count": 1 },
    { "role": "body", "count": 2 }
  ],
  "image_regions": [
    { "role": "illustration", "count": 1 }
  ],
  "visual_density": "medium",
  "style_keywords": ["academic", "clean", "blue"],
  "notes": "右下角有固定 logo 区域"
}
```

- 固定字段用于程序逻辑和自动匹配
- `notes` 字段承载 AI 无法很好结构化的观察
- **用户可在 TemplateSetupPage 直接修改解析结果**

### 5.4 模板上传方式

1. **逐张上传图片**
2. **上传 PDF 自动拆页**：系统自动解析 PDF 每页图片，全部加入项目模板库

### 5.5 用户标记

- 每个模板资产可带持久化标记，如：`封面图`、`目录模板`、`A/B 对比页`、`章节过渡页` 等
- 标记信息提供给 AI 自动匹配作为选择参考
- 在 TemplateSetupPage 编辑

---

## 6. 页级模板字段

在 `pages` 表上新增：

| 字段 | 类型 | 说明 |
|------|------|------|
| `template_asset_id` | string / null | 引用的图片模板 |
| `template_style_text` | string / null | 页级文字模板 |
| `template_selection_source` | enum | `manual / auto / batch_apply` |
| `template_match_reason` | string / null | 自动匹配理由 |
| `template_match_confidence` | number / null | 自动匹配置信度 |

### 状态判定

| 状态 | 条件 |
|------|------|
| 已确认 | `template_asset_id` 非空，或 `template_style_text` 非空 |
| 未确认 | 两者都为空，或自动匹配返回 `undecided` |

---

## 7. TemplateSetupPage（新增页面）

### 7.1 页面职责

这是 `DetailEditor` 之后、`SlidePreview` 之前的正式步骤，负责：

1. 选择模板模式（如果还没选）
2. 上传模板：逐张图片 / 上传 PDF 拆页
3. 展示模板缩略图列表
4. 展示 AI 解析结果（上传后立即异步解析）
5. 编辑模板标记和版式描述（用户可纠正 AI 解析）
6. 一键自动匹配模板到页面
7. 手动修正个别页的模板选择
8. 删除模板
9. 查看解析状态
10. 确认完成后进入 SlidePreview

### 7.2 模板卡片布局

每张模板资产展开显示：
- 缩略图
- 用户标记字段
- AI 解析的版式结构（可编辑）
- 解析状态指示

---

## 8. 自动匹配多页模板

### 8.1 匹配方式

- **全项目一次性 LLM 调用**，不是逐页单独匹配
- 输入：全部模板库及其解析信息 + 全部页面的标题/描述摘要/页码位置/内容密度
- 输出：每页的结构化匹配结果 JSON

### 8.2 输出格式

```json
[
  {
    "page_id": "...",
    "template_asset_id": "tpl_003",
    "status": "matched",
    "confidence": 0.86,
    "reason": "内容密度中等，双栏结构，适合该正文模板"
  },
  {
    "page_id": "...",
    "template_asset_id": null,
    "status": "undecided",
    "confidence": 0.32,
    "reason": "当前模板库中没有适合高密度时间线内容的模板"
  }
]
```

### 8.3 前置条件

- **要求所有页面都已有描述**
- 若存在缺描述的页面，不执行匹配，弹提示：  
  > "还有 N 页缺少描述，建议先生成/编辑描述后再自动匹配模板"

### 8.4 覆盖逻辑

- **默认覆盖所有页面的模板选择**
- 点击时弹确认框，提示会覆盖当前模板选择
- 确认框提供可选项：`保留已有模板选择`（勾选后跳过 `template_asset_id` 非空的页面）
- 如果 LLM 返回 `undecided`，**清空该页旧模板**，标记为"未确认模板"

### 8.5 匹配结果处理

- 自动匹配成功的页面：**直接视为已确认**（无需逐页二次确认）
- `undecided` 的页面：视为未确认
- 匹配结果直接写库

---

## 9. 单页自动匹配

### 9.1 入口

每个页面卡片工具栏里的 `自动匹配模板` 按钮（类似"单页生成描述"的心智模型）

### 9.2 前置条件

- **只要求当前页有描述**，不受其他页是否缺描述影响

### 9.3 覆盖逻辑

- 如果当前页已有模板，弹确认框：  
  > "自动匹配将覆盖当前页已选择的模板，确定继续吗？"
- 确认框支持勾选 `下次不再提示`（本地偏好存储）

---

## 10. 手动选择模板

### 10.1 入口

每个页面卡片下方工具栏（编辑、重新生成按钮左边）加 `选择模板` 按钮

### 10.2 交互

- 点击后弹出**带缩略图的模板选择弹层**（不是下拉列表），包含：
  - 当前项目模板库所有模板（缩略图展示）
  - `未选择模板` 选项
  - `上传新模板` 入口
- 选中的模板预览图固定显示在卡片工具栏上方区域

### 10.3 从弹层上传新模板

- 上传成功后：
  1. 加入项目模板库
  2. **自动绑定到当前页**（默认选中这张新模板）
  3. 模板解析后台异步继续（手动选择不依赖解析完成）

---

## 11. 模板删除

- 允许删除被页面引用的模板
- 删除时弹确认框，明确提示会影响多少个页面
- 删除后，所有引用该模板的页面清空模板，进入"未确认模板"状态

---

## 12. 入口汇总

| 入口 | 位置 | 功能 |
|------|------|------|
| 模板模式选择 | Home 创建项目时 | 选择单模板 / 多模板模式 |
| 转为多模板 | DetailEditor 顶部模板控制区 | 单模板升级为多模板（不可逆） |
| 自动匹配多页模板 | TemplateSetupPage 顶部 | 全项目批量自动匹配 |
| 单页自动匹配模板 | 页面卡片工具栏 | 单页自动匹配 |
| 选择模板 | 页面卡片工具栏 | 手动选择 / 更换模板 |
| 管理模板库 | TemplateSetupPage | 上传、删除、标记、纠正解析 |

---

## 13. 与现有功能的兼容

| 现有功能 | 改造方式 |
|---------|---------|
| 项目级 `template_image_path` | 单模板模式下仍可用于批量赋值，但最终真相落在页级字段 |
| 项目级 `template_style` | 同上，单模板模式下作为批量赋值源，不再作为最终生效真相 |
| 无模板流程 | 统一为"只填文字模板"的状态，不再单独存在 |
| 图片生成时的模板引用 | 优先读取页级 `template_asset_id`，其次读页级 `template_style_text` |

---

## 14. 已决事项（2026-06-22）

> 原 PRD 此处列了 6 项未决事项。本次评审已逐项决策并落定。每项的写法是"候选方案 → 选择 → 理由（含不选其他候选的原因）"。

### 决策 1 — TemplateSetupPage 是否必经

**候选方案：**
- A) 单模板和多模板都必经
- B) 多模板必经，单模板完全跳过（不渲染、不路由）
- C) 多模板必经，单模板展示简化版（只展示模板预览作为确认页）
- D) 单模板和多模板都可选（全部都靠页面卡片入口完成）

**选择：B**

**理由：**
- 选 B：`feat/per-page-template` 分支 Home 已落地"单/多模式按钮"，单模板模式的模板已在 Home 的 `TemplateSelector` 一次选完批量赋值，setup 页对单模板用户没有任何操作目标（模板库管理、自动匹配、逐页修正都是多模板独占）；多模板没有 setup 页则项目模板库无处管理。配合决策 7 的"全阶段双向切换"，单模板用户切到多模板时会自动进入 TemplateSetupPage 路由，无需重新创建项目。
- 不选 A：让单模板用户冗余跳一页，UX 倒退，且强制把"管理模板库"概念塞给所有用户。
- 不选 C：详见决策 6——简化版的维护和测试成本与功能版同级，价值不抵成本。
- 不选 D：多模板用户找不到模板库管理入口，自动匹配、批量上传等批量操作无处可放。

---

### 决策 2 — 模板解析失败降级策略

**候选方案：**
- A) 解析失败的模板完全不可用（从模板库移除或不显示）
- B) 解析失败的模板可手动选择并用于生成，但不进自动匹配候选池；UI 标识失败状态，提供重新解析按钮
- C) 解析失败也无差别参与所有功能（包括自动匹配），靠 fallback 文本兜底
- D) 解析失败的模板进入"待用户手动补全解析"模式，用户必须填完才能用

**选择：B**

**理由：**
- 选 B：模板的核心价值是"图片本体 + 用户标记"，解析 JSON 只服务自动匹配这一个下游；现有 `generate_json()` 已有 3 次重试，真实失败概率低，但 AI 短暂故障被放大成"模板不可用"是体验灾难；"可手动用，不进自动匹配"是最小损伤。
- 不选 A：惩罚用户而不是 AI；手动选择本不依赖解析。
- 不选 C：自动匹配若用未解析模板等于乱猜，误导更糟。
- 不选 D：把 AI 失败转嫁为用户必填项，用户不一定有能力或意愿填 9 字段 schema。

---

### 决策 3 — PDF 拆页实现

**候选方案：**
- A) MVP 不做 PDF 拆页（只支持单图上传）；v2 再补
- B) MVP 包含 PDF 拆页，自建 `backend/services/pdf_image_service.py`，用 PyMuPDF (`fitz`) 渲染每页 PNG
- C) MVP 包含 PDF 拆页，复用 `backend/services/file_parser_service.py` 现有 MinerU 链路
- D) MVP 包含 PDF 拆页，前端用 PDF.js 拆页后逐张上传（后端零改动）

**选择：B**

**理由：**
- 选 B：依赖已就位——`PyMuPDF>=1.24.0`（`backend/pyproject.toml:39`）、`PyPDF2>=3.0.0`（L38）都在；`backend/controllers/project_controller.py` 里已有 `fitz.open() + page.get_pixmap()` 的拆页参考代码；`task_manager.py` 的 `ResourceLimiter` + `_commit_with_retry` + 异步任务框架可直接套用，工程量约 8-10h；PDF 是品牌手册、风格 deck 的高频输入格式，推迟会让"项目模板库"在 MVP 沦为玩具。
- 不选 A：依赖和参考代码现成，推迟省不了多少工程量，反而让 MVP 价值大幅缩水。
- 不选 C：`file_parser_service.py` 走 MinerU 提取**内容**（返回 Markdown + 内嵌图），不渲染页面图；职责错位，且引入了不必要的外部 API 依赖和网络延迟。
- 不选 D：前端 PDF.js 在大文件时性能不佳；高 DPI 渲染消耗浏览器内存；切到后端后还要再做"批量上传"调度，反而更复杂。

**实现轮廓（留给工程 spec 细化）：**
- 新建 `backend/services/pdf_image_service.py`：`pdf_to_page_images(pdf_path, output_dir, dpi=150) -> List[str]`
- `task_manager.py` 新增 `process_pdf_to_template_images_task`，复用 `image_resource_limiter`
- `template_controller.py` 新增 `POST /api/projects/:projectId/template-assets/upload-pdf`，返回 task_id 给前端轮询
- 防御：页数上限 50，DPI 默认 150，渲染失败单页跳过不阻塞整体

---

### 决策 4 — 模板解析 prompt 设计

**候选方案：**
- A) 沿用 `generate_json()` 模式——few-shot + markdown JSON 块 + 3 次软重试
- B) Anthropic provider 走 `tool_use` 强制 schema，OpenAI/Gemini 沿用 A
- C) 全 provider 引入结构化输出（OpenAI `response_format=json_schema`、Gemini `response_schema`、Anthropic `tool_use`）
- D) 纯描述无 few-shot，完全靠 prompt 文字约束

**选择：A**

**理由：**
- 选 A：`prompts.py` 现有 7 处 JSON 输出 prompt（L280/L413/L680/L815 等）走的都是同一套模式，生产已验证；模板解析 9 字段 schema 比 outline、descriptions 简单；沿用同套基础设施意味着错误处理、重试、日志全复用，工程量最小。
- 不选 B：provider 之间行为分叉，测试矩阵翻倍，单 provider 的稳定性收益不显著。
- 不选 C：OpenAI/Gemini 当前 provider 实现都不支持原生 schema，改造工作量大，跨 provider 行为对齐难。
- 不选 D：9 字段中 `text_regions[]`、`image_regions[]` 这种结构化数组不给样本难稳定输出。

**实现要点：**
- prompt 中嵌 2-3 个真实模板的解析样本作 few-shot
- 写 `get_template_analysis_prompt()` 到 `prompts.py`
- 在 `ai_service.py` 加 `analyze_template(image_path)`，组合 `generate_with_image` + `generate_json`

---

### 决策 5 — 自动匹配 prompt 设计

**候选方案：**
- A) 一次性全量调用，不做防御
- B) 一次性全量调用 + 阈值防御：页数 ≤ 50 且模板 ≤ 20 时一次调用，超阈值按 30 页分批
- C) 始终分批（每批 30 页），牺牲全局视角换稳定性
- D) 模板侧 Embedding 预过滤（每页先选 Top-5 模板，再 LLM 精排）
- E) 逐页独立调用（N 页 = N 次调用）

**选择：B**

**理由：**
- 选 B：实测口径 50 页 + 10 模板 ≈ 6K input tokens，主流模型（Gemini 32K、Claude 200K、GPT-4 128K）余量充足；`generate_descriptions_stream`（`prompts.py:615-677`）已经验证过同等量级的全量打包；阈值防御挡住极端项目，工程上只需在 `ai_service.py` 里加一段分支逻辑。
- 不选 A：无防御对超大项目（>50 页）token 截断风险高，失败时排查成本高。
- 不选 C：常态项目都是 ≤ 50 页，分批让每次匹配丢失全局上下文（模板分布的均衡性、章节的视觉节奏感），匹配质量下降。
- 不选 D：Embedding 是另一套基础设施（向量库 / 向量服务 / Embedding 模型），MVP 不开；且模板数 ≤ 20 时 Top-5 预过滤的精度收益小于"丢失全局视角"的损失。
- 不选 E：N 次调用成本和延迟都不可接受，且失去"跨页协调"能力（同模板不要连续 5 页都用）。

**实现要点：**
- 写 `get_template_auto_match_prompt(templates, page_summaries)` 到 `prompts.py`
- 在 `ai_service.py` 加 `auto_match_templates(project_id)`
- 输入字段裁剪：每页只传 title + 100 字描述摘要 + 内容密度；模板只传 `analysis_json` 关键字段 + `user_label`，`notes` 截断到 200 字
- 分批触发条件：页数 > 50 或模板 > 20，按 30 页一批

---

### 决策 6 — 单模板模式下 TemplateSetupPage 简化形态

**候选方案：**
- A) 完全不渲染 TemplateSetupPage，路由直接跳过（单模板：Home → OutlineEditor）
- B) 渲染简化版（只展示已选模板预览 + "下一步"按钮）
- C) 渲染完整版（模板库管理也展示，但所有页面统一锁定到同一模板）

**选择：A**

**理由：**
- 选 A：与决策 1 配套——单模板模式的模板在 Home `TemplateSelector` 已选定；setup 页对单模板用户没有任何操作目标；`feat/per-page-template` 分支 Home 已具备 `templateMode` 分支判断条件，实现成本几乎为零。
- 不选 B：简化版页面是噪音，拖慢"创建项目→编辑大纲"主路径；且简化版/完整版的视觉差异容易让用户误以为"我点错了模式"。
- 不选 C：单模板模式的语义就是"一次选定，批量赋值"，不应让用户看到"模板库"概念；一旦让用户看见模板库，就会期望多模板能力，导致模式语义混乱。

**路由实现：**
- Home `initializeProject` 后，`templateMode === 'multi'` 才 navigate 到 `/project/:projectId/template-setup`
- 否则直接 navigate 到 `/project/:projectId/outline`

---

> **决策日期：2026-06-22**　决策依据见 `~/.claude/plans/prd-unified-biscuit.md`。第 3.2 节关于"模式切换规则"的修订对应决策 7。
