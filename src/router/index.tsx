import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '../layout/AppLayout'
import AppDBPage from '../pages/AppDBPage'
import ExternalDBPage from '../pages/ExternalDBPage'
import SettingsPage from '../pages/SettingsPage'

export default function AppRouter() {
  return (
    <HashRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/app-db" replace />} />
          <Route path="/app-db" element={<AppDBPage />} />
          <Route path="/external-db" element={<ExternalDBPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppLayout>
    </HashRouter>
  )
}
