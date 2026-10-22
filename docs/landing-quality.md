# 官网主题、无障碍与 SEO

本实现只面向 `production/bananaslides-online`。业务内容、Demo 优先级与现有布局保留。

## 视觉变化

- 顶栏外观按钮点击直接切换亮暗；首次访问跟随系统，手动切换后记住选择。太阳／月亮沿用 shadcn/ui 的旋转缩放过渡，并加淡入淡出；减少动态效果时直接切换。独立保存 `banana-landing-theme`，不改编辑器的主题设置。小于 375px 时品牌只显示图标。
- 浅色页的邮箱占位文字、页脚文字加深；键盘操作时出现跳转正文入口和焦点环。反馈弹窗的边框、关闭按钮与布局统一。
- 暗色以 `#181818` 中性炭黑为页面底，导航、卡片、输入框使用中性深灰层次，正文为暖白和柔灰；主 Demo 按钮使用 `#EFD16F` 柔金。
- Hero 保留四个矩形的比例、叠放和向下流动，使用较暗的金色并降低颗粒对比度。第二屏插画底为 `#282828`，第三屏为 `#242424`；纸张主体保持浅色。
- 暗色玻璃导航使用半透明深色、低亮度边框，保留原有收拢和悬停高光动作。邮箱框保持中性深色；页脚波浪另设 Canvas 调色板，并在文字背后加压暗层。
- 分享封面是站外链接卡片用图，首页不新增图片区块。

## 无障碍

`FeedbackDialog` 复用 `@base-ui/react/dialog`，提供焦点限制、背景不可交互、Esc 关闭以及返回反馈按钮。共享 FeedbackWidget 仅增加可选 DialogComponent 注入，编辑器默认 Modal 保持原状。

跳转正文和 section 锚点同时移动键盘焦点；表单有名称、错误状态与 live region；预约请求最长等待 15 秒。装饰图保持隐藏语义。减少动态效果偏好覆盖粒子、波浪、滚动入场和 CSS 过渡。

自动 axe 扫描使用 WCAG A/AA 标签，另有键盘、对比度与响应式手动检查。自动扫描通过不等于完整无障碍认证。

## 字体

`npm run fonts:landing` 从 Landing 与反馈组件源码采集字符，用 subset-font 生成 `landing-rounded-ui.woff2` 与 `landing-fonts.generated.css`。保留原字体的 wght、ROND 轴及 shaping features。

原字库约 2.17 MB；当前 UI 字库约 298 KB（减少 86.3%）。两个字体面的 unicode-range 互斥，完整字库只在出现额外字符时加载。修改文案后执行官网构建会自动重新生成；不要手改生成 CSS。字体原文件与许可保留。

## SEO 与构建

```sh
cd frontend
npm run build:online
```

官网构建完成后，通过 Vite 的 SSR 构建与 React 服务端渲染生成 `/index.html`、`/en/index.html`。这些 HTML 含实际页面文案、描述、canonical、hreflang、Open Graph、Twitter 卡片和真实 SoftwareApplication/WebSite 结构化数据，不依赖爬虫执行 JS。同时生成 robots.txt、sitemap.xml。

生成过程只运行于官网构建；无 JS 时仍可读页面与 FAQ，表单需 JS。原有 Reveal 组件仅增加服务端可见渲染分支，原因是默认入场隐藏状态不能作为静态页面输出；客户端动效仍复用原组件。

中英文分享图位于 `frontend/public/social/`，1200 × 630 PNG。复用现有字体、logo 与颗粒矩形，以真实浏览器截图生成。重新生成时，对运行 4178 预览的 Playwright CLI 会话执行：

```sh
playwright-cli -s=landing-review run-code --filename frontend/scripts/landing-cover.js
```

文件参数以仓库根为工作目录；截图完成后重新构建。发布需完整包含 `dist/en/`、`dist/social/`、robots.txt 和 sitemap.xml。robots 排除应用与 API 仅用于抓取管理，不是权限措施。

## Hero 定稿决策（2026-10-21）

本轮通过控制变量对比后，用户选择“原线上布局＋新文案及按钮顺序”为正式版。

- 布局沿用生产基线 `239acf5b`：`desktop-layout.css`、`landing.css` 不变，保留原有字号、字距、间距、容器宽度、右侧矩形比例与位置。文案变长后的自然换行属于正常文档流，不通过移动画面或缩小字体补偿。
- 中文标题为两行“让 PPT 创作 / 回归直觉”，保留 PPT 两侧空格，不加逗号或句号。“回归直觉”四字不改；本轮试验的 0.04em 字距不进入定稿。
- 中文介绍为“Banana Slides 是一款一站式原生 AI PPT 应用。用自然语言描述想法即可生成或调整页面，几分钟内生成完整、精美的演示文稿。无需设计基础。”保留产品定位，用“应用”而非“工具”。仅将“无需”作为不可拆分词，空间不足时两个字一起换行，其余文字自然排版，不插入额外中文空格。
- 英文标题为“Vibe your way / to great slides.”，呼应 GitHub slogan。介绍保留 all-in-one、AI-native presentation app、自然语言创作、complete, beautifully designed presentations 和 No design skills needed；首屏不再强调 image-generation models。
- 按钮顺序固定为“体验演示 → 预约在线版内测 → GitHub”。保留原黑色 Demo、黄白动态内测按钮、带 star 数的 GitHub 样式。小屏沿用原两列布局，由第三项 GitHub 占整行。
- “视觉设计”英文使用 visual design，而非 style。末屏采用“把你的下一个想法，变成精彩的演示。”／“Turn your next idea into stunning slides.”。
- 淘汰“只改布局”及“布局和文案一起调整”两套实验；不把它们的 CSS 或对照入口带入发布。历史快照仅用于追溯，不再作为待选设计。

### 本轮可复用的取舍

先用真实成品和控制变量对照判断效果；用户认可原有视觉层级时，不按通用审美建议擅自重做。修改文案、按钮顺序和调整布局是独立变量。不得为适配布局删除产品介绍，也不得将局部调整扩大到右侧图形、功能行或其他已确认区域。

### 发布基线

本轮仅发布官网前端，不更改后端、数据库、模型配置或共享 GitHub star 刷新机制。发布前发现实际线上镜像 `banana-demo-release-frontend:blank-key-check-20261021` 还包含已发布的 `7b4c8694`（PR #661，空白项目 API Key 校验），该提交尚未进入生产分支。构建发布产物时须保留这项线上补丁；不得用仅含生产分支的旧应用代码覆盖它。发布源码与验证结果如下。

### 发布记录（2026-10-21）

- PR #662 已合入 `production/bananaslides-online`，合并提交 `b999d757`；其文件树与经过 CI 的 `2b7d0b73` 一致。Docs Link Check、Quick Check（含前后端测试、构建和真实后端深层链接测试）、Smoke Test 全部通过。
- 线上前端镜像：`banana-demo-release-frontend:hero-copy-2b7d0b73-20261021`，保留已上线的 `7b4c8694` 应用补丁。发布目录 `/root/banana-demo-releases/hero-copy-2b7d0b73` 保存 `release-source.json`、补丁、旧 Compose 配置、产物校验和部署记录。
- 中英文公网首页与本次发布 HTML 字节一致；真实浏览器验证浅色首屏、新文案、按钮顺序，以及 Demo 点击进入 `/app` 并完成加载。共享 star 文件挂载保留，后端容器 ID 与启动时间均未变化。
- 两个淘汰方案的预览服务和本地分支已清理；布局对照工作区已归档。正式预览继续使用 43191。
- 容器刚重建时曾因连接重置触发自动回滚；给只读启动探测增加有界重试后重新发布并通过全部产物校验。上一版本镜像保留以便回滚。

## 文案与动画入口微调（2026-10-22）

在已确认的原布局与按钮顺序上，仅调整以下内容：

- 中文产品定位改为“Banana Slides 是一款原生 AI PPT 生成应用。”，去掉“一站式”，补充“生成”。
- 使用场景标题改为“每个场景都值得尝试”。
- 末屏标题改为“把下一个想法，变成精彩的演示”，保留“的”，不加句号。
- 中英文使用场景区移除播放／暂停动画按钮，继续保留可见区域播放、后台暂停及系统减少动态效果设置。
- 英文其余文案、布局、按钮顺序和共享 star 数据机制保持既有版本。发布产物继续保留线上 `7b4c8694` 应用补丁。

## 验收与维护

首页 GitHub star 数使用网站共享成功快照，不依赖访客 localStorage 或直连 GitHub。预渲染 HTML 与客户端初始状态均使用 `src/landing/githubStats.snapshot.json`，首访和刷新期间就有真实数字；挂载后读取本站 `/stats/github.json`，只有有效且不早于内置快照的数据才替换。服务器每小时原子刷新持久化 JSON，失败保留上次结果。部署及回归命令见 `deploy/github-stats/README.md`。

复用 4178 的稳定预览产物，在仓库根执行 `frontend/scripts/landing-audit.js`（Playwright CLI run-code）。该脚本创建并清理独立浏览器上下文，检查主题、键盘、语言、静态 HTML、320–1440px 布局、axe 和模拟表单响应；不提交真实预约。返回结构化结果。

本次验收：官网构建、修改文件 ESLint、publicLanding 的 5 项测试及浏览器验收通过。全仓 tsc 仍报 61 个错误；已在相同依赖下对比未修改的生产基线，输出完全相同，本次未新增。

发布仅合入 `production/bananaslides-online`，以前端临时容器验收后替换线上前端镜像，保留后端与挂载配置。发布版本以生产分支提交及线上镜像记录为准。预存的 `src/i18n.ts` 工作区改动来自其他任务，不包含在本次提交内。
