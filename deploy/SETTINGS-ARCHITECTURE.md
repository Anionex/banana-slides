# Banana Slides SaaS 设置结构说明

## 目标

本文档说明本项目中 `.env`、全局设置、用户设置、运行时配置和后台任务之间的关系，以及它们在保存后、重启后、实际业务执行时的生效顺序。

## 设置层级

### 1. `.env` / `Config`

- 启动时最先加载
- 作用是提供系统初始值
- 只应被视为“冷启动默认值”和“reset 回退值”
- 不应把 `.env` 当作运行期唯一真实来源

代码位置：

- `backend/config.py`
- `backend/app.py`

### 2. 全局 `Settings`

- 数据库存储的系统级默认配置
- 应用启动时会把它同步到 `app.config`
- 重启后运行时默认读取它
- 管理员保存设置后，应同步更新这一层

代码位置：

- `backend/models/settings.py`
- `backend/app.py`
- `backend/controllers/settings_controller.py`

### 3. 用户级 `UserSettings`

- 每个用户自己的配置副本
- 用户在设置页编辑时，直接修改这一层
- 实际 AI 请求应优先使用当前用户的有效设置
- 若某个可空字段未设置，则应回退到全局 `Settings`

代码位置：

- `backend/models/user_settings.py`
- `backend/controllers/settings_controller.py`

### 4. `SystemConfig`

- 不是 API / 模型配置本体
- 主要用于平台级策略，例如：
  - 普通用户允许编辑哪些字段
  - 积分、邀请码等系统规则

代码位置：

- `backend/models/system_config.py`
- `backend/controllers/admin_config_controller.py`

### 5. 运行时覆盖（request/task scoped override）

- 为了解决“测试页读的是用户设置，实际任务读的是全局设置”以及“多用户共享缓存串配置”的问题，新增了运行时设置覆盖层
- 这一层不直接改全局 `app.config`
- 它只在当前请求或后台任务上下文中生效
- AI provider 工厂和 AIService 会优先读取这一层

代码位置：

- `backend/services/runtime_settings.py`

## 正确优先级

对于实际 AI 业务请求，优先级应为：

1. 当前请求/任务的运行时覆盖
2. 全局 `app.config`（由 `Settings` 启动时恢复）
3. 环境变量 `.env`
4. 代码默认值

对于用户级有效设置构建，优先级应为：

1. 当前用户的 `UserSettings`
2. 全局 `Settings`
3. `.env` 仅通过 `Settings` 初始化间接参与

## 普通用户可编辑设置规则

- `SystemConfig.user_editable_fields` 只决定“普通用户能改哪些字段”
- 它不改变运行时优先级，运行时优先级始终是：
  - `UserSettings`
  - `Settings`
  - `.env`
- 管理员修改全局 `Settings`，等于修改平台默认值
- 普通用户只要对某字段没有设置个人覆盖，就继续继承全局默认值
- 普通用户对某字段设置了个人值，请求和后台任务优先使用该个人值

### 返回给普通用户的设置接口约定

- 非管理员读取 `/api/settings/` 时，应返回“有效值”而不是裸 `UserSettings`
- 非敏感字段：
  - 如果用户未覆盖，则直接返回全局默认值
- 敏感字段（如 `api_key`）：
  - 如果值来自用户自己的覆盖，可以返回给该用户自己
  - 如果值来自全局 `Settings`，不能把全局密钥明文返回给普通用户
  - 但应通过元信息标记该字段当前使用的是全局默认值

建议前端使用：

- `_value_sources`：标记每个字段来自 `user` 还是 `global`
- `_inherits_global_fields`：列出当前仍在继承全局默认值的字段

## 保存后的行为

### 普通用户保存

- 写入自己的 `UserSettings`
- 不修改全局 `Settings`
- 后续该用户自己的 AI 请求应使用自己的运行时覆盖

### 管理员保存

- 先写入自己的 `UserSettings`
- 再复制到全局 `Settings`
- 同时同步到当前进程的运行时配置
- 重启后，全局默认值从 `Settings` 恢复

## 重启后的行为

- 应用先读 `.env`
- 再从数据库读取全局 `Settings`
- 用 `Settings` 覆盖启动时的默认配置
- 真实请求执行时，如果存在当前用户，则再叠加用户级运行时覆盖

## 本次修复的核心问题

本次修复前，存在两个关键问题：

1. 测试页和实际业务链路的设置来源不一致

- 测试验证接口会临时使用当前用户的设置
- 但实际生成/编辑链路很多地方只读全局配置
- 导致“测试通过，实际失败”

2. AI provider 缓存只按模型名缓存

- 旧实现没有把 `provider/api_base/api_key` 纳入缓存 key
- 当模型名相同但凭证不同，可能复用到旧 provider
- 导致保存后或重启后看起来像“还在用旧密钥”

## 本次修复后的行为

- 新增 request/task scoped runtime settings override
- AI provider 工厂优先读取运行时覆盖
- AIService 在用户请求和后台任务里按当前用户配置创建
- provider 缓存 key 现在包含：
  - provider format
  - api_base
  - api_key hash
  - model
- `UserSettings` 首次创建时，改为继承当前全局 `Settings`，不再直接回退到 `.env`

## 排障建议

如果再次出现“测试能过，实际不能用”，优先检查：

1. 当前用户的 `UserSettings`
2. 全局 `Settings`
3. 日志里的 runtime settings override 摘要
4. AIService/provider 是否因配置变更重新创建

建议查看日志关键字：

- `Applied runtime settings override`
- `Creating request-scoped AIService`
- `Creating new TextProvider`
- `Creating new ImageProvider`
- `AIService singleton created`
