import { Page } from '../types'
import logoImg from '../assets/logo.jpg'

interface HeaderProps {
  page: Page
  onNavigate: (p: Page) => void
}

export default function Header({ page, onNavigate }: HeaderProps) {
  return (
    <header
      className="fixed top-0 inset-x-0 z-50 h-16"
      style={{
        background: 'rgba(4, 13, 30, 0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(245,166,35,0.12)'
      }}
    >
      <div className="max-w-7xl mx-auto h-full px-4 flex items-center justify-between gap-4">
        {/* Logo + name */}
        <button onClick={() => onNavigate('home')} className="flex items-center gap-3 group">
          <img src={logoImg} alt="أسرة الكاروز" className="w-10 h-10 rounded-full object-cover" />
          <div className="hidden sm:block text-right leading-tight">
            <div className="text-sm font-bold text-amber-400">أسرة الكاروز</div>
            <div className="text-[10px] text-slate-400">اليوم الرياضي</div>
          </div>
        </button>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          <button
            onClick={() => onNavigate('home')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              page === 'home'
                ? 'text-amber-400 bg-amber-400/10'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            الرئيسية
          </button>
          <button
            onClick={() => onNavigate('register')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              page === 'register'
                ? 'text-amber-400 bg-amber-400/10'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            التسجيل
          </button>
          {(page === 'dashboard' || (typeof window !== 'undefined' && sessionStorage.getItem('karoz_admin_auth') === 'true')) && (
            <button
              onClick={() => onNavigate('dashboard')}
              className={`px-3 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                page === 'dashboard'
                  ? 'text-amber-400 bg-amber-400/15 border border-amber-400/30'
                  : 'text-amber-300/80 hover:text-amber-300 hover:bg-amber-400/10'
              }`}
            >
              <span>⚙️</span>
              <span className="hidden sm:inline">لوحة التحكم</span>
            </button>
          )}
        </nav>

        {/* CTA & Admin Access */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('register')}
            className="px-5 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #F5A623, #D97706)',
              color: '#040d1e',
              boxShadow: '0 0 12px rgba(245,166,35,0.35)'
            }}
          >
            سجّل الآن
          </button>
        </div>
      </div>
    </header>
  )
}
