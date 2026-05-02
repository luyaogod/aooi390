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
import { Alert, AlertTitle, AlertDescription, AlertAction } from '@/components/ui/alert'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
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
  Database,
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
  const [ooba001, setOoba001] = useState('S01')
  const [importError, setImportError] = useState<string | null>(null)

  // 配置导入/导出状态
  const [exportConfigLoading, setExportConfigLoading] = useState(false)
  const [importConfigLoading, setImportConfigLoading] = useState(false)

  // IC行业单据别批次设置MULTI 状态
  const [entList, setEntList] = useState<{ gzou001: string; gzou003: string }[]>([])
  const [entListLoading, setEntListLoading] = useState(false)
  const [selectedEnt, setSelectedEnt] = useState('')
  const [wfPreviewLoading, setWfPreviewLoading] = useState(false)
  const [wfPreviewRows, setWfPreviewRows] = useState<WfOobxRow[]>([])
  const [wfExecuteLoading, setWfExecuteLoading] = useState(false)
  const [wfError, setWfError] = useState<string | null>(null)
  const [wfResult, setWfResult] = useState<number | null>(null)

  // 同步单据别设置 状态
  const [sourceEnt, setSourceEnt] = useState('')
  const [sourceOoba001, setSourceOoba001] = useState('')
  const [targetEnt, setTargetEnt] = useState('')
  const [targetOoba001, setTargetOoba001] = useState('')
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareResult, setCompareResult] = useState<{ matched: MatchedOobaRow[]; onlyEnt1: OobaRefRow[]; onlyEnt2: OobaRefRow[] } | null>(null)
  const [selectedOoba002, setSelectedOoba002] = useState<Set<string>>(new Set())
  const [validateLoading, setValidateLoading] = useState(false)
  const [validateErrors, setValidateErrors] = useState<ValidateError[]>([])
  const [validationPassed, setValidationPassed] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<{ timestamp: number; results: { table: string; deleted: number; inserted: number }[] } | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [sourceOoba001List, setSourceOoba001List] = useState<string[]>([])
  const [targetOoba001List, setTargetOoba001List] = useState<string[]>([])

  // 备份管理 状态
  const [backupSchema, setBackupSchema] = useState('')
  const [backupVersions, setBackupVersions] = useState<BackupVersion[]>([])
  const [backupListLoading, setBackupListLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [backupCleanLoading, setBackupCleanLoading] = useState(false)

  const sourceSchema = entList.find(e => e.gzou001 === sourceEnt)?.gzou003 ?? ''
  const targetSchema = entList.find(e => e.gzou001 === targetEnt)?.gzou003 ?? ''

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

  const handleExportConfig = async () => {
    setExportConfigLoading(true)
    try {
      const result = await window.electronAPI.aooi200ExportConfig()
      if (result.canceled) return
      if (result.success && result.results) {
        setGenResult(result.results)
        toast.success(`配置导出成功，共 ${result.results.reduce((s, r) => s + r.count, 0)} 条记录`)
      } else {
        toast.error(result.error ?? '导出失败')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setExportConfigLoading(false)
    }
  }

  const handleImportConfig = async () => {
    setImportConfigLoading(true)
    setGenResult(null)
    setError(null)
    try {
      const result = await window.electronAPI.aooi200ImportConfig()
      if (result.canceled) return
      if (result.success && result.results) {
        setGenResult(result.results)
        toast.success(`配置导入成功，共 ${result.results.reduce((s, r) => s + r.count, 0)} 条记录`)
      } else {
        const msg = result.error ?? '导入失败'
        setError(msg)
        toast.error(msg)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      toast.error(msg)
    } finally {
      setImportConfigLoading(false)
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
      const result = await window.electronAPI.aooi200ExportResult(importedRows, ooba001)
      if (result.canceled) return
      if (result.success) {
        toast.success('已保存 aooi199.xlsx 和 aooi200.xlsx')
      } else {
        toast.error(result.error ?? '保存失败')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setExportResultLoading(false)
    }
  }

  // IC行业单据别批次设置MULTI 事件处理
  const handleLoadEntList = async () => {
    setEntListLoading(true)
    setWfError(null)
    try {
      const result = await window.electronAPI.aooi200QueryEnt()
      if (result.success) {
        setEntList(result.rows)
        if (result.rows.length === 0) {
          toast.warning('未查询到企业数据，请确认外部数据库已连接')
        }
      } else {
        setWfError(result.error ?? '查询企业列表失败')
        toast.error(result.error ?? '查询企业列表失败')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setWfError(msg)
      toast.error(msg)
    } finally {
      setEntListLoading(false)
    }
  }

  const selectedSchema = entList.find(e => e.gzou001 === selectedEnt)?.gzou003 ?? ''

  const handleWfPreview = async () => {
    if (!selectedEnt || !selectedSchema) {
      toast.error('请先选择企业')
      return
    }
    setWfPreviewLoading(true)
    setWfPreviewRows([])
    setWfError(null)
    setWfResult(null)
    try {
      const result = await window.electronAPI.aooi200QueryWfOobx(selectedSchema, Number(selectedEnt))
      if (result.success) {
        setWfPreviewRows(result.rows)
        toast.success(`查询完成，共 ${result.rows.length} 条记录`)
      } else {
        setWfError(result.error ?? '查询失败')
        toast.error(result.error ?? '查询失败')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setWfError(msg)
      toast.error(msg)
    } finally {
      setWfPreviewLoading(false)
    }
  }

  const handleWfExecute = async () => {
    if (!selectedEnt || !selectedSchema || wfPreviewRows.length === 0) return
    setWfExecuteLoading(true)
    setWfError(null)
    setWfResult(null)
    try {
      const result = await window.electronAPI.aooi200ReplaceOoblWf(selectedSchema, Number(selectedEnt), wfPreviewRows)
      if (result.success) {
        setWfResult(result.count ?? 0)
        toast.success(`执行更新完成，共插入 ${result.count} 条记录`)
      } else {
        setWfError(result.error ?? '执行更新失败')
        toast.error(result.error ?? '执行更新失败')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setWfError(msg)
      toast.error(msg)
    } finally {
      setWfExecuteLoading(false)
    }
  }

  // 同步单据别设置 事件处理
  const handleCompare = async () => {
    if (!sourceEnt || !targetEnt || !sourceOoba001 || !targetOoba001) {
      toast.error('请填写完整的来源和目标信息')
      return
    }
    if (!sourceSchema || !targetSchema) {
      toast.error('未找到对应企业的 schema，请先加载企业列表')
      return
    }
    setCompareLoading(true)
    setCompareResult(null)
    setSelectedOoba002(new Set())
    setValidateErrors([])
    setValidationPassed(false)
    setSyncResult(null)
    setSyncError(null)
    try {
      const result = await window.electronAPI.aooi200CompareOobaRef(
        sourceSchema, targetSchema, Number(sourceEnt), Number(targetEnt), sourceOoba001, targetOoba001,
      )
      if (result.success) {
        setCompareResult({ matched: result.matched, onlyEnt1: result.onlyEnt1, onlyEnt2: result.onlyEnt2 })
        setSelectedOoba002(new Set(result.matched.map(r => r.ooba002)))
        toast.success(`查询完成，匹配 ${result.matched.length} 条，仅来源 ${result.onlyEnt1.length} 条，仅目标 ${result.onlyEnt2.length} 条`)
      } else {
        toast.error(result.error ?? '查询失败')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setCompareLoading(false)
    }
  }

  const matchedList = compareResult?.matched ?? []
  const checkedList = matchedList.filter(r => selectedOoba002.has(r.ooba002))

  const handleValidate = async () => {
    if (checkedList.length === 0) {
      toast.error('请先在匹配列表中勾选要同步的单据别')
      return
    }
    setValidateLoading(true)
    setValidateErrors([])
    try {
      const result = await window.electronAPI.aooi200ValidateDocConfig(
        sourceSchema, targetSchema, Number(sourceEnt), Number(targetEnt),
        sourceOoba001, targetOoba001,
        checkedList.map(r => r.ooba002), 'collect',
      )
      if (result.success) {
        setValidateErrors(result.errors)
        setValidationPassed(result.errors.length === 0)
        if (result.errors.length === 0) {
          toast.success('校验全部通过')
        } else {
          toast.warning(`校验完成，共 ${result.errors.length} 项错误`)
        }
      } else {
        toast.error(result.error ?? '校验失败')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setValidateLoading(false)
    }
  }

  const handleSync = async () => {
    if (checkedList.length === 0) {
      toast.error('请先在匹配列表中勾选要同步的单据别')
      return
    }
    setSyncLoading(true)
    setSyncResult(null)
    setSyncError(null)
    try {
      const result = await window.electronAPI.aooi200CopyDocConfig(
        sourceSchema, targetSchema, Number(sourceEnt), Number(targetEnt),
        sourceOoba001, targetOoba001,
        checkedList.map(r => r.ooba002), 'collect',
      )
      if (result.success) {
        setSyncResult({ timestamp: result.timestamp, results: result.results })
        if (result.errors.length > 0) {
          setValidateErrors(result.errors)
          setValidationPassed(false)
          toast.warning(`校验不通过，共 ${result.errors.length} 项错误，已跳过同步（备份表 ts=${result.timestamp} 已保留）`)
        } else {
          const total = result.results.reduce((s: number, r: { inserted: number }) => s + r.inserted, 0)
          toast.success(`同步完成，共插入 ${total} 条记录（备份 ts=${result.timestamp}）`)
        }
      } else {
        setSyncError(result.error ?? '同步失败')
        toast.error(result.error ?? '同步失败')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSyncError(msg)
      toast.error(msg)
    } finally {
      setSyncLoading(false)
    }
  }

  const toggleOoba002 = (ooba002: string) => {
    const next = new Set(selectedOoba002)
    if (next.has(ooba002)) { next.delete(ooba002) } else { next.add(ooba002) }
    setSelectedOoba002(next)
  }

  const handleFetchOoba001List = async (ent: string, role: 'source' | 'target') => {
    const schema = entList.find(e => e.gzou001 === ent)?.gzou003
    if (!schema || !ent) return
    try {
      const result = await window.electronAPI.aooi200QueryOoba001List(schema, Number(ent))
      if (result.success) {
        if (role === 'source') setSourceOoba001List(result.list)
        else setTargetOoba001List(result.list)
      }
    } catch { /* ignore */ }
  }

  // 备份管理 事件处理
  const backupEntSchema = entList.find(e => e.gzou001 === backupSchema)?.gzou003 ?? ''

  const handleListBackups = async () => {
    if (!backupEntSchema) { toast.error('未找到对应企业的 schema'); return }
    setBackupListLoading(true)
    setBackupVersions([])
    try {
      const result = await window.electronAPI.aooi200ListBackups(backupEntSchema)
      if (result.success) {
        setBackupVersions(result.versions)
        toast.success(`找到 ${result.versions.length} 个备份版本`)
      } else {
        toast.error(result.error ?? '查询失败')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBackupListLoading(false)
    }
  }

  const handleRestoreBackup = async (timestamp: number) => {
    if (!backupEntSchema) { toast.error('未找到对应企业的 schema'); return }
    setRestoreLoading(true)
    try {
      const result = await window.electronAPI.aooi200RestoreFromBackup(backupEntSchema, timestamp)
      if (result.success) {
        toast.success(`已恢复 ${result.restored.length} 张备份表`)
        handleListBackups()
      } else {
        toast.error(result.error ?? '恢复失败')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setRestoreLoading(false)
    }
  }

  const handleCleanBackup = async (timestamp?: number) => {
    if (!backupEntSchema) { toast.error('未找到对应企业的 schema'); return }
    setBackupCleanLoading(true)
    try {
      const result = await window.electronAPI.aooi200CleanBackups(backupEntSchema, timestamp)
      if (result.success) {
        toast.success(`已清理 ${result.cleaned.length} 张备份表`)
        handleListBackups()
      } else {
        toast.error(result.error ?? '清理失败')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBackupCleanLoading(false)
    }
  }

  const toggleAllMatched = () => {
    if (selectedOoba002.size === matchedList.length) {
      setSelectedOoba002(new Set())
    } else {
      setSelectedOoba002(new Set(matchedList.map(r => r.ooba002)))
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
            <Alert variant="default">
              <CheckCircle2 className="size-4" />
              <AlertTitle>同步完成</AlertTitle>
              <AlertDescription>
                共 {totalRows} 条记录
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
              </AlertDescription>

             <AlertAction>
              <div className="mt-2 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGenResult(null)}
                >
                  好的
                </Button>   
              </div>           
              </AlertAction>     
            </Alert>
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

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportConfig}
            disabled={exportConfigLoading}
            className="gap-1.5"
          >
            {exportConfigLoading
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Database className="size-3.5" />
            }
            {exportConfigLoading ? '导出中...' : '导出配置'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleImportConfig}
            disabled={importConfigLoading}
            className="gap-1.5"
          >
            {importConfigLoading
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Database className="size-3.5" />
            }
            {importConfigLoading ? '导入中...' : '导入配置'}
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

          <Field label="参照表编号（导出多Sheet模板用）">
            <Input
              value={ooba001}
              onChange={(e) => setOoba001(e.target.value)}
              className="w-32 font-mono"
              maxLength={5}
            />
          </Field>

          {importError && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>导入失败</AlertTitle>
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          )}

          {importedRows.length > 0 && (
            <Alert variant="default">
              <CheckCircle2 className="size-4" />
              <AlertTitle>导入完成</AlertTitle>
              <AlertDescription>
                共 {importedRows.length} 条记录
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
              </AlertDescription>

              <AlertAction>
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImportedRows([])}
                  >
                    好的
                  </Button>
                </div>
              </AlertAction>
            </Alert>
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
            {importLoading ? '解析中...' : '导入模板'}
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

      <Card>
        <CardHeader>
          <CardTitle>IC行业单据别批次设置MULTI</CardTitle>
          <CardDescription>查询 _wf 后缀的作业编号，批量替换单据别属性</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <Field label="选择企业">
            <div className="flex items-center gap-2">
              <Select
                value={selectedEnt}
                onValueChange={(value) => {
                  setSelectedEnt(value)
                  setWfPreviewRows([])
                  setWfError(null)
                  setWfResult(null)
                }}
                disabled={entList.length === 0}
              >
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="请先加载企业列表" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {entList.map((ent) => (
                      <SelectItem key={ent.gzou001} value={ent.gzou001}>
                        {ent.gzou001}{ent.gzou003 ? ` (${ent.gzou003})` : ''}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadEntList}
                disabled={entListLoading}
                className="gap-1.5"
              >
                {entListLoading
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <Database className="size-3.5" />
                }
                {entListLoading ? '加载中...' : '加载企业'}
              </Button>
            </div>
          </Field>

          {wfError && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>操作失败</AlertTitle>
              <AlertDescription>{wfError}</AlertDescription>
            </Alert>
          )}

          {wfResult != null && (
            <Alert variant="default">
              <CheckCircle2 className="size-4" />
              <AlertTitle>更新完成</AlertTitle>
              <AlertDescription>共插入 {wfResult} 条记录</AlertDescription>
            </Alert>
          )}

          {wfPreviewRows.length > 0 && (
            <div className="max-h-96 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>单据别</TableHead>
                    <TableHead>单据名称</TableHead>
                    <TableHead>模组别</TableHead>
                    <TableHead>单据性质</TableHead>
                    <TableHead>对应作业编号</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wfPreviewRows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-mono">{row.oobx001}</TableCell>
                      <TableCell>{row.oobxl003}</TableCell>
                      <TableCell>{row.oobx002}</TableCell>
                      <TableCell>{row.oobx003}</TableCell>
                      <TableCell className="font-mono">{row.oobx004}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>

        <CardFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleWfPreview}
            disabled={!selectedEnt || wfPreviewLoading}
            className="gap-1.5"
          >
            {wfPreviewLoading
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Download className="size-3.5" />
            }
            {wfPreviewLoading ? '查询中...' : '查询预览'}
          </Button>

          {wfPreviewRows.length > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleWfExecute}
              disabled={wfExecuteLoading}
              className="gap-1.5"
            >
              {wfExecuteLoading
                ? <Loader2 className="size-3.5 animate-spin" />
                : <CheckCircle2 className="size-3.5" />
              }
              {wfExecuteLoading ? '更新中...' : '执行更新'}
            </Button>
          )}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>同步单据别设置</CardTitle>
          <CardDescription>将来源 ENT 指定参照表下的单据别配置迁移到目标 ENT 指定参照表</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
            <Field label="来源 ENT">
              <Select value={sourceEnt} onValueChange={(v) => { if (!v) return; setSourceEnt(v); setSourceOoba001(''); setSourceOoba001List([]); setCompareResult(null); setValidateErrors([]); setValidationPassed(false); setSyncResult(null); handleFetchOoba001List(v, 'source') }} disabled={entList.length === 0}>
                <SelectTrigger className="w-52"><SelectValue placeholder="选择来源企业" /></SelectTrigger>
                <SelectContent><SelectGroup>{entList.map(e => <SelectItem key={e.gzou001} value={e.gzou001}>{e.gzou001}{e.gzou003 ? ` (${e.gzou003})` : ''}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            </Field>
            <Field label="来源参照表">
              <Select value={sourceOoba001} onValueChange={(v) => { setSourceOoba001(v); setCompareResult(null); setValidateErrors([]); setValidationPassed(false); setSyncResult(null) }} disabled={!sourceEnt || sourceOoba001List.length === 0}>
                <SelectTrigger><SelectValue placeholder={sourceEnt ? '选择参照表' : '请先选企业'} /></SelectTrigger>
                <SelectContent><SelectGroup>{sourceOoba001List.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            </Field>
            </div>

            <div className="flex gap-4">
            <Field label="目标 ENT">
              <Select value={targetEnt} onValueChange={(v) => { if (!v) return; setTargetEnt(v); setTargetOoba001(''); setTargetOoba001List([]); setCompareResult(null); setValidateErrors([]); setValidationPassed(false); setSyncResult(null); handleFetchOoba001List(v, 'target') }} disabled={entList.length === 0}>
                <SelectTrigger className="w-52"><SelectValue placeholder="选择目标企业" /></SelectTrigger>
                <SelectContent><SelectGroup>{entList.map(e => <SelectItem key={e.gzou001} value={e.gzou001}>{e.gzou001}{e.gzou003 ? ` (${e.gzou003})` : ''}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            </Field>
            <Field label="目标参照表">
              <Select value={targetOoba001} onValueChange={(v) => { setTargetOoba001(v); setCompareResult(null); setValidateErrors([]); setValidationPassed(false); setSyncResult(null) }} disabled={!targetEnt || targetOoba001List.length === 0}>
                <SelectTrigger><SelectValue placeholder={targetEnt ? '选择参照表' : '请先选企业'} /></SelectTrigger>
                <SelectContent><SelectGroup>{targetOoba001List.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            </Field>
            </div>
          </div>

          {syncError && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>同步失败</AlertTitle>
              <AlertDescription>{syncError}</AlertDescription>
            </Alert>
          )}

          {/* 查询结果 */}
          {compareResult && (
            <>
              <div className="text-sm text-muted-foreground">
                匹配 {compareResult.matched.length} 条 · 仅来源 {compareResult.onlyEnt1.length} 条 · 仅目标 {compareResult.onlyEnt2.length} 条
                {matchedList.length > 0 && <span className="ml-2">（已勾选 {checkedList.length}/{matchedList.length}）</span>}
              </div>

              {matchedList.length > 0 && (
                <div className="max-h-80 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <input type="checkbox" checked={checkedList.length === matchedList.length} onChange={toggleAllMatched} />
                        </TableHead>
                        <TableHead>单据别</TableHead>
                        <TableHead>来源说明</TableHead>
                        <TableHead>目标说明</TableHead>
                        <TableHead>模组别</TableHead>
                        <TableHead>单据性质</TableHead>
                        <TableHead>作业编号</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matchedList.map(r => (
                        <TableRow key={r.ooba002} className={(r.oobxl003Ent1 !== r.oobxl003Ent2 ? 'bg-yellow-50 ' : '') + (selectedOoba002.has(r.ooba002) ? '' : 'opacity-50')}>
                          <TableCell><input type="checkbox" checked={selectedOoba002.has(r.ooba002)} onChange={() => toggleOoba002(r.ooba002)} /></TableCell>
                          <TableCell className="font-mono">{r.ooba002}</TableCell>
                          <TableCell>{r.oobxl003Ent1}</TableCell>
                          <TableCell>{r.oobxl003Ent2}</TableCell>
                          <TableCell>{r.oobx002}</TableCell>
                          <TableCell>{r.oobx003}</TableCell>
                          <TableCell className="font-mono text-xs">{r.oobx004}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {compareResult.onlyEnt1.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-sm text-muted-foreground">仅来源 ({compareResult.onlyEnt1.length} 条)</summary>
                  <div className="max-h-40 overflow-auto rounded-md border mt-1">
                    <Table>
                      <TableHeader><TableRow><TableHead>单据别</TableHead><TableHead>说明</TableHead><TableHead>模组别</TableHead><TableHead>单据性质</TableHead><TableHead>作业编号</TableHead></TableRow></TableHeader>
                      <TableBody>{compareResult.onlyEnt1.map(r => <TableRow key={r.ooba002}><TableCell className="font-mono">{r.ooba002}</TableCell><TableCell>{r.oobxl003}</TableCell><TableCell>{r.oobx002}</TableCell><TableCell>{r.oobx003}</TableCell><TableCell className="font-mono text-xs">{r.oobx004}</TableCell></TableRow>)}</TableBody>
                    </Table>
                  </div>
                </details>
              )}

              {compareResult.onlyEnt2.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-sm text-muted-foreground">仅目标 ({compareResult.onlyEnt2.length} 条)</summary>
                  <div className="max-h-40 overflow-auto rounded-md border mt-1">
                    <Table>
                      <TableHeader><TableRow><TableHead>单据别</TableHead><TableHead>说明</TableHead><TableHead>模组别</TableHead><TableHead>单据性质</TableHead><TableHead>作业编号</TableHead></TableRow></TableHeader>
                      <TableBody>{compareResult.onlyEnt2.map(r => <TableRow key={r.ooba002}><TableCell className="font-mono">{r.ooba002}</TableCell><TableCell>{r.oobxl003}</TableCell><TableCell>{r.oobx002}</TableCell><TableCell>{r.oobx003}</TableCell><TableCell className="font-mono text-xs">{r.oobx004}</TableCell></TableRow>)}</TableBody>
                    </Table>
                  </div>
                </details>
              )}
            </>
          )}

          {/* 校验结果 */}
          {validateErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>校验错误（共 {validateErrors.length} 项）</AlertTitle>
              <AlertDescription>
                <div className="max-h-60 overflow-auto rounded-md">
                  <Table>
                    <TableHeader><TableRow><TableHead>表</TableHead><TableHead>字段</TableHead><TableHead>值</TableHead><TableHead>错误描述</TableHead></TableRow></TableHeader>
                    <TableBody>{validateErrors.map((e, i) => <TableRow key={i}><TableCell className="font-mono text-xs">{e.table}</TableCell><TableCell>{e.label}</TableCell><TableCell className="font-mono text-xs">{e.value}</TableCell><TableCell className="text-xs">{e.message}</TableCell></TableRow>)}</TableBody>
                  </Table>
                </div>
              </AlertDescription>
              <AlertAction>
                <div className="mt-2 flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setValidateErrors([])}>好的</Button>
                </div>
              </AlertAction>
            </Alert>
          )}

          {/* 同步结果 */}
          {syncResult && (
            <Alert variant="default">
              <CheckCircle2 className="size-4" />
              <AlertTitle>同步完成（备份 ts={syncResult.timestamp}）</AlertTitle>
              <AlertDescription>
                <div className="max-h-60 overflow-auto rounded-md">
                  <Table>
                    <TableHeader><TableRow><TableHead>表名</TableHead><TableHead>删除</TableHead><TableHead>插入</TableHead></TableRow></TableHeader>
                    <TableBody>{syncResult.results.map(r => <TableRow key={r.table}><TableCell className="font-mono">{r.table}</TableCell><TableCell>{r.deleted}</TableCell><TableCell>{r.inserted}</TableCell></TableRow>)}</TableBody>
                  </Table>
                </div>
              </AlertDescription>
              <AlertAction>
                <div className="mt-2 flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setSyncResult(null)}>好的</Button>
                </div>
              </AlertAction>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleCompare} disabled={compareLoading || !sourceEnt || !targetEnt || !sourceOoba001 || !targetOoba001} className="gap-1.5">
            {compareLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {compareLoading ? '查询中...' : '查询数据'}
          </Button>

          {matchedList.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleValidate} disabled={validateLoading || checkedList.length === 0} className="gap-1.5">
                {validateLoading ? <Loader2 className="size-3.5 animate-spin" /> : <AlertTriangle className="size-3.5" />}
                {validateLoading ? '校验中...' : '执行校验'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleSync} disabled={syncLoading || checkedList.length === 0 || !validationPassed} className="gap-1.5">
                {syncLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                {syncLoading ? '同步中...' : '同步数据'}
              </Button>
            </>
          )}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>备份管理</CardTitle>
          <CardDescription>查看、恢复或清理跨 schema 同步产生的备份数据</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Field label="目标 Schema 的 ENT">
              <Select value={backupSchema} onValueChange={(v) => { if (!v) return; setBackupSchema(v); setBackupVersions([]) }} disabled={entList.length === 0}>
                <SelectTrigger className="w-52"><SelectValue placeholder="选择企业" /></SelectTrigger>
                <SelectContent><SelectGroup>{entList.map(e => <SelectItem key={e.gzou001} value={e.gzou001}>{e.gzou001}{e.gzou003 ? ` (${e.gzou003})` : ''}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            </Field>
            <Button variant="outline" size="sm" onClick={handleListBackups} disabled={backupListLoading || !backupSchema} className="gap-1.5 mt-5">
              {backupListLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              {backupListLoading ? '查询中...' : '查询备份'}
            </Button>
          </div>

          {backupVersions.length > 0 && (
            <div className="flex items-center justify-end">
              <Button variant="outline" size="sm" onClick={() => handleCleanBackup()} disabled={backupCleanLoading} className="gap-1.5">
                {backupCleanLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                清理全部
              </Button>
            </div>
          )}

          {backupVersions.length > 0 && (
            <div className="max-h-96 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">时间戳</TableHead>
                    <TableHead>备份表</TableHead>
                    <TableHead className="w-32">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backupVersions.map(v => (
                    <TableRow key={v.timestamp}>
                      <TableCell className="font-mono text-xs">{v.timestamp}<br /><span className="text-muted-foreground">{new Date(v.timestamp * 1000).toLocaleString()}</span></TableCell>
                      <TableCell className="text-xs font-mono">{v.tables.join(', ')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => handleRestoreBackup(v.timestamp)} disabled={restoreLoading} className="gap-1 text-xs">
                            {restoreLoading ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                            应用
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleCleanBackup(v.timestamp)} disabled={backupCleanLoading} className="gap-1 text-xs">
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default GenAooi200Page
