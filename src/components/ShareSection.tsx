import { useState } from 'react'

export default function ShareSection() {
  const [copied, setCopied] = useState(false)

  const shareUrl = 'https://karoz-sports.vercel.app/'
  const whatsappMessage = `🏆🔥 اليوم الرياضي لأسرة الكاروز بدأ!\nسجّل من دلوقتي وابدأ كوّن فريقك:\n${shareUrl}`

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = shareUrl
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch (err) {
      console.error('Failed to copy link', err)
    }
  }

  const handleWhatsAppShare = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden" style={{ background: '#071020' }}>
      <div className="max-w-4xl mx-auto">
        <div className="glass-card rounded-3xl p-6 sm:p-10 text-center border border-amber-500/20 shadow-2xl relative">
          <div className="text-4xl sm:text-5xl mb-4">👥</div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-3" dir="rtl">
            ادعي أصحابك وشاركهم المنافسة!
          </h2>
          <p className="text-slate-300 text-sm sm:text-base mb-8 max-w-xl mx-auto leading-relaxed">
            شارك رابط اليوم الرياضي مع أصحابك عشان تسجلوا وتتجمعوا في أقوى منافسة رياضية لأسرة الكاروز!
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto">
            {/* Copy Link Button */}
            <button
              onClick={handleCopyLink}
              className="w-full sm:w-auto flex-1 py-4 px-6 rounded-2xl font-bold text-base text-white transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2 border border-white/20 glass-card"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <span>{copied ? '✅' : '🔗'}</span>
              <span>{copied ? 'تم نسخ الرابط!' : 'نسخ الرابط'}</span>
            </button>

            {/* WhatsApp Share Button */}
            <button
              onClick={handleWhatsAppShare}
              className="w-full sm:w-auto flex-1 py-4 px-6 rounded-2xl font-bold text-base text-white transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2 shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                boxShadow: '0 4px 20px rgba(37,211,102,0.3)'
              }}
            >
              <span className="text-xl">💬</span>
              <span>مشاركة على واتساب</span>
            </button>
          </div>

          {/* Toast Notification when link copied */}
          {copied && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs animate-float-up">
              <span>✓</span>
              <span>تم نسخ الرابط بنجاح! شاركه الآن مع أصحابك</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
