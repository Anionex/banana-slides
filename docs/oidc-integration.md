# OIDC 单点登录接入指南

本文档说明如何为 Banana Slides SaaS 添加新的 OIDC（OpenID Connect）单点登录提供商。

## 概述

当前系统已支持 Google OIDC 登录，架构设计支持快速接入其他符合 OIDC 标准的提供商（如 GitHub、Microsoft、Auth0 等）。

## 前置条件

1. 在目标 OIDC 提供商处创建 OAuth 2.0 应用
2. 获取 Client ID 和 Client Secret
3. 配置回调 URL：`http://your-domain/auth/oidc/callback`

## 接入步骤

### 1. 后端配置

编辑 `backend/services/oidc_service.py`，在 `PROVIDERS` 字典中添加新提供商：

```python
PROVIDERS = {
    'google': {
        'authorize_url': 'https://accounts.google.com/o/oauth2/v2/auth',
        'token_url': 'https://oauth2.googleapis.com/token',
        'userinfo_url': 'https://openidconnect.googleapis.com/v1/userinfo',
        'scope': 'openid email profile'
    },
    # 添加新提供商
    'github': {
        'authorize_url': 'https://github.com/login/oauth/authorize',
        'token_url': 'https://github.com/login/oauth/access_token',
        'userinfo_url': 'https://api.github.com/user',
        'scope': 'read:user user:email'
    }
}
```

### 2. 环境变量配置

在 `.env` 文件中添加新提供商的凭据：

```bash
# GitHub OIDC 配置
OIDC_GITHUB_CLIENT_ID=your_github_client_id
OIDC_GITHUB_CLIENT_SECRET=your_github_client_secret
```

### 3. 前端 UI

编辑 `frontend/src/pages/auth/LoginPage.tsx`，添加新的登录按钮：

```tsx
const handleGitHubLogin = async () => {
  try {
    const provider = 'github';
    const response = await fetch(`/api/auth/oidc/login?provider=${provider}`);
    const data = await response.json();
    if (data.data?.auth_url && data.data?.state) {
      sessionStorage.setItem('oidc_state', data.data.state);
      sessionStorage.setItem('oidc_provider', provider);
      window.location.href = data.data.auth_url;
    }
  } catch (err) {
    setError('GitHub 登录失败，请重试');
  }
};
```

在 JSX 中添加按钮：

```tsx
<button
  type="button"
  onClick={handleGitHubLogin}
  className="w-full flex items-center justify-center gap-3 px-4 py-3 border rounded-lg"
>
  <GitHubIcon />
  使用 GitHub 登录
</button>
```

## 常见 OIDC 提供商配置

### GitHub

```python
'github': {
    'authorize_url': 'https://github.com/login/oauth/authorize',
    'token_url': 'https://github.com/login/oauth/access_token',
    'userinfo_url': 'https://api.github.com/user',
    'scope': 'read:user user:email'
}
```

### Microsoft

```python
'microsoft': {
    'authorize_url': 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    'token_url': 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    'userinfo_url': 'https://graph.microsoft.com/v1.0/me',
    'scope': 'openid email profile'
}
```

### Auth0

```python
'auth0': {
    'authorize_url': 'https://YOUR_DOMAIN.auth0.com/authorize',
    'token_url': 'https://YOUR_DOMAIN.auth0.com/oauth/token',
    'userinfo_url': 'https://YOUR_DOMAIN.auth0.com/userinfo',
    'scope': 'openid email profile'
}
```

## 注意事项

1. **回调 URL 配置**：确保在 OIDC 提供商处配置正确的回调 URL
2. **Scope 权限**：不同提供商的 scope 可能不同，需要根据实际需求调整
3. **用户信息字段**：不同提供商返回的用户信息字段可能不同，可能需要调整 `auth_service.py` 中的字段映射
4. **安全性**：
   - 妥善保管 Client Secret，不要提交到代码仓库
   - 生产环境使用 HTTPS
   - 定期轮换密钥

## 测试

添加新提供商后，建议进行以下测试：

1. 点击登录按钮，验证跳转到正确的授权页面
2. 授权后验证回调处理正确
3. 验证用户信息正确保存到数据库
4. 测试重复登录（已有账号）
5. 测试邮箱冲突场景（邮箱已被密码注册占用）

## 故障排查

### 常见问题

**问题：回调时提示"安全验证失败"**
- 检查 state 参数是否正确传递
- 检查 Flask session 配置是否正确

**问题：获取用户信息失败**
- 检查 userinfo_url 是否正确
- 检查 scope 是否包含必要的权限
- 查看后端日志获取详细错误信息

**问题：邮箱冲突**
- 当前实现不支持同一邮箱绑定多个 OIDC 提供商
- 如果邮箱已被密码注册，会提示用户使用密码登录

## 相关文件

- `backend/services/oidc_service.py` - OIDC 核心服务
- `backend/services/auth_service.py` - 认证服务（包含 OIDC 用户创建逻辑）
- `backend/controllers/auth_controller.py` - OIDC 端点
- `frontend/src/pages/auth/LoginPage.tsx` - 登录页面
- `frontend/src/pages/auth/OIDCCallbackPage.tsx` - OIDC 回调处理
