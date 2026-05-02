import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { Field } from '@/components/ui/field'
import {
  RefreshCw,
  AlertCircle,
  Plug,
  CheckCircle2,
  XCircle,
  Globe,
  Pencil,
} from 'lucide-react'

interface SQLiteStatus {
  connected: boolean
  status: string
  dbType: string
  dbPath: string
  error?: string
}

interface ExternalDBConnection {
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

interface T100GlobalItem {
  name: string
  globals: {
    g_user: string
    g_dept: string
    g_enterprise: string
    g_site: string
    g_lang: string
    g_dlang: string
  }
  isDefault?: boolean
  description?: string
}

function SettingsPage() {
  // SQLite 状态
  const [sqliteStatus, setSqliteStatus] = useState<SQLiteStatus | null>(null)
  const [sqliteLoading, setSqliteLoading] = useState(true)

  // 外部数据库
  const [connections, setConnections] = useState<ExternalDBConnection[]>([])
  const [selectedConnectionName, setSelectedConnectionName] = useState<string>('')
  const [switchingDB, setSwitchingDB] = useState(false)
  const [externalLoading, setExternalLoading] = useState(false)
  const [externalResult, setExternalResult] = useState<ExternalDBTestResult | null>(null)
  const [connectionsLoading, setConnectionsLoading] = useState(true)

  // T100 全局变量
  const [configs, setConfigs] = useState<T100GlobalItem[]>([])
  const [configsLoading, setConfigsLoading] = useState(true)
  const [selectedName, setSelectedName] = useState<string>('')
  const switchingRef = useRef(false)

  // === SQLite ===
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

  // === 外部数据库 ===
  const fetchConnections = async () => {
    setConnectionsLoading(true)
    try {
      const result = await window.electronAPI.getExternalDBConnections()
      if (result.success) {
        setConnections(result.connections)
        const defaultConn = result.connections.find(c => c.isDefault)
        if (defaultConn) {
          setSelectedConnectionName(defaultConn.name)
        } else if (result.connections.length > 0) {
          setSelectedConnectionName(result.connections[0].name)
        }
      }
    } catch (err) {
      console.error('获取连接配置失败:', err)
    } finally {
      setConnectionsLoading(false)
    }
  }

  const testExternalConnection = async () => {
    if (!selectedConnection) return
    setExternalLoading(true)
    setExternalResult(null)
    try {
      const result = await window.electronAPI.testExternalDBConnection(selectedConnectionName)
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

  // === T100 ===
  const fetchConfigs = async () => {
    setConfigsLoading(true)
    try {
      const result = await window.electronAPI.getT100Configs()
      if (result.success) {
        setConfigs(result.configs)
        const active = result.configs.find(c => c.isDefault)
        if (active) {
          setSelectedName(active.name)
        } else if (result.configs.length > 0) {
          setSelectedName(result.configs[0].name)
        }
      }
    } catch (err) {
      console.error('获取T100配置失败:', err)
    } finally {
      setConfigsLoading(false)
    }
  }

  const handleSwitch = async () => {
    if (!selectedName || switchingRef.current) return
    switchingRef.current = true
    try {
      const result = await window.electronAPI.setT100ActiveConfig(selectedName)
      if (result.success) {
        setConfigs(prev => prev.map(c => ({
          ...c,
          isDefault: c.name === selectedName,
        })))
        toast.success('已切换为「' + selectedName + '」')
      }
    } catch (err) {
      console.error('切换T100配置失败:', err)
    } finally {
      switchingRef.current = false
    }
  }

  // === 编辑 & 刷新配置文件 ===
  const [refreshingDB, setRefreshingDB] = useState(false)
  const [refreshingT100, setRefreshingT100] = useState(false)

  const handleEditExternalDBConfig = async () => {
    try {
      const result = await window.electronAPI.editExternalDBConfig()
      if (!result.success) {
        toast.error('打开配置文件失败: ' + (result.error || '未知错误'))
      }
    } catch (err) {
      toast.error('打开配置文件失败: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const handleRefreshExternalDB = async () => {
    setRefreshingDB(true)
    try {
      const result = await window.electronAPI.refreshExternalDBConnections()
      if (result.success) {
        setConnections(result.connections)
        const defaultConn = result.connections.find(c => c.isDefault)
        if (defaultConn) {
          setSelectedConnectionName(defaultConn.name)
        } else if (result.connections.length > 0) {
          setSelectedConnectionName(result.connections[0].name)
        }
        toast.success('外部数据库配置已刷新')
      }
    } catch (err) {
      toast.error('刷新配置失败')
    } finally {
      setRefreshingDB(false)
    }
  }

  const handleEditT100Config = async () => {
    try {
      const result = await window.electronAPI.editT100Config()
      if (!result.success) {
        toast.error('打开配置文件失败: ' + (result.error || '未知错误'))
      }
    } catch (err) {
      toast.error('打开配置文件失败: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const handleRefreshT100Configs = async () => {
    setRefreshingT100(true)
    try {
      const result = await window.electronAPI.refreshT100Configs()
      if (result.success) {
        setConfigs(result.configs)
        const active = result.configs.find(c => c.isDefault)
        if (active) {
          setSelectedName(active.name)
        } else if (result.configs.length > 0) {
          setSelectedName(result.configs[0].name)
        }
        toast.success('T100 配置已刷新')
      }
    } catch (err) {
      toast.error('刷新配置失败')
    } finally {
      setRefreshingT100(false)
    }
  }

  useEffect(() => {
    fetchSQLiteStatus()
    fetchConnections()
    fetchConfigs()
  }, [])

  const selectedConnection = connections.find(c => c.name === selectedConnectionName)
  const selectedConfig = configs.find(c => c.name === selectedName)
  const activeConfig = configs.find(c => c.isDefault)
  const isAlreadyActive = selectedName === activeConfig?.name

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* SQLite 本地数据库卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>SQLite 本地数据库</CardTitle>
          <CardDescription>查看内置 SQLite 数据库的连接状态与路径信息</CardDescription>
          <CardAction>
            <Badge
              className={sqliteStatus?.connected
                ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
              }
            >
              {sqliteStatus?.connected ? '已连接' : '未连接'}
            </Badge>
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {sqliteLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Field label="连接状态">
                <span className={cn('font-medium text-sm', sqliteStatus?.connected ? 'text-primary' : 'text-destructive')}>
                  {sqliteStatus?.status}
                </span>
              </Field>
              <Field label="数据库类型">
                <span className="text-sm">{sqliteStatus?.dbType}</span>
              </Field>
              <Field label="数据库路径">
                <span className="font-mono text-xs text-muted-foreground break-all">
                  {sqliteStatus?.dbPath}
                </span>
              </Field>
            </div>
          )}

          {sqliteStatus?.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>连接错误</AlertTitle>
              <AlertDescription>{sqliteStatus.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSQLiteStatus}
            disabled={sqliteLoading}
            className="gap-1.5"
          >
            <RefreshCw className={cn('size-3.5', sqliteLoading && 'animate-spin')} />
            {sqliteLoading ? '检测中...' : '刷新状态'}
          </Button>
        </CardFooter>
      </Card>

      {/* 外部数据库卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>外部数据库</CardTitle>
          <CardDescription>连接并测试外部数据库（Kingbase / Oracle）</CardDescription>
          {externalResult && (
            <CardAction>
              <Badge
                className={externalResult.connected
                  ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                }
              >
                {externalResult.connected ? '已连接' : '未连接'}
              </Badge>
            </CardAction>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {connectionsLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : connections.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Plug className="size-4" />
              暂无外部数据库连接配置
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Field label="选择连接">
                <Select
                  value={selectedConnectionName}
                  onValueChange={async (value) => {
                    if (!value || value === selectedConnectionName) return
                    setSwitchingDB(true)
                    setSelectedConnectionName(value)
                    setExternalResult(null)
                    const result = await window.electronAPI.setDefaultExternalDBConnection(value)
                    if (result.success) {
                      setConnections(prev => prev.map(c => ({ ...c, isDefault: c.name === value })))
                      toast.success(`已切换为全局数据库：${value}`)
                    } else {
                      toast.error(result.error ?? '切换失败')
                    }
                    setSwitchingDB(false)
                  }}
                >
                  <SelectTrigger className="w-60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {connections.map((conn) => (
                        <SelectItem key={conn.name} value={conn.name}>
                          {conn.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              {selectedConnection && (
                <>
                  <Field label="数据库类型">
                    <Badge variant="secondary">
                      {selectedConnection.type === 'kingbase' ? 'Kingbase' : 'Oracle'}
                    </Badge>
                  </Field>
                  {selectedConnection.description && (
                    <Field label="描述">
                      <span className="text-sm">{selectedConnection.description}</span>
                    </Field>
                  )}
                </>
              )}

              {externalResult && (
                <Alert
                  variant={externalResult.connected ? 'default' : 'destructive'}
                >
                  {externalResult.connected ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <XCircle className="size-4" />
                  )}
                  <AlertTitle>测试结果</AlertTitle>
                  <AlertDescription>{externalResult.message}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={testExternalConnection}
            disabled={externalLoading || switchingDB || connections.length === 0}
            className="gap-1.5"
          >
            <Plug className="size-3.5" />
            {externalLoading ? '测试中...' : '测试连接'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEditExternalDBConfig}
            className="gap-1.5"
          >
            <Pencil className="size-3.5" />
            编辑配置文件
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshExternalDB}
            disabled={refreshingDB}
            className="gap-1.5"
          >
            <RefreshCw className={cn('size-3.5', refreshingDB && 'animate-spin')} />
            {refreshingDB ? '刷新中...' : '刷新配置'}
          </Button>
        </CardFooter>
      </Card>

      {/* T100 全局变量卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>T100 全局变量</CardTitle>
          <CardDescription>设置并切换当前系统使用的全局变量配置组</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {configsLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : configs.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="size-4" />
              暂无 T100 全局变量配置
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <Field label="选择配置">
                  <Select
                    value={selectedName}
                    onValueChange={(value) => {
                      if (value) {
                        setSelectedName(value)
                      }
                    }}
                  >
                    <SelectTrigger className="w-72">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {configs.map((c) => (
                          <SelectItem key={c.name} value={c.name}>
                            <span className="flex items-center gap-1.5">
                              {c.isDefault && (
                                <span className="inline-block size-1.5 shrink-0 rounded-full bg-green-500" />
                              )}
                              {c.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                {selectedConfig && (
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="font-mono text-xs gap-1">
                      <span className="text-muted-foreground font-sans font-normal">用户</span>
                      {selectedConfig.globals.g_user}
                    </Badge>
                    <Badge variant="secondary" className="font-mono text-xs gap-1">
                      <span className="text-muted-foreground font-sans font-normal">部门</span>
                      {selectedConfig.globals.g_dept}
                    </Badge>
                    <Badge variant="secondary" className="font-mono text-xs gap-1">
                      <span className="text-muted-foreground font-sans font-normal">ENT</span>
                      {selectedConfig.globals.g_enterprise}
                    </Badge>
                    <Badge variant="secondary" className="font-mono text-xs gap-1">
                      <span className="text-muted-foreground font-sans font-normal">站点</span>
                      {selectedConfig.globals.g_site}
                    </Badge>
                    <Badge variant="secondary" className="font-mono text-xs gap-1">
                      <span className="text-muted-foreground font-sans font-normal">界面语言</span>
                      {selectedConfig.globals.g_lang}
                    </Badge>
                    <Badge variant="secondary" className="font-mono text-xs gap-1">
                      <span className="text-muted-foreground font-sans font-normal">资料语言</span>
                      {selectedConfig.globals.g_dlang}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleEditT100Config}
            className="gap-1.5"
          >
            <Pencil className="size-3.5" />
            编辑配置文件
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshT100Configs}
            disabled={refreshingT100}
            className="gap-1.5"
          >
            <RefreshCw className={cn('size-3.5', refreshingT100 && 'animate-spin')} />
            {refreshingT100 ? '刷新中...' : '刷新配置'}
          </Button>
          {configs.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSwitch}
              disabled={isAlreadyActive}
              className="gap-1.5"
            >
              <Globe className="size-3.5" />
              {isAlreadyActive ? '当前配置' : '切换为此配置'}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

export default SettingsPage
