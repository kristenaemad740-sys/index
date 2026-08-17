import logoImg from '../assets/logo.jpg'

export default function Footer() {
  return (
    <footer
      className="py-8 px-4 text-center border-t"
      style={{ background: '#040d1e', borderColor: 'rgba(245,166,35,0.1)' }}
    >
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-2">
        <img src={logoImg} alt="أسرة الكاروز" className="w-12 h-12 rounded-full object-cover mb-1" />
        <p className="text-slate-400 text-sm font-medium">أسرة الكاروز — كنيسة العذراء مريم بالبداري</p>
        <p className="text-slate-500 text-xs">اليوم الرياضي للشباب</p>
        <div className="mt-3 pt-3 border-t border-white/5 w-full max-w-xs">
          <p className="text-amber-400/80 text-xs font-semibold tracking-widest uppercase">
            CREATING BY ENG SHAKER
          </p>
        </div>
      </div>
    </footer>
  )
}
