# 本地CI测试指南

在提交代码前，建议先在本地运行测试，确保代码质量。

## 🚀 快速开始

### 方法1：使用测试脚本（推荐）

```bash
# Light检查（2-3分钟）- 快速检查语法和构建
./scripts/run-local-ci.sh light

# Full测试（10-20分钟）- 完整测试套件
./scripts/run-local-ci.sh full
```

### 方法2：手动运行各个测试

```bash
# 1. 后端语法检查
cd backend
flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics

# 2. 前端Lint
cd frontend
npm run lint

# 3. 前端构建
npm run build

# 4. 后端单元测试
cd backend
uv run pytest tests/unit -v

# 5. 前端单元测试
cd frontend
npm test

# 6. Docker环境测试
./scripts/test_docker_environment.sh

# 7. E2E测试
docker-compose up -d
npx playwright test
```

## 📋 测试层级说明

### ⚡ Light检查（快速反馈）
**耗时**: 2-3分钟  
**适用场景**: 每次提交前快速检查

包含：
- ✅ Python语法检查（flake8）
- ✅ TypeScript Lint检查
- ✅ 前端构建检查

### 🎯 Full测试（完整验证）
**耗时**: 10-20分钟  
**适用场景**: PR合并前、重要功能完成后

包含：
- ✅ 后端单元测试
- ✅ 后端集成测试
- ✅ 前端单元测试
- ✅ Docker环境测试
- ✅ E2E端到端测试

## 🔧 前置依赖

### 必需工具

```bash
# Python环境
python3 --version  # >= 3.10

# Node.js环境
node --version     # >= 18

# UV包管理器（后端）
curl -LsSf https://astral.sh/uv/install.sh | sh

# Docker（用于环境测试和E2E测试）
docker --version
docker-compose --version
```

### 安装测试依赖

```bash
# 后端测试依赖
uv sync --extra test

# 前端依赖
cd frontend
npm ci

# Playwright（E2E测试）
npx playwright install --with-deps chromium
```

### 可选工具

```bash
# 代码格式检查
pip install flake8 black

# 前端格式化
cd frontend
npm install -D prettier
```

## 🧪 运行特定测试

### 只运行后端测试

```bash
cd backend

# 单元测试
uv run pytest tests/unit -v

# 集成测试
TESTING=true uv run pytest tests/integration -v

# 特定测试文件
uv run pytest tests/unit/test_ai_service.py -v

# 带覆盖率
uv run pytest tests/unit -v --cov=. --cov-report=html
# 查看覆盖率报告: open htmlcov/index.html
```

### 只运行前端测试

```bash
cd frontend

# 单元测试
npm test

# 监听模式（开发时）
npm test -- --watch

# 带覆盖率
npm test -- --coverage

# 特定测试文件
npm test -- src/components/Button.test.tsx
```

### 只运行E2E测试

```bash
# 1. 启动环境
docker-compose up -d
sleep 20

# 2. 运行E2E测试
npx playwright test

# 3. 只运行特定测试
npx playwright test home.spec.ts
npx playwright test full-flow.spec.ts

# 4. UI模式（可视化调试）
npx playwright test --ui

# 5. Debug模式
npx playwright test --debug
```

## 🎬 完整流程E2E测试

完整流程测试会测试从创建到导出PPT的整个流程，需要真实的AI API。

```bash
# 1. 设置API密钥
export GOOGLE_API_KEY=your-gemini-api-key

# 2. 启动Docker环境
docker-compose up -d

# 3. 运行完整流程测试
npx playwright test full-flow.spec.ts --workers=1

# 测试内容：
# - 创建项目
# - 生成大纲
# - 生成页面描述（真实AI调用）
# - 生成页面图片（真实AI调用）
# - 导出PPT文件
# - 验证文件可下载
```

**注意**：
- ⏱️ 完整流程测试需要5-10分钟
- 💰 会消耗真实API配额
- 🌐 需要网络连接

## 📊 查看测试报告

### 后端覆盖率报告

```bash
cd backend
uv run pytest tests/ --cov=. --cov-report=html
# WSL: explorer.exe htmlcov/index.html
# Linux: xdg-open htmlcov/index.html
```

### 前端覆盖率报告

```bash
cd frontend
npm test -- --coverage
# WSL: explorer.exe coverage/index.html
# Linux: xdg-open coverage/index.html
```

### E2E测试报告

```bash
# 运行测试后，查看报告
npx playwright show-report

# 或直接打开
# WSL: explorer.exe playwright-report/index.html
```

## 🐛 调试失败的测试

### 后端测试失败

```bash
# 1. 查看详细日志
cd backend
uv run pytest tests/unit/test_xxx.py -v -s

# 2. 进入调试模式
uv run pytest tests/unit/test_xxx.py --pdb

# 3. 只运行失败的测试
uv run pytest --lf  # last-failed
```

### 前端测试失败

```bash
cd frontend

# 查看详细日志
npm test -- --reporter=verbose

# 监听模式（自动重跑）
npm test -- --watch
```

### E2E测试失败

```bash
# 1. UI模式调试
npx playwright test --ui

# 2. Debug模式（逐步执行）
npx playwright test --debug

# 3. 查看失败截图
ls test-results/

# 4. 查看trace
npx playwright show-trace test-results/xxx/trace.zip
```

### Docker测试失败

```bash
# 查看容器日志
docker-compose logs backend
docker-compose logs frontend

# 重新构建
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## ✅ 提交前检查清单

在提交代码前，确保：

- [ ] Light检查通过（`./scripts/run-local-ci.sh light`）
- [ ] 本地手动测试主要功能
- [ ] 新增代码有对应的测试
- [ ] 所有测试文件运行通过
- [ ] 提交信息清晰明确

在合并PR前，确保：

- [ ] PR添加`ready-for-test`标签
- [ ] Full测试通过
- [ ] Code review完成
- [ ] 文档已更新（如果需要）

## 🚨 常见问题

### Q: 测试脚本权限错误
```bash
# 添加执行权限
chmod +x scripts/run-local-ci.sh
chmod +x scripts/test_docker_environment.sh
```

### Q: uv命令找不到
```bash
# 安装uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# 添加到PATH（WSL）
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### Q: Playwright浏览器未安装
```bash
# 安装所需浏览器
npx playwright install chromium
# 或安装所有依赖
npx playwright install --with-deps chromium
```

### Q: Docker端口冲突
```bash
# 停止所有容器
docker-compose down

# 查看占用端口的进程
lsof -i :5000
lsof -i :3000

# 杀掉进程或修改docker-compose.yml中的端口
```

### Q: 前端依赖安装失败
```bash
# 清理缓存重新安装
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## 💡 最佳实践

1. **频繁运行Light检查**：每次提交前都运行
2. **定期运行Full测试**：每天至少一次
3. **PR前运行完整测试**：确保所有测试通过
4. **修复失败立即重跑**：确认修复有效
5. **保持测试快速**：单元测试应该秒级完成
6. **隔离测试环境**：使用Docker避免环境污染

## 📚 相关资源

- [pytest文档](https://docs.pytest.org)
- [Vitest文档](https://vitest.dev)
- [Playwright文档](https://playwright.dev)
- [CI配置说明](.github/CI_SETUP.md)

---

**提示**: 本地测试只是第一道防线，GitHub Actions会运行完整的CI测试确保代码质量！

