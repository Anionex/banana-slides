# Banana Slides 🍌

AI 驱动的 PPT 生成器

## 技术栈

### 前端 (Frontend)

- **React 18** + TypeScript
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架
- **Zustand** - 状态管理
- **React Router** - 路由

### 后端 (Backend)

- **Python 3.10+** + Flask
- **SQLite** + SQLAlchemy - 数据库
- **Alembic** - 数据库迁移
- **uv** - 依赖管理

### 桌面端 (Desktop)

- **Electron 28** - 跨平台桌面框架
- **electron-builder** - 打包工具
- **PyInstaller** - Python 打包

---

## 项目结构

```
banana-slides/
├── frontend/                   # React 前端
│   ├── src/
│   │   ├── api/               # API 客户端
│   │   ├── components/        # 组件
│   │   ├── pages/             # 页面
│   │   ├── store/             # Zustand 状态
│   │   └── utils/             # 工具函数
│   ├── e2e/                   # E2E 测试
│   ├── package.json
│   └── Dockerfile
│
├── backend/                    # Python Flask 后端
│   ├── controllers/           # 路由控制器
│   ├── models/                # 数据模型
│   ├── services/              # 业务逻辑
│   ├── migrations/            # Alembic 迁移
│   ├── tests/                 # 单元测试
│   ├── pyproject.toml         # Python 依赖
│   ├── uv.lock
│   └── Dockerfile
│
├── desktop/                    # Electron 桌面端
│   ├── main.js                # 主进程
│   ├── preload.js             # 预加载脚本
│   ├── python-manager.js      # Python 进程管理
│   ├── banana-slides.spec     # PyInstaller 配置
│   ├── electron-builder.yml   # 打包配置
│   ├── resources/             # 图标资源
│   │   ├── icon.ico          # Windows 图标
│   │   ├── icon.icns         # macOS 图标
│   │   └── icon.png          # 通用图标
│   └── scripts/
│       └── build-all.bat     # Windows 构建脚本
│
├── docker-compose.yml          # Docker 编排
├── package.json                # 根 workspace 脚本
└── .github/
    └── workflows/
        ├── ci-test.yml        # CI 测试
        ├── docker-publish.yml # Docker 镜像发布
        └── release-desktop.yml # 桌面端发布
```

---

## 本地开发

### 后端

```bash
cd backend
uv sync                    # 安装依赖
uv run python app.py       # 启动开发服务器 (http://localhost:5000)
```

### 前端

```bash
cd frontend
npm install
npm run dev               # 启动开发服务器 (http://localhost:5173)
```

### 桌面端（开发模式）

```bash
# 1. 先启动后端
cd backend && uv run python app.py

# 2. 启动 Electron（另一个终端）
cd desktop
npm install
npm run dev
```

---

## 打包构建

### Docker 部署

```bash
# 构建并启动
docker compose up --build

# 访问
# 前端: http://localhost:3000
# 后端: http://localhost:5000
```

### 桌面端打包

#### Windows

```bash
cd desktop/scripts
./build-all.bat
# 输出: desktop/dist/BananaSlides-x.x.x-Setup.exe
```

#### macOS / Linux

```bash
# 1. 构建前端
cd frontend && npm run build

# 2. 打包 Python 后端
cd backend && pyinstaller ../desktop/banana-slides.spec --clean --noconfirm

# 3. 复制构建产物
cp -r frontend/dist desktop/frontend
cp -r backend/dist/banana-backend desktop/backend

# 4. 打包 Electron
cd desktop && npm install
npx electron-builder --mac    # macOS: .dmg
npx electron-builder --linux  # Linux: .AppImage
npx electron-builder --win    # Windows: .exe
```

### GitHub Actions 自动构建

创建 Release 时自动触发构建：

1. 创建 Git 标签: `git tag v0.3.1 && git push origin v0.3.1`
2. 在 GitHub 创建 Release，选择该标签
3. Actions 自动构建 Windows exe + macOS dmg
4. 构建产物自动上传到 Release 附件

---

## 用户数据位置

桌面端用户数据存储在系统用户目录，升级时不会丢失：

| 平台 | 路径 |
|------|------|
| Windows | `%APPDATA%\Banana Slides\` |
| macOS | `~/Library/Application Support/Banana Slides/` |
| Linux | `~/.config/Banana Slides/` |

数据包括：

- `data/database.db` - 项目数据库
- `uploads/` - 上传的模板和素材
- `exports/` - 导出的 PPT 文件

---

## 脚本命令

根目录 `package.json` 包含以下常用命令：

```bash
npm run dev:frontend     # 启动前端开发服务器
npm run dev:backend      # 启动后端开发服务器
npm run test:frontend    # 运行前端测试
npm run test:backend     # 运行后端测试
npm run lint:backend     # 后端代码检查
```

---

## License

CC-BY-NC-SA-4.0
