import { BrowserRouter, Routes, Route } from 'react-router'
import { HomePage } from './pages'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  )
}
