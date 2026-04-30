import { useEffect, useState } from 'react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Field } from '@/components/ui/field'
import {
  Loader2,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

function GenAooi200Page() {
  const [connections, setConnections] = useState<ExternalDBConnection[]>([])
  const [connectionsLoading, setConnectionsLoading] = useState(true)
  const [selectedConnection, setSelectedConnection] = useState('')

  const [genLoading, setGenLoading] = useState(false)
  const [cleanLoading, setCleanLoading] = useState(false)
  const [genResult, setGenResult] = useState<{ table: string; count: number }[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchConnections = async () => {
    setConnectionsLoading(true)
    try {
      const result = await window.electronAPI.getExternalDBConnections()
      if (result.success) {
        setConnections(result.connections)
      }
    } catch (err) {
      console.error('获取外部连接列表失败:', err)
    } finally {
      setConnectionsLoading(false)
    }
  }

  useEffect(() => {
    fetchConnections()
  }, [])

  const totalRows = genResult?.reduce((sum, r) => sum + r.count, 0) ?? 0

  const handleGen = async () => {
    if (!selectedConnection) {
      toast.error('请先选择外部服务器')
      return
    }

    setGenLoading(true)
    setGenResult(null)
    setError(null)
    try {
      const result = await window.electronAPI.aooi200GenData(selectedConnection)
      if (result.success) {
        setGenResult(result.results)
        toast.success(`同步完成，共 ${result.results.reduce((s, r) => s + r.count, 0)} 条记录`)
      } else {
        setError(result.error ?? '同步失败')
        toast.error(result.error ?? '同步失败')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      toast.error(msg)
    } finally {
      setGenLoading(false)
    }
  }

  const handleClean = async () => {
    setCleanLoading(true)
    setGenResult(null)
    setError(null)
    try {
      const result = await window.electronAPI.aooi200CleanSqlite()
      if (result.success) {
        toast.success('本地数据已清空')
      } else {
        toast.error(result.error ?? '清空失败')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setCleanLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>获取系统配置</CardTitle>
          <CardDescription>选择外部服务器，拉取单据管制相关表数据到本地数据库</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {connectionsLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <Field label="外部服务器">
              <Select
                value={selectedConnection}
                onValueChange={(value) => {
                  setSelectedConnection(value)
                  setGenResult(null)
                  setError(null)
                }}
              >
                <SelectTrigger className="w-72">
                  <SelectValue placeholder="选择外部数据库连接" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {connections.map((conn) => (
                      <SelectItem key={conn.name} value={conn.name}>
                        {conn.name}{conn.isDefault ? ' (默认)' : ''}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>同步失败</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {genResult && (
            <>
              <Alert variant="default">
                <CheckCircle2 className="size-4" />
                <AlertTitle>同步完成</AlertTitle>
                <AlertDescription>共 {totalRows} 条记录</AlertDescription>
              </Alert>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>表名</TableHead>
                    <TableHead>同步行数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {genResult.map((r) => (
                    <TableRow key={r.table}>
                      <TableCell className="font-mono">{r.table}</TableCell>
                      <TableCell>{r.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>

        <CardFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGen}
            disabled={!selectedConnection || genLoading}
            className="gap-1.5"
          >
            {genLoading
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Download className="size-3.5" />
            }
            {genLoading ? '获取中...' : '获取系统配置'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleClean}
            disabled={cleanLoading}
            className="gap-1.5"
          >
            {cleanLoading
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Trash2 className="size-3.5" />
            }
            {cleanLoading ? '清空中...' : '清空本地数据'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default GenAooi200Page
