import { useState } from 'react'
import { Page } from './types'
import Header from './components/Header'
import Home from './pages/Home'
import Register from './pages/Register'
import Footer from './components/Footer'

export default function App() {
  const [page, setPage] = useState<Page>('home')

  function handleNavigate(p: Page) {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div dir="rtl" className="min-h-screen flex flex-col justify-between text-slate-100" style={{ fontFamily: "'Cairo', sans-serif" }}>
      {/* Fixed top Header */}
      <Header page={page} onNavigate={handleNavigate} />

      {/* Pages Router */}
      <main className="flex-grow">
        {page === 'home' ? (
          <Home onNavigate={handleNavigate} />
        ) : (
          <Register />
        )}
      </main>

      {/* Footer appears ONLY on Home page */}
      {page === 'home' && <Footer />}
    </div>
  )
}
