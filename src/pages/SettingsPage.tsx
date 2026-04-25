import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Settings } from 'lucide-react'

function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>系统设置</CardTitle>
          <CardDescription>配置数据库连接参数与应用偏好</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
            <Settings className="size-8" />
            <p className="text-sm">暂无可配置项</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default SettingsPage
