# GitHub Secrets 配置指南

## 🔑 CI中的密钥管理机制

### 工作原理

CI使用以下流程配置环境变量：

```bash
# 1. 复制模板文件
cp .env.example .env

# 2. 从GitHub Secrets注入真实密钥
sed -i '/^GOOGLE_API_KEY=/s/your-api-key-here/$GOOGLE_API_KEY/' .env
```

**关键点**：
- ✅ 使用`.env.example`作为配置模板（和README流程一致）
- ✅ 通过`sed`精确替换特定配置行（不影响其他配置）
- ✅ GitHub Secrets的值会**替换**占位符`your-api-key-here`
- ✅ 如果没有配置Secret，使用`mock-api-key`（完整E2E测试会跳过）

### 不会有冲突

**Q: GitHub Secrets会覆盖.env文件吗？**  
A: **不会覆盖，而是精确替换**。机制如下：

1. `.env.example`中的占位符：
   ```env
   GOOGLE_API_KEY=your-api-key-here
   OPENAI_API_KEY=your-api-key-here
   ```

2. CI运行时，**只替换配置了Secret的那一行**：
   ```bash
   # 只替换GOOGLE_API_KEY那一行
   sed -i '/^GOOGLE_API_KEY=/s/your-api-key-here/$ACTUAL_KEY/' .env
   
   # 如果配置了OPENAI_API_KEY，也替换
   if [ -n "$OPENAI_API_KEY" ]; then
     sed -i '/^OPENAI_API_KEY=/s/your-api-key-here/$ACTUAL_KEY/' .env
   fi
   ```

3. 结果（假设只配置了GOOGLE_API_KEY）：
   ```env
   GOOGLE_API_KEY=sk-your-real-gemini-key-here
   OPENAI_API_KEY=your-api-key-here  # 未配置，保持占位符
   ```

---

## 📝 配置步骤

### 1. 添加GitHub Secret

1. 进入你的GitHub仓库
2. 点击 `Settings` → `Secrets and variables` → `Actions`
3. 点击 `New repository secret`
4. 添加以下Secrets（根据需要）：

| Secret名称 | 说明 | 必需性 | 获取方式 |
|-----------|------|-------|---------|
| `GOOGLE_API_KEY` | Google Gemini API密钥 | ⭐ **推荐** | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `OPENAI_API_KEY` | OpenAI API密钥 | 可选 | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `CODECOV_TOKEN` | CodeCov上传令牌 | 可选 | [CodeCov](https://codecov.io) |

### 2. Secret值格式

```
# GOOGLE_API_KEY 示例
AIzaSyD_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# OPENAI_API_KEY 示例  
sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**注意**：
- ⚠️ 不要包含引号
- ⚠️ 不要包含空格
- ⚠️ 直接粘贴原始密钥

---

## 🔍 验证配置

### 方法1：查看CI日志

CI运行时会输出（密钥已脱敏）：

```
✓ .env文件已配置
GOOGLE_API_KEY: AIzaSyD_xxxxxxxxxxxxx...
```

### 方法2：测试完整E2E

1. 提交代码并创建PR
2. 添加`ready-for-test`标签
3. 查看CI日志中的E2E测试步骤：

```
🚀 运行完整流程E2E测试（需要真实API）
  ✓ 如果配置了GOOGLE_API_KEY，这个步骤会运行
  ✗ 如果没有配置，这个步骤会跳过
```

---

## 🛡️ 安全性

### GitHub Secrets的安全特性

✅ **加密存储**：Secrets在GitHub服务器上加密存储  
✅ **日志脱敏**：CI日志中自动隐藏Secret值  
✅ **访问控制**：只有仓库管理员可以查看/修改  
✅ **不会泄露**：PR中的fork无法访问Secrets  

### 最佳实践

1. **使用测试专用API key**
   - 不要使用生产环境的密钥
   - 设置合理的配额限制

2. **定期轮换密钥**
   - 建议每3-6个月更换一次
   - 旧密钥失效后及时更新Secret

3. **监控API使用**
   - 关注API调用量
   - 设置配额告警

4. **最小权限原则**
   - 只授予必需的权限
   - 不要共享个人密钥

---

## 🎯 不同场景的配置

### 场景1：只使用Gemini（推荐）

**需要配置**：
- `GOOGLE_API_KEY` ✅

**效果**：
- ✅ 完整E2E测试会运行
- ✅ 使用真实AI生成
- ❌ OpenAI相关功能不可用

### 场景2：同时支持Gemini和OpenAI

**需要配置**：
- `GOOGLE_API_KEY` ✅
- `OPENAI_API_KEY` ✅

**效果**：
- ✅ 完整E2E测试会运行
- ✅ 两种AI provider都可用
- ✅ 可以测试provider切换功能

### 场景3：不配置任何密钥（开发阶段）

**配置**：
- 不配置任何Secret

**效果**：
- ✅ Light检查正常运行
- ✅ 单元测试、集成测试正常（使用mock）
- ❌ 完整E2E测试会跳过
- 📝 CI日志会提示："未配置GOOGLE_API_KEY，跳过完整流程测试"

---

## 🚨 常见问题

### Q1: 配置了Secret但E2E测试还是跳过？

**可能原因**：
1. Secret名称拼写错误（必须是`GOOGLE_API_KEY`，区分大小写）
2. Secret值包含了引号或空格
3. API key无效或已过期

**解决方法**：
```bash
# 检查CI日志中的环境配置步骤
# 应该看到：GOOGLE_API_KEY: AIzaSyD_xxx...
# 而不是：GOOGLE_API_KEY: mock-api-key...
```

### Q2: 会不会暴露我的API key？

**不会**。GitHub Actions会自动脱敏：
```
# CI日志中看到的：
GOOGLE_API_KEY: ***
Response: ***

# 实际运行时使用的是真实key
```

### Q3: Fork的PR可以访问Secrets吗？

**不能**。出于安全考虑：
- ❌ 来自fork的PR无法访问仓库的Secrets
- ✅ 只有仓库自身的分支可以访问
- 💡 如果需要测试fork的PR，需要先合并到自己仓库的分支

### Q4: 本地测试需要配置GitHub Secrets吗？

**不需要**。本地测试流程：
```bash
# 本地直接使用.env文件
cp .env.example .env
# 编辑.env文件，填入真实密钥

# 运行测试
./scripts/run-local-ci.sh full
```

GitHub Secrets **只用于CI环境**，本地使用`.env`文件。

### Q5: 如何更新已配置的Secret？

1. 进入 `Settings` → `Secrets and variables` → `Actions`
2. 找到要更新的Secret
3. 点击 `Update` 按钮
4. 粘贴新值并保存
5. 重新运行CI验证

---

## 📊 配置检查清单

提交代码前，确认：

- [ ] 已在GitHub仓库中配置`GOOGLE_API_KEY` Secret
- [ ] Secret值正确（无引号、无空格）
- [ ] API key有效且有足够配额
- [ ] `.env.example`文件包含正确的占位符
- [ ] 本地`.env`文件已配置（用于本地测试）
- [ ] 本地测试通过（`./scripts/run-local-ci.sh full`）

---

## 🔗 相关资源

- [GitHub Actions Secrets文档](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Google AI Studio](https://aistudio.google.com/app/apikey)
- [OpenAI API Keys](https://platform.openai.com/api-keys)
- [CI配置说明](.github/CI_SETUP.md)
- [本地测试指南](../LOCAL_TESTING.md)

---

**最后更新**: 2025-01-20  
**维护者**: Banana Slides Team

