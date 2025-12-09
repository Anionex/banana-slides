# 🍌 Banana Slides - AI PPT 生成器

基于 Gemini AI 的智能 PPT 生成工具，支持从想法、大纲或描述快速生成专业演示文稿。

## ✨ 特性

- 🤖 **AI 驱动**：使用 Google Gemini 2.0 生成内容和图片
- 📝 **三种生成方式**：
  - 从想法生成（一句话生成完整 PPT）
  - 从大纲生成（结构化内容）
  - 从描述生成（详细描述）
- 📄 **文件解析**：支持 PDF、DOCX、PPTX 等文件解析（MinerU）
- 🎨 **模板系统**：预设模板 + 自定义模板
- 🖼️ **AI 图片生成**：自动为每页生成配图
- 🌐 **多语言支持**：中文、英文
- 🎯 **纯前端模式**：无需后端，直接部署到 Vercel
- 📦 **一键导出**：支持 PPTX 和 PDF 格式

## 🚀 快速开始

### 在线体验

访问 [Demo](https://your-domain.vercel.app)（部署后填写）

### 本地运行

#### 前置要求

- Node.js 18+
- npm 或 yarn

#### 安装步骤

1. **克隆项目**

```bash
git clone https://github.com/your-username/banana-slides.git
cd banana-slides
```

2. **安装依赖**

```bash
cd frontend
npm install
```

3. **配置环境变量**

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 API Keys：

```env
# 必需：Gemini API Key
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# 可选：MinerU Token（用于文件解析）
VITE_MINERU_TOKEN=your_mineru_token_here
```

4. **启动开发服务器**

```bash
npm run dev
```

访问 `http://localhost:3002`

## 🔑 获取 API Keys

### Gemini API Key（必需）

1. 访问 [Google AI Studio](https://aistudio.google.com/apikey)
2. 登录 Google 账号
3. 点击 "Create API Key"
4. 复制 API Key

### MinerU Token（可选，用于文件解析）

1. 访问 [MinerU](https://mineru.net)
2. 注册并登录
3. 在个人中心获取 API Token
4. 免费额度：每天 2000 页

## 📦 部署到 Vercel

### 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/banana-slides)

### 手动部署

1. **安装 Vercel CLI**

```bash
npm install -g vercel
```

2. **登录 Vercel**

```bash
vercel login
```

3. **部署**

```bash
./deploy-vercel.sh
```

或者：

```bash
vercel --prod
```

4. **配置环境变量**

在 Vercel Dashboard 中：
- 进入项目 Settings → Environment Variables
- 添加 `VITE_GEMINI_API_KEY`
- 添加 `VITE_MINERU_TOKEN`（可选）
- 重新部署

## 🛠️ 技术栈

### 前端
- **框架**：React 18 + TypeScript
- **构建工具**：Vite
- **状态管理**：Zustand
- **UI 组件**：Tailwind CSS + Lucide Icons
- **路由**：React Router
- **国际化**：i18next

### AI 服务
- **文本生成**：Google Gemini 2.0 Flash
- **图片生成**：Google Gemini 2.0 Flash (Imagen 3)
- **文件解析**：MinerU API

### 部署
- **前端托管**：Vercel
- **Serverless Functions**：Vercel Functions（解决 CORS）
- **存储**：localStorage（本地模式）

## 📖 使用指南

### 1. 从想法生成

输入一句话描述你的 PPT 主题：

```
例如：介绍人工智能的发展历史
```

AI 会自动生成：
- 完整的大纲结构
- 每页的详细内容
- 配套的图片

### 2. 从大纲生成

输入结构化的大纲：

```
# 人工智能简介
## 什么是人工智能
- 定义
- 发展历程
## AI 的应用
- 医疗
- 教育
- 金融
```

### 3. 从描述生成

输入详细的描述文本，AI 会提取关键信息生成 PPT。

### 4. 上传参考文件

支持上传以下文件作为参考：
- PDF 文档
- Word 文档（.docx）
- PowerPoint 文档（.pptx）
- 文本文件（.txt, .md）

## 🔧 配置说明

### 环境变量

| 变量名 | 必需 | 说明 | 默认值 |
|--------|------|------|--------|
| `VITE_MODE` | 否 | 运行模式 | `local` |
| `VITE_GEMINI_API_KEY` | 是 | Gemini API Key | - |
| `VITE_GEMINI_API_BASE` | 否 | Gemini API 地址 | `https://apipro.maynor1024.live` |
| `VITE_MINERU_TOKEN` | 否 | MinerU Token | - |
| `VITE_MINERU_API_BASE` | 否 | MinerU API 地址 | `https://mineru.net/api/v4` |

### 运行模式

- **local**（推荐）：纯前端模式，数据存储在 localStorage
- **backend**：使用后端 API

## 🐛 故障排除

### CORS 错误

如果遇到 CORS 错误（特别是 MinerU API），请：

1. 确保已部署到 Vercel（Serverless Functions 会处理 CORS）
2. 或者使用 `vercel dev` 在本地测试

详见：[MINERU_CORS_SOLUTION.md](./MINERU_CORS_SOLUTION.md)

### 文件解析失败

1. 检查 MinerU Token 是否有效
2. 检查文件大小（< 200MB）和页数（< 600 页）
3. 查看浏览器控制台日志

### API 调用失败

1. 检查 API Key 是否正确
2. 检查网络连接
3. 查看 API 额度是否用完

## 📚 文档

- [部署指南](./VERCEL_DEPLOYMENT_GUIDE.md)
- [CORS 问题解决](./MINERU_CORS_SOLUTION.md)
- [文件解析指南](./FILE_PARSING_GUIDE.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- [Google Gemini](https://ai.google.dev/) - AI 模型
- [MinerU](https://mineru.net) - 文件解析
- [Vercel](https://vercel.com) - 部署平台
- [React](https://react.dev/) - 前端框架

## 📧 联系

- 项目主页：[GitHub](https://github.com/your-username/banana-slides)
- 问题反馈：[Issues](https://github.com/your-username/banana-slides/issues)

---

Made with ❤️ by [Your Name]
