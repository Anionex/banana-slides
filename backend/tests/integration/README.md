# Backend Integration Tests

## 测试分类

### 1. Flask Test Client 测试（不需要运行服务）
**文件**: `test_full_workflow.py`

这些测试使用 Flask 的测试客户端（`client` fixture），不需要真实的服务运行。

**特点**：
- ✅ 快速（毫秒级）
- ✅ 不需要启动服务
- ✅ 在 CI 的 `backend-integration-test` 阶段运行
- ✅ 使用 mock 模式，不需要真实 API key

**运行方式**：
```bash
cd backend
uv run pytest tests/integration/test_full_workflow.py -v
```

### 2. Real Service 测试（需要运行服务）
**文件**: `test_api_full_flow.py`

这些测试使用 `requests` 库直接调用 HTTP 端点，需要真实的后端服务运行。

**特点**：
- ⏱️ 较慢（需要真实 HTTP 请求）
- 🔧 默认连接当前 worktree 对应的后端端口；也可用 `BACKEND_BASE_URL` 显式指定
- 🏗️ 在 CI 的 `docker-test` 阶段运行（服务已启动）
- 🔑 完整流程测试需要真实 AI API key
- 🤖 测试启动时会把 text / image / image caption 模型统一固定为 `gemini-3.1-flash-image-preview`

**标记**: `@pytest.mark.requires_service`

**运行方式**：
```bash
# 1. 启动服务
docker compose up -d

# 2. 运行测试
cd backend
uv run pytest tests/integration/test_api_full_flow.py -v -m "requires_service"
```

如果要显式指定后端地址：
```bash
BACKEND_BASE_URL=http://localhost:5260 uv run pytest tests/integration/test_api_full_flow.py -v -m "requires_service"
```

## CI/CD 策略

### Backend Integration Test 阶段
**何时运行**: 在每次 PR 和 push 时

**运行测试**: 
- ✅ 使用 Flask test client 的测试
- ❌ 跳过需要真实服务的测试

```yaml
# 跳过 @pytest.mark.requires_service 标记的测试
pytest tests/integration -v -m "not requires_service"
```

**环境变量**:
```yaml
TESTING: true
SKIP_SERVICE_TESTS: true
GOOGLE_API_KEY: mock-api-key-for-testing
```

### Docker Test 阶段
**何时运行**: 在 PR 添加 `ready-for-test` 标签时

**运行测试**:
- ✅ 运行需要真实服务的测试
- ✅ 测试完整的 API 调用流程

```yaml
# 只运行 @pytest.mark.requires_service 标记的测试
pytest tests/integration/test_api_full_flow.py -v -m "requires_service"
```

**环境变量**:
```yaml
SKIP_SERVICE_TESTS: false
GOOGLE_API_KEY: <real-api-key-from-secrets>
```

## Pytest Markers

所有可用的 markers 定义在 `pytest.ini` 中：

| Marker | 说明 | 示例 |
|--------|------|------|
| `unit` | 单元测试 | 测试单个函数或方法 |
| `integration` | 集成测试 | 测试多个组件交互 |
| `slow` | 慢速测试 | 需要 AI API 调用的测试 |
| `requires_service` | 需要运行服务 | 使用 requests 调用 HTTP 端点 |
| `mock` | 使用 mock | 不调用真实外部服务 |
| `docker` | Docker 环境测试 | 需要 Docker 环境 |

## 运行示例

### 运行所有集成测试（跳过需要服务的）
```bash
cd backend
SKIP_SERVICE_TESTS=true uv run pytest tests/integration/ -v -m "not requires_service"
```

### 只运行需要服务的测试
```bash
# 确保服务已启动
docker compose up -d

# 运行测试
cd backend
SKIP_SERVICE_TESTS=false uv run pytest tests/integration/ -v -m "requires_service"
```

### 运行所有集成测试（需要服务）
```bash
# 确保服务已启动
docker compose up -d

# 运行所有测试
cd backend
uv run pytest tests/integration/ -v
```

### 运行特定测试
```bash
# 运行快速 API 测试（需要服务）
cd backend
uv run pytest tests/integration/test_api_full_flow.py::TestAPIFullFlow::test_quick_api_flow_no_ai -v

# 运行完整流程测试（需要服务和真实 API key）
cd backend
uv run pytest tests/integration/test_api_full_flow.py::TestAPIFullFlow::test_api_full_flow_create_to_export -v
```

## 故障排除

### 问题：`ConnectionRefusedError: [Errno 111] Connection refused`

**原因**: 测试尝试连接当前 worktree 默认后端地址（或 `BACKEND_BASE_URL` 指定地址），但服务未运行。

**解决方案**:
1. 启动服务：`docker compose up -d`
2. 或者跳过这些测试：`pytest -m "not requires_service"`

### 问题：测试在 CI 的 backend-integration-test 阶段失败

**原因**: 该阶段不启动服务，应该跳过 `requires_service` 测试。

**解决方案**: 确保 CI 配置使用了正确的 pytest 命令：
```yaml
pytest tests/integration -v -m "not requires_service"
```

## 最佳实践

1. **新的集成测试**:
   - 如果测试可以使用 Flask test client → 添加到 `test_full_workflow.py`
   - 如果测试需要真实 HTTP 调用 → 添加到 `test_api_full_flow.py` 并标记 `@pytest.mark.requires_service`

2. **Marker 使用**:
   ```python
   @pytest.mark.integration
   @pytest.mark.requires_service
   def test_real_api_call(self):
       response = requests.post('http://localhost:5000/api/projects', ...)
   ```

3. **环境检查**:
   - 文件级跳过：使用 `pytestmark = pytest.mark.skipif(...)`
   - 测试级跳过：使用 `@pytest.mark.skipif(...)`

---

**更新日期**: 2025-12-22  
**维护者**: Banana Slides Team
