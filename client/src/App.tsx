import { BrowserRouter, Routes, Route } from 'react-router'
import { AuthProvider } from './contexts'
import { ProtectedRoute } from './components'
import { HomePage, LoginPage, RegisterPage } from './pages'

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
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
