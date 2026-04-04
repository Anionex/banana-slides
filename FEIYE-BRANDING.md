# 飞叶智能品牌适配说明

本文档记录了基于上游 `Anionex/banana-slides` 项目，在 `feature/feiye-branding` 分支上进行的所有品牌定制改动。后续开发人员参照本文档可快速了解改动范围，并在上游更新合并后按需重新适配。

---

## 改动总览

| 类别 | 改动数量 | 涉及文件 |
|------|---------|---------|
| 主色系替换 | 2 | `index.css`, `tailwind.config.js` |
| 品牌名称替换 | 5 | `index.html`, `Footer.tsx`, `HelpModal.tsx`, `Home.tsx`, `Landing.tsx` |
| GitHub 相关移除 | 4 | `GithubBadge.tsx`, `GithubRepoCard.tsx`, `HelpModal.tsx`, `Landing.tsx` |
| Logo 占位符 | 1 | `public/feiye.svg` |

---

## 一、主色系：黄色 → 蓝色

### 改动文件

**`frontend/src/index.css`**

CSS 变量替换（亮色模式）：

| 变量 | 原值（黄色） | 新值（蓝色） |
|------|------------|------------|
| `--banana-yellow` | `#FFD700` | `#1677FF` |
| `--banana-yellow-light` | `#FFE44D` | `#4096FF` |
| `--banana-yellow-dark` | `#FFC700` | `#0958D9` |
| `--banana-yellow-pale` | `#FFF9E6` | `#E6F4FF` |

CSS 变量替换（深色模式 `.dark`）：

| 变量 | 原值 | 新值 |
|------|------|------|
| `--banana-yellow` | `#F5A623` | `#4096FF` |
| `--banana-yellow-light` | `#FFD700` | `#69B1FF` |
| `--banana-yellow-dark` | `#E6930E` | `#1677FF` |
| `--banana-yellow-pale` | `#2A2520` | `#111D2C` |

**`frontend/tailwind.config.js`**

Tailwind 静态色阶替换（`banana.50` ~ `banana.600`）：

| 色阶 | 原值 | 新值 |
|------|------|------|
| 50 | `#FFF9E6` | `#E6F4FF` |
| 100 | `#FFE44D` | `#BAE0FF` |
| 200 | `#FFD93D` | `#91CAFF` |
| 300 | `#FFD21F` | `#69B1FF` |
| 400 | `#FFCA00` | `#4096FF` |
| 500 | `#FFD700` | `#1677FF` |
| 600 | `#FFC700` | `#0958D9` |

阴影色同步更新：`shadow-yellow` 从 `rgba(255,215,0,0.3)` 改为 `rgba(22,119,255,0.3)`。

> **注意**：Tailwind class 名称（如 `bg-banana-500`、`text-banana-600`）保持不变，只是颜色值从黄色变为蓝色。上游如果新增了使用 `banana-*` class 的组件，颜色会自动跟随蓝色主题，无需额外修改。

---

## 二、品牌名称替换

### `frontend/index.html`

- `<title>` 从 `蕉幻 | AI 原生 PPT 生成器` 改为 `飞叶智能 | AI 原生 PPT 生成器`
- favicon 从 `/banana.svg` 改为 `/feiye.svg`

### `frontend/src/components/shared/Footer.tsx`

- 移除 GitHub 链接
- 品牌名从 `蕉幻 Banana Slides` 改为 `飞叶智能 FEIYE INTELLIGENCE`
- 渐变色从 `from-banana-600 to-orange-500` 改为 `from-banana-500 to-banana-400`（蓝色渐变）

### `frontend/src/components/shared/HelpModal.tsx`

中英文 i18n 字典内替换：

| 字段 | 原值 | 新值 |
|------|------|------|
| `zh.guide.brand` | `蕉幻 · Banana Slides` | `飞叶智能 · FEIYE INTELLIGENCE` |
| `zh.guide.gallerySub` | `以下是使用蕉幻生成的...` | `以下是使用飞叶智能生成的...` |
| `zh.guide.hi` | `欢迎使用蕉幻！` | `欢迎使用飞叶智能！` |
| `zh.guide.s4d` | `可在 github issue 提出` | `请联系飞叶智能技术支持团队` |
| `zh.guide.issueLink` | `前往 Github issue` | `联系技术支持` |
| `en.guide.brand` | `Banana Slides` | `FEIYE INTELLIGENCE` |
| `en.guide.gallerySub` | `...generated with Banana Slides` | `...generated with FEIYE INTELLIGENCE` |
| `en.guide.hi` | `Welcome to Banana Slides!` | `Welcome to FEIYE INTELLIGENCE!` |
| `en.guide.s4d` | `please raise them on GitHub issues` | `please contact FEIYE INTELLIGENCE technical support` |
| `en.guide.issueLink` | `Go to GitHub Issues` | `Contact Support` |

Logo alt 文字从 `Banana Slides Logo` 改为 `FEIYE INTELLIGENCE Logo`。

### `frontend/src/pages/Home.tsx`

| 位置 | 原值 | 新值 |
|------|------|------|
| `zh.home.title` | `蕉幻` | `飞叶智能` |
| `zh.home.subtitle` | `Vibe your slides like vibe coding` | `AI-Powered Presentation Generator` |
| `zh.home.tagline` | `基于 nano banana pro🍌 的原生 AI PPT 生成器` | `飞叶智能 FEIYE INTELLIGENCE — 原生 AI PPT 生成器` |
| `en.home.title` | `Banana Slides` | `FEIYE INTELLIGENCE` |
| `en.home.subtitle` | `Vibe your slides like vibe coding` | `AI-Powered Presentation Generator` |
| `en.home.tagline` | `AI-native PPT generator powered by nano banana pro🍌` | `AI-native PPT generator by FEIYE INTELLIGENCE` |
| 导航栏品牌名 | `蕉幻` | `飞叶智能` |
| 导航栏渐变色 | `from-banana-600 via-orange-500 to-pink-500` | `from-banana-600 via-banana-500 to-banana-400` |
| 标题栏品牌名 | `蕉幻 · Banana Slides` / `Banana Slides` | `飞叶智能 · FEIYE INTELLIGENCE` / `FEIYE INTELLIGENCE` |
| Logo alt | `蕉幻 Banana Slides Logo` | `飞叶智能 Logo` |

### `frontend/src/pages/Landing.tsx`

| 位置 | 原值 | 新值 |
|------|------|------|
| `zh.landing.hero.subtitle` | `...交给 Banana Slides...` | `...交给飞叶智能...` |
| `en.landing.hero.subtitle` | `...leave the rest to Banana Slides...` | `...leave the rest to FEIYE INTELLIGENCE...` |
| 导航栏品牌名 | `Banana Slides` | `FEIYE INTELLIGENCE` |

---

## 三、GitHub 相关移除

### `frontend/src/components/shared/GithubBadge.tsx`

整个组件替换为 `() => null`（渲染空内容）。原组件会请求 GitHub API 获取 star/fork 数并展示徽章。

### `frontend/src/components/shared/GithubRepoCard.tsx`

整个组件替换为 `() => null`（渲染空内容）。原组件会展示仓库卡片（star/fork 数）。

### `frontend/src/components/shared/HelpModal.tsx`

- 步骤 4「问题反馈」中的 GitHub Issues 链接改为 `mailto:support@feiye.ai`
- 案例展示页「查看更多」链接（原指向 GitHub Issues）改为纯文字展示
- 底部 footer 中的 GitHub 链接改为「飞叶智能」文字

### `frontend/src/pages/Landing.tsx`

- Hero 区域的 GitHub 按钮（`<a href="https://github.com/...">GitHub</a>`）整体移除
- 移除未使用的 `Github` lucide-react import

---

## 四、Logo 文件

### 当前状态

| 文件 | 说明 |
|------|------|
| `frontend/public/feiye.svg` | **占位符**，蓝底白字「飞叶 / FEIYE INTELLIGENCE」，用于 favicon |
| `frontend/public/logo.png` | 原香蕉 logo，**待替换** |
| `frontend/public/banana.svg` | 原香蕉 favicon，已不再引用（可删除） |

### 替换 Logo 的步骤

1. 将公司 logo 文件放入 `frontend/public/`，建议命名：
   - `logo.png`（主 logo，建议 512×512 或更大，PNG 格式）
   - `feiye.svg`（favicon，建议正方形 SVG）

2. `logo.png` 被以下位置引用，替换文件后自动生效：
   - `frontend/src/components/shared/HelpModal.tsx` line 163：欢迎页 logo
   - `frontend/src/pages/Home.tsx` line 658：导航栏 logo
   - `frontend/src/pages/Landing.tsx` line 97：落地页导航栏 logo

3. `feiye.svg` 被 `frontend/index.html` 引用为 favicon，替换文件后自动生效。

---

## 五、未改动的内容（上游合并友好）

以下内容**刻意保留不改**，以降低与上游合并时的冲突概率：

- 所有 Tailwind class 名称（`banana-*` 系列）保持不变
- 组件文件结构和 props 接口不变
- 后端代码完全不涉及
- i18n key 结构不变（只改 value）
- 路由结构不变

---

## 六、后续维护指南

### 合并上游更新后的检查清单

每次从 `upstream/main` 合并更新后，检查以下内容是否需要重新适配：

- [ ] 是否新增了包含 `蕉幻`、`Banana Slides`、`banana pro` 字样的文件
- [ ] 是否新增了引用 `github.com/Anionex` 的链接
- [ ] 是否新增了使用 `banana-yellow` 硬编码色值（而非 CSS 变量）的样式
- [ ] `index.html` 的 `<title>` 是否被上游覆盖
- [ ] `Footer.tsx`、`GithubBadge.tsx`、`GithubRepoCard.tsx` 是否被上游修改

### 快速搜索命令

```bash
# 检查品牌名残留
grep -r "蕉幻\|Banana Slides\|banana pro\|banana-slides" frontend/src/ --include="*.tsx" --include="*.ts"

# 检查 GitHub 链接残留
grep -r "github.com/Anionex" frontend/src/ --include="*.tsx" --include="*.ts"

# 检查硬编码黄色值
grep -r "#FFD700\|#FFC700\|#FFE44D" frontend/src/ --include="*.tsx" --include="*.css"
```

---

*本文档由 Kiro 自动生成，分支：`feature/feiye-branding`，基准：`main`*
