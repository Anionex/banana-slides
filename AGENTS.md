# Project notes

- Docker E2E 在环境测试重建容器后，须让宿主 runner 可写 `uploads`、`backend/instance` 及 SQLite 文件，并验证实际写事务；PPTX 下载须在点击前监听 Page 的 `download`，保存文件验收，不能用接口 200 代替。
- nightly 的官方 PyPI 配置须在测试和发布两个 job 中通过 `scripts/prepare_nightly_lock.py` 同步锁文件 URL；`uv sync --frozen` 不会用索引环境变量覆盖锁定的下载地址，不能通过重新解析或升级依赖规避镜像 403。

- README 翻译以 `docs/i18n/readme-state.json` 的成功同步快照为基线；保留 `i18n` 章节 ID，译文与状态一起提交。不可用干净 CI 工作区的 `git diff HEAD` 判断增量，也不可用中英文标题文字匹配章节。维护说明见 `docs/readme-i18n.md`。

- 同一项目的素材工具箱会从多个入口同时挂载；任务列表和轮询必须按项目共享，验收跨入口提交、关闭其中一个入口及重新挂载，避免覆盖任务或重复轮询。

- `main` 只承载通用开源功能。`bananaslides.online` 专属的 Landing、内测预约、站内反馈、公开 Demo、访客隔离、管理员入口及其配置/迁移只能进入 `production/bananaslides-online`；默认关闭的开关不等于分支隔离。官网任务创建分支和 PR 前必须核对基线与目标分支，未经用户明确要求不得“同步主线”。

- `bananaslides.online` 的正式源码基线为 `origin/production/bananaslides-online`（2026-09-27 建立，包含当时线上首页与后端补丁）；官网改动从该分支出发，发布前重新核对线上镜像及差异，不把旧 `feat/sponsor` 或独立 `feat/public-site-landing` 当作完整线上代码。
- `bananaslides.online` 经 Cloudflare 访问时，服务器内 Python `urllib` 可能被返回 403，即使源站和浏览器正常。发布验收分别核对源站构建哈希与公网 `curl`/真实浏览器结果；不要仅因 `urllib` 的边缘拦截判定部署失败。
- 官网发布含数据库迁移时，先用真实 SQLite 库的在线备份预演，再核对该备份的 `alembic_version`、新表和原有数据行数；镜像中的 `alembic.ini` 不得指向占位数据库。
- 官网前端使用 `npm run build:online`（启用 `VITE_PUBLIC_LANDING=true`）；验收实际发布产物和公网根路径的 landing 标题及 Demo 跳转，不能只检查 HTTP 200。
