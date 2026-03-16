import { useState, useEffect } from 'react'
import { Mail, Plus, Trash2, RefreshCw, Settings, ExternalLink, Copy, Check, Eye, EyeOff, AlertCircle, Clock, Inbox, X, FileText } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function App() {
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)
  const [activeTab, setActiveTab] = useState('mailboxes')
  
  // Mailboxes state
  const [mailboxes, setMailboxes] = useState([])
  const [selectedMailbox, setSelectedMailbox] = useState(null)
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(false)
  const [newAddress, setNewAddress] = useState('')
  
  // Domains state
  const [domains, setDomains] = useState([])
  const [newDomain, setNewDomain] = useState('')
  
  // Domain selection mode for mailbox creation
  const [domainSelectionMode, setDomainSelectionMode] = useState('default')
  const [specificDomain, setSpecificDomain] = useState('')

  // Logs state
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logFilter, setLogFilter] = useState('all')
  
  // Toast notifications
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const checkApiKey = () => {
    if (apiKey.length > 0) {
      setIsConfigured(true)
      fetchMailboxes()
      fetchDomains()
      fetchLogs()
    }
  }

  const fetchMailboxes = async () => {
    if (!apiKey) return
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/mailboxes`, {
        headers: { 'X-API-Key': apiKey }
      })
      if (res.ok) {
        const data = await res.json()
        setMailboxes(data)
      }
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const fetchDomains = async () => {
    if (!apiKey) return
    try {
      const res = await fetch(`${API_URL}/api/domains`, {
        headers: { 'X-API-Key': apiKey }
      })
      if (res.ok) {
        const data = await res.json()
        setDomains(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchLogs = async () => {
    if (!apiKey) return
    setLogsLoading(true)
    try {
      const url = logFilter === 'all'
        ? `${API_URL}/api/logs?limit=100`
        : `${API_URL}/api/logs?limit=100&event_type=${logFilter}`
      const res = await fetch(url, {
        headers: { 'X-API-Key': apiKey }
      })
      if (res.ok) {
        const data = await res.json()
        setLogs(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLogsLoading(false)
    }
  }

  const createMailbox = async () => {
    if (!apiKey) return
    try {
      const requestBody = { address: newAddress || null }
      
      // Add domain selection parameters
      if (domainSelectionMode === 'specific' && specificDomain) {
        requestBody.domain_selection = 'specific'
        requestBody.specific_domain = specificDomain
      } else if (domainSelectionMode !== 'default') {
        requestBody.domain_selection = domainSelectionMode
      }
      
      const res = await fetch(`${API_URL}/api/mailboxes`, {
        method: 'POST',
        headers: { 
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })
      if (res.ok) {
        const mailbox = await res.json()
        setMailboxes([...mailboxes, mailbox])
        setNewAddress('')
        showToast('邮箱创建成功！')
      } else {
        const error = await res.json()
        showToast(error.detail || '创建邮箱失败', 'error')
      }
    } catch (err) {
      console.error(err)
      showToast('创建邮箱失败', 'error')
    }
  }

  const deleteMailbox = async (address) => {
    if (!apiKey) return
    try {
      const res = await fetch(`${API_URL}/api/mailboxes/${address}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': apiKey }
      })
      if (res.ok) {
        setMailboxes(mailboxes.filter(m => m.address !== address))
        if (selectedMailbox === address) {
          setSelectedMailbox(null)
          setEmails([])
        }
        showToast('邮箱已删除')
      }
    } catch (err) {
      console.error(err)
      showToast('删除邮箱失败', 'error')
    }
  }

  const selectMailbox = async (address) => {
    setSelectedMailbox(address)
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/mailboxes/${address}`, {
        headers: { 'X-API-Key': apiKey }
      })
      if (res.ok) {
        const data = await res.json()
        setEmails(data)
      }
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const createDomain = async () => {
    if (!apiKey || !newDomain) return
    try {
      const res = await fetch(`${API_URL}/api/domains`, {
        method: 'POST',
        headers: { 
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ domain: newDomain })
      })
      if (res.ok) {
        const domain = await res.json()
        setDomains([...domains, domain])
        setNewDomain('')
        
        // Show DNS config result
        if (domain.dns_configured) {
          showToast(`域名添加成功！DNS 记录已自动配置 (${domain.dns_message})`)
        } else if (domain.dns_message) {
          showToast(`域名添加成功！${domain.dns_message}`, 'warning')
        } else {
          showToast('域名添加成功！')
        }
      }
    } catch (err) {
      console.error(err)
      showToast('添加域名失败', 'error')
    }
  }

  const deleteDomain = async (id) => {
    if (!apiKey) return
    try {
      const res = await fetch(`${API_URL}/api/domains/${id}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': apiKey }
      })
      if (res.ok) {
        setDomains(domains.filter(d => d.id !== id))
        showToast('域名已删除')
      }
    } catch (err) {
      console.error(err)
      showToast('删除域名失败', 'error')
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    showToast('已复制到剪贴板！')
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN')
  }

  const getTimeRemaining = (expiresAt) => {
    const now = new Date()
    const expires = new Date(expiresAt)
    const diff = expires - now
    if (diff <= 0) return '已过期'
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}小时 ${minutes}分钟`
  }

  // Auto-refresh emails every 10 seconds
  useEffect(() => {
    if (selectedMailbox) {
      const interval = setInterval(() => selectMailbox(selectedMailbox), 10000)
      return () => clearInterval(interval)
    }
  }, [selectedMailbox])

  // Auto-refresh logs when filter changes
  useEffect(() => {
    if (isConfigured) {
      fetchLogs()
      const interval = setInterval(fetchLogs, 5000)
      return () => clearInterval(interval)
    }
  }, [logFilter, isConfigured])

  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 max-w-md w-full animate-fadeIn">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 mb-4 animate-pulse-glow">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-display text-3xl font-bold gradient-text mb-2">24MailAPI</h1>
            <p className="text-dark-400">临时邮箱服务</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">API 密钥</label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && checkApiKey()}
                  placeholder="请输入 API 密钥"
                  className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 pr-12 text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-300"
                >
                  {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            
            <button
              onClick={checkApiKey}
              disabled={!apiKey}
              className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              进入管理面板
            </button>
          </div>
          
          <p className="text-center text-dark-500 text-sm mt-6">
            请在环境变量中设置 API_KEY
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl animate-fadeIn ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
        }`}>
          {toast.message}
        </div>
      )}
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-white">24MailAPI</h1>
              <p className="text-dark-400 text-sm">临时邮箱服务</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-dark-800 rounded-lg text-dark-400 text-sm">
              <span className="text-dark-500">API:</span>
              <code className="text-primary-400">{API_URL}</code>
              <button
                onClick={() => copyToClipboard(API_URL)}
                className="text-dark-500 hover:text-primary-400 transition-colors"
                title="复制 API 地址"
              >
                <Copy size={14} />
              </button>
            </div>
            <button
              onClick={fetchMailboxes}
              className="p-2 rounded-lg bg-dark-800 text-dark-300 hover:text-white hover:bg-dark-700 transition-colors"
            >
              <RefreshCw size={20} />
            </button>
            <button
              onClick={() => setIsConfigured(false)}
              className="p-2 rounded-lg bg-dark-800 text-dark-300 hover:text-white hover:bg-dark-700 transition-colors"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'mailboxes', label: '邮箱管理', icon: Inbox },
            { id: 'domains', label: '域名管理', icon: ExternalLink },
            { id: 'logs', label: '系统日志', icon: FileText },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary-500 text-white'
                  : 'bg-dark-800 text-dark-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Mailboxes Tab */}
          {activeTab === 'mailboxes' && (
            <>
              {/* Create Mailbox */}
              <div className="lg:col-span-3 glass rounded-2xl p-6 animate-fadeIn">
                <h2 className="font-display text-xl font-semibold text-white mb-4">创建新邮箱</h2>
                <div className="flex flex-wrap gap-3 items-end">
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="自定义地址（留空则随机生成）"
                    className="flex-1 min-w-[200px] bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                  
                  {/* Domain Selection Mode */}
                  <select
                    value={domainSelectionMode}
                    onChange={(e) => setDomainSelectionMode(e.target.value)}
                    className="bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-colors"
                  >
                    <option value="default">默认域名</option>
                    <option value="round_robin">轮询分配</option>
                    <option value="random">随机分配</option>
                    <option value="specific">指定域名</option>
                  </select>
                  
                  {/* Specific Domain Input (only shown when 'specific' is selected) */}
                  {domainSelectionMode === 'specific' && (
                    <select
                      value={specificDomain}
                      onChange={(e) => setSpecificDomain(e.target.value)}
                      className="bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-colors"
                    >
                      <option value="">选择域名...</option>
                      {domains.map(d => (
                        <option key={d.id} value={d.domain}>{d.domain}</option>
                      ))}
                    </select>
                  )}
                  
                  <button
                    onClick={createMailbox}
                    disabled={domainSelectionMode === 'specific' && !specificDomain}
                    className="flex items-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-white font-semibold px-6 py-3 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={20} />
                    创建
                  </button>
                </div>
                <div className="mt-3 text-sm text-dark-400">
                  {domainSelectionMode === 'default' && <span>将使用默认域名创建邮箱</span>}
                  {domainSelectionMode === 'round_robin' && <span>将在所有域名间轮询分配</span>}
                  {domainSelectionMode === 'random' && <span>将在所有域名中随机选择</span>}
                  {domainSelectionMode === 'specific' && <span>将使用您指定的域名</span>}
                </div>
              </div>

              {/* Mailbox List */}
              <div className="lg:col-span-1 glass rounded-2xl p-6 animate-fadeIn stagger-1">
                <h2 className="font-display text-lg font-semibold text-white mb-4">邮箱列表</h2>
                {loading && mailboxes.length === 0 ? (
                  <div className="text-center py-8 text-dark-400">加载中...</div>
                ) : mailboxes.length === 0 ? (
                  <div className="text-center py-8 text-dark-400">
                    <Inbox size={48} className="mx-auto mb-3 opacity-50" />
                    <p>暂无邮箱</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {mailboxes.map((mb, i) => (
                      <div
                        key={mb.address}
                        onClick={() => selectMailbox(mb.address)}
                        className={`p-3 rounded-xl cursor-pointer transition-all animate-slideIn stagger-${Math.min(i + 1, 5)} ${
                          selectedMailbox === mb.address
                            ? 'bg-primary-500/20 border border-primary-500'
                            : 'bg-dark-800 hover:bg-dark-700 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{mb.address}</p>
                            <div className="flex items-center gap-2 text-sm text-dark-400">
                              <Clock size={14} />
                              <span>{getTimeRemaining(mb.expires_at)}</span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteMailbox(mb.address) }}
                            className="p-2 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Email View */}
              <div className="lg:col-span-2 glass rounded-2xl p-6 animate-fadeIn stagger-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-lg font-semibold text-white">
                    {selectedMailbox ? selectedMailbox : '请选择邮箱'}
                  </h2>
                  {selectedMailbox && (
                    <button
                      onClick={() => copyToClipboard(selectedMailbox)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 rounded-lg transition-colors text-sm"
                    >
                      <Copy size={14} />
                      复制
                    </button>
                  )}
                </div>
                
                {selectedMailbox ? (
                  loading ? (
                    <div className="text-center py-8 text-dark-400">加载邮件中...</div>
                  ) : emails.length === 0 ? (
                    <div className="text-center py-8 text-dark-400">
                      <Mail size={48} className="mx-auto mb-3 opacity-50" />
                      <p>暂无邮件</p>
                      <p className="text-sm mt-1">发送邮件到此邮箱即可在此查看</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {emails.map((email, i) => (
                        <div
                          key={i}
                          className="p-4 bg-dark-800 rounded-xl border border-dark-600 hover:border-dark-500 transition-colors animate-slideIn"
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-primary-400 font-medium">{email.from_addr}</p>
                              <p className="text-dark-400 text-sm">{email.subject || '(无主题)'}</p>
                            </div>
                            <span className="text-dark-500 text-xs">{formatDate(email.timestamp)}</span>
                          </div>
                          <div className="mt-3 p-3 bg-dark-900 rounded-lg text-dark-300 text-sm whitespace-pre-wrap font-mono">
                            {email.content || email.text_content}
                          </div>
                          {email.html_content && (
                            <details className="mt-3">
                              <summary className="text-primary-400 text-sm cursor-pointer">查看 HTML</summary>
                              <div 
                                className="mt-2 p-3 bg-dark-900 rounded-lg text-dark-300 text-sm max-h-48 overflow-y-auto"
                                dangerouslySetInnerHTML={{ __html: email.html_content }}
                              />
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="text-center py-12 text-dark-400">
                    <Inbox size={64} className="mx-auto mb-4 opacity-30" />
                    <p>选择邮箱查看邮件</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Domains Tab */}
          {activeTab === 'domains' && (
            <div className="lg:col-span-3 glass rounded-2xl p-6 animate-fadeIn">
              <h2 className="font-display text-xl font-semibold text-white mb-4">域名管理</h2>
              
              <div className="flex gap-3 mb-6">
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="输入域名（例如：mail.example.com）"
                  className="flex-1 bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
                />
                <button
                  onClick={createDomain}
                  disabled={!newDomain}
                  className="flex items-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-all"
                >
                  <Plus size={20} />
                  添加域名
                </button>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {domains.map((domain, i) => (
                  <div
                    key={domain.id}
                    className="p-4 bg-dark-800 rounded-xl border border-dark-600 animate-slideIn"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{domain.domain}</p>
                        <p className="text-dark-500 text-sm">
                          {domain.is_default ? '默认域名' : '自定义域名'}
                        </p>
                        {domain.dns_configured ? (
                          <span className="inline-flex items-center gap-1 text-green-400 text-xs mt-1">
                            <Check size={12} /> DNS 已配置
                          </span>
                        ) : domain.dns_message ? (
                          <span className="text-yellow-400 text-xs mt-1 block">{domain.dns_message}</span>
                        ) : null}
                      </div>
                      {!domain.is_default && (
                        <button
                          onClick={() => deleteDomain(domain.id)}
                          className="p-2 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="lg:col-span-3 glass rounded-2xl p-6 animate-fadeIn">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-semibold text-white">系统日志</h2>
                <div className="flex items-center gap-3">
                  <select
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value)}
                    className="bg-dark-800 border border-dark-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary-500"
                  >
                    <option value="all">所有日志</option>
                    <option value="mailbox_created">邮箱创建</option>
                    <option value="mailbox_deleted">邮箱删除</option>
                    <option value="domain_added">域名添加</option>
                    <option value="domain_deleted">域名删除</option>
                    <option value="email_received">收到邮件</option>
                    <option value="error">错误</option>
                  </select>
                  <button
                    onClick={fetchLogs}
                    className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
                  >
                    <RefreshCw size={18} className={logsLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              <div className="bg-dark-900 rounded-xl border border-dark-700 overflow-hidden">
                {logsLoading && logs.length === 0 ? (
                  <div className="p-8 text-center text-dark-400">加载中...</div>
                ) : logs.length === 0 ? (
                  <div className="p-8 text-center text-dark-400">暂无日志</div>
                ) : (
                  <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-dark-800 sticky top-0">
                        <tr>
                          <th className="text-left text-dark-400 text-xs font-medium px-4 py-3">时间</th>
                          <th className="text-left text-dark-400 text-xs font-medium px-4 py-3">类型</th>
                          <th className="text-left text-dark-400 text-xs font-medium px-4 py-3">消息</th>
                          <th className="text-left text-dark-400 text-xs font-medium px-4 py-3">详情</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-800">
                        {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-dark-800/50 transition-colors">
                            <td className="px-4 py-3 text-dark-400 text-sm whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString('zh-CN', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium ${
                                log.event_type === 'mailbox_created' ? 'bg-green-500/20 text-green-400' :
                                log.event_type === 'mailbox_deleted' ? 'bg-red-500/20 text-red-400' :
                                log.event_type === 'domain_added' ? 'bg-blue-500/20 text-blue-400' :
                                log.event_type === 'domain_deleted' ? 'bg-orange-500/20 text-orange-400' :
                                log.event_type === 'email_received' ? 'bg-purple-500/20 text-purple-400' :
                                log.event_type === 'error' ? 'bg-red-500/20 text-red-400' :
                                'bg-dark-700 text-dark-400'
                              }`}>
                                {log.event_type === 'mailbox_created' && '创建邮箱'}
                                {log.event_type === 'mailbox_deleted' && '删除邮箱'}
                                {log.event_type === 'domain_added' && '添加域名'}
                                {log.event_type === 'domain_deleted' && '删除域名'}
                                {log.event_type === 'email_received' && '收到邮件'}
                                {log.event_type === 'error' && '错误'}
                                {log.event_type === 'dns_configured' && 'DNS配置'}
                                {log.event_type === 'api_request' && 'API请求'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-white text-sm">{log.message}</td>
                            <td className="px-4 py-3 text-dark-400 text-sm max-w-xs truncate">{log.details || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
