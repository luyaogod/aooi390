import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  GitBranch,
  ShieldCheck,
  Settings,
  ArrowLeftRight,
} from 'lucide-react'

interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  {
    path: '/sync-azzi001',
    label: '同步流程图',
    icon: <GitBranch className="size-4" />,
  },
  {
    path: '/sync-aooi200',
    label: '单据别校验',
    icon: <ShieldCheck className="size-4" />,
  },
  {
    path: '/param-diff',
    label: '参数对比',
    icon: <ArrowLeftRight className="size-4" />,
  },
  {
    path: '/settings',
    label: '设置',
    icon: <Settings className="size-4" />,
  },
]

function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* 侧边栏 */}
      <aside className="flex w-56 flex-col border-r bg-card">
        <div className="flex h-12 items-center gap-2 px-4">
          <span className="text-sm font-semibold">aooi390</span>
        </div>

        <Separator />

        <nav className="flex flex-1 flex-col gap-1 p-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Button
                key={item.path}
                variant={isActive ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  'w-full justify-start gap-2',
                  isActive && 'font-medium'
                )}
                onClick={() => navigate(item.path)}
              >
                {item.icon}
                {item.label}
              </Button>
            )
          })}
        </nav>

        <Separator />

        <div className="flex items-center px-4 py-2">
          <Badge variant="secondary" className="text-xs font-normal">
            v0.0.1
          </Badge>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}

export default AppLayout
