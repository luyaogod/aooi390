import { useEffect, useState } from 'react'

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
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

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

function SyncDataPage() {
  const [syncTables, setSyncTables] = useState<string[]>([])
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncAllResult | null>(null)
  const [syncTablesLoading, setSyncTablesLoading] = useState(true)

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
    fetchSyncTables()
  }, [])

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* 数据拉取卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>数据拉取</CardTitle>
          <CardDescription>从外部数据库同步数据到本地 SQLite</CardDescription>
          {syncResult && (
            <CardAction>
              <Badge
                className={syncResult.success
                  ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                }
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
                                <Badge className="gap-1 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                                  <CheckCircle2 className="size-3" />
                                  成功
                                </Badge>
                              ) : (
                                <Badge className="gap-1 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
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
            {syncLoading
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Download className="size-3.5" />
            }
            {syncLoading ? '拉取中...' : '开始拉取'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default SyncDataPage
