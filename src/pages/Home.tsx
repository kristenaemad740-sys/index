import { Page, TEAMS } from '../types'
import logoImg from '../assets/logo.jpg'

interface HomeProps {
  onNavigate: (p: Page) => void
}

function SportsBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Animated rings inspired by logo */}
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
      {/* Motion lines */}
      <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="line1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F5A623" stopOpacity="0" />
            <stop offset="50%" stopColor="#F5A623" stopOpacity="1" />
            <stop offset="100%" stopColor="#F5A623" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="30%" x2="100%" y2="28%" stroke="url(#line1)" strokeWidth="2" />
        <line x1="0" y1="55%" x2="100%" y2="52%" stroke="url(#line1)" strokeWidth="1.5" />
        <line x1="0" y1="75%" x2="100%" y2="73%" stroke="url(#line1)" strokeWidth="1" />
      </svg>
      {/* Gold glow orb */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-[0.04]"
        style={{ background: 'radial-gradient(ellipse, #F5A623 0%, transparent 70%)' }}
      />
    </div>
  )
}

function HeroSportsVisual() {
  return (
    <div className="relative w-full h-full flex items-center justify-center min-h-[300px] lg:min-h-[420px]">
      <div className="relative w-64 h-64 lg:w-80 lg:h-80">
        {/* Outer ring */}
        <div
          className="absolute inset-0 rounded-full border-4 border-dashed opacity-20 animate-spin-slow"
          style={{ borderColor: '#F5A623' }}
        />
        {/* Second ring */}
        <div
          className="absolute inset-4 rounded-full border-2 opacity-30 animate-spin-slow-reverse"
          style={{ borderColor: '#FBBF24', borderStyle: 'dashed' }}
        />
        {/* Four team quadrants */}
        <div
          className="absolute inset-8 rounded-full overflow-hidden grid grid-cols-2 grid-rows-2 gap-[3px] p-[3px]"
          style={{ background: 'rgba(13,27,62,0.8)' }}
        >
          {TEAMS.map(team => (
            <div
              key={team.id}
              className="rounded-sm flex items-center justify-center text-2xl"
              style={{ background: team.bg + 'cc' }}
            >
              <span>{team.emoji}</span>
            </div>
          ))}
        </div>
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center gold-glow"
            style={{ background: 'linear-gradient(135deg, #F5A623, #FBBF24)' }}
          >
            <span className="text-lg">🏆</span>
          </div>
        </div>
        {/* Floating sport icons */}
        {[
          { emoji: '⚽', top: '5%', left: '50%', delay: '0s' },
          { emoji: '🏀', top: '50%', left: '5%', delay: '0.5s' },
          { emoji: '🏐', top: '50%', left: '90%', delay: '1s' },
          { emoji: '🏃', top: '88%', left: '50%', delay: '1.5s' }
        ].map(({ emoji, top, left, delay }) => (
          <div
            key={emoji}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-xl animate-pulse-gold"
            style={{ top, left, animationDelay: delay }}
          >
            {emoji}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Home({ onNavigate }: HomeProps) {
  return (
    <main className="relative pt-16">
      {/* Hero */}
      <section
        className="relative min-h-screen flex items-center overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #040d1e 0%, #0d1b3e 50%, #071020 100%)' }}
      >
        <SportsBg />
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Right: Text content (RTL = right side displays first) */}
            <div className="text-right order-1 animate-float-up">
              {/* Logo prominent */}
              <div className="flex justify-center lg:justify-end mb-8">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full opacity-30 gold-glow animate-pulse-gold" />
                  <img
                    src={logoImg}
                    alt="أسرة الكاروز"
                    className="w-28 h-28 lg:w-36 lg:h-36 rounded-full object-cover relative z-10"
                  />
                </div>
              </div>

              {/* Tag */}
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold mb-4"
                style={{
                  background: 'rgba(245,166,35,0.12)',
                  border: '1px solid rgba(245,166,35,0.3)',
                  color: '#F5A623'
                }}
              >
                🏟️ &nbsp; كنيسة العذراء مريم بالبداري
              </div>

              {/* Title */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-4" dir="rtl">
                <span className="text-white">اليوم </span>
                <span className="shimmer-text">الرياضي</span>
                <br />
                <span className="text-white text-3xl sm:text-4xl lg:text-5xl">لأسرة الكاروز</span>
              </h1>

              {/* Slogan */}
              <p className="text-lg text-slate-300 mb-8 leading-relaxed">
                تنافس، العب، وانتصر مع فريقك! <br />
                <span className="text-amber-400 font-semibold">سجّل الآن وكون فريقك واعرف فريقك.</span>
              </p>

              {/* Teams preview pills */}
              <div className="flex flex-wrap gap-2 justify-center lg:justify-end mb-8">
                {TEAMS.map(team => (
                  <span
                    key={team.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold"
                    style={{ background: team.bg, color: '#fff', border: `1px solid ${team.color}44` }}
                  >
                    {team.emoji} {team.name}
                  </span>
                ))}
              </div>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-end">
                <button
                  onClick={() => onNavigate('register')}
                  className="group px-8 py-4 rounded-2xl text-lg font-black transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #F5A623 0%, #D97706 100%)',
                    color: '#040d1e',
                    boxShadow: '0 4px 24px rgba(245,166,35,0.4)'
                  }}
                >
                  <span className="flex items-center justify-center gap-2">
                    سجّل الآن
                    <span className="group-hover:translate-x-1 transition-transform text-xl">🏃</span>
                  </span>
                </button>
              </div>
            </div>

            {/* Left: Sports visual */}
            <div className="order-2 animate-float-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
              <HeroSportsVisual />
            </div>
          </div>
        </div>
      </section>

      {/* Teams section */}
      <section
        className="py-16 px-4 sm:px-6 lg:px-8"
        style={{ background: 'linear-gradient(180deg, #071020 0%, #040d1e 100%)' }}
      >
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-2 text-white">الفرق الأربعة</h2>
          <p className="text-center text-slate-400 mb-10">النظام يوزع المشتركين تلقائيًا بالتساوي</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {TEAMS.map((team, i) => (
              <div
                key={team.id}
                className={`relative p-6 rounded-2xl text-center transition-all hover:scale-105 animate-float-up ${team.glowClass}`}
                style={{
                  background: `linear-gradient(135deg, ${team.bg}, ${team.color}33)`,
                  border: `1px solid ${team.color}44`,
                  animationDelay: `${i * 0.1}s`,
                  animationFillMode: 'forwards',
                  opacity: 0
                }}
              >
                <div className="text-4xl mb-3">{team.emoji}</div>
                <div className="text-white font-bold text-base">{team.name}</div>
                <div className="w-8 h-1 rounded-full mx-auto mt-3" style={{ background: team.color }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 sm:px-6 lg:px-8" style={{ background: '#040d1e' }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-black mb-10 text-white">كيف تسجّل؟</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { num: '١', icon: '🎉', title: 'اعرف فريقك', desc: 'سجّل بياناتك واعرف فريقك الموزع تلقائيًا بالتساوي بين الفرق' },
              { num: '٢', icon: '🏃', title: 'كوّن فريقك', desc: 'شارك مع أصدقائك في التنافس واللعب لتحقيق الفوز والبطولة' },
              { num: '٣', icon: '👥', title: 'اختار صحابك معاك', desc: 'اكتب أسماء أصحابك في النموذج عشان تكونوا مع بعض في نفس الفريق' }
            ].map(step => (
              <div key={step.num} className="flex flex-col items-center gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                  style={{
                    background: 'rgba(245,166,35,0.12)',
                    border: '1px solid rgba(245,166,35,0.3)'
                  }}
                >
                  {step.icon}
                </div>
                <div className="font-black text-amber-400 text-xl">{step.num}</div>
                <div className="font-bold text-white">{step.title}</div>
                <div className="text-slate-400 text-sm">{step.desc}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => onNavigate('register')}
            className="mt-12 px-10 py-4 rounded-2xl text-lg font-black transition-all hover:scale-105 active:scale-95 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #F5A623 0%, #D97706 100%)',
              color: '#040d1e',
              boxShadow: '0 4px 24px rgba(245,166,35,0.35)'
            }}
          >
            سجّل الآن 🏆
          </button>
        </div>
      </section>
    </main>
  )
}
