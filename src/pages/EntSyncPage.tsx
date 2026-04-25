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
  GitBranch,
  Loader2,
  Search,
  Play,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

function EntSyncPage() {
  const [tables, setTables] = useState<Array<{ tableName: string; entField: string }>>([])
  const [tablesLoading, setTablesLoading] = useState(true)

  const [entList, setEntList] = useState<number[]>([])
  const [entListLoading, setEntListLoading] = useState(true)

  const [sourceEnt, setSourceEnt] = useState('')
  const [targetEnt, setTargetEnt] = useState('')

  const [preview, setPreview] = useState<Array<{ tableName: string; entField: string; sourceCount: number }>>([])
  const [previewLoading, setPreviewLoading] = useState(false)

  const [syncLoading, setSyncLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<{ success: boolean; results: Array<{ tableName: string; success: boolean; sourceCount: number; tempCount: number; deletedCount: number; insertedCount: number; verifyCount: number; error?: string }>; message: string } | null>(null)

  // 已预览确认，可以执行同步
  const [confirmed, setConfirmed] = useState(false)

  const fetchEntList = async () => {
    setEntListLoading(true)
    try {
      const result = await window.electronAPI.getEntList()
      if (result.success) {
        setEntList(result.entList)
      }
    } catch (err) {
      console.error('获取ENT列表失败:', err)
    } finally {
      setEntListLoading(false)
    }
  }

  const fetchTables = async () => {
    setTablesLoading(true)
    try {
      const result = await window.electronAPI.getEntSyncTables()
      if (result.success) {
        setTables(result.tables)
      }
    } catch (err) {
      console.error('获取ENT同步表配置失败:', err)
    } finally {
      setTablesLoading(false)
    }
  }

  const handlePreview = async () => {
    const src = Number(sourceEnt)
    if (!src) return

    setPreviewLoading(true)
    setPreview([])
    setConfirmed(false)
    setSyncResult(null)
    try {
      const result = await window.electronAPI.entPreview(src)
      if (result.success) {
        setPreview(result.preview)
      }
    } catch (err) {
      console.error('ENT预览失败:', err)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleConfirm = () => {
    setConfirmed(true)
  }

  const handleSync = async () => {
    const src = Number(sourceEnt)
    const tgt = Number(targetEnt)
    if (!src || !tgt) return

    setSyncLoading(true)
    setSyncResult(null)
    try {
      const result = await window.electronAPI.entSyncAll(src, tgt)
      setSyncResult(result)
    } catch (err) {
      setSyncResult({
        success: false,
        results: [],
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSyncLoading(false)
      setConfirmed(false)
    }
  }

  useEffect(() => {
    fetchTables()
    fetchEntList()
  }, [])

  const canPreview = sourceEnt !== '' && targetEnt !== '' && sourceEnt !== targetEnt && tables.length > 0
  const entDuplicate = sourceEnt !== '' && targetEnt !== '' && sourceEnt === targetEnt

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* ENT 参数配置卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>同步流程图</CardTitle>
          <CardDescription>将外部数据库中指定 ENT 的数据复制为目标 ENT（批量操作）</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {tablesLoading || entListLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <span className="text-muted-foreground">同步表数</span>
              <span>{tables.length} 张</span>
              <span className="text-muted-foreground">表名列表</span>
              <div className="flex flex-wrap gap-1">
                {tables.map((t) => (
                  <Badge key={t.tableName} variant="secondary" className="font-mono text-xs">
                    {t.tableName}
                  </Badge>
                ))}
              </div>

              <span className="text-muted-foreground">源 ENT</span>
              <Select
                value={sourceEnt}
                onValueChange={(value) => {
                  if (value) setSourceEnt(value)
                  setPreview([])
                  setConfirmed(false)
                  setSyncResult(null)
                }}
              >
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="选择源 ENT" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {entList
                      .filter(ent => String(ent) !== targetEnt)
                      .map((ent) => (
                        <SelectItem key={ent} value={String(ent)}>{ent}</SelectItem>
                      ))
                    }
                  </SelectGroup>
                </SelectContent>
              </Select>

              <span className="text-muted-foreground">目标 ENT</span>
              <Select
                value={targetEnt}
                onValueChange={(value) => {
                  if (value) setTargetEnt(value)
                  setConfirmed(false)
                  setSyncResult(null)
                }}
              >
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="选择目标 ENT" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {entList
                      .filter(ent => String(ent) !== sourceEnt)
                      .map((ent) => (
                        <SelectItem key={ent} value={String(ent)}>{ent}</SelectItem>
                      ))
                    }
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}
          {entDuplicate && (
            <Alert variant="destructive">
              <XCircle className="size-4" />
              <AlertTitle>ENT 不可重复</AlertTitle>
              <AlertDescription>源 ENT 和目标 ENT 不能相同</AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={!canPreview || previewLoading}
            className="gap-1.5"
          >
            {previewLoading
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Search className="size-3.5" />
            }
            {previewLoading ? '查询中...' : '查询预览'}
          </Button>
        </CardFooter>
      </Card>

      {/* 预览结果卡片 */}
      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>预览结果</CardTitle>
            <CardDescription>
              源 ENT={sourceEnt} 在各表中的数据条数
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>表名</TableHead>
                  <TableHead>ENT 字段</TableHead>
                  <TableHead className="text-right">数据条数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((p) => (
                  <TableRow key={p.tableName}>
                    <TableCell className="font-mono">{p.tableName}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{p.entField}</TableCell>
                    <TableCell className="text-right">
                      {p.sourceCount === -1 ? (
                        <Badge className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">查询失败</Badge>
                      ) : p.sourceCount === 0 ? (
                        <span className="text-muted-foreground">0</span>
                      ) : (
                        <span className="font-medium">{p.sourceCount}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {!syncResult && (
              <Alert className="mt-4" variant="default">
                <AlertTriangle className="size-4" />
                <AlertTitle>请确认操作</AlertTitle>
                <AlertDescription>
                  即将把 ENT={sourceEnt} 的数据复制为 ENT={targetEnt}，
                  目标 ENT={targetEnt} 的原有数据将被<strong>先删除再插入</strong>。
                  请确认无误后点击下方「确认并执行」按钮。
                </AlertDescription>
              </Alert>
            )}
          </CardContent>

          {!syncResult && (
            <CardFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreview}
                disabled={previewLoading}
                className="gap-1.5"
              >
                <Search className="size-3.5" />
                重新查询
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={confirmed || !preview.some(p => p.sourceCount > 0)}
                className="gap-1.5"
              >
                <GitBranch className="size-3.5" />
                确认操作
              </Button>
              {confirmed && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncLoading}
                  className="gap-1.5"
                >
                  {syncLoading
                    ? <Loader2 className="size-3.5 animate-spin" />
                    : <Play className="size-3.5" />
                  }
                  {syncLoading ? '执行中...' : '执行同步'}
                </Button>
              )}
            </CardFooter>
          )}
        </Card>
      )}

      {/* 同步结果卡片 */}
      {syncResult && (
        <Card>
          <CardHeader>
            <CardTitle>同步结果</CardTitle>
            <CardDescription>ENT={sourceEnt} → ENT={targetEnt} 同步执行结果</CardDescription>
            <CardAction>
              <Badge
                className={syncResult.success
                  ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                }
              >
                {syncResult.success ? '全部成功' : '部分失败'}
              </Badge>
            </CardAction>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <Alert variant={syncResult.success ? 'default' : 'destructive'}>
              {syncResult.success ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <XCircle className="size-4" />
              )}
              <AlertTitle>执行结果</AlertTitle>
              <AlertDescription>{syncResult.message}</AlertDescription>
            </Alert>

            {syncResult.results.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>表名</TableHead>
                    <TableHead className="text-right">临时表</TableHead>
                    <TableHead className="text-right">删除数</TableHead>
                    <TableHead className="text-right">插入数</TableHead>
                    <TableHead className="text-right">验证数</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncResult.results.map((r) => (
                    <TableRow key={r.tableName}>
                      <TableCell className="font-mono">{r.tableName}</TableCell>
                      <TableCell className="text-right">{r.tempCount}</TableCell>
                      <TableCell className="text-right">{r.deletedCount}</TableCell>
                      <TableCell className="text-right">{r.insertedCount}</TableCell>
                      <TableCell className="text-right font-medium">{r.verifyCount}</TableCell>
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
          </CardContent>

          <CardFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPreview([])
                setSyncResult(null)
                setConfirmed(false)
              }}
              className="gap-1.5"
            >
              重新开始
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}

export default EntSyncPage
