# Contributing to Banana-slides

Thank you for your interest in contributing to Banana-slides! We welcome contributions from the community.

## Before You Start

### Contributor License Agreement (CLA)

By submitting a Pull Request (or any other Contribution intended for inclusion) to this repository, you confirm that you have read and agree to the terms of our [Contributor License Agreement (CLA)](CLA.md).
If you do not agree to the CLA, please do not submit a Pull Request.

**Why do we need a CLA?**

- To ensure we have the necessary rights to use, modify, and distribute contributions
- To allow the project to explore sustainable commercial models while keeping the open-source edition available
- To protect both contributors and the project legally

**How to agree:**

When you open a Pull Request, the PR template includes a CLA checkbox. Simply check it to indicate your agreement. PRs without the CLA checkbox checked may be delayed or closed.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/Anionex/banana-slides/issues)
2. If not, create a new issue with:
   - A clear, descriptive title
   - Steps to reproduce the bug
   - Expected behavior vs actual behavior
   - Screenshots if applicable
   - Your environment (OS, browser, etc.)

### Suggesting Features

1. Check existing issues for similar suggestions
2. Create a new issue with the "feature request" label
3. Describe the feature and its use case

### Submitting Code

1. Fork the repository
2. Create a new branch for your feature/fix: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Test your changes thoroughly
5. Commit with clear, descriptive messages
6. Push to your fork
7. Open a Pull Request with:
   - A clear description of the changes
   - Reference to any related issues
   - **CLA checkbox checked** (PRs without this may be delayed/closed) (PRs without this statement may be delayed/closed)

## Development Setup

### 环境要求 / Requirements

- Python 3.10+
- [uv](https://github.com/astral-sh/uv) - Python 包管理器
- Node.js 16+ 和 npm
- 有效的 API 密钥（详见 `.env.example`）

### 安装步骤 / Installation

```bash
# 克隆代码仓库
git clone https://github.com/Anionex/banana-slides.git
cd banana-slides

# 安装 uv（如果尚未安装）
curl -LsSf https://astral.sh/uv/install.sh | sh

# 安装后端依赖（在项目根目录运行）
uv sync

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置你的 API 密钥

# 安装前端依赖
cd frontend
npm install
```

### 启动开发服务器 / Start Development Server

```bash
# 启动后端（在项目根目录）
cd backend
uv run alembic upgrade head && uv run python app.py
# 后端运行在 http://localhost:5000

# 启动前端（新开一个终端）
cd frontend
npm run dev
# 前端运行在 http://localhost:3000
```

## Code Style

- Follow the existing code style in the project
- Write clear, self-documenting code
- Add comments for complex logic
- Include tests for new features when applicable

## Questions?

If you have questions, feel free to open an issue or reach out to the maintainers.

---

Thank you for contributing to Banana-slides! 🍌
