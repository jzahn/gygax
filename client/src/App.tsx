import { BrowserRouter, Routes, Route } from 'react-router'
import { AuthProvider } from './contexts'
import { ProtectedRoute } from './components'
import {
  HomePage,
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
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
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
