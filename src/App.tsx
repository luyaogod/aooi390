import { useEffect, useState } from 'react'
import './App.css'

interface SQLiteStatus {
  connected: boolean
  status: string
  dbType: string
  dbPath: string
  error?: string
}

interface ExternalDBConnection {
  id: string
  name: string
  type: 'kingbase' | 'oracle'
  isDefault?: boolean
  description?: string
}

interface ExternalDBTestResult {
  success: boolean
  connected: boolean
  message: string
  dbType?: string
  name?: string
}

function App() {
  // SQLite 状态
  const [sqliteStatus, setSqliteStatus] = useState<SQLiteStatus | null>(null)
  const [sqliteLoading, setSqliteLoading] = useState(true)

  // 外部数据库状态
  const [connections, setConnections] = useState<ExternalDBConnection[]>([])
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('')
  const [externalLoading, setExternalLoading] = useState(false)
  const [externalResult, setExternalResult] = useState<ExternalDBTestResult | null>(null)
  const [connectionsLoading, setConnectionsLoading] = useState(true)

  const fetchSQLiteStatus = async () => {
    setSqliteLoading(true)
    try {
      const status = await window.electronAPI.getSQLiteStatus()
      setSqliteStatus(status)
    } catch (err) {
      setSqliteStatus({
        connected: false,
        status: '查询失败',
        dbType: 'SQLite',
        dbPath: 'unknown',
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSqliteLoading(false)
    }
  }

  const fetchConnections = async () => {
    setConnectionsLoading(true)
    try {
      const result = await window.electronAPI.getExternalDBConnections()
      if (result.success) {
        setConnections(result.connections)
        // 默认选中第一个或默认连接
        const defaultConn = result.connections.find(c => c.isDefault)
        if (defaultConn) {
          setSelectedConnectionId(defaultConn.id)
        } else if (result.connections.length > 0) {
          setSelectedConnectionId(result.connections[0].id)
        }
      } else {
        console.error('获取连接配置失败:', result.error)
      }
    } catch (err) {
      console.error('获取连接配置失败:', err)
    } finally {
      setConnectionsLoading(false)
    }
  }

  const testExternalConnection = async () => {
    if (!selectedConnectionId) return
    setExternalLoading(true)
    setExternalResult(null)
    try {
      const result = await window.electronAPI.testExternalDBConnection(selectedConnectionId)
      setExternalResult(result)
    } catch (err) {
      setExternalResult({
        success: false,
        connected: false,
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setExternalLoading(false)
    }
  }

  useEffect(() => {
    fetchSQLiteStatus()
    fetchConnections()
  }, [])

  const selectedConnection = connections.find(c => c.id === selectedConnectionId)

  return (
    <div className="container">
      <h1>数据库连接状态</h1>

      {/* SQLite 卡片 */}
      <div className={`card ${sqliteStatus?.connected ? 'connected' : 'disconnected'}`}>
        <div className="card-header">
          <span className={`status-dot ${sqliteStatus?.connected ? 'green' : 'red'}`} />
          <h2>SQLite 本地数据库</h2>
        </div>

        {sqliteLoading ? (
          <p className="loading">正在检测连接状态...</p>
        ) : (
          <div className="card-body">
            <div className="info-row">
              <span className="label">连接状态：</span>
              <span className={`value ${sqliteStatus?.connected ? 'success' : 'error'}`}>
                {sqliteStatus?.status}
              </span>
            </div>
            <div className="info-row">
              <span className="label">数据库类型：</span>
              <span className="value">{sqliteStatus?.dbType}</span>
            </div>
            <div className="info-row">
              <span className="label">数据库路径：</span>
              <span className="value path">{sqliteStatus?.dbPath}</span>
            </div>
            {sqliteStatus?.error && (
              <div className="info-row">
                <span className="label">错误信息：</span>
                <span className="value error">{sqliteStatus.error}</span>
              </div>
            )}
          </div>
        )}

        <button className="refresh-btn" onClick={fetchSQLiteStatus} disabled={sqliteLoading}>
          {sqliteLoading ? '检测中...' : '刷新状态'}
        </button>
      </div>

      {/* 外部数据库卡片 */}
      <div className={`card ${externalResult?.connected ? 'connected' : externalResult ? 'disconnected' : ''}`}>
        <div className="card-header">
          <span className={`status-dot ${externalResult?.connected ? 'green' : externalResult ? 'red' : 'gray'}`} />
          <h2>外部数据库</h2>
        </div>

        {connectionsLoading ? (
          <p className="loading">正在加载连接配置...</p>
        ) : connections.length === 0 ? (
          <p className="loading">暂无外部数据库连接配置</p>
        ) : (
          <div className="card-body">
            <div className="info-row">
              <span className="label">选择连接：</span>
              <select
                className="connection-select"
                value={selectedConnectionId}
                onChange={(e) => {
                  setSelectedConnectionId(e.target.value)
                  setExternalResult(null)
                }}
              >
                {connections.map(conn => (
                  <option key={conn.id} value={conn.id}>
                    {conn.name} {conn.isDefault ? '(默认)' : ''} [{conn.type === 'kingbase' ? 'Kingbase' : 'Oracle'}]
                  </option>
                ))}
              </select>
            </div>

            {selectedConnection && (
              <>
                <div className="info-row">
                  <span className="label">数据库类型：</span>
                  <span className="value">
                    {selectedConnection.type === 'kingbase' ? 'Kingbase' : 'Oracle'}
                  </span>
                </div>
                {selectedConnection.description && (
                  <div className="info-row">
                    <span className="label">描述：</span>
                    <span className="value">{selectedConnection.description}</span>
                  </div>
                )}
              </>
            )}

            {externalResult && (
              <div className="test-result">
                <div className="info-row">
                  <span className="label">测试结果：</span>
                  <span className={`value ${externalResult.connected ? 'success' : 'error'}`}>
                    {externalResult.message}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          className="refresh-btn test-btn"
          onClick={testExternalConnection}
          disabled={externalLoading || connections.length === 0}
        >
          {externalLoading ? '测试中...' : '测试连接'}
        </button>
      </div>
    </div>
  )
}

export default App
