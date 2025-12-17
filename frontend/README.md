# 蕉幻 (Banana Slides) 前端

这是蕉幻 AI PPT 生成器的前端应用。

## 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **状态管理**: Zustand
- **样式**: TailwindCSS
- **路由**: React Router
- **拖拽**: @dnd-kit
- **图标**: Lucide React

## 开始开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

**注意**：现在不再需要配置 `VITE_API_BASE_URL`！

前端使用相对路径，通过代理自动转发到后端：
- **开发环境**：通过 Vite proxy 自动转发到后端
- **生产环境**：通过 nginx proxy 自动转发到后端服务

**一键修改后端端口**：
只需在项目根目录的 `.env` 文件中修改 `PORT` 环境变量（默认 5000），前端和后端都会自动使用新端口：

```env
PORT=8080  # 修改为 8080 或其他端口
```

这样无论后端运行在什么地址（localhost、IP 或域名），前端都能自动适配，无需手动配置。

### 3. 启动开发服务器

```bash
npm run dev
```

应用将在 http://localhost:3000 启动

### 4. 构建生产版本

```bash
npm run build
```

## 项目结构

```
src/
├── api/              # API 封装
│   ├── client.ts     # Axios 实例配置
│   └── endpoints.ts  # API 端点
├── components/       # 组件
│   ├── shared/       # 通用组件
│   ├── outline/      # 大纲编辑组件
│   └── preview/      # 预览组件
├── pages/            # 页面
│   ├── Home.tsx      # 首页
│   ├── OutlineEditor.tsx    # 大纲编辑页
│   ├── DetailEditor.tsx     # 详细描述编辑页
│   └── SlidePreview.tsx     # 预览页
├── store/            # 状态管理
│   └── useProjectStore.ts
├── types/            # TypeScript 类型
│   └── index.ts
├── utils/            # 工具函数
│   └── index.ts
├── App.tsx           # 应用入口
├── main.tsx          # React 挂载点
└── index.css         # 全局样式
```

## 主要功能

### 1. 首页 (/)
- 三种创建方式：一句话生成、从大纲生成、从描述生成
- 风格模板选择和上传

### 2. 大纲编辑页 (/project/:id/outline)
- 拖拽排序页面
- 编辑大纲内容
- 自动生成大纲

### 3. 详细描述编辑页 (/project/:id/detail)
- 批量生成页面描述
- 编辑单页描述
- 网格展示所有页面

### 4. 预览页 (/project/:id/preview)
- 查看生成的图片
- 编辑单页（自然语言修改）
- 导出为 PPTX/PDF

## 开发注意事项

### 状态管理
- 使用 Zustand 进行全局状态管理
- 关键状态会同步到 localStorage
- 页面刷新后自动恢复项目

### 异步任务
- 使用轮询机制监控长时间任务
- 显示实时进度
- 完成后自动刷新数据

### 图片处理
- 所有图片路径需通过 `getImageUrl()` 处理
- 支持相对路径和绝对路径

### 拖拽功能
- 使用 @dnd-kit 实现
- 支持键盘操作
- 乐观更新 UI

## 与后端集成

确保后端服务运行在配置的端口（默认 5000）：

```bash
cd ../backend
python app.py
```

## 浏览器支持

- Chrome (推荐)
- Firefox
- Safari
- Edge

