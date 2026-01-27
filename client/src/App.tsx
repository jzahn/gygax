import { BrowserRouter, Routes, Route } from 'react-router'
import { AuthProvider } from './contexts'
import { ProtectedRoute } from './components'
import { AuthenticatedLayout } from './components/layout'
import {
  DashboardPage,
  CampaignPage,
  AdventurePage,
  AdventureModePage,
  MapEditorPage,
  CharacterPage,
  NPCPage,
  LoginPage,
  RegisterPage,
  VerifyEmailPage,
  UnverifiedPage,
  ForgotPasswordPage,
  ResetPasswordPage,
} from './pages'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Authenticated routes with NavBar */}
          <Route
            element={
              <ProtectedRoute>
                <AuthenticatedLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/adventure" element={<AdventureModePage />} />
            <Route path="/campaigns/:id" element={<CampaignPage />} />
            <Route path="/adventures/:id" element={<AdventurePage />} />
            <Route path="/maps/:id" element={<MapEditorPage />} />
            <Route path="/characters/:id" element={<CharacterPage />} />
            <Route path="/adventures/:adventureId/npcs/:npcId" element={<NPCPage />} />
          </Route>

          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/verify-pending" element={<UnverifiedPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
