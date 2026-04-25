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
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import {
  RefreshCw,
  AlertCircle,
} from 'lucide-react'

interface SQLiteStatus {
  connected: boolean
  status: string
  dbType: string
  dbPath: string
  error?: string
}

function AppDBPage() {
  const [sqliteStatus, setSqliteStatus] = useState<SQLiteStatus | null>(null)
  const [sqliteLoading, setSqliteLoading] = useState(true)

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

  useEffect(() => {
    fetchSQLiteStatus()
  }, [])

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
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
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <span className="text-muted-foreground">连接状态</span>
              <span
                className={cn(
                  'font-medium',
                  sqliteStatus?.connected ? 'text-primary' : 'text-destructive'
                )}
              >
                {sqliteStatus?.status}
              </span>
              <span className="text-muted-foreground">数据库类型</span>
              <span>{sqliteStatus?.dbType}</span>
              <span className="text-muted-foreground">数据库路径</span>
              <span className="font-mono text-xs text-muted-foreground break-all">
                {sqliteStatus?.dbPath}
              </span>
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
    </div>
  )
}

export default AppDBPage
