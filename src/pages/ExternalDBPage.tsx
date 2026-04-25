import { useEffect, useState } from 'react'
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
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import {
  Plug,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

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

function ExternalDBPage() {
  const [connections, setConnections] = useState<ExternalDBConnection[]>([])
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('')
  const [externalLoading, setExternalLoading] = useState(false)
  const [externalResult, setExternalResult] = useState<ExternalDBTestResult | null>(null)
  const [connectionsLoading, setConnectionsLoading] = useState(true)

  const [syncTables, setSyncTables] = useState<string[]>([])
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncAllResult | null>(null)
  const [syncTablesLoading, setSyncTablesLoading] = useState(true)

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
    fetchConnections()
    fetchSyncTables()
  }, [])

  const selectedConnection = connections.find(c => c.id === selectedConnectionId)

  return (
    <div className="flex flex-col gap-6">
      {/* 外部数据库卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>外部数据库</CardTitle>
          <CardDescription>连接并测试外部数据库（Kingbase / Oracle）</CardDescription>
          {externalResult && (
            <CardAction>
              <Badge
                variant={externalResult.connected ? 'default' : 'destructive'}
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
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <span className="text-muted-foreground">选择连接</span>
                <Select
                  value={selectedConnectionId}
                  onValueChange={(value) => {
                    if (value) {
                      setSelectedConnectionId(value)
                      setExternalResult(null)
                    }
                  }}
                >
                  <SelectTrigger className="w-60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {connections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id}>
                          {conn.name}
                          {conn.isDefault ? ' (默认)' : ''}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>

                {selectedConnection && (
                  <>
                    <span className="text-muted-foreground">数据库类型</span>
                    <Badge variant="secondary">
                      {selectedConnection.type === 'kingbase' ? 'Kingbase' : 'Oracle'}
                    </Badge>
                    {selectedConnection.description && (
                      <>
                        <span className="text-muted-foreground">描述</span>
                        <span>{selectedConnection.description}</span>
                      </>
                    )}
                  </>
                )}
              </div>

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

        <CardFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={testExternalConnection}
            disabled={externalLoading || connections.length === 0}
            className="gap-1.5"
          >
            <Plug className="size-3.5" />
            {externalLoading ? '测试中...' : '测试连接'}
          </Button>
        </CardFooter>
      </Card>

      {/* 数据拉取卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>数据拉取</CardTitle>
          <CardDescription>从外部数据库同步数据到本地 SQLite</CardDescription>
          {syncResult && (
            <CardAction>
              <Badge
                variant={syncResult.success ? 'default' : 'destructive'}
              >
                {syncResult.success ? '成功' : '失败'}
              </Badge>
            </CardAction>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {syncTablesLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : syncTables.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="size-4" />
              未配置同步表
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <span className="text-muted-foreground">同步表数</span>
                <span>{syncTables.length} 张</span>
                <span className="text-muted-foreground">表名列表</span>
                <div className="flex flex-wrap gap-1">
                  {syncTables.map((t) => (
                    <Badge key={t} variant="secondary" className="font-mono text-xs">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>

              {syncResult && (
                <div className="flex flex-col gap-3">
                  <Alert
                    variant={syncResult.success ? 'default' : 'destructive'}
                  >
                    {syncResult.success ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <XCircle className="size-4" />
                    )}
                    <AlertTitle>同步结果</AlertTitle>
                    <AlertDescription>{syncResult.message}</AlertDescription>
                  </Alert>

                  {syncResult.results.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>表名</TableHead>
                          <TableHead>源数据</TableHead>
                          <TableHead>插入数</TableHead>
                          <TableHead>状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {syncResult.results.map((r) => (
                          <TableRow key={r.tableName}>
                            <TableCell className="font-mono">{r.tableName}</TableCell>
                            <TableCell>{r.sourceCount}</TableCell>
                            <TableCell>{r.insertedCount}</TableCell>
                            <TableCell>
                              {r.success ? (
                                <Badge variant="default" className="gap-1">
                                  <CheckCircle2 className="size-3" />
                                  成功
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="gap-1">
                                  <XCircle className="size-3" />
                                  失败
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={syncAllTables}
            disabled={syncLoading || syncTables.length === 0}
            className="gap-1.5"
          >
            <Download className={cn('size-3.5', syncLoading && 'animate-spin')} />
            {syncLoading ? '拉取中...' : '开始拉取'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default ExternalDBPage
