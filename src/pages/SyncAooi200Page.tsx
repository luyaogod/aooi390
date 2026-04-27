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
} from 'lucide-react'

function SyncAooi200Page() {
  const [entList, setEntList] = useState<number[]>([])
  const [entListLoading, setEntListLoading] = useState(true)

  const [ooba001List, setOoba001List] = useState<string[]>([])
  const [ooba001ListLoading, setOoba001ListLoading] = useState(true)

  const [sourceEnt, setSourceEnt] = useState('')
  const [targetEnt, setTargetEnt] = useState('')
  const [dlang, setDlang] = useState('')
  const [ooba001, setOoba001] = useState('')
  const [mode, setMode] = useState<'collect' | 'failFast'>('collect')

  const [validateLoading, setValidateLoading] = useState(false)
  const [validateResult, setValidateResult] = useState<Aooi200ValidateResult | null>(null)

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

  const fetchOoba001List = async (): Promise<void> => {
    setOoba001ListLoading(true)
    try {
      const result = await window.electronAPI.getAooi200Ooba001List()
      if (result.success) {
        setOoba001List(result.ooba001List)
      }
    } catch (err) {
      console.error('获取参照表编号列表失败:', err)
    } finally {
      setOoba001ListLoading(false)
    }
  }

  const handleValidate = async () => {
    if (!sourceEnt || !targetEnt || !dlang || !ooba001) return

    setValidateLoading(true)
    setValidateResult(null)
    try {
      const result = await window.electronAPI.aooi200Validate(sourceEnt, targetEnt, dlang, ooba001, mode)
      setValidateResult(result)
    } catch (err) {
      setValidateResult({
        success: false,
        errors: [],
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setValidateLoading(false)
    }
  }

  useEffect(() => {
    fetchEntList()
    fetchOoba001List()
  }, [])

  const entDuplicate = sourceEnt !== '' && targetEnt !== '' && sourceEnt === targetEnt
  const canValidate = sourceEnt !== '' && targetEnt !== '' && dlang !== '' && ooba001 !== '' && !entDuplicate

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* 校验参数配置卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>单据别校验</CardTitle>
          <CardDescription>校验来源集团与目标集团之间单据别数据的一致性</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {entListLoading || ooba001ListLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <span className="text-muted-foreground">来源集团</span>
              <Select
                value={sourceEnt}
                onValueChange={(value) => {
                  if (value) setSourceEnt(value)
                  setValidateResult(null)
                }}
              >
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="选择来源集团" />
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

              <span className="text-muted-foreground">目标集团</span>
              <Select
                value={targetEnt}
                onValueChange={(value) => {
                  if (value) setTargetEnt(value)
                  setValidateResult(null)
                }}
              >
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="选择目标集团" />
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

              <span className="text-muted-foreground">语言代码</span>
              <Input
                value={dlang}
                onChange={(e) => {
                  setDlang(e.target.value)
                  setValidateResult(null)
                }}
                placeholder="例如：zh_CN"
                className="w-60"
              />

              <span className="text-muted-foreground">参照表编号</span>
              <Select
                value={ooba001}
                onValueChange={(value) => {
                  if (value) setOoba001(value)
                  setValidateResult(null)
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

              <span className="text-muted-foreground">校验模式</span>
              <Select
                value={mode}
                onValueChange={(value) => setMode(value as 'collect' | 'failFast')}
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
            </div>
          )}
          {entDuplicate && (
            <Alert variant="destructive">
              <XCircle className="size-4" />
              <AlertTitle>集团不可重复</AlertTitle>
              <AlertDescription>来源集团和目标集团不能相同</AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={handleValidate}
            disabled={!canValidate || validateLoading}
            className="gap-1.5"
          >
            {validateLoading
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Play className="size-3.5" />
            }
            {validateLoading ? '校验中...' : '执行校验'}
          </Button>
        </CardFooter>
      </Card>

      {/* 校验结果卡片 */}
      {validateResult && (
        <Card>
          <CardHeader>
            <CardTitle>校验结果</CardTitle>
            <CardDescription>
              来源集团={sourceEnt} → 目标集团={targetEnt}，参照表编号={ooba001}
            </CardDescription>
            <CardAction>
              <Badge
                className={validateResult.success
                  ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                }
              >
                {validateResult.success ? '校验通过' : `存在 ${validateResult.errors.length} 项错误`}
              </Badge>
            </CardAction>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <Alert variant={validateResult.success ? 'default' : 'destructive'}>
              {validateResult.success ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <AlertTriangle className="size-4" />
              )}
              <AlertTitle>执行结果</AlertTitle>
              <AlertDescription>{validateResult.message}</AlertDescription>
            </Alert>

            {validateResult.errors.length > 0 && (
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
                  {validateResult.errors.map((err, idx) => (
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
              onClick={() => setValidateResult(null)}
              className="gap-1.5"
            >
              重新校验
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}

export default SyncAooi200Page
