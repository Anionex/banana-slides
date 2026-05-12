# Banana Slides CLI 需求规格（API 驱动，接近全量能力）

## 1. 目标与非目标

### 1.1 目标

1. 在不改动后端 API 的前提下，提供可批量执行的命令行工具 `banana-cli`。
2. 以“纯 HTTP API 编排”为唯一依赖边界，不直接复用后端内部 Python 业务模块。
3. 首版提供高阶批处理入口 `run jobs`，并提供低阶子命令覆盖后端主要能力域。
4. 支持无鉴权和 `X-Access-Code` 两种现有后端模式。
5. 产出标准化机器可读报告（JSON）和终端摘要，满足批处理追踪与失败重试。

### 1.2 非目标

1. 不实现新的后端接口、字段或返回结构。
2. 不做 pip 对外发布或单文件二进制分发，仅支持仓库内 Python 包运行。
3. 不改造现有 Web 前端流程或前端状态模型。
4. 不在本期引入数据库直连能力，CLI 仅通过 HTTP。

## 2. 后端能力映射矩阵（Endpoint -> CLI 子命令 -> Phase）

### 2.1 Phase 1（可用闭环 + 高频扩展）

| 方法 | Endpoint | CLI 子命令 | Phase |
|---|---|---|---|
| `GET` | `/api/projects` | `banana-cli projects list` | P1 |
| `POST` | `/api/projects` | `banana-cli projects create` | P1 |
| `GET` | `/api/projects/{project_id}` | `banana-cli projects get` | P1 |
| `PUT` | `/api/projects/{project_id}` | `banana-cli projects update` | P1 |
| `DELETE` | `/api/projects/{project_id}` | `banana-cli projects delete` | P1 |
| `POST` | `/api/projects/{project_id}/generate/outline` | `banana-cli workflows outline` | P1 |
| `POST` | `/api/projects/{project_id}/generate/from-description` | `banana-cli workflows outline --from-description` | P1 |
| `POST` | `/api/projects/{project_id}/generate/descriptions` | `banana-cli workflows descriptions` | P1 |
| `POST` | `/api/projects/{project_id}/generate/images` | `banana-cli workflows images` | P1 |
| `POST` | `/api/projects/{project_id}/refine/outline` | `banana-cli workflows outline --refine` | P1 |
| `POST` | `/api/projects/{project_id}/refine/descriptions` | `banana-cli workflows descriptions --refine` | P1 |
| `GET` | `/api/projects/{project_id}/tasks/{task_id}` | `banana-cli tasks status` | P1 |
| `GET` | `/api/projects/{project_id}/tasks/{task_id}` | `banana-cli tasks wait` | P1 |
| `POST` | `/api/projects/{project_id}/pages` | `banana-cli pages create` | P1 |
| `PUT` | `/api/projects/{project_id}/pages/{page_id}` | `banana-cli pages update` | P1 |
| `DELETE` | `/api/projects/{project_id}/pages/{page_id}` | `banana-cli pages delete` | P1 |
| `PUT` | `/api/projects/{project_id}/pages/{page_id}/outline` | `banana-cli pages set-outline` | P1 |
| `PUT` | `/api/projects/{project_id}/pages/{page_id}/description` | `banana-cli pages set-description` | P1 |
| `POST` | `/api/projects/{project_id}/pages/{page_id}/generate/description` | `banana-cli pages gen-description` | P1 |
| `POST` | `/api/projects/{project_id}/pages/{page_id}/generate/image` | `banana-cli pages gen-image` | P1 |
| `POST` | `/api/projects/{project_id}/pages/{page_id}/edit/image` | `banana-cli pages edit-image` | P1 |
| `POST` | `/api/projects/{project_id}/template` | `banana-cli templates upload` | P1 |
| `DELETE` | `/api/projects/{project_id}/template` | `banana-cli templates delete` | P1 |
| `GET` | `/api/projects/{project_id}/export/pptx` | `banana-cli exports pptx` | P1 |
| `GET` | `/api/projects/{project_id}/export/pdf` | `banana-cli exports pdf` | P1 |
| `GET` | `/api/projects/{project_id}/export/images` | `banana-cli exports images` | P1 |
| `POST` | `/api/projects/{project_id}/export/editable-pptx` | `banana-cli exports editable-pptx` | P1 |
| `POST` | `/api/reference-files/upload` | `banana-cli refs upload` | P1 |
| `GET` | `/api/reference-files/project/{project_id}` | `banana-cli refs list` | P1 |
| `GET` | `/api/reference-files/{file_id}` | `banana-cli refs get` | P1 |
| `POST` | `/api/reference-files/{file_id}/parse` | `banana-cli refs parse` | P1 |
| `POST` | `/api/reference-files/{file_id}/associate` | `banana-cli refs associate` | P1 |
| `POST` | `/api/reference-files/{file_id}/dissociate` | `banana-cli refs dissociate` | P1 |
| `DELETE` | `/api/reference-files/{file_id}` | `banana-cli refs delete` | P1 |
| `GET` | `/api/projects/{project_id}/materials` | `banana-cli materials list --project-id` | P1 |
| `POST` | `/api/projects/{project_id}/materials/upload` | `banana-cli materials upload --project-id` | P1 |
| `POST` | `/api/projects/{project_id}/materials/generate` | `banana-cli materials generate --project-id` | P1 |
| `GET` | `/api/materials` | `banana-cli materials list --scope` | P1 |
| `POST` | `/api/materials/associate` | `banana-cli materials associate` | P1 |
| `DELETE` | `/api/materials/{material_id}` | `banana-cli materials delete` | P1 |

### 2.2 Phase 2（补齐接近全量）

| 方法 | Endpoint | CLI 子命令 | Phase |
|---|---|---|---|
| `POST` | `/api/projects/renovation` | `banana-cli renovation create` | P2 |
| `POST` | `/api/extract-style` | `banana-cli styles extract` | P2 |
| `GET` | `/api/projects/{project_id}/pages/{page_id}/image-versions` | `banana-cli pages versions` | P2 |
| `POST` | `/api/projects/{project_id}/pages/{page_id}/image-versions/{version_id}/set-current` | `banana-cli pages set-current` | P2 |
| `POST` | `/api/projects/{project_id}/pages/{page_id}/regenerate-renovation` | `banana-cli pages regenerate-renovation` | P2 |
| `GET` | `/api/settings` | `banana-cli settings get` | P2 |
| `PUT` | `/api/settings` | `banana-cli settings update` | P2 |
| `POST` | `/api/settings/reset` | `banana-cli settings reset` | P2 |
| `POST` | `/api/settings/verify` | `banana-cli settings verify` | P2 |
| `POST` | `/api/settings/tests/{test_name}` | `banana-cli settings test` | P2 |
| `GET` | `/api/settings/tests/{task_id}/status` | `banana-cli settings test-status` | P2 |
| `POST` | `/api/materials/upload` | `banana-cli materials upload --global` | P2 |
| `POST` | `/api/materials/download` | `banana-cli materials download` | P2 |
| `GET` | `/files/{project_id}/{type}/{filename}` | `banana-cli files fetch` | P2 |
| `GET` | `/files/materials/{filename}` | `banana-cli files fetch` | P2 |
| `GET` | `/files/user-templates/{template_id}/{filename}` | `banana-cli files fetch` | P2 |

## 3. CLI 命令契约（参数、输入输出、退出码）

### 3.1 命令行总入口

```bash
banana-cli [GLOBAL_OPTIONS] <domain> <action> [OPTIONS]
```

全局参数：

1. `--base-url <url>`：默认 `http://localhost:5000`。
2. `--access-code <code>`：传入后自动注入 `X-Access-Code` 请求头。
3. `--poll-interval <sec>`：默认 `3`。
4. `--request-timeout <sec>`：默认 `60`。
5. `--config <path>`：配置文件路径。
6. `--json`：输出机器可读 JSON。
7. `--verbose`：输出请求/轮询详细日志（不打印密钥）。

### 3.2 顶级命令面

```bash
banana-cli run jobs --file <jobs.jsonl|jobs.csv> --report <path> [--continue-on-error] [--timeout-sec N] [--state-file <path>] [--progress-interval-sec N]
banana-cli run monitor --state-file <path> [--watch] [--interval N]
banana-cli projects list|get|create|update|delete ...
banana-cli workflows outline|descriptions|images|full ...
banana-cli tasks status|wait --project-id <id> --task-id <id>
banana-cli pages create|update|delete|set-outline|set-description|gen-description|gen-image|edit-image|versions|set-current|regenerate-renovation ...
banana-cli templates upload|delete ...
banana-cli exports pptx|pdf|images|editable-pptx ...
banana-cli refs upload|list|get|parse|associate|dissociate|delete ...
banana-cli materials list|upload|generate|associate|download|delete ...
banana-cli settings get|update|reset|verify|test|test-status ...
banana-cli renovation create ...
banana-cli styles extract ...
banana-cli files fetch --url <download_url> --output <path>
```

### 3.3 高阶命令契约：`run jobs`

1. 读取 `JSONL/CSV` 任务并做前置校验（字段合法性、文件绝对路径存在性）。
2. 逐任务执行，默认继续执行并汇总失败。
3. 支持任务级 `policy.continue_on_error` 覆盖全局。
4. 每个任务记录：`steps`、`tasks`、`artifacts`、`error`、`duration_sec`。
5. 支持 `--state-file` 运行态文件：执行中持续写入 run/job/task 进度，供外部监控读取。
6. 支持 `--progress-interval-sec` 控制终端进度日志节流。
7. 命令结束时输出终端摘要，并写入 `--report` 指定 JSON 文件。

### 3.5 监控命令契约：`run monitor`

1. 读取 `run jobs --state-file` 产出的运行态 JSON。
2. 默认单次读取后输出当前快照。
3. `--watch` 模式按 `--interval` 周期刷新，直到 `status` 进入完成态。
4. 全局 `--json` 可用于输出结构化结果（最终快照）。

### 3.4 输出与退出码

退出码固定：

1. `0`：所有任务成功。
2. `2`：部分任务失败（至少一个成功且至少一个失败）。
3. `1`：致命错误（配置错误、输入不可解析、报告写入失败等）。

输出约定：

1. 默认人类可读摘要。
2. `--json` 时输出结构化 JSON（单命令响应或 run 总结）。
3. 错误输出格式统一为：`code/message/details`。

## 4. 批处理作业格式（JSONL 主格式 + CSV 兼容格式）

### 4.1 JSONL 主 Schema

每行一个 JSON 对象：

```json
{
  "job_id": "optional-string",
  "job_type": "full_generation|export_only",
  "creation_type": "idea|outline|descriptions",
  "idea_prompt": "...",
  "outline_text": "...",
  "description_text": "...",
  "project_id": "required for export_only",
  "template_image_path": "/abs/path.png",
  "template_style": "text style",
  "extra_requirements": "optional",
  "language": "zh|en|ja|auto",
  "max_description_workers": 5,
  "max_image_workers": 8,
  "use_template": true,
  "reference_files": ["/abs/a.pdf"],
  "material_files": ["/abs/m1.png"],
  "export": {
    "formats": ["pptx", "pdf", "editable_pptx"],
    "filename_prefix": "demo",
    "page_ids": [],
    "editable_max_depth": 1,
    "editable_max_workers": 4
  },
  "policy": {
    "continue_on_error": true,
    "timeout_sec": 1800
  }
}
```

### 4.2 `job_type` 行为定义

1. `full_generation`：
   1. 创建项目。
   2. 可选更新项目字段：`template_style`、`extra_requirements`。
   3. 可选模板上传（`template_image_path`）。
   4. 可选上传并解析 `reference_files`（全部完成后再进入生成）。
   5. 可选上传 `material_files`。
   6. 生成流程：
      1. `creation_type=descriptions` 时优先调用 `/generate/from-description`。
      2. 其余调用 `/generate/outline` -> `/generate/descriptions`（异步轮询）。
      3. 调用 `/generate/images`（异步轮询）。
   7. 按 `export.formats` 导出产物。
2. `export_only`：
   1. 使用 `project_id` 直接导出。
   2. 不触发创建与生成。

### 4.3 CSV 兼容 Schema

表头固定：

```text
job_id,job_type,creation_type,idea_prompt,outline_text,description_text,project_id,template_image_path,template_style,export_formats,options_json
```

说明：

1. `export_formats` 为 `;` 分隔值，如 `pptx;pdf;editable_pptx`。
2. 复杂字段（如 `policy/export/page_ids/reference_files/material_files`）放入 `options_json`。
3. 解析规则：先读显式列，再用 `options_json` 合并覆盖。

### 4.4 前置校验规则

1. `job_type` 必填且必须为 `full_generation|export_only`。
2. `export_only` 必须提供 `project_id`。
3. `full_generation` 必须满足：
   1. `creation_type` 有效。
   2. `idea` 需要 `idea_prompt`。
   3. `outline` 需要 `outline_text`。
   4. `descriptions` 需要 `description_text`。
4. 上传类字段路径必须为绝对路径且文件存在。
5. `export.formats` 仅允许：`pptx|pdf|images|editable_pptx`。

## 5. 配置与鉴权模型（配置文件、环境变量、优先级）

### 5.1 配置来源与优先级

优先级（高 -> 低）：

1. CLI 参数。
2. 环境变量。
3. 配置文件。
4. 内置默认值。

### 5.2 配置文件

默认路径：

1. macOS/Linux：`${XDG_CONFIG_HOME:-~/.config}/banana-slides/cli.toml`
2. Windows：`%APPDATA%/banana-slides/cli.toml`

TOML 字段：

```toml
base_url = "http://localhost:5000"
access_code = ""
poll_interval = 3
request_timeout = 60
continue_on_error = true
report_dir = "./reports"
```

### 5.3 环境变量

1. `BANANA_CLI_BASE_URL`
2. `BANANA_CLI_ACCESS_CODE`
3. `BANANA_CLI_POLL_INTERVAL`
4. `BANANA_CLI_REQUEST_TIMEOUT`
5. `BANANA_CLI_CONTINUE_ON_ERROR`

### 5.4 鉴权规则

1. 若 `access_code` 非空，所有 `/api/*` 请求自动添加 `X-Access-Code`。
2. `/files/*` 下载请求不附加 `X-Access-Code`（后端当前不要求）。
3. 不支持 Bearer Token（本期明确不做）。

## 6. 错误模型、重试与超时策略

### 6.1 错误分类

1. `CONFIG_ERROR`：配置无效、URL 非法、超时参数非法。
2. `INPUT_ERROR`：作业字段缺失、文件路径不存在、CSV/JSONL 解析失败。
3. `HTTP_ERROR`：后端返回非 2xx。
4. `TASK_FAILED`：异步任务状态为 `FAILED`。
5. `TASK_TIMEOUT`：轮询超时。
6. `IO_ERROR`：报告文件写入失败、下载失败。

### 6.2 重试策略

1. 对 `GET` 请求启用自动重试：最多 `3` 次，退避 `1s/2s/4s`。
2. 对 `POST/PUT/DELETE` 默认不自动重试（避免非幂等副作用）。
3. 网络错误或 `5xx` 才重试；`4xx` 直接失败。
4. `run jobs` 失败处理以任务策略为准：
   1. `continue_on_error=true`：记录失败继续后续任务。
   2. `continue_on_error=false`：当前任务失败后立即终止整个 run。

### 6.3 超时策略

1. 单请求超时：`request_timeout`（默认 60 秒）。
2. 任务轮询超时：
   1. 命令参数 `--timeout-sec` > job `policy.timeout_sec` > 默认 `1800` 秒。
3. `tasks wait` 到达超时后返回 `TASK_TIMEOUT`。

### 6.4 任务轮询算法

轮询目标：

```text
GET /api/projects/{project_id}/tasks/{task_id}
```

判定：

1. `status=COMPLETED`：成功结束。
2. `status=FAILED`：失败结束，错误消息来自 `error_message`。
3. 超时：返回失败并写入报告。

## 7. 分期实施方案（Phase 1/Phase 2）

### 7.1 Phase 1

范围：

1. `run jobs` 支持 `full_generation` 与 `export_only`。
2. 项目、任务、模板、导出命令全量。
3. 参考文件与素材常用操作（上传/列表/关联/删除）。
4. 页面基础编辑与单页生成命令。

实现结构（仓库内 Python 包）：

```text
cli/banana_cli/
  __init__.py
  __main__.py
  app.py
  config.py
  errors.py
  http_client.py
  models.py
  reporter.py
  jobs/
    loader.py
    runner.py
    workflow.py
  commands/
    run.py
    projects.py
    workflows.py
    tasks.py
    pages.py
    templates.py
    exports.py
    refs.py
    materials.py
```

技术栈约束：

1. 命令框架：`argparse`（标准库）。
2. HTTP：`httpx`（同步客户端）。
3. 数据模型：`pydantic`（用于作业与报告校验）。

### 7.2 Phase 2

范围：

1. `renovation create`、`styles extract`。
2. 页面版本命令（`versions`/`set-current`）与翻新页重生。
3. `settings test` 与 `settings test-status`。
4. 素材下载打包与 `files fetch`。

完成标准：

1. CLI 映射覆盖率达到 >=90% 常用后端 endpoint。
2. 批处理/单命令两类使用方式均可稳定运行。

## 8. 测试与验收标准

### 8.1 测试层次

1. 单元测试：
   1. 作业解析（JSONL/CSV）。
   2. 配置优先级合并。
   3. 错误映射与退出码。
2. 集成测试（Mock HTTP）：
   1. `run jobs` 流程编排。
   2. 任务轮询状态机。
   3. 报告产物结构。
3. 真实后端联调测试：
   1. 对齐现有 `backend/tests/integration/test_api_full_flow.py` 主链路。
   2. 校验 Access Code 开关两种模式。

### 8.2 必测场景

1. 输入校验：
   1. 字段缺失。
   2. 路径非法。
   3. CSV/JSONL 结构错误。
2. 批处理失败策略：
   1. 默认继续执行。
   2. 任务级 fail-fast 覆盖。
3. 异步任务：
   1. 描述生成。
   2. 图片生成。
   3. 可编辑导出。
4. 导出链路：
   1. `pptx`。
   2. `pdf`。
   3. `images`。
   4. `editable_pptx`。
5. 参考文件与素材：
   1. 上传。
   2. 解析触发与状态跟踪。
   3. 关联与删除。
6. 报告一致性：
   1. 终端统计。
   2. JSON `totals/jobs` 一致。

### 8.3 验收标准

1. 批量 10 个作业运行后，报告完整、退出码正确。
2. 单任务失败不影响后续任务（默认模式）。
3. `export_only` 可在已有项目上稳定产出下载 URL。
4. 在 `ACCESS_CODE` 开启时全部命令可正常访问 `/api/*`。

## 9. 风险与回滚策略

### 9.1 主要风险

1. 后端异步任务耗时波动大导致轮询超时。
2. 上传文件较大导致网络超时。
3. 非幂等接口在网络抖动下重复触发。
4. 不同作业输入质量差导致失败率高。

### 9.2 风险控制

1. 统一超时可配置并支持任务级覆盖。
2. 仅对 `GET` 自动重试，写操作默认不重试。
3. 预校验文件路径与必填字段，尽早失败。
4. 报告中记录 step 级失败点，便于补跑。

### 9.3 回滚策略

1. CLI 仅新增文件与入口，不改后端协议，可随时移除 CLI 目录回滚。
2. 若 Phase 2 风险过高，保持 Phase 1 稳定分支并冻结新增命令。
3. 发生线上作业异常时可直接降级为低阶子命令手动执行。

## 10. 附录（示例作业文件 + 示例报告 JSON）

### 10.1 示例：`full_generation` JSONL 行

```json
{"job_id":"job-ai-001","job_type":"full_generation","creation_type":"idea","idea_prompt":"生成一份关于 AI Agent 工程实践的 6 页演示文稿","template_image_path":"/Users/chenzixin/projects/banana-slides/assets/test_img.png","template_style":"科技感、深蓝主色、信息密度高","extra_requirements":"每页保持标题可读性，图文比例约 6:4","language":"zh","max_description_workers":5,"max_image_workers":6,"use_template":true,"reference_files":["/Users/chenzixin/projects/banana-slides/docs/quickstart.mdx"],"material_files":[],"export":{"formats":["pptx","pdf","editable_pptx"],"filename_prefix":"ai-agent-practice","page_ids":[],"editable_max_depth":1,"editable_max_workers":4},"policy":{"continue_on_error":true,"timeout_sec":1800}}
```

### 10.2 示例：最终报告 JSON

```json
{
  "run_id": "37f00fd8-3c3f-4b3f-9dfa-d4f6f3344c19",
  "started_at": "2026-02-28T10:00:00Z",
  "finished_at": "2026-02-28T10:18:24Z",
  "base_url": "http://localhost:5000",
  "totals": {
    "total": 2,
    "success": 1,
    "failed": 1
  },
  "jobs": [
    {
      "job_id": "job-ai-001",
      "status": "SUCCESS",
      "project_id": "9f2e8d1d-becf-4a58-8fc7-3c3f0b2f3e4b",
      "tasks": [
        {"task_id": "70f8c7ee-2eb0-4ce4-9f85-4b3ace3f8ef2", "type": "GENERATE_DESCRIPTIONS", "status": "COMPLETED"},
        {"task_id": "7b5cb67e-95f6-4b2a-8f1b-e14e429d15eb", "type": "GENERATE_IMAGES", "status": "COMPLETED"},
        {"task_id": "8de44d14-e42a-4fd4-b1a7-9c0bf4f18adc", "type": "EXPORT_EDITABLE_PPTX", "status": "COMPLETED"}
      ],
      "artifacts": [
        {"format": "pptx", "download_url": "http://localhost:5000/files/9f2e8d1d-becf-4a58-8fc7-3c3f0b2f3e4b/exports/ai-agent-practice.pptx"},
        {"format": "pdf", "download_url": "http://localhost:5000/files/9f2e8d1d-becf-4a58-8fc7-3c3f0b2f3e4b/exports/ai-agent-practice.pdf"},
        {"format": "editable_pptx", "download_url": "http://localhost:5000/files/9f2e8d1d-becf-4a58-8fc7-3c3f0b2f3e4b/exports/ai-agent-practice_editable.pptx"}
      ],
      "error": {"code": null, "message": null},
      "duration_sec": 684
    },
    {
      "job_id": "job-export-002",
      "status": "FAILED",
      "project_id": "missing-project-id",
      "tasks": [],
      "artifacts": [],
      "error": {"code": "HTTP_ERROR", "message": "Project not found"},
      "duration_sec": 2
    }
  ]
}
```

## Phase 1/Phase 2 验收 Checklist

### Phase 1

- [ ] `run jobs` 支持 `full_generation` 与 `export_only`。
- [ ] 任务报告 JSON 输出符合本 spec 的报告 schema。
- [ ] 项目/任务/模板/导出命令可用。
- [ ] `refs` 与 `materials` 常用命令可用。
- [ ] 页面基础编辑与单页生成命令可用。
- [ ] 默认“继续执行并汇总”策略生效。
- [ ] 退出码 `0/1/2` 行为符合定义。

### Phase 2

- [ ] `renovation create` 与 `styles extract` 可用。
- [ ] 页面版本 `versions`/`set-current` 可用。
- [ ] `settings test` 与 `settings test-status` 可用。
- [ ] 素材下载与 `files fetch` 可用。
- [ ] 映射覆盖率达到 >=90% 常用 endpoint。
