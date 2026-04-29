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
import { Input } from '@/components/ui/input'
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
  Loader2,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Field } from '@/components/ui/field'

function SyncAooi200Page() {
  const [entList, setEntList] = useState<number[]>([])
  const [entListLoading, setEntListLoading] = useState(true)

  // === 卡片1：检查设置（E-COM 参数检查） ===
  const [ecomSourceEnt, setEcomSourceEnt] = useState('')
  const [ecomTargetEnt, setEcomTargetEnt] = useState('')
  const [ecomCheckLoading, setEcomCheckLoading] = useState(false)
  const [ecomCheckResult, setEcomCheckResult] = useState<Aooi200ValidateResult | null>(null)
  const [ecomSkipped, setEcomSkipped] = useState(false)

  // === 卡片2：校验 Aooi199（单据别字段校验） ===
  const [dlang, setDlang] = useState('zh_CN')
  const [aooi199Mode, setAooi199Mode] = useState<'collect' | 'failFast'>('failFast')
  const [aooi199Loading, setAooi199Loading] = useState(false)
  const [aooi199Result, setAooi199Result] = useState<Aooi200ValidateResult | null>(null)
  const [aooi199Skipped, setAooi199Skipped] = useState(false)

  // === 卡片3：校验 Aooi200 ===
  const [ooba001List, setOoba001List] = useState<string[]>([])
  const [ooba001ListLoading, setOoba001ListLoading] = useState(false)
  const [ooba001, setOoba001] = useState('')
  const [aooi200Mode, setAooi200Mode] = useState<'collect' | 'failFast'>('failFast')
  const [aooi200Loading, setAooi200Loading] = useState(false)
  const [aooi200Result, setAooi200Result] = useState<Aooi200ValidateResult | null>(null)

  const fetchEntList = async (): Promise<void> => {
    setEntListLoading(true)
    try {
      const result = await window.electronAPI.getAooi200EntList()
      if (result.success) {
        setEntList(result.entList)
      }
    } catch (err) {
      console.error('获取ENT列表失败:', err)
    } finally {
      setEntListLoading(false)
    }
  }

  const fetchOoba001List = async (ent: number): Promise<void> => {
    setOoba001ListLoading(true)
    try {
      const result = await window.electronAPI.getAooi200Ooba001List(ent)
      if (result.success) {
        setOoba001List(result.ooba001List)
      }
    } catch (err) {
      console.error('获取参照表编号列表失败:', err)
    } finally {
      setOoba001ListLoading(false)
    }
  }

  // === 卡片1：检查设置 ===
  const handleEcomCheck = async () => {
    if (!ecomSourceEnt || !ecomTargetEnt) return
    if (ecomSourceEnt === ecomTargetEnt) {
      toast.error('来源集团和目标集团不能相同')
      return
    }

    setEcomCheckLoading(true)
    setEcomCheckResult(null)
    setAooi199Result(null)
    setAooi200Result(null)
    try {
      const result = await window.electronAPI.aooi200EcomCheck(ecomSourceEnt, ecomTargetEnt)
      setEcomCheckResult(result)
    } catch (err) {
      setEcomCheckResult({
        success: false,
        errors: [],
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setEcomCheckLoading(false)
    }
  }

  // === 卡片2：校验 Aooi199 ===
  const handleAooi199 = async () => {
    if (!ecomSourceEnt || !ecomTargetEnt || !dlang) return

    setAooi199Loading(true)
    setAooi199Result(null)
    setAooi200Result(null)
    try {
      const result = await window.electronAPI.aooi200ValidateAooi199(ecomSourceEnt, ecomTargetEnt, dlang, aooi199Mode)
      setAooi199Result(result)
    } catch (err) {
      setAooi199Result({
        success: false,
        errors: [],
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setAooi199Loading(false)
    }
  }

  // === 卡片3：校验 Aooi200 ===
  const handleAooi200 = async () => {
    if (!ecomSourceEnt || !ecomTargetEnt || !dlang || !ooba001) return

    setAooi200Loading(true)
    setAooi200Result(null)
    try {
      const result = await window.electronAPI.aooi200ValidateAooi200(ecomSourceEnt, ecomTargetEnt, dlang, ooba001, aooi200Mode)
      setAooi200Result(result)
    } catch (err) {
      setAooi200Result({
        success: false,
        errors: [],
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setAooi200Loading(false)
    }
  }

  useEffect(() => {
    fetchEntList()
  }, [])

  useEffect(() => {
    if ((ecomCheckResult?.success || ecomSkipped) && ecomSourceEnt) {
      fetchOoba001List(Number(ecomSourceEnt))
    }
  }, [ecomCheckResult?.success, ecomSkipped, ecomSourceEnt])

  const ecomEntDuplicate = ecomSourceEnt !== '' && ecomTargetEnt !== '' && ecomSourceEnt === ecomTargetEnt
  const canEcomCheck = ecomSourceEnt !== '' && ecomTargetEnt !== '' && !ecomEntDuplicate
  const ecomPassed = ecomCheckResult?.success === true || ecomSkipped

  const canAooi199 = dlang !== '' && !ecomEntDuplicate
  const aooi199Passed = aooi199Result?.success === true || aooi199Skipped

  const canAooi200 = dlang !== '' && ooba001 !== '' && !ecomEntDuplicate

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* 卡片1：检查设置 —— 企业单据参数设置检查 */}
      <Card>
        <CardHeader>
          <CardTitle>检查设置</CardTitle>
          <CardDescription>检查来源集团与目标集团的 E-COM 参数是否一致，通过后方可进行后续校验</CardDescription>
          {ecomCheckResult && (
            <CardAction>
              <Badge
                className={ecomCheckResult.success
                  ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                }
              >
                {ecomCheckResult.success ? '检查通过' : `存在 ${ecomCheckResult.errors.length} 项不一致`}
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
              <Field label="来源集团">
                <Select
                  value={ecomSourceEnt}
                  onValueChange={(value) => {
                    if (value) setEcomSourceEnt(value)
                    setEcomCheckResult(null)
                    setAooi199Result(null)
                    setAooi200Result(null)
                    setEcomSkipped(false)
                    setAooi199Skipped(false)
                  }}
                >
                  <SelectTrigger className="w-60">
                    <SelectValue placeholder="选择来源集团" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {entList
                        .map((ent) => (
                          <SelectItem key={ent} value={String(ent)}>{ent}</SelectItem>
                        ))
                      }
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="目标集团">
                <Select
                  value={ecomTargetEnt}
                  onValueChange={(value) => {
                    if (value) setEcomTargetEnt(value)
                    setEcomCheckResult(null)
                    setAooi199Result(null)
                    setAooi200Result(null)
                    setEcomSkipped(false)
                    setAooi199Skipped(false)
                  }}
                >
                  <SelectTrigger className="w-60">
                    <SelectValue placeholder="选择目标集团" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {entList
                        .map((ent) => (
                          <SelectItem key={ent} value={String(ent)}>{ent}</SelectItem>
                        ))
                      }
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}

          {ecomEntDuplicate && (
            <Alert variant="destructive">
              <XCircle className="size-4" />
              <AlertTitle>集团不可重复</AlertTitle>
              <AlertDescription>来源集团和目标集团不能相同</AlertDescription>
            </Alert>
          )}

          {ecomCheckResult && (
            <Alert variant={ecomCheckResult.success ? 'default' : 'destructive'}>
              {ecomCheckResult.success ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <AlertTriangle className="size-4" />
              )}
              <AlertTitle>检查结果</AlertTitle>
              <AlertDescription>{ecomCheckResult.message}</AlertDescription>
            </Alert>
          )}

          {ecomCheckResult && ecomCheckResult.errors.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>表名</TableHead>
                  <TableHead>字段</TableHead>
                  <TableHead>中文名</TableHead>
                  <TableHead>实际值</TableHead>
                  <TableHead>错误描述</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ecomCheckResult.errors.map((err, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono">{err.table}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{err.field}</TableCell>
                    <TableCell>{err.label}</TableCell>
                    <TableCell className="font-mono">{err.value}</TableCell>
                    <TableCell className="text-sm">{err.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        <CardFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleEcomCheck}
            disabled={!canEcomCheck || ecomCheckLoading}
            className="gap-1.5"
          >
            {ecomCheckLoading
              ? <Loader2 className="size-3.5 animate-spin" />
              : <ShieldCheck className="size-3.5" />
            }
            {ecomCheckLoading ? '检查中...' : '执行检查'}
          </Button>

          {ecomCheckResult && !ecomCheckResult.success && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEcomSkipped(true)}
              className="gap-1.5"
            >
              <Play className="size-3.5" />
              跳过检查，继续校验
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* 卡片2：校验 Aooi199 —— 仅在卡片1通过后显示 */}
      {ecomPassed && (
        <Card>
          <CardHeader>
            <CardTitle>校验 Aooi199</CardTitle>
            <CardDescription>校验来源集团单据别字段（oobx_t）在目标集团中的有效性</CardDescription>
            {aooi199Result && (
              <CardAction>
                <Badge
                  className={aooi199Result.success
                    ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                    : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                  }
                >
                  {aooi199Result.success ? '校验通过' : `存在 ${aooi199Result.errors.length} 项错误`}
                </Badge>
              </CardAction>
            )}
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-4">
              <Field label="来源集团">
                <span className="font-medium text-sm">{ecomSourceEnt}</span>
              </Field>

              <Field label="目标集团">
                <span className="font-medium text-sm">{ecomTargetEnt}</span>
              </Field>

              <Field label="语言代码">
                <Input
                  value={dlang}
                  onChange={(e) => {
                    setDlang(e.target.value)
                    setAooi199Result(null)
                  }}
                  placeholder="例如：zh_CN"
                  className="w-60"
                />
              </Field>

              <Field label="校验模式">
                <Select
                  value={aooi199Mode}
                  onValueChange={(value) => setAooi199Mode(value as 'collect' | 'failFast')}
                >
                  <SelectTrigger className="w-60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="collect">收集所有错误</SelectItem>
                      <SelectItem value="failFast">遇错即停</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {aooi199Result && (
              <Alert variant={aooi199Result.success ? 'default' : 'destructive'}>
                {aooi199Result.success ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <AlertTriangle className="size-4" />
                )}
                <AlertTitle>校验结果</AlertTitle>
                <AlertDescription>{aooi199Result.message}</AlertDescription>
              </Alert>
            )}

            {aooi199Result && aooi199Result.errors.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>表名</TableHead>
                    <TableHead>字段</TableHead>
                    <TableHead>中文名</TableHead>
                    <TableHead>实际值</TableHead>
                    <TableHead>错误描述</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aooi199Result.errors.map((err, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono">{err.table}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{err.field}</TableCell>
                      <TableCell>{err.label}</TableCell>
                      <TableCell className="font-mono">{err.value}</TableCell>
                      <TableCell className="text-sm">{err.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>

          <CardFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAooi199}
              disabled={!canAooi199 || aooi199Loading}
              className="gap-1.5"
            >
              {aooi199Loading
                ? <Loader2 className="size-3.5 animate-spin" />
                : <Play className="size-3.5" />
              }
              {aooi199Loading ? '校验中...' : '执行校验'}
            </Button>

            {aooi199Result && !aooi199Result.success && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAooi199Skipped(true)}
                className="gap-1.5"
              >
                <Play className="size-3.5" />
                跳过校验，继续
              </Button>
            )}
          </CardFooter>
        </Card>
      )}

      {/* 卡片3：校验 Aooi200 —— 仅在卡片2通过后显示 */}
      {aooi199Passed && (
        <Card>
          <CardHeader>
            <CardTitle>校验 Aooi200</CardTitle>
            <CardDescription>校验参照表、控制组、生命周期、产品分类、库存标签等字段在目标集团中的有效性</CardDescription>
            {aooi200Result && (
              <CardAction>
                <Badge
                  className={aooi200Result.success
                    ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                    : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                  }
                >
                  {aooi200Result.success ? '校验通过' : `存在 ${aooi200Result.errors.length} 项错误`}
                </Badge>
              </CardAction>
            )}
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {ooba001ListLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <Field label="来源集团">
                  <span className="font-medium text-sm">{ecomSourceEnt}</span>
                </Field>

                <Field label="目标集团">
                  <span className="font-medium text-sm">{ecomTargetEnt}</span>
                </Field>

                <Field label="语言代码">
                  <Input
                    value={dlang}
                    onChange={(e) => {
                      setDlang(e.target.value)
                      setAooi200Result(null)
                    }}
                    placeholder="例如：zh_CN"
                    className="w-60"
                  />
                </Field>

                <Field label="参照表编号">
                  <Select
                    value={ooba001}
                    onValueChange={(value) => {
                      if (value) setOoba001(value)
                      setAooi200Result(null)
                    }}
                  >
                    <SelectTrigger className="w-60">
                      <SelectValue placeholder="选择参照表编号" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {ooba001List.map((code) => (
                          <SelectItem key={code} value={code}>{code}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="校验模式">
                  <Select
                    value={aooi200Mode}
                    onValueChange={(value) => setAooi200Mode(value as 'collect' | 'failFast')}
                  >
                    <SelectTrigger className="w-60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="collect">收集所有错误</SelectItem>
                        <SelectItem value="failFast">遇错即停</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}

            {aooi200Result && (
              <Alert variant={aooi200Result.success ? 'default' : 'destructive'}>
                {aooi200Result.success ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <AlertTriangle className="size-4" />
                )}
                <AlertTitle>校验结果</AlertTitle>
                <AlertDescription>{aooi200Result.message}</AlertDescription>
              </Alert>
            )}

            {aooi200Result && aooi200Result.errors.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>表名</TableHead>
                    <TableHead>字段</TableHead>
                    <TableHead>中文名</TableHead>
                    <TableHead>实际值</TableHead>
                    <TableHead>错误描述</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aooi200Result.errors.map((err, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono">{err.table}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{err.field}</TableCell>
                      <TableCell>{err.label}</TableCell>
                      <TableCell className="font-mono">{err.value}</TableCell>
                      <TableCell className="text-sm">{err.message}</TableCell>
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
              onClick={handleAooi200}
              disabled={!canAooi200 || aooi200Loading}
              className="gap-1.5"
            >
              {aooi200Loading
                ? <Loader2 className="size-3.5 animate-spin" />
                : <Play className="size-3.5" />
              }
              {aooi200Loading ? '校验中...' : '执行校验'}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}

export default SyncAooi200Page
