# 24MailAPI - 临时邮件服务

一个自托管的临时邮件 API 服务，支持 24 小时邮箱过期、自定义域名和 Cloudflare DNS 自动配置。

## 功能特性

- **24 小时有效期** - 邮箱创建后 24 小时自动过期并删除
- **REST API** - 完整的 API 支持生成邮箱、读取邮件
- **自定义域名** - 支持添加多个自定义域名
- **Cloudflare DNS 自动配置** - 一键自动设置 DNS 记录
- **美观的管理界面** - 现代 React 前端界面
- **Docker 部署** - 完整的容器化部署方案

## 系统要求

- Docker
- Docker Compose
- 一个域名（推荐使用 Cloudflare 管理）
- 服务器开放 25 端口（SMTP）

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/TangSengVIP/24mailapi.git
cd 24mailapi
```

### 2. 配置环境变量

```bash
cp env.example .env
```

编辑 `.env` 文件：

```env
# 服务器配置
SERVER_IP=你的服务器IP

# 域名配置
DOMAIN=mail.yourdomain.com
API_DOMAIN=api.mail.yourdomain.com

# API 配置（请修改为安全密钥）
API_KEY=your_secure_random_key_here

# 邮件过期时间（小时）
MAIL_EXPIRY_HOURS=24

# Cloudflare 配置（可选）- DNS 记录会在添加域名时自动配置
CF_API_TOKEN=your_cloudflare_api_token
CF_API_EMAIL=your_email@domain.com

# DMARC 报告邮箱（可选）
DMARC_REPORT_EMAIL=dmarc-reports
```

### 3. 启动服务

```bash
docker-compose up -d
```

### 4. 访问服务

- Web 界面: http://your-server-ip:3000
- API: http://your-server-ip:8000

---

## 详细配置

### 获取 Cloudflare API 密钥

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 "My Profile" > "API Tokens"
3. 点击 "Create Custom Token"
4. 配置权限：
   - Zone - DNS - Edit
   - Include - Specific Zone - 你的域名
5. 创建并保存 token

### 获取 Zone ID

1. 在 Cloudflare 仪表板选择你的域名
2. 右侧边栏底部可以看到 "Zone ID"

### 配置自定义域名

#### 方案一：使用 Cloudflare 自动配置

在 Web 界面中：
1. 进入 "Cloudflare" 标签
2. 输入你的域名（如 `mail.yourdomain.com`）
3. 点击 "Configure DNS"

#### 方案二：手动配置 DNS

在 Cloudflare DNS 设置中添加：

| 类型 | 名称 | 内容 | 优先级 |
|------|------|------|--------|
| A | mail | 你的服务器IP | - |
| MX | mail | mail.yourdomain.com | 10 |

### 开放服务器端口

```bash
# Ubuntu/Debian
sudo ufw allow 25/tcp    # SMTP
sudo ufw allow 3000/tcp  # Frontend
sudo ufw allow 8000/tcp  # API
```

---

## API 接口文档

### 基础信息

| 项目 | 值 |
|------|-----|
| Base URL | `https://api.mail.iplc.tv` (生产环境) 或 `http://localhost:8000` (本地) |
| 认证方式 | Header 中传递 `X-API-Key` |
| Content-Type | `application/json` |

### 认证

所有接口（除 `/api/health` 外）都需要在请求头中携带 API Key：

```bash
-H "X-API-Key: your_api_key_here"
```

默认 API Key: `123456`（请修改为安全的随机密钥）

### 接口列表

#### 1. 健康检查

| 项目 | 值 |
|------|-----|
| 方法 | `GET` |
| 路径 | `/api/health` |
| 认证 | 否 |

**响应示例：**

```json
{
  "status": "ok",
  "mail_expiry_hours": 24
}
```

#### 2. 创建临时邮箱

| 项目 | 值 |
|------|-----|
| 方法 | `POST` |
| 路径 | `/api/mailboxes` |
| 认证 | 是 |

**请求体：**

```json
{
  "expires_hours": 24
}
```

**响应示例：**

```json
{
  "address": "abc123def456@mail.yourdomain.com",
  "domain": "mail.yourdomain.com",
  "expires_at": "2026-03-16T14:30:00",
  "created_at": "2026-03-15T14:30:00"
}
```

**调用示例：**

```bash
curl -X POST http://localhost:8000/api/mailboxes \
  -H "X-API-Key: 123456" \
  -H "Content-Type: application/json" \
  -d '{"expires_hours": 24}'
```

#### 3. 获取所有邮箱

| 项目 | 值 |
|------|-----|
| 方法 | `GET` |
| 路径 | `/api/mailboxes` |
| 认证 | 是 |

**调用示例：**

```bash
curl http://localhost:8000/api/mailboxes \
  -H "X-API-Key: 123456"
```

#### 4. 获取邮箱邮件

| 项目 | 值 |
|------|-----|
| 方法 | `GET` |
| 路径 | `/api/mailboxes/{address}` |
| 认证 | 是 |

**调用示例：**

```bash
curl http://localhost:8000/api/mailboxes/abc123def456@mail.yourdomain.com \
  -H "X-API-Key: 123456"
```

**响应示例：**

```json
[
  {
    "id": "0",
    "from_addr": "sender@example.com",
    "to_addr": "abc123def456@mail.yourdomain.com",
    "subject": "Test Email",
    "content": "This is a test email body",
    "html_content": "<p>This is a test email body</p>",
    "timestamp": "2026-03-15T14:35:00"
  }
]
```

#### 5. 删除邮箱

| 项目 | 值 |
|------|-----|
| 方法 | `DELETE` |
| 路径 | `/api/mailboxes/{address}` |
| 认证 | 是 |

**调用示例：**

```bash
curl -X DELETE http://localhost:8000/api/mailboxes/abc123def456@mail.yourdomain.com \
  -H "X-API-Key: 123456"
```

#### 6. 添加域名

| 项目 | 值 |
|------|-----|
| 方法 | `POST` |
| 路径 | `/api/domains` |
| 认证 | 是 |

**请求体：**

```json
{
  "domain": "example.com"
}
```

**响应示例：**

```json
{
  "id": "uuid-1234-5678",
  "domain": "example.com",
  "is_default": false,
  "created_at": "2026-03-15T14:40:00",
  "dns_configured": true,
  "dns_message": "Created A, MX, SPF, DMARC records"
}
```

#### 7. 获取所有域名

| 项目 | 值 |
|------|-----|
| 方法 | `GET` |
| 路径 | `/api/domains` |
| 认证 | 是 |

#### 8. 删除域名

| 项目 | 值 |
|------|-----|
| 方法 | `DELETE` |
| 路径 | `/api/domains/{domain_id}` |
| 认证 | 是 |

### Python 调用示例

```python
import requests

API_KEY = "123456"
BASE_URL = "http://localhost:8000"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# 创建临时邮箱
response = requests.post(
    f"{BASE_URL}/api/mailboxes",
    headers=headers,
    json={"expires_hours": 24}
)
print(response.json())

# 获取所有邮箱
response = requests.get(f"{BASE_URL}/api/mailboxes", headers=headers)
print(response.json())

# 获取某邮箱的邮件
response = requests.get(
    f"{BASE_URL}/api/mailboxes/test123@mail.yourdomain.com",
    headers=headers
)
print(response.json())

# 添加域名
response = requests.post(
    f"{BASE_URL}/api/domains",
    headers=headers,
    json={"domain": "example.com"}
)
print(response.json())
```

### JavaScript 调用示例

```javascript
const API_KEY = "123456";
const BASE_URL = "http://localhost:8000";

const headers = {
  "X-API-Key": API_KEY,
  "Content-Type": "application/json"
};

// 创建临时邮箱
fetch(`${BASE_URL}/api/mailboxes`, {
  method: "POST",
  headers,
  body: JSON.stringify({ expires_hours: 24 })
})
  .then(res => res.json())
  .then(data => console.log(data));

// 获取所有邮箱
fetch(`${BASE_URL}/api/mailboxes`, { headers })
  .then(res => res.json())
  .then(data => console.log(data));
```

### 错误响应

| 状态码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | API Key 无效 |
| 404 | 资源不存在 |
| 410 | 邮箱已过期 |
| 500 | 服务器内部错误 |

**错误响应示例：**

```json
{
  "detail": "Invalid API key"
}
```

---

## 目录结构

```
24mailapi/
├── backend/              # Python 后端
│   ├── main.py          # 主程序
│   ├── requirements.txt # 依赖
│   ├── Dockerfile.api   # API 容器
│   └── Dockerfile.smtp # SMTP 容器
├── frontend/            # React 前端
│   ├── src/            # 源代码
│   ├── public/         # 静态资源
│   ├── package.json    # 依赖
│   ├── Dockerfile      # 容器配置
│   └── nginx.conf     # Nginx 配置
├── data/               # 数据库目录
├── mailstore/         # 邮件存储
├── docker-compose.yml # Docker 配置
├── .env               # 环境变量
├── env.example        # 环境变量示例
└── README.md          # 说明文档
```

---

## 故障排除

### 端口 25 无法连接

1. 检查服务器是否开放了 25 端口
2. 如果是云服务器，需要在安全组中开放 25 端口
3. 部分服务商默认禁用 25 端口，需要申请解封

### 无法接收邮件

1. 检查 DNS 配置是否正确
2. 验证 MX 记录是否指向正确域名
3. 检查防火墙是否阻止了 25 端口

### API 请求返回 401

1. 确认 API Key 正确
2. 检查 Header 格式：`X-API-Key: your_key`

---

## 安全注意事项

1. **修改默认 API Key** - 必须在环境变量中设置安全的随机密钥
2. **限制 API 访问** - 生产环境建议配置防火墙
3. **HTTPS** - 建议使用 Nginx 配置 SSL 证书

---

## 许可证

MIT
