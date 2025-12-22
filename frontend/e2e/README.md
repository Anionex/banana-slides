# E2E 测试说明

## 📋 测试策略

本项目采用**单一真正的 E2E 测试**策略，避免"伪 E2E"测试造成混淆。

### 测试金字塔

```
        ┌──────────────────┐
        │   E2E 测试        │  ← 少量，测试完整流程，需要真实 API
        │  (api-full-flow)  │
        └──────────────────┘
              ▲
              │
      ┌───────────────────┐
      │   集成测试         │  ← 中等，测试 API 端点，使用 mock
      │  (backend/tests/)  │
      └───────────────────┘
            ▲
            │
    ┌─────────────────────┐
    │   单元测试           │  ← 大量，快速，独立
    │ (前端 + 后端)        │
    └─────────────────────┘
```

---

## 🎯 E2E 测试文件

### 1. **api-full-flow.spec.ts** ⭐ 主要 E2E 测试

**特点**：
- ✅ 真正的端到端测试（完整流程）
- ✅ 使用真实的 AI API（Google Gemini）
- ✅ 测试从创建到导出的完整链路
- ✅ 在 CI 中自动运行（如果配置了 API key）

**测试流程**：
```
1. 创建项目（从想法/大纲/描述）
   ↓
2. 等待 AI 生成大纲
   ↓
3. 生成页面描述
   ↓
4. 生成页面图片
   ↓
5. 导出 PPT 文件
```

**运行条件**：
- ⚠️ 需要真实的 `GOOGLE_API_KEY`
- ⚠️ 需要约 10-15 分钟
- ⚠️ 会消耗 API 配额（约 $0.01-0.05/次）

**本地运行**：
```bash
# 1. 确保 .env 中配置了真实的 GOOGLE_API_KEY
# 2. 启动服务
docker compose up -d

# 3. 等待服务就绪（使用智能等待脚本）
./scripts/wait-for-health.sh http://localhost:5000/health 60 2
./scripts/wait-for-health.sh http://localhost:3000 60 2

# 4. 运行测试
npx playwright test api-full-flow.spec.ts --workers=1
```

**CI 运行**：
- 自动运行：在 `docker-test` job 中
- 条件：`GOOGLE_API_KEY` 已在 GitHub Secrets 中配置
- 跳过：如果没有配置 API key，会跳过并显示说明

---

### 2. **ui-full-flow.spec.ts** 🎨 UI 驱动的完整测试

**特点**：
- ✅ 从浏览器 UI 开始操作（模拟真实用户）
- ✅ 测试完整的用户交互流程
- ✅ 需要真实的 AI API（Google Gemini）
- ⚠️ 运行时间更长（15-20 分钟）
- ✅ 在 CI 中自动运行（如果有 API key）

**用途**：
- 发布前的最终验证
- 验证真实用户体验
- CI/CD 完整流程测试

**本地运行**：
```bash
# 1. 确保 .env 中配置了真实的 GOOGLE_API_KEY
# 2. 启动服务
docker compose up -d

# 3. 等待服务就绪
./scripts/wait-for-health.sh http://localhost:5000/health 60 2
./scripts/wait-for-health.sh http://localhost:3000 60 2

# 4. 运行测试
npx playwright test ui-full-flow.spec.ts --workers=1
```

**CI 运行**：
- 自动运行：在 `docker-test` job 中
- 条件：`GOOGLE_API_KEY` 已在 GitHub Secrets 中配置
- 跳过：如果没有配置 API key 或是 Fork PR，会跳过并显示说明

---

## 🚫 已删除的测试

以下测试文件已被删除（避免混淆）：

- ~~`home.spec.ts`~~ - 基础 UI 测试（不是真正的 E2E）
- ~~`create-ppt.spec.ts`~~ - API 集成测试（不是真正的 E2E）

**原因**：
- 它们不调用真实 AI API，不是真正的端到端测试
- 测试的内容已被其他测试覆盖：
  - UI 交互 → 前端单元测试
  - API 端点 → 后端集成测试
  - 完整流程 → `api-full-flow.spec.ts`

---

## 🔧 CI 配置

### 在 GitHub Actions 中的运行逻辑

```yaml
# .github/workflows/ci-test.yml

docker-test job:
  ├─ 构建 Docker 镜像
  ├─ 启动服务
  ├─ 健康检查
  ├─ Docker 环境测试
  └─ E2E 测试 (api-full-flow.spec.ts)
      ├─ 如果有 GOOGLE_API_KEY → 运行完整 E2E
      └─ 如果没有 API key → 跳过，显示说明
```

### 配置 GitHub Secrets

要在 CI 中运行 E2E 测试，需要配置：

1. 进入仓库 → **Settings** → **Secrets and variables** → **Actions**
2. 添加 Secret：
   - Name: `GOOGLE_API_KEY`
   - Value: 你的 Google Gemini API 密钥
   - 获取地址：https://aistudio.google.com/app/apikey

### 如果没有配置 API key

CI 会跳过 E2E 测试，并显示：

```
⚠️  Skipping E2E tests

Reason: GOOGLE_API_KEY not configured or using mock key

Note: Other tests already passed:
  ✅ Backend unit tests
  ✅ Backend integration tests (with mock AI)
  ✅ Frontend unit tests
  ✅ Docker environment tests

E2E tests require a real Google API key to test the complete AI generation workflow.
```

**这是正常的！** 其他测试已经覆盖了大部分功能。

---

## 📊 测试覆盖范围

| 测试层级 | 测试内容 | 需要真实 API | 运行时间 | CI 运行 |
|---------|---------|-------------|---------|---------|
| **前端单元测试** | React 组件、hooks、工具函数 | ❌ | < 1 分钟 | ✅ 总是 |
| **后端单元测试** | Services、Utils、Models | ❌ | < 2 分钟 | ✅ 总是 |
| **后端集成测试** | API 端点（mock AI） | ❌ | < 3 分钟 | ✅ 总是 |
| **Docker 环境测试** | 容器启动、健康检查 | ❌ | < 5 分钟 | ✅ 总是 |
| **E2E 测试** | 完整 AI 生成流程 | ✅ | 10-15 分钟 | ⚠️ 有 API key 时 |

---

## 🎯 最佳实践

### 开发时

1. **日常开发**：运行单元测试和集成测试
   ```bash
   # 后端
   cd backend && uv run pytest tests/
   
   # 前端
   cd frontend && npm test
   ```

2. **提交 PR 前**：确保 CI 的所有测试通过
   - Light Check（自动运行）
   - Full Test（添加 `ready-for-test` 标签触发）

3. **大功能完成后**：本地运行一次 E2E 测试
   ```bash
   # 确保 .env 配置了真实 API key
   npx playwright test api-full-flow.spec.ts
   ```

### 发布前

1. **最终验证**：运行完整的 UI E2E 测试
   ```bash
   npx playwright test ui-full-flow.spec.ts
   ```

2. **检查 CI**：确保所有测试（包括 E2E）都通过

---

## 🐛 调试失败的测试

### 查看测试报告

```bash
# 运行测试后，打开 HTML 报告
npx playwright show-report
```

### 查看失败截图和视频

测试失败时，Playwright 会自动保存：
- 截图：`test-results/**/test-failed-*.png`
- 视频：`test-results/**/video.webm`
- 追踪：`test-results/**/trace.zip`

### 查看追踪

```bash
npx playwright show-trace test-results/**/trace.zip
```

### UI 模式调试

```bash
# 在 UI 模式下运行测试（可以看到浏览器操作过程）
npx playwright test --ui
```

---

## 📚 相关文档

- [Playwright 文档](https://playwright.dev)
- [CI 配置说明](../.github/CI_SETUP.md)
- [项目 README](../README.md)

---

**最后更新**: 2025-12-22  
**测试策略**: 单一真正的 E2E 测试
