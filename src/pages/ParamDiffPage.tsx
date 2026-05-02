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
import { cn } from '@/lib/utils'
import { Field } from '@/components/ui/field'
import {
  Loader2,
  ArrowLeftRight,
  Play,
  Filter,
} from 'lucide-react'

// ==================== 类型 ====================

interface ParamRow {
  ooaaent?: string
  ooabent?: string
  ooabsite?: string
  paramCode: string
  paramValue: string
  gzszl004: string
  gzszl005: string
  gzszl006: string
  gzszl007: string
}

interface CompareRow {
  paramCode: string
  valueA: string
  valueB: string
  /** 仅在 A 侧存在 */
  onlyA: boolean
  /** 仅在 B 侧存在 */
  onlyB: boolean
  diff: boolean
  gzszl004: string
  gzszl005: string
  gzszl006: string
  gzszl007: string
}

// ==================== 辅助函数 ====================

function buildParamMap(rows: EnterpriseParamRow[] | SiteParamRow[], kind: 'enterprise' | 'site'): Map<string, ParamRow> {
  const map = new Map<string, ParamRow>()
  for (const row of rows) {
    const code = kind === 'enterprise'
      ? (row as EnterpriseParamRow).ooaa001
      : (row as SiteParamRow).ooab001
    const value = kind === 'enterprise'
      ? (row as EnterpriseParamRow).ooaa002
      : (row as SiteParamRow).ooab002
    map.set(code, {
      paramCode: code,
      paramValue: value,
      gzszl004: row.gzszl004 ?? '',
      gzszl005: row.gzszl005 ?? '',
      gzszl006: row.gzszl006 ?? '',
      gzszl007: row.gzszl007 ?? '',
    })
  }
  return map
}

function buildCompareRows(mapA: Map<string, ParamRow>, mapB: Map<string, ParamRow>): CompareRow[] {
  const allCodes = new Set([...mapA.keys(), ...mapB.keys()])
  const rows: CompareRow[] = []

  for (const code of allCodes) {
    const a = mapA.get(code)
    const b = mapB.get(code)
    const onlyA = !b
    const onlyB = !a
    rows.push({
      paramCode: code,
      valueA: a?.paramValue ?? '',
      valueB: b?.paramValue ?? '',
      onlyA,
      onlyB,
      diff: a?.paramValue !== b?.paramValue,
      gzszl004: a?.gzszl004 ?? b?.gzszl004 ?? '',
      gzszl005: a?.gzszl005 ?? b?.gzszl005 ?? '',
      gzszl006: a?.gzszl006 ?? b?.gzszl006 ?? '',
      gzszl007: a?.gzszl007 ?? b?.gzszl007 ?? '',
    })
  }

  rows.sort((a, b) => a.paramCode.localeCompare(b.paramCode))
  return rows
}

// ==================== 组件 ====================

function ParamDiffPage() {
  const [entList, setEntList] = useState<{ gzou001: string; gzou003: string }[]>([])
  const [entListLoading, setEntListLoading] = useState(true)

  // === 集团级参数 ===
  const [entA, setEntA] = useState('')
  const [entB, setEntB] = useState('')
  const [entLoading, setEntLoading] = useState(false)
  const [entCompareRows, setEntCompareRows] = useState<CompareRow[] | null>(null)
  const [entResultInfo, setEntResultInfo] = useState<{ labelA: string; labelB: string } | null>(null)
  const [entShowDiffOnly, setEntShowDiffOnly] = useState(false)

  // === 据点级参数 ===
  const [entA2, setEntA2] = useState('')
  const [siteA, setSiteA] = useState('')
  const [sitesA, setSitesA] = useState<string[]>([])
  const [entB2, setEntB2] = useState('')
  const [siteB, setSiteB] = useState('')
  const [sitesB, setSitesB] = useState<string[]>([])
  const [siteLoading, setSiteLoading] = useState(false)
  const [siteCompareRows, setSiteCompareRows] = useState<CompareRow[] | null>(null)
  const [siteResultInfo, setSiteResultInfo] = useState<{ labelA: string; labelB: string } | null>(null)
  const [siteShowDiffOnly, setSiteShowDiffOnly] = useState(false)

  const fetchEntList = async () => {
    setEntListLoading(true)
    try {
      const result = await window.electronAPI.aooi200QueryEnt()
      if (result.success) {
        setEntList(result.rows)
      }
    } catch (err) {
      console.error('获取ENT列表失败:', err)
    } finally {
      setEntListLoading(false)
    }
  }

  useEffect(() => {
    fetchEntList()
  }, [])

  useEffect(() => {
    if (entA2) {
      window.electronAPI.getSites(entA2).then(r => {
        if (r.success) setSitesA(r.sites)
      })
    } else {
      setSitesA([])
    }
    setSiteA('')
    setSiteCompareRows(null)
  }, [entA2])

  useEffect(() => {
    if (entB2) {
      window.electronAPI.getSites(entB2).then(r => {
        if (r.success) setSitesB(r.sites)
      })
    } else {
      setSitesB([])
    }
    setSiteB('')
    setSiteCompareRows(null)
  }, [entB2])

  // === 集团级参数对比 ===
  const canCompareEnt = entA !== '' && entB !== '' && entA !== entB

  const handleEntCompare = async () => {
    if (!canCompareEnt) return
    setEntLoading(true)
    setEntCompareRows(null)
    try {
      const [rowsA, rowsB] = await Promise.all([
        window.electronAPI.getEnterpriseParams(entA, 'zh_CN'),
        window.electronAPI.getEnterpriseParams(entB, 'zh_CN'),
      ])
      const mapA = buildParamMap(rowsA.success ? rowsA.rows : [], 'enterprise')
      const mapB = buildParamMap(rowsB.success ? rowsB.rows : [], 'enterprise')
      setEntCompareRows(buildCompareRows(mapA, mapB))
      setEntResultInfo({ labelA: entA, labelB: entB })
    } catch (err) {
      console.error('集团级参数对比失败:', err)
    } finally {
      setEntLoading(false)
    }
  }

  // === 据点级参数对比 ===
  const canCompareSite = entA2 !== '' && siteA !== '' && entB2 !== '' && siteB !== ''
    && !(entA2 === entB2 && siteA === siteB)

  const handleSiteCompare = async () => {
    if (!canCompareSite) return
    setSiteLoading(true)
    setSiteCompareRows(null)
    try {
      const [rowsA, rowsB] = await Promise.all([
        window.electronAPI.getSiteParams(entA2, siteA, 'zh_CN'),
        window.electronAPI.getSiteParams(entB2, siteB, 'zh_CN'),
      ])
      const mapA = buildParamMap(rowsA.success ? rowsA.rows : [], 'site')
      const mapB = buildParamMap(rowsB.success ? rowsB.rows : [], 'site')
      setSiteCompareRows(buildCompareRows(mapA, mapB))
      setSiteResultInfo({ labelA: `${entA2}/${siteA}`, labelB: `${entB2}/${siteB}` })
    } catch (err) {
      console.error('据点级参数对比失败:', err)
    } finally {
      setSiteLoading(false)
    }
  }

  const diffCount = (rows: CompareRow[]) => rows.filter(r => r.diff || r.onlyA || r.onlyB).length

  // ==================== 渲染辅助 ====================

  const renderCompareTable = (
    rows: CompareRow[],
    resultInfo: { labelA: string; labelB: string } | null,
    showDiffOnly: boolean,
    onToggleFilter: () => void,
  ) => {
    const diff = diffCount(rows)
    const displayRows = showDiffOnly ? rows.filter(r => r.diff || r.onlyA || r.onlyB) : rows
    return (
      <>
        {resultInfo && (
          <Alert variant={diff === 0 ? 'default' : 'destructive'}>
            <ArrowLeftRight className="size-4" />
            <AlertTitle>
              {diff === 0 ? '参数完全一致' : `${diff} 个参数存在差异`}
            </AlertTitle>
            <AlertDescription>
              对比 {resultInfo.labelA} vs {resultInfo.labelB}，共 {rows.length} 个参数
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant={showDiffOnly ? 'secondary' : 'outline'}
            size="sm"
            onClick={onToggleFilter}
            className="gap-1.5"
          >
            <Filter className="size-3.5" />
            {showDiffOnly ? '显示全部' : `只显示差异（${diff} 项）`}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">参数编号</TableHead>
                <TableHead className="whitespace-nowrap">
                  {resultInfo?.labelA ? `值（${resultInfo.labelA}）` : '值（A）'}
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  {resultInfo?.labelB ? `值（${resultInfo.labelB}）` : '值（B）'}
                </TableHead>
                <TableHead className="whitespace-nowrap">说明</TableHead>
                <TableHead className="whitespace-nowrap">使用说明</TableHead>
                <TableHead className="whitespace-nowrap">应用建议</TableHead>
                <TableHead className="whitespace-nowrap">个案应用说明</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map((row) => (
                <TableRow
                  key={row.paramCode}
                  className={cn(
                    (row.diff || row.onlyA || row.onlyB) && 'bg-yellow-50 dark:bg-yellow-950/30',
                  )}
                >
                  <TableCell className="font-mono whitespace-nowrap">{row.paramCode}</TableCell>
                  <TableCell className={cn('font-mono whitespace-nowrap max-w-32 truncate', row.onlyA && 'text-muted-foreground italic')} title={row.valueA || undefined}>
                    {row.onlyA ? '（仅此侧有）' : row.valueA}
                  </TableCell>
                  <TableCell className={cn('font-mono whitespace-nowrap max-w-32 truncate', row.onlyB && 'text-muted-foreground italic')} title={row.valueB || undefined}>
                    {row.onlyB ? '（仅此侧有）' : row.valueB}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-40 truncate" title={row.gzszl004 || undefined}>
                    {row.gzszl004 || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-40 truncate" title={row.gzszl005 || undefined}>
                    {row.gzszl005 || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-40 truncate" title={row.gzszl006 || undefined}>
                    {row.gzszl006 || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-40 truncate" title={row.gzszl007 || undefined}>
                    {row.gzszl007 || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    )
  }

  // ==================== 页面 ====================

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* 集团级参数对比卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>企业层级参数对比</CardTitle>
          <CardDescription>对比两个集团(ENT)的在作业aoos010中设置 E-COM 参数值是否一致</CardDescription>
          {entCompareRows && (
            <CardAction>
              <Badge
                className={diffCount(entCompareRows) === 0
                  ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                }
              >
                {diffCount(entCompareRows) === 0 ? '完全一致' : `${diffCount(entCompareRows)} 项差异`}
              </Badge>
            </CardAction>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {entListLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Field label="ENT A">
                <Select
                  value={entA}
                  onValueChange={(value) => { if (value) setEntA(value); setEntCompareRows(null) }}
                >
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="选择ENT A" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {entList.map((ent) => (
                        <SelectItem key={ent.gzou001} value={ent.gzou001}>{ent.gzou001}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="ENT B">
                <Select
                  value={entB}
                  onValueChange={(value) => { if (value) setEntB(value); setEntCompareRows(null) }}
                >
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="选择ENT B" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {entList.map((ent) => (
                        <SelectItem key={ent.gzou001} value={ent.gzou001}>{ent.gzou001}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}

          {entCompareRows && renderCompareTable(entCompareRows, entResultInfo, entShowDiffOnly, () => setEntShowDiffOnly(v => !v))}
        </CardContent>

        <CardFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEntCompare}
            disabled={!canCompareEnt || entLoading}
            className="gap-1.5"
          >
            {entLoading
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Play className="size-3.5" />
            }
            {entLoading ? '对比中...' : '执行对比'}
          </Button>
        </CardFooter>
      </Card>

      {/* 据点级参数对比卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>营运据点参数对比</CardTitle>
          <CardDescription>对比两个营运据点在作业aoos020中设置的参数值是否一致</CardDescription>
          {siteCompareRows && (
            <CardAction>
              <Badge
                className={diffCount(siteCompareRows) === 0
                  ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                }
              >
                {diffCount(siteCompareRows) === 0 ? '完全一致' : `${diffCount(siteCompareRows)} 项差异`}
              </Badge>
            </CardAction>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {entListLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex gap-4">
                <Field label="ENT A">
                  <Select
                    value={entA2}
                    onValueChange={(value) => { if (value) setEntA2(value); setSiteCompareRows(null) }}
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="选择ENT A" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {entList.map((ent) => (
                          <SelectItem key={ent.gzou001} value={ent.gzou001}>{ent.gzou001}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="据点 A">
                  <Select
                    value={siteA}
                    onValueChange={(value) => { if (value) setSiteA(value); setSiteCompareRows(null) }}
                    disabled={sitesA.length === 0}
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder={sitesA.length === 0 ? '请先选择ENT' : '选择据点 A'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {sitesA.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="flex gap-4">
                <Field label="ENT B">
                  <Select
                    value={entB2}
                    onValueChange={(value) => { if (value) setEntB2(value); setSiteCompareRows(null) }}
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="选择ENT B" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {entList.map((ent) => (
                          <SelectItem key={ent.gzou001} value={ent.gzou001}>{ent.gzou001}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="据点 B">
                  <Select
                    value={siteB}
                    onValueChange={(value) => { if (value) setSiteB(value); setSiteCompareRows(null) }}
                    disabled={sitesB.length === 0}
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder={sitesB.length === 0 ? '请先选择ENT' : '选择据点 B'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {sitesB.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          )}

          {siteCompareRows && renderCompareTable(siteCompareRows, siteResultInfo, siteShowDiffOnly, () => setSiteShowDiffOnly(v => !v))}
        </CardContent>

        <CardFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSiteCompare}
            disabled={!canCompareSite || siteLoading}
            className="gap-1.5"
          >
            {siteLoading
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Play className="size-3.5" />
            }
            {siteLoading ? '对比中...' : '执行对比'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default ParamDiffPage
