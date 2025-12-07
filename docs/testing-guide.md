# 🧪 Banana Slides 测试指南

本文档介绍如何在本地和CI环境中运行测试。

## 📋 测试类型概览

| 测试类型 | 位置 | 运行命令 | 用途 |
|---------|------|---------|------|
| 后端单元测试 | `backend/tests/unit/` | `npm run test:backend` | 测试单个函数/类 |
| 后端集成测试 | `backend/tests/integration/` | `npm run test:backend` | 测试API端点 |
| 前端组件测试 | `frontend/src/tests/` | `npm run test:frontend` | 测试React组件 |
| E2E测试 | `e2e/` | `npm run test:e2e` | 测试完整用户流程 |
| Docker测试 | `tests/docker/` | `npm run test:docker` | 测试容器化部署 |

---

## 🚀 快速开始

### 1. 安装依赖

```bash
# 一键安装所有测试依赖
npm run setup:test

# 或者分步安装：
# 后端（含测试依赖）
uv sync --extra test

# 前端依赖
cd frontend && npm install

# E2E测试依赖
npm install
npx playwright install chromium
```

> **注意**: 普通用户运行 `uv sync` 不会安装测试依赖，只有 `uv sync --extra test` 才会安装。

### 2. 运行快速检查（Push前必做）

```bash
# 方式1：使用npm脚本
npm run quick-check

# 方式2：使用shell脚本
chmod +x scripts/pre-push-check.sh
./scripts/pre-push-check.sh
```

### 3. 运行完整测试

```bash
# 运行所有测试
npm run test:all

# 或分开运行
npm run test:backend    # 后端测试
npm run test:frontend   # 前端测试
npm run test:docker     # Docker测试
npm run test:e2e        # E2E测试
```

---

## 🔧 详细测试说明

### 后端测试 (pytest)

```bash
cd backend

# 运行所有测试
uv run pytest tests/ -v

# 只运行单元测试
uv run pytest tests/unit -v

# 只运行集成测试
uv run pytest tests/integration -v

# 运行特定测试文件
uv run pytest tests/unit/test_api_project.py -v

# 生成覆盖率报告
uv run pytest tests/ --cov=. --cov-report=html

# 查看覆盖率报告
open htmlcov/index.html
```

**测试标记：**

```bash
# 只运行标记为unit的测试
uv run pytest -m unit

# 跳过慢速测试
uv run pytest -m "not slow"
```

### 前端测试 (Vitest)

```bash
cd frontend

# 运行一次测试
npm test -- --run

# 监听模式（开发时使用）
npm test

# 生成覆盖率报告
npm run test:coverage

# 使用UI界面运行测试
npm run test:ui
```

### E2E测试 (Playwright)

```bash
# 确保Docker服务运行
docker-compose up -d

# 运行E2E测试
npm run test:e2e

# 使用UI界面
npm run test:e2e:ui

# 只运行特定测试
npx playwright test home.spec.ts

# 调试模式
npx playwright test --debug

# 查看测试报告
npx playwright show-report
```

### Docker环境测试

```bash
# 运行完整Docker测试
npm run test:docker

# 或直接运行脚本
chmod +x tests/docker/test_docker_environment.sh
./tests/docker/test_docker_environment.sh
```

---

## 🔄 CI/CD 工作流

### PR创建时

自动运行 **快速检查**（约2-3分钟）：
- Lint检查
- 构建检查
- 冒烟测试

### 合并到develop/main时

自动运行 **完整测试**（约10-15分钟）：
- 后端单元测试
- 后端集成测试
- 前端测试
- Docker环境测试
- E2E测试
- 安全扫描

---

## 📝 编写测试指南

### 后端测试示例

```python
# backend/tests/unit/test_example.py
import pytest
from tests.conftest import assert_success_response

class TestExample:
    def test_something(self, client):
        response = client.get('/api/endpoint')
        data = assert_success_response(response)
        assert data['data']['key'] == 'expected_value'
```

### 前端测试示例

```typescript
// frontend/src/tests/components/Example.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ExampleComponent from '@/components/ExampleComponent'

describe('ExampleComponent', () => {
  it('renders correctly', () => {
    render(<ExampleComponent />)
    expect(screen.getByText('Expected Text')).toBeInTheDocument()
  })
})
```

### E2E测试示例

```typescript
// e2e/example.spec.ts
import { test, expect } from '@playwright/test'

test('example flow', async ({ page }) => {
  await page.goto('/')
  await page.click('button:has-text("Click me")')
  await expect(page.locator('.result')).toBeVisible()
})
```

---

## 🐛 常见问题

### Q: 测试找不到模块

```bash
# 后端：确保在backend目录并使用uv运行
cd backend
uv run pytest tests/

# 前端：确保安装了依赖
cd frontend
npm install
```

### Q: E2E测试连不上服务

```bash
# 确保Docker服务在运行
docker-compose up -d
docker-compose ps  # 检查状态

# 等待服务就绪
sleep 10
curl http://localhost:5000/health
curl http://localhost:3000
```

### Q: CI测试失败但本地通过

1. 检查环境变量是否正确设置
2. 检查是否有依赖版本差异
3. 检查CI日志中的具体错误

---

## 📊 测试覆盖率目标

| 模块 | 目标覆盖率 |
|-----|----------|
| 后端核心业务 | ≥ 80% |
| 后端API | 100% |
| 前端组件 | ≥ 70% |
| E2E核心流程 | 100% |

---

## 🔗 相关文档

- [Git工作流规范](./git-workflow.md)
- [API设计文档](../API设计文档.md)
- [后端测试报告](../后端测试报告.md)

