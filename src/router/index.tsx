import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '../layout/AppLayout'
import SyncAzzi001Page from '../pages/SyncAzzi001Page'
import GenAooi200Page from '../pages/GenAooi200Page'
import SyncAooi200Page from '../pages/SyncAooi200Page'
import ParamDiffPage from '../pages/ParamDiffPage'
import SettingsPage from '../pages/SettingsPage'

export default function AppRouter() {
  return (
    <HashRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/sync-azzi001" replace />} />
          <Route path="/sync-azzi001" element={<SyncAzzi001Page />} />
          <Route path="/gen-aooi200" element={<GenAooi200Page />} />
          <Route path="/sync-aooi200" element={<SyncAooi200Page />} />
          <Route path="/param-diff" element={<ParamDiffPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppLayout>
    </HashRouter>
  )
}
