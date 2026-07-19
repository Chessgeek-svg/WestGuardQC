import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'

import { Dashboard } from './pages/Dashboard'
import { LotDetail } from './pages/LotDetail'

function App() {
  return (
    <BrowserRouter>
      <div className="mx-auto max-w-6xl p-6 text-slate-100">
        <header className="mb-6">
          <Link to="/">
            <h1 className="text-2xl font-bold tracking-tight">WestGuardQC</h1>
          </Link>
          <p className="text-sm text-slate-400">Levey-Jennings QC monitoring</p>
        </header>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/lots/:lotId" element={<LotDetail />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
