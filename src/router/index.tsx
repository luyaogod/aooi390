import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AppLayout from '../layout/AppLayout'
import AppDBPage from '../pages/AppDBPage'
import ExternalDBPage from '../pages/ExternalDBPage'
import EntSyncPage from '../pages/EntSyncPage'
import SettingsPage from '../pages/SettingsPage'

function PageCache() {
  const location = useLocation()

  const pages = [
    { path: '/app-db', element: <AppDBPage /> },
    { path: '/external-db', element: <ExternalDBPage /> },
    { path: '/ent-sync', element: <EntSyncPage /> },
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
          <Route path="/" element={<Navigate to="/app-db" replace />} />
          <Route path="/*" element={<PageCache />} />
        </Routes>
      </AppLayout>
    </HashRouter>
  )
}
