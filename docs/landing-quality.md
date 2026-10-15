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

## 验收与维护

复用 4178 的稳定预览产物，在仓库根执行 `frontend/scripts/landing-audit.js`（Playwright CLI run-code）。该脚本创建并清理独立浏览器上下文，检查主题、键盘、语言、静态 HTML、320–1440px 布局、axe 和模拟表单响应；不提交真实预约。返回结构化结果。

本次验收：官网构建、修改文件 ESLint、publicLanding 的 5 项测试及浏览器验收通过。全仓 tsc 仍报 61 个错误；已在相同依赖下对比未修改的生产基线，输出完全相同，本次未新增。

发布仅合入 `production/bananaslides-online`，以前端临时容器验收后替换线上前端镜像，保留后端与挂载配置。发布版本以生产分支提交及线上镜像记录为准。预存的 `src/i18n.ts` 工作区改动来自其他任务，不包含在本次提交内。
