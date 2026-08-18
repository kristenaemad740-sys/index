import { useState, useEffect } from 'react'

interface CountdownProps {
  onNavigateRegister: () => void
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
  isExpired: boolean
}

// Target date: 27 August 2026 - 8:00 AM Cairo Time
const TARGET_DATE = new Date('2026-08-27T08:00:00+03:00').getTime()

function calculateTimeLeft(): TimeLeft {
  const now = new Date().getTime()
  const difference = TARGET_DATE - now

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true }
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24))
  const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((difference % (1000 * 60)) / 1000)

  return { days, hours, minutes, seconds, isExpired: false }
}

export default function Countdown({ onNavigateRegister }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft)

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const padZero = (n: number) => n.toString().padStart(2, '0')

  if (timeLeft.isExpired) {
    return (
      <div className="w-full max-w-3xl mx-auto my-8 p-8 rounded-3xl glass-card text-center border border-amber-500/40 gold-glow animate-celebrate">
        <h2 className="text-3xl sm:text-4xl font-black text-amber-400 mb-2">
          🔥 المنافسة بدأت! 🏆
        </h2>
        <p className="text-slate-300 text-base mb-6">اليوم الرياضي لأسرة الكاروز انطلق الآن بكل حماس!</p>
        <button
          onClick={onNavigateRegister}
          className="px-8 py-4 rounded-2xl font-black text-lg text-slate-950 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
          style={{ background: 'linear-gradient(135deg, #F5A623 0%, #D97706 100%)' }}
        >
          ابدأ المنافسة 🏃
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto my-8 p-6 sm:p-8 rounded-3xl glass-card text-center border border-amber-500/20 shadow-2xl relative overflow-hidden">
      {/* Glow orb background */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-48 rounded-full pointer-events-none opacity-20"
        style={{ background: 'radial-gradient(circle, #F5A623 0%, transparent 70%)' }}
      />

      <div className="relative z-10">
        {/* Header */}
        <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-white mb-1 flex items-center justify-center gap-2" dir="rtl">
          <span>⏳</span>
          <span>العد التنازلي</span>
        </h3>
        <p className="text-amber-400 font-bold text-sm sm:text-base mb-6">
          27 أغسطس — 8:00 صباحًا
        </p>

        {/* Dynamic Timer Cards */}
        <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-2xl mx-auto mb-2" dir="rtl">
          {[
            { label: 'يوم', val: padZero(timeLeft.days) },
            { label: 'ساعة', val: padZero(timeLeft.hours) },
            { label: 'دقيقة', val: padZero(timeLeft.minutes) },
            { label: 'ثانية', val: padZero(timeLeft.seconds) }
          ].map((item, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center justify-center p-3 sm:p-5 rounded-2xl bg-slate-900/60 border border-amber-500/30 backdrop-blur-md shadow-inner transition-transform hover:scale-105"
            >
              <div className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-wider font-mono shimmer-text">
                {item.val}
              </div>
              <div className="text-xs sm:text-sm font-bold text-amber-300/80 mt-1">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
