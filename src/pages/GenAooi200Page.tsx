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
import { RadioGroup } from '@/components/ui/radio-group'
import {
  Loader2,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileUp,
  FileDown,
  Save,
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

  // 导入/导出相关状态
  const [queryMode, setQueryMode] = useState<'internal' | 'external'>('internal')
  const [importConnectionName, setImportConnectionName] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [exportResultLoading, setExportResultLoading] = useState(false)
  const [importedRows, setImportedRows] = useState<ImportRow[]>([])
  const [importError, setImportError] = useState<string | null>(null)

  const fetchConnections = async () => {
    setConnectionsLoading(true)
    try {
      const result = await window.electronAPI.getExternalDBConnections()
      if (result.success) {
        setConnections(result.connections)
        if (result.connections.length > 0) {
          const def = result.connections.find(c => c.isDefault)
          setImportConnectionName(def?.name ?? result.connections[0].name)
        }
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

  const handleExportTemplate = async () => {
    try {
      const result = await window.electronAPI.aooi200ExportTemplate()
      if (result.canceled) return
      if (result.success) {
        toast.success('模板导出成功')
      } else {
        toast.error(result.error ?? '导出失败')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  const handleImportTemplate = async () => {
    setImportLoading(true)
    setImportedRows([])
    setImportError(null)
    try {
      const result = await window.electronAPI.aooi200ImportTemplate(
        queryMode,
        queryMode === 'external' ? importConnectionName : undefined,
      )
      if (result.canceled) return
      if (result.success && result.rows) {
        setImportedRows(result.rows)
        toast.success(`导入完成，共 ${result.rows.length} 条记录`)
      } else {
        setImportError(result.error ?? '导入失败')
        toast.error(result.error ?? '导入失败')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setImportError(msg)
      toast.error(msg)
    } finally {
      setImportLoading(false)
    }
  }

  const handleExportResult = async () => {
    setExportResultLoading(true)
    try {
      const result = await window.electronAPI.aooi200ExportResult(importedRows)
      if (result.canceled) return
      if (result.success) {
        toast.success('处理结果保存成功')
      } else {
        toast.error(result.error ?? '保存失败')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setExportResultLoading(false)
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

      <Card>
        <CardHeader>
          <CardTitle>导入单据别</CardTitle>
          <CardDescription>导出模板填写后导入，通过作业编号自动查找单据性质和模组</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <Field label="查询模式">
            <RadioGroup
              value={queryMode}
              onValueChange={(v) => setQueryMode(v as 'internal' | 'external')}
              options={[
                { label: '内部 SQLite', value: 'internal', description: '从已同步的本地数据库查询' },
                { label: '外部数据库', value: 'external', description: '直连 Oracle/Kingbase 查询' },
              ]}
            />
          </Field>

          {queryMode === 'external' && !connectionsLoading && connections.length > 0 && (
            <Field label="选择外部连接">
              <Select
                value={importConnectionName}
                onValueChange={(value) => {
                  if (value) setImportConnectionName(value)
                }}
              >
                <SelectTrigger className="w-72">
                  <SelectValue />
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

          {importError && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>导入失败</AlertTitle>
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          )}

          {importedRows.length > 0 && (
            <>
              <Alert variant="default">
                <CheckCircle2 className="size-4" />
                <AlertTitle>导入完成</AlertTitle>
                <AlertDescription>共 {importedRows.length} 条记录</AlertDescription>
              </Alert>

              <div className="max-h-80 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>单据别</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>作业编号</TableHead>
                      <TableHead>模组别</TableHead>
                      <TableHead>单据性质</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importedRows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-mono">{row.oobx001}</TableCell>
                        <TableCell>{row.oobxl003}</TableCell>
                        <TableCell className="font-mono">{row.oobx004}</TableCell>
                        <TableCell>{row.oobx002}</TableCell>
                        <TableCell>{row.oobx003}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportTemplate}
            className="gap-1.5"
          >
            <FileDown className="size-3.5" />
            导出模板
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleImportTemplate}
            disabled={importLoading}
            className="gap-1.5"
          >
            {importLoading
              ? <Loader2 className="size-3.5 animate-spin" />
              : <FileUp className="size-3.5" />
            }
            {importLoading ? '解析中...' : '导入'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportResult}
            disabled={importedRows.length === 0 || exportResultLoading}
            className="gap-1.5"
          >
            {exportResultLoading
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Save className="size-3.5" />
            }
            {exportResultLoading ? '保存中...' : '保存结果'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default GenAooi200Page
