import { useEffect, useState, useMemo } from 'react'

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
import { Badge } from '@/components/ui/badge'
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

interface ExternalDBConnection {
  name: string
  type: 'kingbase' | 'oracle'
  isDefault?: boolean
  description?: string
}

function GenAooi200Page() {
  const [connections, setConnections] = useState<ExternalDBConnection[]>([])
  const [connectionsLoading, setConnectionsLoading] = useState(true)

  const [genLoading, setGenLoading] = useState(false)
  const [cleanLoading, setCleanLoading] = useState(false)
  const [genResult, setGenResult] = useState<{ table: string; count: number }[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [queryMode, setQueryMode] = useState<'internal' | 'external'>('internal')
  const [importLoading, setImportLoading] = useState(false)
  const [exportResultLoading, setExportResultLoading] = useState(false)
  const [importedRows, setImportedRows] = useState<ImportRow[]>([])
  const [ooba001, setOoba001] = useState('S01')
  const [importError, setImportError] = useState<string | null>(null)

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

  const currentConnectionName = useMemo(() => {
    const def = connections.find(c => c.isDefault)
    return def?.name ?? connections[0]?.name ?? ''
  }, [connections])

  const currentConnection = useMemo(() => {
    return connections.find(c => c.name === currentConnectionName)
  }, [connections, currentConnectionName])

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

  // 自动加载企业列表
  useEffect(() => {
    if (!currentConnectionName) return
    setEntListLoading(true)
    setWfError(null)
    window.electronAPI.aooi200QueryEnt()
      .then(result => {
        if (result.success) {
          setEntList(result.rows)
          if (result.rows.length === 0) toast.warning('未查询到企业数据，请确认外部数据库已连接')
        } else {
          setWfError(result.error ?? '查询企业列表失败')
          toast.error(result.error ?? '查询企业列表失败')
        }
      })
      .catch(err => {
        const msg = err instanceof Error ? err.message : String(err)
        setWfError(msg)
        toast.error(msg)
      })
      .finally(() => setEntListLoading(false))
  }, [currentConnectionName])

  const totalRows = genResult?.reduce((sum, r) => sum + r.count, 0) ?? 0

  const handleGen = async () => {
    if (!currentConnectionName) { toast.error('请先在设置中配置外部数据库连接'); return }
    setGenLoading(true); setGenResult(null); setError(null)
    try {
      const result = await window.electronAPI.aooi200GenData(currentConnectionName)
      if (result.success) {
        setGenResult(result.results)
        toast.success(`同步完成，共 ${result.results.reduce((s, r) => s + r.count, 0)} 条记录`)
      } else { setError(result.error ?? '同步失败'); toast.error(result.error ?? '同步失败') }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err); setError(msg); toast.error(msg)
    } finally { setGenLoading(false) }
  }

  const handleClean = async () => {
    setCleanLoading(true); setGenResult(null); setError(null)
    try {
      const result = await window.electronAPI.aooi200CleanSqlite()
      if (result.success) { toast.success('本地数据已清空') }
      else { toast.error(result.error ?? '清空失败') }
    } catch (err) { toast.error(err instanceof Error ? err.message : String(err)) }
    finally { setCleanLoading(false) }
  }

  const handleExportConfig = async () => {
    setExportConfigLoading(true)
    try {
      const result = await window.electronAPI.aooi200ExportConfig()
      if (result.canceled) return
      if (result.success && result.results) {
        setGenResult(result.results)
        toast.success(`配置导出成功，共 ${result.results.reduce((s, r) => s + r.count, 0)} 条记录`)
      } else { toast.error(result.error ?? '导出失败') }
    } catch (err) { toast.error(err instanceof Error ? err.message : String(err)) }
    finally { setExportConfigLoading(false) }
  }

  const handleImportConfig = async () => {
    setImportConfigLoading(true); setGenResult(null); setError(null)
    try {
      const result = await window.electronAPI.aooi200ImportConfig()
      if (result.canceled) return
      if (result.success && result.results) {
        setGenResult(result.results)
        toast.success(`配置导入成功，共 ${result.results.reduce((s, r) => s + r.count, 0)} 条记录`)
      } else { const msg = result.error ?? '导入失败'; setError(msg); toast.error(msg) }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err); setError(msg); toast.error(msg)
    } finally { setImportConfigLoading(false) }
  }

  const handleExportTemplate = async () => {
    try {
      const result = await window.electronAPI.aooi200ExportTemplate()
      if (result.canceled) return
      if (result.success) { toast.success('模板导出成功') }
      else { toast.error(result.error ?? '导出失败') }
    } catch (err) { toast.error(err instanceof Error ? err.message : String(err)) }
  }

  const handleImportTemplate = async () => {
    setImportLoading(true); setImportedRows([]); setImportError(null)
    try {
      const result = await window.electronAPI.aooi200ImportTemplate(
        queryMode,
        queryMode === 'external' ? currentConnectionName : undefined
      )
      if (result.canceled) return
      if (result.success && result.rows) { setImportedRows(result.rows); toast.success(`导入完成，共 ${result.rows.length} 条记录`) }
      else { setImportError(result.error ?? '导入失败'); toast.error(result.error ?? '导入失败') }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err); setImportError(msg); toast.error(msg)
    } finally { setImportLoading(false) }
  }

  const handleExportResult = async () => {
    setExportResultLoading(true)
    try {
      const result = await window.electronAPI.aooi200ExportResult(importedRows, ooba001)
      if (result.canceled) return
      if (result.success) { toast.success('已保存 aooi199.xlsx 和 aooi200.xlsx') }
      else { toast.error(result.error ?? '保存失败') }
    } catch (err) { toast.error(err instanceof Error ? err.message : String(err)) }
    finally { setExportResultLoading(false) }
  }

  // IC行业单据别批次设置MULTI
  const handleLoadEntList = async () => {
    setEntListLoading(true); setWfError(null)
    try {
      const result = await window.electronAPI.aooi200QueryEnt()
      if (result.success) {
        setEntList(result.rows)
        if (result.rows.length === 0) toast.warning('未查询到企业数据，请确认外部数据库已连接')
      } else { setWfError(result.error ?? '查询企业列表失败'); toast.error(result.error ?? '查询企业列表失败') }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err); setWfError(msg); toast.error(msg)
    } finally { setEntListLoading(false) }
  }

  const selectedSchema = entList.find(e => e.gzou001 === selectedEnt)?.gzou003 ?? ''

  const handleWfPreview = async () => {
    if (!selectedEnt || !selectedSchema) { toast.error('请先选择企业'); return }
    setWfPreviewLoading(true); setWfPreviewRows([]); setWfError(null); setWfResult(null)
    try {
      const result = await window.electronAPI.aooi200QueryWfOobx(selectedSchema, Number(selectedEnt))
      if (result.success) { setWfPreviewRows(result.rows); toast.success(`查询完成，共 ${result.rows.length} 条记录`) }
      else { setWfError(result.error ?? '查询失败'); toast.error(result.error ?? '查询失败') }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err); setWfError(msg); toast.error(msg)
    } finally { setWfPreviewLoading(false) }
  }

  const handleWfExecute = async () => {
    if (!selectedEnt || !selectedSchema || wfPreviewRows.length === 0) return
    setWfExecuteLoading(true); setWfError(null); setWfResult(null)
    try {
      const result = await window.electronAPI.aooi200ReplaceOoblWf(selectedSchema, Number(selectedEnt), wfPreviewRows)
      if (result.success) { setWfResult(result.count ?? 0); toast.success(`执行更新完成，共插入 ${result.count} 条记录`) }
      else { setWfError(result.error ?? '执行更新失败'); toast.error(result.error ?? '执行更新失败') }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err); setWfError(msg); toast.error(msg)
    } finally { setWfExecuteLoading(false) }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>拉取系统配置</CardTitle>
          <CardDescription>从外部数据库获取客户环境中的T100单据别相关系统配置并保存到本地</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {connectionsLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : currentConnectionName ? (
            <Field label="当前外部数据库">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{currentConnectionName}</span>
                {currentConnection && (
                  <Badge variant="secondary" className="text-xs">
                    {currentConnection.type === 'kingbase' ? 'Kingbase' : 'Oracle'}
                  </Badge>
                )}
              </div>
            </Field>
          ) : (
            <div className="text-sm text-muted-foreground">请先在设置页面配置并选择外部数据库连接</div>
          )}
          {error && <Alert variant="destructive"><AlertTriangle className="size-4" /><AlertTitle>同步失败</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {genResult && (
            <Alert variant="default">
              <CheckCircle2 className="size-4" /><AlertTitle>同步完成</AlertTitle>
              <AlertDescription>
                共 {totalRows} 条记录
                <Table><TableHeader><TableRow><TableHead>表名</TableHead><TableHead>同步行数</TableHead></TableRow></TableHeader><TableBody>{genResult.map(r => <TableRow key={r.table}><TableCell className="font-mono">{r.table}</TableCell><TableCell>{r.count}</TableCell></TableRow>)}</TableBody></Table>
              </AlertDescription>
              <AlertAction><div className="mt-2 flex justify-end"><Button variant="outline" size="sm" onClick={() => setGenResult(null)}>好的</Button></div></AlertAction>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleGen} disabled={!currentConnectionName || genLoading} className="gap-1.5">{genLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}{genLoading ? '获取中...' : '获取系统配置'}</Button>
          <Button variant="outline" size="sm" onClick={handleClean} disabled={cleanLoading} className="gap-1.5">{cleanLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}{cleanLoading ? '清空中...' : '清空本地数据'}</Button>
          <Button variant="outline" size="sm" onClick={handleExportConfig} disabled={exportConfigLoading} className="gap-1.5">{exportConfigLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Database className="size-3.5" />}{exportConfigLoading ? '导出中...' : '导出配置'}</Button>
          <Button variant="outline" size="sm" onClick={handleImportConfig} disabled={importConfigLoading} className="gap-1.5">{importConfigLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Database className="size-3.5" />}{importConfigLoading ? '导入中...' : '导入配置'}</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader><CardTitle>生成标准导入模板</CardTitle><CardDescription>导入表格生成T100标准的aooi199和aooi200导入模板</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="数据源: 选择从哪里查询生成模板所需的数据">
            <RadioGroup value={queryMode} onValueChange={(v) => setQueryMode(v as 'internal' | 'external')} options={[
              { label: '本地默认配置', value: 'internal', description: '从已同步的本地数据库查询' },
              { label: '外部数据库', value: 'external', description: '直连 Oracle/Kingbase 查询' },
            ]} />
          </Field>
          {queryMode === 'external' && (
            <Field label="当前外部数据库">
              {connectionsLoading ? (
                <Skeleton className="h-5 w-40" />
              ) : currentConnectionName ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{currentConnectionName}</span>
                  {currentConnection && (
                    <Badge variant="secondary" className="text-xs">
                      {currentConnection.type === 'kingbase' ? 'Kingbase' : 'Oracle'}
                    </Badge>
                  )}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">请先在设置页面配置外部数据库连接</span>
              )}
            </Field>
          )}
          <Field label="参照表编号: 指定模板后续要导入的参照表"><Input value={ooba001} onChange={(e) => setOoba001(e.target.value)} className="w-32 font-mono" maxLength={5} /></Field>
          {importError && <Alert variant="destructive"><AlertTriangle className="size-4" /><AlertTitle>导入失败</AlertTitle><AlertDescription>{importError}</AlertDescription></Alert>}
          {importedRows.length > 0 && (
            <Alert variant="default">
              <CheckCircle2 className="size-4" /><AlertTitle>导入完成</AlertTitle>
              <AlertDescription>
                共 {importedRows.length} 条记录
                <div className="max-h-80 overflow-auto rounded-md border">
                  <Table><TableHeader><TableRow><TableHead className="w-12">#</TableHead><TableHead>单据别</TableHead><TableHead>名称</TableHead><TableHead>作业编号</TableHead><TableHead>模组别</TableHead><TableHead>单据性质</TableHead></TableRow></TableHeader>
                    <TableBody>{importedRows.map((row, i) => <TableRow key={i}><TableCell className="text-muted-foreground">{i + 1}</TableCell><TableCell className="font-mono">{row.oobx001}</TableCell><TableCell>{row.oobxl003}</TableCell><TableCell className="font-mono">{row.oobx004}</TableCell><TableCell>{row.oobx002}</TableCell><TableCell>{row.oobx003}</TableCell></TableRow>)}</TableBody></Table>
                </div>
              </AlertDescription>
              <AlertAction><div className="mt-2 flex justify-end"><Button variant="outline" size="sm" onClick={() => setImportedRows([])}>好的</Button></div></AlertAction>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleExportTemplate} className="gap-1.5"><FileDown className="size-3.5" />导出模板</Button>
          <Button variant="outline" size="sm" onClick={handleImportTemplate} disabled={importLoading} className="gap-1.5">{importLoading ? <Loader2 className="size-3.5 animate-spin" /> : <FileUp className="size-3.5" />}{importLoading ? '解析中...' : '导入模板'}</Button>
          <Button variant="outline" size="sm" onClick={handleExportResult} disabled={importedRows.length === 0 || exportResultLoading} className="gap-1.5">{exportResultLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}{exportResultLoading ? '保存中...' : '保存结果'}</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader><CardTitle>IC行业单据别批次设置MULTI</CardTitle><CardDescription>查询aooi199中对应作业编号属于IC行业("_wf")的所有单据别明细, 可批量将其作业编号更新为MULTI, 并同时绑定标准作业编号和IC行业作业编号</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="选择企业">
            <div className="flex items-center gap-2">
              {entListLoading ? (
                <Skeleton className="h-9 w-52" />
              ) : (
                <Select value={selectedEnt} onValueChange={(value) => { if (value) { setSelectedEnt(value); setWfPreviewRows([]); setWfError(null); setWfResult(null) } }} disabled={entList.length === 0}>
                  <SelectTrigger className="w-52"><SelectValue placeholder={entList.length === 0 ? '暂无企业数据' : '选择企业'} /></SelectTrigger>
                  <SelectContent><SelectGroup>{entList.map(ent => <SelectItem key={ent.gzou001} value={ent.gzou001}>{ent.gzou001}{ent.gzou003 ? ` (${ent.gzou003})` : ''}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              )}
              <Button variant="outline" size="sm" onClick={handleLoadEntList} disabled={entListLoading} className="gap-1.5">{entListLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Database className="size-3.5" />}{entListLoading ? '加载中...' : '重新加载'}</Button>
            </div>
          </Field>
          {wfError && <Alert variant="destructive"><AlertTriangle className="size-4" /><AlertTitle>操作失败</AlertTitle><AlertDescription>{wfError}</AlertDescription></Alert>}
          {wfResult != null && <Alert variant="default"><CheckCircle2 className="size-4" /><AlertTitle>更新完成</AlertTitle><AlertDescription>共插入 {wfResult} 条记录</AlertDescription></Alert>}
          {wfPreviewRows.length > 0 && (
            <div className="max-h-96 overflow-auto rounded-md border">
              <Table><TableHeader><TableRow><TableHead className="w-12">#</TableHead><TableHead>单据别</TableHead><TableHead>单据名称</TableHead><TableHead>模组别</TableHead><TableHead>单据性质</TableHead><TableHead>对应作业编号</TableHead></TableRow></TableHeader>
                <TableBody>{wfPreviewRows.map((row, i) => <TableRow key={i}><TableCell className="text-muted-foreground">{i + 1}</TableCell><TableCell className="font-mono">{row.oobx001}</TableCell><TableCell>{row.oobxl003}</TableCell><TableCell>{row.oobx002}</TableCell><TableCell>{row.oobx003}</TableCell><TableCell className="font-mono">{row.oobx004}</TableCell></TableRow>)}</TableBody></Table>
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleWfPreview} disabled={!selectedEnt || wfPreviewLoading} className="gap-1.5">{wfPreviewLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}{wfPreviewLoading ? '查询中...' : '查询预览'}</Button>
          {wfPreviewRows.length > 0 && <Button variant="default" size="sm" onClick={handleWfExecute} disabled={wfExecuteLoading} className="gap-1.5">{wfExecuteLoading ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}{wfExecuteLoading ? '更新中...' : '执行更新'}</Button>}
        </CardFooter>
      </Card>
    </div>
  )
}

export default GenAooi200Page
