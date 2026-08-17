import { useState } from 'react'
import { Page } from './types'
import Header from './components/Header'
import Home from './pages/Home'
import Register from './pages/Register'

export default function App() {
  const [page, setPage] = useState<Page>('home')

  function handleNavigate(p: Page) {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div dir="rtl" className="min-h-screen text-slate-100" style={{ fontFamily: "'Cairo', sans-serif" }}>
      {/* Fixed top Header */}
      <Header page={page} onNavigate={handleNavigate} />

      {/* Pages Router */}
      {page === 'home' ? (
        <Home onNavigate={handleNavigate} />
      ) : (
        <Register />
      )}
    </div>
  )
}
