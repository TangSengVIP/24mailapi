# 24MailAPI 接口文档

## 基础信息

| 项目 | 值 |
|------|-----|
| Base URL | `https://api.mail.iplc.tv` (生产环境) 或 `http://localhost:8000` (本地) |
| 认证方式 | Header 中传递 `X-API-Key` |
| Content-Type | `application/json` |

## 认证

所有接口都需要在请求头中携带 API Key：

```bash
-H "X-API-Key: your_api_key_here"
```

---

## 接口列表

### 1. 健康检查

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

---

### 2. 创建临时邮箱

| 项目 | 值 |
|------|-----|
| 方法 | `POST` |
| 路径 | `/api/mailboxes` |
| 认证 | 是 |

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| address | string | 否 | 邮箱地址前缀，不填则自动生成随机地址 |
| domain_selection | string | 否 | 域名选择模式：`default`, `round_robin`, `random`, `specific` |
| specific_domain | string | 条件必填 | 当 domain_selection 为 `specific` 时必填，指定具体域名 |
| expires_hours | int | 否 | 邮箱过期时间（小时），默认 24 小时 |

#### domain_selection 域名选择模式说明

| 值 | 说明 |
|----|------|
| `default` | 默认域名（系统设置的第一个域名） |
| `round_robin` | 轮询分配，所有域名轮流使用 |
| `random` | 随机分配，从所有域名中随机选择 |
| `specific` | 指定域名，使用 specific_domain 参数指定的域名 |

#### 请求体示例

**示例1：创建随机地址邮箱（使用默认域名）**
```json
{}
```

**示例2：创建随机地址邮箱（轮询域名）**
```json
{
  "domain_selection": "round_robin"
}
```

**示例3：创建自定义地址（随机域名）**
```json
{
  "address": "mycustom",
  "domain_selection": "random"
}
```

**示例4：创建自定义地址（指定域名）**
```json
{
  "address": "mycustom",
  "domain_selection": "specific",
  "specific_domain": "mail.example.com"
}
```

**响应示例：**

```json
{
  "address": "abc123def456@mail.iplc.tv",
  "domain": "mail.iplc.tv",
  "expires_at": "2026-03-16T14:30:00",
  "created_at": "2026-03-15T14:30:00"
}
```

#### 调用示例

```bash
# 使用默认域名创建随机邮箱
curl -X POST "https://api.mail.iplc.tv/api/mailboxes" \
  -H "X-API-Key: caoFANG1991" \
  -H "Content-Type: application/json" \
  -d '{}'

# 使用轮询模式创建随机邮箱
curl -X POST "https://api.mail.iplc.tv/api/mailboxes" \
  -H "X-API-Key: caoFANG1991" \
  -H "Content-Type: application/json" \
  -d '{"domain_selection": "round_robin"}'

# 使用随机模式创建自定义地址邮箱
curl -X POST "https://api.mail.iplc.tv/api/mailboxes" \
  -H "X-API-Key: caoFANG1991" \
  -H "Content-Type: application/json" \
  -d '{"address": "myemail", "domain_selection": "random"}'

# 使用指定域名创建邮箱
curl -X POST "https://api.mail.iplc.tv/api/mailboxes" \
  -H "X-API-Key: caoFANG1991" \
  -H "Content-Type: application/json" \
  -d '{"address": "myemail", "domain_selection": "specific", "specific_domain": "mail.158689.net"}'
```

---

### 3. 获取所有邮箱

| 项目 | 值 |
|------|-----|
| 方法 | `GET` |
| 路径 | `/api/mailboxes` |
| 认证 | 是 |

**调用示例：**

```bash
curl -X GET "https://api.mail.iplc.tv/api/mailboxes" \
  -H "X-API-Key: caoFANG1991"
```

**响应示例：**

```json
[
  {
    "address": "abc123@mail.iplc.tv",
    "domain": "mail.iplc.tv",
    "created_at": "2026-03-15T14:30:00",
    "expires_at": "2026-03-16T14:30:00"
  },
  {
    "address": "def456@mail.158689.net",
    "domain": "mail.158689.net",
    "created_at": "2026-03-15T15:00:00",
    "expires_at": "2026-03-16T15:00:00"
  }
]
```

---

### 4. 获取邮箱邮件

| 项目 | 值 |
|------|-----|
| 方法 | `GET` |
| 路径 | `/api/mailboxes/{address}` |
| 认证 | 是 |

**参数：**

| 参数 | 说明 |
|------|------|
| address | 邮箱地址，支持带域名或不带域名 |

**调用示例：**

```bash
# 方式1：带域名
curl -X GET "https://api.mail.iplc.tv/api/mailboxes/abc123@mail.iplc.tv" \
  -H "X-API-Key: caoFANG1991"

# 方式2：不带域名（自动添加默认域名）
curl -X GET "https://api.mail.iplc.tv/api/mailboxes/abc123" \
  -H "X-API-Key: caoFANG1991"
```

**响应示例：**

```json
[
  {
    "id": "0",
    "from_addr": "sender@example.com",
    "to_addr": "abc123@mail.iplc.tv",
    "subject": "Test Email",
    "content": "This is a test email body",
    "html_content": "<p>This is a test email body</p>",
    "timestamp": "2026-03-15T14:35:00"
  }
]
```

---

### 5. 删除邮箱

| 项目 | 值 |
|------|-----|
| 方法 | `DELETE` |
| 路径 | `/api/mailboxes/{address}` |
| 认证 | 是 |

**调用示例：**

```bash
curl -X DELETE "https://api.mail.iplc.tv/api/mailboxes/abc123@mail.iplc.tv" \
  -H "X-API-Key: caoFANG1991"
```

**响应示例：**

```json
{
  "message": "Mailbox deleted"
}
```

---

### 6. 添加域名

| 项目 | 值 |
|------|-----|
| 方法 | `POST` |
| 路径 | `/api/domains` |
| 认证 | 是 |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| domain | string | 是 | 要添加的域名 |

**请求体示例：**

```json
{
  "domain": "mail.example.com"
}
```

**响应示例：**

```json
{
  "id": "uuid-1234-5678",
  "domain": "mail.example.com",
  "is_default": false,
  "created_at": "2026-03-15T14:40:00",
  "dns_configured": true,
  "dns_message": "Created A, MX, SPF, DMARC records"
}
```

**调用示例：**

```bash
curl -X POST "https://api.mail.iplc.tv/api/domains" \
  -H "X-API-Key: caoFANG1991" \
  -H "Content-Type: application/json" \
  -d '{"domain": "mail.example.com"}'
```

---

### 7. 获取所有域名

| 项目 | 值 |
|------|-----|
| 方法 | `GET` |
| 路径 | `/api/domains` |
| 认证 | 是 |

**调用示例：**

```bash
curl -X GET "https://api.mail.iplc.tv/api/domains" \
  -H "X-API-Key: caoFANG1991"
```

**响应示例：**

```json
[
  {
    "id": "uuid-1234-5678",
    "domain": "mail.iplc.tv",
    "is_default": true,
    "created_at": "2026-03-15T14:30:00",
    "dns_configured": false,
    "dns_message": null
  },
  {
    "id": "uuid-5678-9012",
    "domain": "mail.158689.net",
    "is_default": false,
    "created_at": "2026-03-15T15:00:00",
    "dns_configured": false,
    "dns_message": null
  }
]
```

---

### 8. 删除域名

| 项目 | 值 |
|------|-----|
| 方法 | `DELETE` |
| 路径 | `/api/domains/{domain_id}` |
| 认证 | 是 |

**调用示例：**

```bash
curl -X DELETE "https://api.mail.iplc.tv/api/domains/uuid-1234-5678" \
  -H "X-API-Key: caoFANG1991"
```

**响应示例：**

```json
{
  "message": "Domain deleted"
}
```

---

### 9. Cloudflare DNS 配置（测试接口）

| 项目 | 值 |
|------|-----|
| 方法 | `POST` |
| 路径 | `/api/cloudflare/setup` |
| 认证 | 是 |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| domain | string | 是 | 要配置 DNS 的域名 |

**请求体示例：**

```json
{
  "domain": "mail.example.com"
}
```

**响应示例：**

```json
{
  "message": "DNS records created successfully",
  "records": {
    "A": "mail.example.com -> 1.2.3.4",
    "MX": "mail.example.com -> mail.example.com"
  }
}
```

---

## 错误响应

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

```json
{
  "detail": "specific_domain is required when using SPECIFIC mode"
}
```

```json
{
  "detail": "Domain not found"
}
```

---

## 代码示例

### cURL

```bash
#!/bin/bash

API_KEY="caoFANG1991"
BASE_URL="https://api.mail.iplc.tv"

# 创建随机邮箱（轮询模式）
echo "=== 创建随机邮箱（轮询模式）==="
curl -X POST "$BASE_URL/api/mailboxes" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"domain_selection": "round_robin"}'

# 创建指定域名邮箱
echo -e "\n=== 创建指定域名邮箱 ==="
curl -X POST "$BASE_URL/api/mailboxes" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"address": "mytest", "domain_selection": "specific", "specific_domain": "mail.158689.net"}'

# 获取所有邮箱
echo -e "\n=== 获取所有邮箱 ==="
curl -X GET "$BASE_URL/api/mailboxes" \
  -H "X-API-Key: $API_KEY"

# 获取邮箱邮件
echo -e "\n=== 获取邮箱邮件 ==="
curl -X GET "$BASE_URL/api/mailboxes/test123" \
  -H "X-API-Key: $API_KEY"

# 获取所有域名
echo -e "\n=== 获取所有域名 ==="
curl -X GET "$BASE_URL/api/domains" \
  -H "X-API-Key: $API_KEY"
```

### Python

```python
import requests
import json

API_KEY = "caoFANG1991"
BASE_URL = "https://api.mail.iplc.tv"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}


def create_mailbox(domain_selection="default", address=None, specific_domain=None):
    """创建临时邮箱"""
    data = {}
    if address:
        data["address"] = address
    if domain_selection:
        data["domain_selection"] = domain_selection
    if specific_domain:
        data["specific_domain"] = specific_domain
    
    response = requests.post(
        f"{BASE_URL}/api/mailboxes",
        headers=headers,
        json=data
    )
    return response.json()


def get_mailboxes():
    """获取所有邮箱"""
    response = requests.get(f"{BASE_URL}/api/mailboxes", headers=headers)
    return response.json()


def get_emails(address):
    """获取邮箱邮件"""
    response = requests.get(
        f"{BASE_URL}/api/mailboxes/{address}",
        headers=headers
    )
    return response.json()


def delete_mailbox(address):
    """删除邮箱"""
    response = requests.delete(
        f"{BASE_URL}/api/mailboxes/{address}",
        headers=headers
    )
    return response.json()


def get_domains():
    """获取所有域名"""
    response = requests.get(f"{BASE_URL}/api/domains", headers=headers)
    return response.json()


def add_domain(domain):
    """添加域名"""
    response = requests.post(
        f"{BASE_URL}/api/domains",
        headers=headers,
        json={"domain": domain}
    )
    return response.json()


# 使用示例
if __name__ == "__main__":
    # 1. 获取所有域名
    print("=== 所有域名 ===")
    domains = get_domains()
    for d in domains:
        print(f"  - {d['domain']} (默认: {d['is_default']})")
    
    # 2. 使用轮询模式创建邮箱
    print("\n=== 创建邮箱（轮询模式）===")
    mailbox = create_mailbox(domain_selection="round_robin")
    print(f"  地址: {mailbox.get('address')}")
    print(f"  域名: {mailbox.get('domain')}")
    
    # 3. 使用指定域名创建邮箱
    print("\n=== 创建邮箱（指定域名）===")
    mailbox = create_mailbox(
        address="mytest",
        domain_selection="specific",
        specific_domain="mail.158689.net"
    )
    print(f"  地址: {mailbox.get('address')}")
    print(f"  域名: {mailbox.get('domain')}")
    
    # 4. 获取邮箱邮件
    print("\n=== 获取邮件 ===")
    emails = get_emails(mailbox.get('address'))
    print(f"  邮件数量: {len(emails)}")
    for email in emails:
        print(f"    - 来自: {email.get('from_addr')}, 主题: {email.get('subject')}")
```

### JavaScript

```javascript
const API_KEY = "caoFANG1991";
const BASE_URL = "https://api.mail.iplc.tv";

const headers = {
  "X-API-Key": API_KEY,
  "Content-Type": "application/json"
};

// 创建临时邮箱
async function createMailbox(options = {}) {
  const { domainSelection = "default", address, specificDomain } = options;
  const body = {};
  
  if (address) body.address = address;
  if (domainSelection) body.domain_selection = domainSelection;
  if (specificDomain) body.specific_domain = specificDomain;
  
  const response = await fetch(`${BASE_URL}/api/mailboxes`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  return response.json();
}

// 获取所有邮箱
async function getMailboxes() {
  const response = await fetch(`${BASE_URL}/api/mailboxes`, { headers });
  return response.json();
}

// 获取邮箱邮件
async function getEmails(address) {
  const response = await fetch(`${BASE_URL}/api/mailboxes/${address}`, { headers });
  return response.json();
}

// 删除邮箱
async function deleteMailbox(address) {
  const response = await fetch(`${BASE_URL}/api/mailboxes/${address}`, {
    method: "DELETE",
    headers
  });
  return response.json();
}

// 获取所有域名
async function getDomains() {
  const response = await fetch(`${BASE_URL}/api/domains`, { headers });
  return response.json();
}

// 添加域名
async function addDomain(domain) {
  const response = await fetch(`${BASE_URL}/api/domains`, {
    method: "POST",
    headers,
    body: JSON.stringify({ domain })
  });
  return response.json();
}

// 使用示例
async function main() {
  // 获取所有域名
  console.log("=== 所有域名 ===");
  const domains = await getDomains();
  domains.forEach(d => console.log(`  - ${d.domain} (默认: ${d.is_default})`));
  
  // 使用轮询模式创建邮箱
  console.log("\n=== 创建邮箱（轮询模式） ===");
  const mailbox1 = await createMailbox({ domainSelection: "round_robin" });
  console.log(`  地址: ${mailbox1.address}`);
  console.log(`  域名: ${mailbox1.domain}`);
  
  // 使用指定域名创建邮箱
  console.log("\n=== 创建邮箱（指定域名） ===");
  const mailbox2 = await createMailbox({
    address: "mytest",
    domainSelection: "specific",
    specificDomain: "mail.158689.net"
  });
  console.log(`  地址: ${mailbox2.address}`);
  console.log(`  域名: ${mailbox2.domain}`);
  
  // 获取邮件
  console.log("\n=== 获取邮件 ===");
  const emails = await getEmails(mailbox1.address);
  console.log(`  邮件数量: ${emails.length}`);
  
  // 删除邮箱
  console.log("\n=== 删除邮箱 ===");
  const result = await deleteMailbox(mailbox1.address);
  console.log(`  结果: ${result.message}`);
}

main();
```

### Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

const (
    APIKey  = "caoFANG1991"
    BaseURL = "https://api.mail.iplc.tv"
)

var client = &http.Client{}

func makeRequest(method, path string, body []byte) ([]byte, error) {
    req, err := http.NewRequest(method, BaseURL+path, bytes.NewBuffer(body))
    if err != nil {
        return nil, err
    }
    req.Header.Set("X-API-Key", APIKey)
    req.Header.Set("Content-Type", "application/json")
    
    resp, err := client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    buf := new(bytes.Buffer)
    buf.ReadFrom(resp.Body)
    return buf.Bytes(), nil
}

type Mailbox struct {
    Address   string `json:"address"`
    Domain    string `json:"domain"`
    CreatedAt string `json:"created_at"`
    ExpiresAt string `json:"expires_at"`
}

type Domain struct {
    ID            string `json:"id"`
    Domain        string `json:"domain"`
    IsDefault     bool   `json:"is_default"`
    CreatedAt     string `json:"created_at"`
    DNSConfigured bool   `json:"dns_configured"`
}

func CreateMailbox(domainSelection, address, specificDomain string) (*Mailbox, error) {
    body := map[string]string{}
    if address != "" {
        body["address"] = address
    }
    if domainSelection != "" {
        body["domain_selection"] = domainSelection
    }
    if specificDomain != "" {
        body["specific_domain"] = specificDomain
    }
    
    jsonBody, _ := json.Marshal(body)
    resp, err := makeRequest("POST", "/api/mailboxes", jsonBody)
    if err != nil {
        return nil, err
    }
    
    var mailbox Mailbox
    json.Unmarshal(resp, &mailbox)
    return &mailbox, nil
}

func GetMailboxes() ([]Mailbox, error) {
    resp, err := makeRequest("GET", "/api/mailboxes", nil)
    if err != nil {
        return nil, err
    }
    
    var mailboxes []Mailbox
    json.Unmarshal(resp, &mailboxes)
    return mailboxes, nil
}

func GetDomains() ([]Domain, error) {
    resp, err := makeRequest("GET", "/api/domains", nil)
    if err != nil {
        return nil, err
    }
    
    var domains []Domain
    json.Unmarshal(resp, &domains)
    return domains, nil
}

func main() {
    // 获取所有域名
    fmt.Println("=== 所有域名 ===")
    domains, _ := GetDomains()
    for _, d := range domains {
        fmt.Printf("  - %s (默认: %v)\n", d.Domain, d.IsDefault)
    }
    
    // 使用轮询模式创建邮箱
    fmt.Println("\n=== 创建邮箱（轮询模式） ===")
    mailbox1, _ := CreateMailbox("round_robin", "", "")
    fmt.Printf("  地址: %s\n", mailbox1.Address)
    fmt.Printf("  域名: %s\n", mailbox1.Domain)
    
    // 使用指定域名创建邮箱
    fmt.Println("\n=== 创建邮箱（指定域名） ===")
    mailbox2, _ := CreateMailbox("specific", "mytest", "mail.158689.net")
    fmt.Printf("  地址: %s\n", mailbox2.Address)
    fmt.Printf("  域名: %s\n", mailbox2.Domain)
}
```

---

## 常见问题

### Q: 如何实现域名轮询？

在创建邮箱时传递 `domain_selection` 参数为 `round_robin`：

```json
{
  "domain_selection": "round_robin"
}
```

系统会自动在所有已配置的域名间轮询分配。

### Q: 如何指定使用某个域名？

使用 `specific` 模式，并指定 `specific_domain`：

```json
{
  "domain_selection": "specific",
  "specific_domain": "mail.158689.net"
}
```

### Q: 创建邮箱时返回 404 错误？

检查 `specific_domain` 指定的域名是否已添加到系统中：

```bash
curl -X GET "https://api.mail.iplc.tv/api/domains" \
  -H "X-API-Key: caoFANG1991"
```

### Q: 如何查看当前有哪些可用域名？

调用获取域名列表接口即可查看所有已配置的域名。
