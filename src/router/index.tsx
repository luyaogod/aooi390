import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AppLayout from '../layout/AppLayout'
import SyncAzzi001Page from '../pages/SyncAzzi001Page'
import SettingsPage from '../pages/SettingsPage'

function PageCache() {
  const location = useLocation()

  const pages = [
    { path: '/sync-azzi001', element: <SyncAzzi001Page /> },
    { path: '/settings', element: <SettingsPage /> },
  ]

  return (
    <>
      {pages.map((page) => (
        <div
          key={page.path}
          style={{ display: location.pathname === page.path ? 'contents' : 'none' }}
        >
          {page.element}
        </div>
      ))}
    </>
  )
}

export default function AppRouter() {
  return (
    <HashRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/sync-azzi001" replace />} />
          <Route path="/*" element={<PageCache />} />
        </Routes>
      </AppLayout>
    </HashRouter>
  )
}
