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

interface SyncResult {
  tableName: string
  success: boolean
  sourceCount: number
  insertedCount: number
  error?: string
}

interface SyncAllResult {
  success: boolean
  results: SyncResult[]
  message: string
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

  // 同步状态
  const [syncTables, setSyncTables] = useState<string[]>([])
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncAllResult | null>(null)
  const [syncTablesLoading, setSyncTablesLoading] = useState(true)

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
        const defaultConn = result.connections.find(c => c.isDefault)
        if (defaultConn) {
          setSelectedConnectionId(defaultConn.id)
        } else if (result.connections.length > 0) {
          setSelectedConnectionId(result.connections[0].id)
        }
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

  const fetchSyncTables = async () => {
    setSyncTablesLoading(true)
    try {
      const result = await window.electronAPI.getSyncTables()
      if (result.success) {
        setSyncTables(result.tables)
      }
    } catch (err) {
      console.error('获取同步表列表失败:', err)
    } finally {
      setSyncTablesLoading(false)
    }
  }

  const syncAllTables = async () => {
    setSyncLoading(true)
    setSyncResult(null)
    try {
      const result = await window.electronAPI.syncAllTables()
      setSyncResult(result)
    } catch (err) {
      setSyncResult({
        success: false,
        results: [],
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSyncLoading(false)
    }
  }

  useEffect(() => {
    fetchSQLiteStatus()
    fetchConnections()
    fetchSyncTables()
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

      {/* 数据同步卡片 */}
      <div className={`card ${syncResult?.success ? 'connected' : syncResult ? 'disconnected' : ''}`}>
        <div className="card-header">
          <span className={`status-dot ${syncResult?.success ? 'green' : syncResult ? 'red' : 'gray'}`} />
          <h2>数据同步</h2>
        </div>

        {syncTablesLoading ? (
          <p className="loading">正在加载同步配置...</p>
        ) : syncTables.length === 0 ? (
          <p className="loading">未配置同步表</p>
        ) : (
          <div className="card-body">
            <div className="info-row">
              <span className="label">同步表数：</span>
              <span className="value">{syncTables.length} 张</span>
            </div>
            <div className="info-row">
              <span className="label">表名列表：</span>
              <span className="value path">{syncTables.join(', ')}</span>
            </div>

            {syncResult && (
              <div className={`test-result ${syncResult.success ? '' : 'error'}`}>
                <div className="info-row">
                  <span className="label">同步结果：</span>
                  <span className={`value ${syncResult.success ? 'success' : 'error'}`}>
                    {syncResult.message}
                  </span>
                </div>
                {syncResult.results.length > 0 && (
                  <div className="sync-detail">
                    <table className="sync-table">
                      <thead>
                        <tr>
                          <th>表名</th>
                          <th>源数据</th>
                          <th>插入数</th>
                          <th>状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {syncResult.results.map((r) => (
                          <tr key={r.tableName} className={r.success ? '' : 'error-row'}>
                            <td>{r.tableName}</td>
                            <td>{r.sourceCount}</td>
                            <td>{r.insertedCount}</td>
                            <td className={r.success ? 'success' : 'error'}>
                              {r.success ? '成功' : `失败${r.error ? ': ' + r.error.substring(0, 30) : ''}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <button
          className="refresh-btn sync-btn"
          onClick={syncAllTables}
          disabled={syncLoading || syncTables.length === 0}
        >
          {syncLoading ? '同步中...' : '开始同步'}
        </button>
      </div>
    </div>
  )
}

export default App
