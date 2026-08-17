import logoImg from '../assets/logo.jpg'

export default function Footer() {
  return (
    <footer
      className="py-8 px-4 text-center border-t"
      style={{ background: '#040d1e', borderColor: 'rgba(245,166,35,0.1)' }}
    >
      <div className="max-w-4xl mx-auto">
        <img src={logoImg} alt="أسرة الكاروز" className="w-12 h-12 rounded-full object-cover mx-auto mb-3" />
        <p className="text-slate-500 text-sm">أسرة الكاروز — كنيسة العذراء مريم بالبداري</p>
        <p className="text-slate-600 text-xs mt-1">اليوم الرياضي للشباب</p>
      </div>
    </footer>
  )
}
