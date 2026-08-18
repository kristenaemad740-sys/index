import { useState } from 'react'
import { RegisterView, Gender, TEAMS, getTeamById, Participant } from '../types'
import { registerParticipant, validatePhone, normalizePhone } from '../services/api'
import logoImg from '../assets/logo.jpg'

// ── Arabic ordinal labels ────────────────────────────────────────────────────
const ARABIC_ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس']

// ── Form State Interface ──────────────────────────────────────────────────────
interface FormState {
  name: string
  phone: string
  gender: Gender | ''
  preference: 'yes' | 'no' | ''
  friendsCount: number
  friendNames: string[]
}

const INITIAL_FORM: FormState = {
  name: '',
  phone: '',
  gender: '',
  preference: '',
  friendsCount: 0,
  friendNames: []
}

// ── Sports Background ─────────────────────────────────────────────────────────
function SportsBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute top-[-100px] left-[-100px] w-[400px] h-[400px] opacity-10 animate-spin-slow">
        <svg viewBox="0 0 500 500" fill="none">
          <circle cx="250" cy="250" r="200" stroke="#F5A623" strokeWidth="8" strokeDasharray="30 20" />
          <circle cx="250" cy="250" r="150" stroke="#FBBF24" strokeWidth="5" strokeDasharray="15 25" />
        </svg>
      </div>
      <div className="absolute bottom-[-100px] right-[-100px] w-[350px] h-[350px] opacity-8 animate-spin-slow-reverse">
        <svg viewBox="0 0 400 400" fill="none">
          <circle cx="200" cy="200" r="150" stroke="#F5A623" strokeWidth="8" strokeDasharray="25 15" />
        </svg>
      </div>
    </div>
  )
}

export default function Register() {
  const [view, setView] = useState<RegisterView>('form')
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'friendNames', string>>>({})
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [errorMsg, setErrorMsg] = useState('تعذر الاتصال بالخادم.')
  const [isUpdateMode, setIsUpdateMode] = useState<boolean>(false)

  const activeTeam = participant ? getTeamById(participant.team) : TEAMS[0]

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): boolean {
    const e: typeof errors = {}

    if (!form.name.trim()) {
      e.name = 'من فضلك أدخل اسمك'
    }
    if (!form.phone.trim()) {
      e.phone = 'من فضلك أدخل رقم الواتساب'
    } else if (!validatePhone(form.phone)) {
      e.phone = 'رقم الواتساب غير صحيح'
    }
    if (!form.gender) {
      e.gender = 'من فضلك اختر النوع'
    }
    if (!form.preference) {
      e.preference = 'من فضلك حدد اختيارك'
    }
    if (form.preference === 'yes') {
      if (form.friendsCount === 0) {
        e.friendsCount = 'من فضلك اختر عدد الأشخاص'
      } else {
        const anyEmpty = form.friendNames.some(n => !n.trim())
        if (anyEmpty) {
          e.friendNames = 'من فضلك اكمل جميع أسماء الأشخاص'
        }
      }
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (validate()) {
      setView('confirm')
    }
  }

  async function handleConfirm() {
    setView('loading')
    try {
      const wantsFriends = form.preference === 'yes'
      const result = await registerParticipant({
        name: form.name,
        phone: form.phone,
        gender: form.gender as Gender,
        wantsFriends,
        friendsCount: wantsFriends ? form.friendsCount : 0,
        friendNames: wantsFriends ? form.friendNames : [],
        isUpdate: isUpdateMode
      })

      if (result.status === 'success') {
        setParticipant(result.participant)
        if (result.isExisting && !isUpdateMode) {
          setView('already_registered')
        } else {
          setView('success')
        }
      } else {
        setErrorMsg('حدث خطأ أثناء التسجيل، حاول مرة أخرى.')
        setView('error')
      }
    } catch {
      setErrorMsg('تعذر الاتصال بالخادم.')
      setView('error')
    }
  }

  // ── Count selection helper ───────────────────────────────────────────────────
  function handleFriendsCountSelect(count: number) {
    setForm(f => {
      const prevNames = f.friendNames
      const newNames = Array.from({ length: count }, (_, i) => prevNames[i] ?? '')
      return { ...f, friendsCount: count, friendNames: newNames }
    })
    setErrors(er => ({ ...er, friendsCount: '' }))
  }

  // ── Shared container ─────────────────────────────────────────────────────────
  const containerClass =
    'min-h-screen pt-24 pb-12 px-4 flex flex-col items-center justify-center relative overflow-hidden'

  // ════════════════════════════════════════════════════════════════════════════
  // LOADING
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'loading') {
    return (
      <div className={containerClass} style={{ background: 'linear-gradient(135deg, #040d1e, #0d1b3e)' }}>
        <SportsBg />
        <div className="text-center relative z-10">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-amber-400/20" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-amber-400 animate-spin" />
            <div
              className="absolute inset-3 rounded-full border-2 border-transparent border-t-amber-300/60 animate-spin"
              style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}
            />
          </div>
          <p className="text-amber-400 font-bold text-lg animate-pulse-gold">
            {isUpdateMode ? 'جاري تحديث البيانات...' : 'جاري التسجيل...'}
          </p>
          <p className="text-slate-400 text-sm mt-2">من فضلك انتظر</p>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ALREADY REGISTERED VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'already_registered' && participant) {
    return (
      <div
        className={containerClass}
        style={{ background: `linear-gradient(135deg, #040d1e 0%, ${activeTeam.bg} 100%)` }}
      >
        <SportsBg />
        <div className="w-full max-w-md relative z-10 animate-float-up">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">📱</div>
            <h1 className="text-2xl font-black text-white mb-1">أنت مسجل بالفعل!</h1>
            <p className="text-amber-400 text-sm font-semibold">
              تم العثور على بيانات تسجيل سابقة برقم الواتساب هذا
            </p>
          </div>

          <div
            className={`glass-card rounded-3xl p-6 mb-6 ${activeTeam.glowClass}`}
            style={{ border: `1px solid ${activeTeam.color}55` }}
          >
            <div className="text-center mb-6">
              <div className="text-5xl mb-2">{activeTeam.emoji}</div>
              <div className="text-2xl font-black" style={{ color: activeTeam.color }}>
                {activeTeam.name}
              </div>
              <p className="text-slate-400 text-xs mt-1">فريقك المسجل</p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2.5 border-b border-white/10">
                <span className="font-bold text-white">{participant.name}</span>
                <span className="text-slate-400">الاسم</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-white/10">
                <span className="font-bold text-white text-left" dir="ltr">
                  {normalizePhone(participant.phone)}
                </span>
                <span className="text-slate-400">رقم الواتساب</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-white/10">
                <span className="font-bold text-amber-400">
                  {participant.gender === 'male' ? '👦 ولد' : '👧 بنت'}
                </span>
                <span className="text-slate-400">النوع</span>
              </div>
              {participant.wantsFriends && participant.friendNames.length > 0 && (
                <div className="flex justify-between items-start py-2.5">
                  <div className="text-right max-w-[60%]">
                    {participant.friendNames.map((name, i) => (
                      <p key={i} className="font-bold text-amber-300 text-xs mb-0.5">{name}</p>
                    ))}
                  </div>
                  <span className="text-slate-400 shrink-0 mr-2">الأصدقاء</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              setForm({
                name: participant.name,
                phone: participant.phone,
                gender: participant.gender,
                preference: participant.wantsFriends ? 'yes' : 'no',
                friendsCount: participant.friendsCount || 0,
                friendNames: participant.friendNames || []
              })
              setIsUpdateMode(true)
              setView('form')
            }}
            className="w-full py-4 rounded-2xl font-black text-lg transition-all hover:scale-105 active:scale-95 mb-3 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #F5A623, #D97706)',
              color: '#040d1e',
              boxShadow: '0 4px 20px rgba(245,166,35,0.4)'
            }}
          >
            تعديل البيانات ✏️
          </button>

          <button
            onClick={() => setView('success')}
            className="w-full py-3 rounded-xl text-slate-300 hover:text-white text-sm transition-colors cursor-pointer border border-white/10 glass-card"
          >
            عرض بطاقة فريقك ✓
          </button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SUCCESS
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'success' && participant) {
    return (
      <div
        className={containerClass}
        style={{ background: `linear-gradient(135deg, #040d1e 0%, ${activeTeam.bg} 100%)` }}
      >
        <SportsBg />
        <div className="w-full max-w-md relative z-10 animate-celebrate">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">{activeTeam.emoji}</div>
            <h1 className="text-3xl font-black text-white mb-2">
              {isUpdateMode ? 'تم تحديث بياناتك بنجاح! 🎉' : 'تم تسجيلك بنجاح! 🎉'}
            </h1>
            <div className="text-amber-300 text-lg font-semibold">مبروك عليك!</div>
          </div>

          <div
            className={`glass-card rounded-3xl p-6 mb-6 ${activeTeam.glowClass}`}
            style={{ border: `1px solid ${activeTeam.color}55` }}
          >
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">{activeTeam.emoji}</div>
              <div className="text-2xl font-black" style={{ color: activeTeam.color }}>
                {activeTeam.name}
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="font-bold text-white">{participant.name}</span>
                <span className="text-slate-400">اسمك</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="font-bold" style={{ color: activeTeam.color }}>
                  {activeTeam.name}
                </span>
                <span className="text-slate-400">فريقك</span>
              </div>
              <div className="text-center py-2">
                <p className="text-slate-300 text-sm font-semibold">سيتم إضافتك إلى مجموعتك.</p>
              </div>
              {participant.wantsFriends && (
                <div className="text-center py-1">
                  <p className="text-amber-300 text-sm font-semibold">تم مراعاة إضافتك مع أصدقائك.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ERROR
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'error') {
    return (
      <div className={containerClass} style={{ background: 'linear-gradient(135deg, #040d1e, #1a0a0a)' }}>
        <SportsBg />
        <div className="w-full max-w-sm text-center relative z-10 animate-celebrate">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-black text-white mb-2">حدث خطأ</h2>
          <p className="text-slate-400 mb-6">{errorMsg}</p>
          <button
            onClick={() => setView('confirm')}
            className="w-full py-3.5 rounded-xl font-bold text-white mb-3 transition-all hover:opacity-90 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}
          >
            حاول مرة أخرى
          </button>
          <button
            onClick={() => setView('form')}
            className="w-full py-3 rounded-xl text-slate-400 hover:text-white text-sm transition-colors cursor-pointer"
          >
            العودة للنموذج
          </button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CLOSED
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'closed') {
    return (
      <div className={containerClass} style={{ background: 'linear-gradient(135deg, #040d1e, #0d1b3e)' }}>
        <SportsBg />
        <div className="w-full max-w-sm text-center relative z-10 animate-celebrate">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-black text-white mb-2">التسجيل مغلق حاليًا</h2>
          <p className="text-slate-400">التسجيل للمشاركة في اليوم الرياضي مغلق في الوقت الحالي.</p>
          <p className="text-amber-400 text-sm mt-3">تواصل مع الكنيسة لمزيد من المعلومات.</p>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CONFIRM
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'confirm') {
    return (
      <div className={containerClass} style={{ background: 'linear-gradient(135deg, #040d1e, #0d1b3e)' }}>
        <SportsBg />
        <div className="w-full max-w-md relative z-10 animate-float-up">
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">📋</div>
            <h1 className="text-2xl font-black text-white">
              {isUpdateMode ? 'تأكيد تعديل البيانات' : 'تأكيد التسجيل'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">تأكد من صحة البيانات قبل الحفظ</p>
          </div>

          <div className="glass-card rounded-3xl p-6 mb-4 gold-glow">
            <div className="space-y-3">
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="font-bold text-white">{form.name}</span>
                <span className="text-slate-400 text-sm">الاسم</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="font-bold text-white text-left" dir="ltr">
                  {normalizePhone(form.phone)}
                </span>
                <span className="text-slate-400 text-sm">رقم الواتساب</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="font-bold text-amber-400">
                  {form.gender === 'male' ? '👦 ولد' : '👧 بنت'}
                </span>
                <span className="text-slate-400 text-sm">النوع</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="font-bold text-white">
                  {form.preference === 'yes' ? 'أيوه' : 'لا، مش فارقة'}
                </span>
                <span className="text-slate-400 text-sm shrink-0 mr-2">مع ناس معينة؟</span>
              </div>
              {form.preference === 'yes' && form.friendNames.length > 0 && (
                <div className="flex justify-between items-start py-3">
                  <div className="text-right max-w-[60%]">
                    {form.friendNames.map((name, i) => (
                      <p key={i} className="font-bold text-amber-300 text-sm">{name}</p>
                    ))}
                  </div>
                  <span className="text-slate-400 text-sm shrink-0 mr-2">الأصدقاء</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleConfirm}
            className="w-full py-4 rounded-2xl font-black text-lg transition-all hover:scale-105 active:scale-95 mb-3 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #F5A623, #D97706)',
              color: '#040d1e',
              boxShadow: '0 4px 20px rgba(245,166,35,0.4)'
            }}
          >
            {isUpdateMode ? 'حفظ التعديلات ✓' : 'تأكيد التسجيل ✓'}
          </button>

          <button
            onClick={() => setView('form')}
            className="w-full py-3 rounded-xl text-slate-400 hover:text-white text-sm transition-colors cursor-pointer"
          >
            العودة للتعديل
          </button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FORM (Default)
  // ════════════════════════════════════════════════════════════════════════════
  const inputStyle = (hasError: boolean) => ({
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${hasError ? '#ef4444' : 'rgba(245,166,35,0.2)'}`,
    fontSize: '16px'
  })

  const choiceBtn = (active: boolean, hasError: boolean) => ({
    background: active ? 'linear-gradient(135deg, #F5A623, #D97706)' : 'rgba(255,255,255,0.05)',
    color: active ? '#040d1e' : '#94a3b8',
    border: `1px solid ${active ? '#F5A623' : hasError ? '#ef4444' : 'rgba(255,255,255,0.1)'}`
  })

  return (
    <div
      className="min-h-screen pt-20 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #040d1e 0%, #0d1b3e 100%)' }}
    >
      <SportsBg />
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start min-h-[calc(100vh-5rem)]">

        {/* ── Left info panel (desktop only) ── */}
        <div className="hidden lg:flex flex-col gap-6 animate-float-up sticky top-24">
          <div className="flex justify-center">
            <img
              src={logoImg}
              alt="أسرة الكاروز"
              className="w-32 h-32 rounded-full object-cover"
              style={{ boxShadow: '0 0 40px rgba(245,166,35,0.3)' }}
            />
          </div>
          <h2 className="text-3xl font-black text-white text-right leading-snug">
            سجّل في اليوم الرياضي<br />
            <span className="shimmer-text">لأسرة الكاروز</span>
          </h2>
          <p className="text-slate-400 text-right">
            أدخل بياناتك وسيقوم النظام بتعيين فريقك تلقائيًا مع مراعاة أصدقائك.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {TEAMS.map(team => (
              <div
                key={team.id}
                className="flex items-center gap-2 p-3 rounded-xl"
                style={{ background: team.bg + 'aa', border: `1px solid ${team.color}33` }}
              >
                <span className="text-xl">{team.emoji}</span>
                <span className="text-white text-sm font-semibold">{team.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Form panel ── */}
        <div className="w-full max-w-xl mx-auto lg:max-w-none animate-float-up stagger-1" style={{ animationFillMode: 'forwards', opacity: 0 }}>
          <div className="glass-card rounded-3xl p-6 sm:p-8">
            <h1 className="text-2xl font-black text-white mb-1 text-right">
              {isUpdateMode ? 'تعديل البيانات المسجلة' : 'سجّل في اليوم الرياضي'}
            </h1>
            <p className="text-slate-400 text-sm mb-6 text-right">كنيسة العذراء مريم بالبداري</p>

            {/* ── Name ── */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-300 mb-2 text-right">الاسم</label>
              <input
                type="text"
                value={form.name}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: '' })) }}
                placeholder="أدخل اسمك الكامل"
                dir="rtl"
                className="w-full px-4 py-3.5 rounded-xl text-white text-right outline-none transition-all"
                style={inputStyle(!!errors.name)}
              />
              {errors.name && <p className="text-red-400 text-xs mt-1 text-right">{errors.name}</p>}
            </div>

            {/* ── Phone / WhatsApp ── */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-300 mb-2 text-right">رقم الواتساب</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setErrors(er => ({ ...er, phone: '' })) }}
                placeholder="01xxxxxxxxx"
                dir="ltr"
                disabled={isUpdateMode}
                className={`w-full px-4 py-3.5 rounded-xl text-white text-left outline-none transition-all ${isUpdateMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                style={inputStyle(!!errors.phone)}
              />
              {errors.phone && <p className="text-red-400 text-xs mt-1 text-right">{errors.phone}</p>}
            </div>

            {/* ── Gender ── */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-300 mb-2 text-right">النوع</label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'male' as Gender, label: 'ولد', icon: '👦' },
                  { value: 'female' as Gender, label: 'بنت', icon: '👧' }
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setForm(f => ({ ...f, gender: opt.value })); setErrors(er => ({ ...er, gender: '' })) }}
                    className={`py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${form.gender === opt.value ? 'scale-105' : ''}`}
                    style={choiceBtn(form.gender === opt.value, !!errors.gender)}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
              {errors.gender && <p className="text-red-400 text-xs mt-1 text-right">{errors.gender}</p>}
            </div>

            {/* ── Preference ── */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-300 mb-2 text-right">
                تفضّل تكون مع ناس معينة؟
              </label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'yes', label: 'أيوه' },
                  { value: 'no', label: 'لا، مش فارقة' }
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setForm(f => ({
                        ...f,
                        preference: opt.value,
                        friendsCount: opt.value === 'no' ? 0 : f.friendsCount,
                        friendNames: opt.value === 'no' ? [] : f.friendNames
                      }))
                      setErrors(er => ({ ...er, preference: '', friendsCount: '', friendNames: '' }))
                    }}
                    className={`py-3.5 rounded-xl font-bold transition-all flex items-center justify-center cursor-pointer ${form.preference === opt.value ? 'scale-105' : ''}`}
                    style={choiceBtn(form.preference === opt.value, !!errors.preference)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {errors.preference && <p className="text-red-400 text-xs mt-1 text-right">{errors.preference}</p>}
            </div>

            {/* ── Friends Count (only when "yes") ── */}
            {form.preference === 'yes' && (
              <div className="mb-4 animate-float-up">
                <label className="block text-sm font-semibold text-slate-300 mb-2 text-right">
                  كام شخص تفضّل تكون معاهم؟
                </label>
                <div className="flex gap-2 flex-wrap justify-end">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleFriendsCountSelect(n)}
                      className={`w-12 h-12 rounded-xl font-black text-base transition-all cursor-pointer ${form.friendsCount === n ? 'scale-110' : ''}`}
                      style={choiceBtn(form.friendsCount === n, !!errors.friendsCount)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {errors.friendsCount && <p className="text-red-400 text-xs mt-1 text-right">{errors.friendsCount}</p>}
              </div>
            )}

            {/* ── Friend Name Fields (dynamic) ── */}
            {form.preference === 'yes' && form.friendsCount > 0 && (
              <div className="mb-4 animate-float-up space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 text-right mb-1">
                    اكتب أسماء الأشخاص اللي تفضّل تكون معاهم
                  </label>
                  <div className="mt-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-right text-xs text-amber-300 space-y-1 leading-relaxed">
                    <p className="font-bold text-amber-400">⚠️ خلي بالك:</p>
                    <p>لو كتبت اسم صاحبك، إنت بتطلب إنك تكون معاه في نفس الفريق، مش بتسجّله.</p>
                    <p>صاحبك لازم يسجّل بنفسه عشان يبقى مشارك رسمي، وبعد تسجيله هنخليكم تكونوا مع بعض في نفس الفريق.</p>
                  </div>
                </div>
                {Array.from({ length: form.friendsCount }, (_, i) => (
                  <input
                    key={i}
                    type="text"
                    value={form.friendNames[i] ?? ''}
                    onChange={e => {
                      const newNames = [...form.friendNames]
                      newNames[i] = e.target.value
                      setForm(f => ({ ...f, friendNames: newNames }))
                      setErrors(er => ({ ...er, friendNames: '' }))
                    }}
                    placeholder={`اسم الشخص ${ARABIC_ORDINALS[i]}`}
                    dir="rtl"
                    className="w-full px-4 py-3.5 rounded-xl text-white text-right outline-none transition-all"
                    style={inputStyle(!!errors.friendNames && !(form.friendNames[i] ?? '').trim())}
                  />
                ))}
                {errors.friendNames && <p className="text-red-400 text-xs mt-1 text-right">{errors.friendNames}</p>}
              </div>
            )}


            {/* ── Submit ── */}
            <button
              onClick={handleSubmit}
              className="w-full py-4 rounded-2xl font-black text-lg transition-all hover:scale-105 active:scale-95 cursor-pointer mt-2"
              style={{
                background: 'linear-gradient(135deg, #F5A623, #D97706)',
                color: '#040d1e',
                boxShadow: '0 4px 20px rgba(245,166,35,0.4)'
              }}
            >
              {isUpdateMode ? 'مراجعة التعديلات ←' : 'التالي ←'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
