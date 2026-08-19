import { useState, useEffect } from 'react'
import { Page } from './types'
import Header from './components/Header'
import Home from './pages/Home'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Footer from './components/Footer'

export default function App() {
  const [page, setPage] = useState<Page>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase()
      const hash = window.location.hash.toLowerCase()
      if (path === '/dashboard' || hash === '#dashboard') {
        return 'dashboard'
      }
      if (path === '/register' || hash === '#register') {
        return 'register'
      }
    }
    return 'home'
  })

  // Sync with browser history and URL changes
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname.toLowerCase()
      const hash = window.location.hash.toLowerCase()
      if (path === '/dashboard' || hash === '#dashboard') {
        setPage('dashboard')
      } else if (path === '/register' || hash === '#register') {
        setPage('register')
      } else {
        setPage('home')
      }
    }

    window.addEventListener('popstate', handleLocationChange)
    window.addEventListener('hashchange', handleLocationChange)
    return () => {
      window.removeEventListener('popstate', handleLocationChange)
      window.removeEventListener('hashchange', handleLocationChange)
    }
  }, [])

  function handleNavigate(p: Page) {
    setPage(p)
    if (typeof window !== 'undefined') {
      const targetPath = p === 'home' ? '/' : `/${p}`
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath)
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div dir="rtl" className="min-h-screen flex flex-col justify-between text-slate-100" style={{ fontFamily: "'Cairo', sans-serif" }}>
      {/* Fixed top Header */}
      <Header page={page} onNavigate={handleNavigate} />

      {/* Pages Router */}
      <main className="flex-grow">
        {page === 'home' && <Home onNavigate={handleNavigate} />}
        {page === 'register' && <Register />}
        {page === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
      </main>

      {/* Footer appears ONLY on Home page */}
      {page === 'home' && <Footer />}
    </div>
  )
}
