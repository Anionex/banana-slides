# README 多语言维护

中文 `README.md` 是内容源。当前提供英文、巴西葡萄牙语、日语、韩语；语言、文件名和按钮文案统一登记在 `docs/i18n/languages.json`。各语言文件均放在仓库根目录，共享相对链接和图片素材。

语言范围参考 [GitHub Octoverse 2025 的开发者地区规模](https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/)：优先覆盖中英葡日，并保留项目要求的韩语。地区人数不是母语分布；此清单是维护范围，不是官方语言排名。

## 编辑与同步

每个标题前都有唯一且稳定的章节标识。改标题或移动章节时保留 ID；新增标题时新增 ID，不用翻译标识：

```markdown
<!-- i18n:installation -->
## 安装

安装说明。
```

Hero 使用 `hero` ID。代码块中的 `#`、`##` 不会被当作章节。`readme:languages`、`readme:actions`、`readme:intro` 和 `readme:support` 注释之间的区域由程序生成：语言按钮文案、宽度及各语言 Hero 短文案（`hero` 字段）在语言清单中维护；四个导航按钮的跳转地址在中文 README 中维护。Hero 短文案是明确维护的本地化 UI，不交给正文翻译模型改写。

```bash
# 查看待更新的语言和章节，不需要凭据、不写文件
python3 scripts/translate_readme_incremental.py --plan

# 生成各语言的 SVG 按钮
node scripts/generate_readme_buttons.mjs

# 同步全部语言；只安装脚本所需的轻量依赖
uv run --no-project scripts/translate_readme_incremental.py

# 只同步指定语言，其他语言的同步进度保持原样
uv run --no-project scripts/translate_readme_incremental.py --languages ja,ko

# 组装五种语言的 Hero（保留正文，只同步 Hero 状态）
python3 scripts/render_readme_hero.py

# 离线验收
python3 scripts/render_readme_hero.py --check
python3 scripts/translate_readme_incremental.py --check
node scripts/generate_readme_buttons.mjs --check
python3 -m unittest discover -s scripts/tests -p 'test_readme_i18n.py'
```

有待翻译章节时需要 `GOOGLE_API_KEY`，可选 `GOOGLE_API_BASE`；默认模型沿用 `gemini-3-flash-preview`，通过 `TEXT_MODEL` 配置。无变更不初始化 API 客户端、不需要密钥。旧入口 `scripts/translate_readme.py` 也转入同一增量流程。

## 增量规则

- `docs/i18n/readme-state.json` 按语言保存上次成功同步的中文原文及 SHA-256。与该状态比较，而不是与工作区 `HEAD` 比较，因此可累计多次提交和此前失败后的变更。
- 未变章节直接保留目标文件中的原文，包括人工润色。修改章节把旧中文、新中文和当前译文一起交给模型，只更新相应章节；新增章节生成译文，删除和移动章节直接调整结构。
- 模型拿到的是受保护的占位符。代码块（包括其中的中文注释）、行内代码、URL 和 HTML 标签原样恢复；检查占位符、代码围栏、HTML 顺序和标题层级。Hero 语言选中状态及按钮素材由清单生成，不交给模型猜测。
- 裸 URL 与翻译后紧接的助词、标点保持空格分隔，避免韩语等语言把助词拼进链接地址；Markdown 链接的目标不插入空格。
- 内容相同的 Hero 导航变更只刷新界面，不触发正文翻译。新增语言会首次生成整份译文，之后增量同步。
- 每个请求最多尝试 3 次，单次 HTTP 超时 120 秒，最多 4 个并发请求。成功章节缓存到被 Git 忽略的 `.cache/readme-i18n/`，失败后重跑可复用；缓存不是同步状态。
- 全部选中语言成功并通过校验后，才写入 README 和同步状态。翻译或校验失败不覆盖现有文件；写入异常回滚，状态最后写入。执行期间用户修改了源文档、目标文件、清单或状态，也会停止写入。

初次迁移保留已有英文的 29 个章节，重新生成了代码围栏损坏的 Docker 和后端安装两节。其他语言为机器生成初稿，欢迎直接在对应文件润色；结构校验不能替代母语校审。

## GitHub Actions

PR 只运行离线测试、按钮检查和增量计划，不使用密钥。合入 `main` 或手动触发后，工作流检出最新 `main`，同步所有语言，验收后将译文与状态放在同一个提交中。继续使用仓库原有的 `GOOGLE_API_KEY` / `GOOGLE_API_BASE` Secrets。

任务排队而不是取消正在进行的同步；如果执行期间远端又有提交，推送会拒绝覆盖，下一次任务再按最新源文件同步。不要手工把旧译文配上新的状态，也不要仅提交状态文件而漏掉对应译文。

## 新增语言

在语言清单新增唯一代码、根目录 README 文件名、母语名称、英文语言名称、素材后缀和四个按钮的本地化文案/宽度。同时填写 `hero` 中的介绍与支持提示。运行按钮生成命令，再同步新语言并组装 Hero；确认文案和按钮显示后，一起提交语言清单、SVG、README、状态。要让 `--check` 通过，所有已登记语言都必须完成首次生成。
