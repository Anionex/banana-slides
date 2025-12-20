# E2E测试说明

## 📚 测试文件分类

### 1. 🌐 真正的E2E测试（UI驱动）

**文件**: `ui-full-flow.spec.ts` ✅ 推荐用于发布前验证

**特点**:
- ✅ 从浏览器UI开始操作
- ✅ 模拟真实用户行为（点击、输入、等待）
- ✅ 测试前端 + 后端的完整链路
- ✅ 发现UI和后端交互的问题
- ⚠️ 需要10-20分钟运行时间
- ⚠️ 需要真实AI API密钥

**流程**:
```
用户打开浏览器
  ↓ (page.goto)
点击"从想法创建"
  ↓ (page.click)
输入想法内容
  ↓ (page.fill)
点击生成按钮
  ↓ (等待UI loading)
看到大纲生成
  ↓ (page.waitForSelector)
点击生成描述
  ↓ (等待UI更新)
看到描述完成
  ↓ (page.waitForSelector)
点击生成图片
  ↓ (等待UI更新)
看到图片完成
  ↓ (page.click)
点击导出PPT
  ↓ (page.waitForEvent('download'))
下载PPT文件
```

**何时运行**:
- ✅ 发布前的最终验证
- ✅ Nightly Build（每晚定时）
- ❌ 不推荐在PR阶段运行（太慢）

---

### 2. 🔌 API集成测试（不是真正的E2E）

**文件**: `api-full-flow.spec.ts`

**特点**:
- ✅ 直接调用后端API
- ✅ 跳过前端UI
- ✅ 更快、更稳定
- ✅ 测试后端业务逻辑
- ❌ **不测试前端UI**
- ❌ **不测试前后端交互**

**流程**:
```
直接HTTP POST
  ↓
await request.post('/api/projects')
  ↓
await request.post('/api/projects/{id}/generate/descriptions')
  ↓
await request.post('/api/projects/{id}/generate/images')
  ↓
await request.get('/api/projects/{id}/export/pptx')
```

**何时运行**:
- ✅ PR的Full Test阶段
- ✅ 验证后端逻辑正确性
- ✅ CI中的自动化测试

---

### 3. 🎨 基础UI测试

**文件**: `home.spec.ts`, `create-ppt.spec.ts`

**特点**:
- ✅ 测试基础UI交互
- ✅ 不依赖真实AI API
- ✅ 快速（2-5分钟）
- ❌ 不测试完整流程

**流程**:
```
打开首页 → 点击按钮 → 验证导航
输入内容 → 点击生成 → 验证loading
```

**何时运行**:
- ✅ 每次PR（Light Check）
- ✅ 快速验证UI没有破坏

---

## 🎯 测试策略总结

### 测试金字塔

```
        ┌─────────────────┐
        │  UI驱动E2E测试   │  ← 少量，发布前跑
        │  (完整用户流程)   │     (ui-full-flow.spec.ts)
        └─────────────────┘
              ▲
              │
      ┌───────────────────┐
      │   API集成测试      │  ← 中等，PR Full Test
      │  (后端验证)        │     (api-full-flow.spec.ts)
      └───────────────────┘
            ▲
            │
    ┌─────────────────────┐
    │   基础UI测试         │  ← 大量，PR Light Check
    │  (UI快速验证)        │     (home.spec.ts, create-ppt.spec.ts)
    └─────────────────────┘
          ▲
          │
  ┌─────────────────────────┐
  │      单元测试             │  ← 最多，本地开发
  │ (backend/tests/unit/)    │
  └─────────────────────────┘
```

---

## 📋 运行指南

### 本地运行

```bash
# 1. 基础UI测试（快速）
npx playwright test home.spec.ts create-ppt.spec.ts

# 2. API集成测试（需要后端运行）
docker-compose up -d
npx playwright test api-full-flow.spec.ts

# 3. UI驱动E2E测试（需要前端+后端运行）
# 注意：默认配置已排除此文件，需要明确指定
docker-compose up -d  # 启动后端
cd frontend && npm run dev  # 启动前端（另一个终端）
npx playwright test ui-full-flow.spec.ts

# 4. 快速E2E（不等待生成完成）
npx playwright test ui-full-flow.spec.ts -g "简化版"

# 5. 运行所有测试（包括真正的E2E）
npx playwright test --grep-invert="简化版"  # 排除快速版本
```

### CI运行策略

```yaml
# PR Light Check (pr-quick-check.yml)
- home.spec.ts
- create-ppt.spec.ts (UI部分)
运行时间: 2-5分钟

# PR Full Test (ci-test.yml, ready-for-test标签)
- api-full-flow.spec.ts (API集成测试)
运行时间: 15-30分钟
注意: ui-full-flow.spec.ts 被排除（太慢）

# Nightly Build (nightly-e2e.yml) ✅ 已配置
- ui-full-flow.spec.ts (UI驱动E2E测试)
触发: 每天UTC 2:00自动运行，或手动触发
运行时间: 10-20分钟
```

**重要**：
- ✅ `ui-full-flow.spec.ts` **不会**在PR阶段自动运行
- ✅ 默认Playwright配置已排除此文件（避免误运行）
- ✅ 只在Nightly Build或手动触发时运行

---

## 🤔 常见问题

### Q: 为什么不在PR阶段跑真正的E2E？

**A**: 
1. 太慢（10-20分钟），影响开发效率
2. 依赖UI稳定性，开发中UI经常变动
3. 成本高（真实AI调用）
4. API集成测试已经覆盖了业务逻辑

### Q: 什么时候必须跑真正的E2E？

**A**:
1. **发布前** - 确保用户完整流程能用
2. **重大功能上线前** - 验证关键路径
3. **定期验证（Nightly）** - 防止积累问题
4. **修复UI bug后** - 确保没有其他UI问题

### Q: `api-full-flow.spec.ts`有什么用？

**A**:
虽然不是真正的E2E，但它：
- ✅ 快速验证后端业务逻辑
- ✅ 不依赖UI变化，更稳定
- ✅ 适合CI自动化
- ✅ 发现后端问题

是**开发阶段的主要测试手段**。

### Q: 我该如何选择？

**A**:

| 场景 | 推荐测试 |
|------|---------|
| 本地开发 | 单元测试 |
| 提交PR | 基础UI测试 |
| 合并前 | API集成测试 |
| 发布前 | **真正的E2E测试** ✅ |
| 定期验证 | 真正的E2E测试 |

---

## 📚 参考资料

- [Playwright官方文档](https://playwright.dev)
- [测试金字塔](https://martinfowler.com/articles/practical-test-pyramid.html)
- [E2E vs Integration Testing](https://kentcdodds.com/blog/write-tests)

---

**最后更新**: 2025-01-20

