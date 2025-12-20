# CI/CD 配置说明

本项目使用GitHub Actions实现自动化CI/CD，包含**Light检查**和**Full测试**两个层级。

## 📋 CI架构概览

### 🚀 Light检查 - PR快速反馈
**触发时机**: 提交PR时自动运行  
**耗时**: 2-5分钟  
**工作流**: `.github/workflows/pr-quick-check.yml`

包含：
- ✅ 代码语法检查（flake8, ESLint）
- ✅ 代码格式检查（black, prettier）
- ✅ TypeScript构建检查
- ✅ 后端冒烟测试（健康检查）
- ✅ PR自动评论

### 🎯 Full测试 - 完整验证
**触发时机**:
1. Push到`main`或`develop`分支
2. PR合并后自动运行
3. **PR添加`ready-for-test`标签时** 👈 手动触发

**耗时**: 15-30分钟  
**工作流**: `.github/workflows/ci-test.yml`

包含：
- ✅ 后端单元测试（pytest + coverage）
- ✅ 后端集成测试
- ✅ 前端测试（Vitest + coverage）
- ✅ Docker环境测试
- ✅ **完整E2E测试（从创建到导出PPT）**
- ✅ 安全扫描（依赖漏洞检查）

---

## 🔧 配置步骤

### 1. 配置GitHub Secrets（必需）

为了运行完整的E2E测试（包含真实AI生成），需要配置以下Secrets：

#### 步骤：
1. 进入GitHub仓库页面
2. 点击 `Settings` → `Secrets and variables` → `Actions`
3. 点击 `New repository secret`
4. 添加以下Secret：

| Secret名称 | 必需 | 说明 | 获取方式 |
|-----------|------|------|---------|
| `GOOGLE_API_KEY` | ✅ 必需 | Google Gemini API密钥（用于完整E2E测试） | [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| `OPENAI_API_KEY` | ⚪ 可选 | OpenAI API密钥（如果使用OpenAI格式） | [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `SECRET_KEY` | ⚪ 可选 | Flask应用密钥（生产环境建议配置） | 随机生成，建议使用：`python -c "import secrets; print(secrets.token_hex(32))"` |
| `MINERU_TOKEN` | ⚪ 可选 | MinerU服务Token（如果使用MinerU解析） | 从MinerU服务获取 |

**注意**：
- ⚠️ **没有配置`GOOGLE_API_KEY`时，完整E2E测试会被跳过**
- ✅ 基础E2E测试（UI测试、API测试）仍会运行
- 💰 真实API调用会消耗配额，建议使用测试专用账号
- 🔧 CI会自动将Secrets替换到`.env`文件中对应的占位符（`your-api-key-here`）

**CI如何处理Secrets**：

CI配置会自动处理以下逻辑：

1. **复制`.env.example`到`.env`**（保持所有默认配置）
2. **自动检测并替换Secrets**：
   - 如果GitHub Secrets中配置了某个Secret → 自动替换`.env`中对应的占位符
   - 如果没有配置 → 保持`.env.example`中的默认值

**支持的Secrets列表**：

CI配置会自动检测并替换以下Secrets（如果配置了的话）：

- ✅ `GOOGLE_API_KEY` - 必需，如果没有配置则使用`mock-api-key`
- ⚪ `OPENAI_API_KEY` - 可选，如果配置了则替换
- ⚪ `SECRET_KEY` - 可选，生产环境建议配置
- ⚪ `MINERU_TOKEN` - 可选，如果使用MinerU服务则配置

**添加新的Secret支持**：

如果需要支持其他配置项的Secret替换，只需在`.github/workflows/ci-test.yml`中添加对应的检查逻辑：

```yaml
# 在"设置环境变量"步骤中添加
if [ -n "${{ secrets.YOUR_NEW_SECRET }}" ]; then
  sed -i '/^YOUR_ENV_VAR=/s/placeholder/${{ secrets.YOUR_NEW_SECRET }}/' .env
  echo "✓ 已替换 YOUR_ENV_VAR"
fi
```

### 2. （可选）配置CodeCov

如果需要代码覆盖率报告和徽章：

1. 访问 [codecov.io](https://codecov.io)
2. 关联GitHub账号并授权仓库
3. 获取Upload Token（通常不需要，公开仓库自动识别）
4. 如需手动配置，添加Secret：`CODECOV_TOKEN`

---

## 🏷️ 如何触发Full测试

### 方法1：合并前手动触发（推荐）

当你认为PR已经准备好进行完整测试时：

```bash
# 在PR页面右侧，点击 "Labels"
# 添加 "ready-for-test" 标签
```

这会立即触发完整测试套件，包括：
- ✅ 所有单元和集成测试
- ✅ Docker环境测试
- ✅ **完整E2E测试（如果配置了真实API key）**

测试通过后，你就可以安心合并PR了！

### 方法2：自动触发

- Push到`main`或`develop`分支时自动运行
- PR合并后自动运行

---

## 🧪 测试文件说明

### Light检查测试
- **前端Lint**: `frontend/src/**/*.{ts,tsx}`
- **后端语法**: `backend/**/*.py`
- **冒烟测试**: 启动后端并检查`/health`端点

### Full测试文件
```
backend/tests/
├── unit/              # 后端单元测试
│   ├── test_ai_service.py
│   ├── test_file_service.py
│   └── ...
├── integration/       # 后端集成测试
│   ├── test_api.py
│   └── ...

frontend/src/
├── **/*.test.tsx     # 前端组件测试
└── **/*.spec.tsx     # 前端功能测试

e2e/
├── home.spec.ts           # 首页UI测试
├── create-ppt.spec.ts     # PPT创建基础测试
└── full-flow.spec.ts      # 🎯 完整流程测试（创建→大纲→描述→图片→导出）
```

---

## 📊 测试结果查看

### CI状态检查
- PR页面底部会显示所有检查状态
- 点击 `Details` 查看详细日志
- Light检查会在PR评论中自动发布结果

### 测试报告和覆盖率
- **代码覆盖率**: 自动上传到CodeCov（如果配置）
- **E2E测试报告**: 失败时会上传Playwright报告和截图
  - 在Actions页面 → 对应的workflow run → `Artifacts` 下载
  - `playwright-report`: HTML测试报告
  - `playwright-screenshots`: 失败时的截图和视频

### 查看日志
```bash
# 本地查看Actions日志
gh run list
gh run view <run-id> --log
```

---

## 🚨 常见问题

### Q1: E2E测试超时失败
**原因**: AI生成需要较长时间  
**解决**: 
- 检查API key是否有效
- 检查API配额是否用尽
- 本地运行测试验证：`npx playwright test full-flow.spec.ts`

### Q2: Docker测试失败
**原因**: 容器启动超时或端口冲突  
**解决**:
- 检查`docker-compose.yml`配置
- 查看容器日志（CI会在失败时自动显示）
- 本地测试：`./scripts/test_docker_environment.sh`

### Q3: 前端构建失败
**原因**: TypeScript类型错误或依赖问题  
**解决**:
- 本地运行：`cd frontend && npm run build:check`
- 检查`frontend/package.json`依赖版本
- 确保`package-lock.json`已提交

### Q4: "ready-for-test"标签不触发测试
**原因**: Workflow权限或配置问题  
**解决**:
- 确认标签名称完全匹配（小写，带连字符）
- 检查仓库Settings → Actions → General → Workflow permissions
- 查看Actions页面确认workflow是否被触发

---

## 📝 本地测试

在提交PR前，建议本地运行测试：

```bash
# 后端测试
cd backend
uv run pytest tests/ -v

# 前端测试
cd frontend
npm run lint
npm test
npm run build

# Docker环境测试
./scripts/test_docker_environment.sh

# E2E测试（需要Docker环境运行）
docker-compose up -d
npx playwright test
```

---

## 🎯 最佳实践

### 开发流程建议

1. **开发阶段**：
   - 频繁提交小改动
   - 依赖Light检查快速反馈
   - 修复lint和构建错误

2. **功能完成后**：
   - 自测主要功能
   - 运行本地测试套件
   - 提交PR

3. **准备合并前**：
   - 添加`ready-for-test`标签
   - 等待Full测试通过
   - Code review通过后合并

### CI优化建议

- ✅ 保持测试快速（单元测试 < 5分钟）
- ✅ E2E测试只验证关键流程
- ✅ 使用缓存加速依赖安装
- ✅ 并行运行独立测试
- ✅ 失败快速反馈（fail-fast）

---

## 📚 相关文档

- [GitHub Actions文档](https://docs.github.com/en/actions)
- [Playwright测试文档](https://playwright.dev)
- [pytest文档](https://docs.pytest.org)
- [Vitest文档](https://vitest.dev)

---

## 🆘 需要帮助？

如果遇到CI问题：
1. 查看Actions日志详细错误信息
2. 参考本文档常见问题部分
3. 在issue中提问并附上错误日志
4. 联系维护者

---

**最后更新**: 2025-01-20  
**维护者**: Banana Slides Team

