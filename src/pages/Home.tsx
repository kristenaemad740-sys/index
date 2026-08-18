import { Page } from '../types'
import logoImg from '../assets/logo.jpg'
import Countdown from '../components/Countdown'
import ShareSection from '../components/ShareSection'

interface HomeProps {
  onNavigate: (p: Page) => void
}

function SportsBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Animated background rings */}
      <div className="absolute top-[-120px] left-[-120px] w-[500px] h-[500px] opacity-10 animate-spin-slow">
        <svg viewBox="0 0 500 500" fill="none">
          <circle cx="250" cy="250" r="200" stroke="#F5A623" strokeWidth="12" strokeDasharray="40 20" />
          <circle cx="250" cy="250" r="160" stroke="#F5A623" strokeWidth="8" strokeDasharray="20 30" />
          <circle cx="250" cy="250" r="120" stroke="#FBBF24" strokeWidth="5" strokeDasharray="10 40" />
        </svg>
      </div>
      <div className="absolute bottom-[-80px] right-[-100px] w-[400px] h-[400px] opacity-8 animate-spin-slow-reverse">
        <svg viewBox="0 0 400 400" fill="none">
          <circle cx="200" cy="200" r="160" stroke="#F5A623" strokeWidth="10" strokeDasharray="30 15" />
          <circle cx="200" cy="200" r="120" stroke="#FBBF24" strokeWidth="6" strokeDasharray="15 25" />
        </svg>
      </div>
      {/* Gold glow orb */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-[0.04]"
        style={{ background: 'radial-gradient(ellipse, #F5A623 0%, transparent 70%)' }}
      />
    </div>
  )
}

export default function Home({ onNavigate }: HomeProps) {
  return (
    <main
      className="relative pt-20 pb-12 min-h-screen flex flex-col justify-between overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #040d1e 0%, #0d1b3e 50%, #071020 100%)' }}
    >
      <SportsBg />

      <div className="relative z-10 max-w-3xl mx-auto w-full px-4 text-center my-auto animate-float-up space-y-6 sm:space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full opacity-30 gold-glow animate-pulse-gold" />
            <img
              src={logoImg}
              alt="أسرة الكاروز"
              className="w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover relative z-10 border-2 border-amber-400/40"
              style={{ boxShadow: '0 0 30px rgba(245,166,35,0.3)' }}
            />
          </div>
        </div>

        {/* 🏆 اليوم الرياضي */}
        <div>
          <h1 className="text-4xl sm:text-6xl font-black text-white mb-2" dir="rtl">
            🏆 اليوم الرياضي
          </h1>
          <p className="text-xl sm:text-2xl font-bold text-amber-400">
            المنافسة بدأت من دلوقتي! 🔥
          </p>
        </div>

        {/* [ سجّل الآن 🏃 ] */}
        <div>
          <button
            onClick={() => onNavigate('register')}
            className="group px-10 py-4 sm:py-5 rounded-2xl text-xl sm:text-2xl font-black transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #F5A623 0%, #D97706 100%)',
              color: '#040d1e',
              boxShadow: '0 6px 30px rgba(245,166,35,0.45)'
            }}
          >
            <span className="flex items-center justify-center gap-2">
              سجّل الآن
              <span className="group-hover:translate-x-1 transition-transform text-2xl">🏃</span>
            </span>
          </button>
        </div>

        {/* ⏳ العد التنازلي */}
        <div className="max-w-2xl mx-auto">
          <Countdown onNavigateRegister={() => onNavigate('register')} />
        </div>

        {/* 👥 اختار صحابك معاك */}
        <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-lg mx-auto border border-amber-500/20">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 flex items-center justify-center gap-2" dir="rtl">
            <span>👥</span>
            <span>اختار صحابك معاك</span>
          </h2>
          <p className="text-slate-300 text-base font-semibold mb-6">
            والسيستم هيجمعكم مع بعض تلقائيًا.
          </p>
          <button
            onClick={() => onNavigate('register')}
            className="px-8 py-3.5 rounded-xl text-lg font-bold text-white transition-all hover:scale-105 active:scale-95 cursor-pointer border border-amber-500/40 glass-card"
            style={{ background: 'rgba(245,166,35,0.15)' }}
          >
            ابدأ المنافسة 🔥
          </button>
        </div>

        {/* 👥 قسم الدعوة ومشاركة الموقع */}
        <div className="max-w-xl mx-auto">
          <ShareSection />
        </div>

        {/* أسرة الكاروز */}
        <div className="pt-4 text-slate-400 font-bold text-base tracking-widest uppercase">
          أسرة الكاروز
        </div>
      </div>
    </main>
  )
}
