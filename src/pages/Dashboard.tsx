import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Participant,
  Team,
  TEAMS,
  getTeamById,
  FriendRequestRecord,
  FriendRequestStatus,
  TeamStats,
  DashboardSummary,
  Gender,
  Page
} from '../types'
import {
  fetchAllRegistrations,
  overrideParticipantTeam,
  calculateDashboardSummary,
  normalizeArabic,
  normalizePhone
} from '../services/api'
import logoImg from '../assets/logo.jpg'

interface DashboardProps {
  onNavigate?: (page: Page) => void
}

type TabType = 'teams' | 'participants' | 'friends'

export default function Dashboard({ onNavigate }: DashboardProps) {
  // ── 1. Authentication State ────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('karoz_admin_auth') === 'true'
  })
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [showPin, setShowPin] = useState(false)

  // ── 2. Data State ──────────────────────────────────────────────────────────
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // ── 3. View / Filter State ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabType>('teams')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all')
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<string>('all')
  const [friendsFilterMode, setFriendsFilterMode] = useState<'all' | 'pending' | 'satisfied'>('all')

  // ── 4. Modals State ────────────────────────────────────────────────────────
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null)
  const [selectedTeamDetails, setSelectedTeamDetails] = useState<TeamStats | null>(null)
  const [transferParticipant, setTransferParticipant] = useState<Participant | null>(null)
  const [transferTargetTeam, setTransferTargetTeam] = useState<string>('')
  const [isTransferring, setIsTransferring] = useState(false)

  // ── Toast Helper ───────────────────────────────────────────────────────────
  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  // ── Load Data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true)
    try {
      const data = await fetchAllRegistrations()
      setParticipants(data)
      if (!silent) showToast('تم تحديث البيانات بنجاح ✓')
    } catch (err) {
      console.error('Failed to load registrations:', err)
      if (!silent) showToast('تعذر الاتصال، تم استخدام البيانات المحلية')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      loadData(true)
    }
  }, [isAuthenticated, loadData])

  // ── PIN Submit Handler ─────────────────────────────────────────────────────
  const handlePinSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (pinInput.trim() === '2026' || pinInput.trim() === 'admin2026') {
      sessionStorage.setItem('karoz_admin_auth', 'true')
      setIsAuthenticated(true)
      setPinError('')
      loadData(true)
    } else {
      setPinError('رمز PIN غير صحيح')
      setPinInput('')
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('karoz_admin_auth')
    setIsAuthenticated(false)
    setPinInput('')
  }

  // ── Summary Calculations ───────────────────────────────────────────────────
  const summary: DashboardSummary = useMemo(() => {
    return calculateDashboardSummary(participants)
  }, [participants])

  // ── Filtered Participants ──────────────────────────────────────────────────
  const filteredParticipants = useMemo(() => {
    const normQuery = normalizeArabic(searchQuery)

    return participants.filter(p => {
      if (selectedTeamFilter !== 'all' && p.team !== selectedTeamFilter) return false
      if (selectedGenderFilter !== 'all' && p.gender !== selectedGenderFilter) return false

      if (normQuery) {
        const normName = normalizeArabic(p.name)
        const normPhoneNum = normalizePhone(p.phone)
        const nameMatch = normName.includes(normQuery)
        const phoneMatch = normPhoneNum.includes(normQuery)
        const friendMatch = p.friendNames.some(fn => normalizeArabic(fn).includes(normQuery))
        if (!nameMatch && !phoneMatch && !friendMatch) return false
      }

      return true
    })
  }, [participants, searchQuery, selectedTeamFilter, selectedGenderFilter])

  // ── Filtered Friend Requests ───────────────────────────────────────────────
  const filteredFriendRequests = useMemo(() => {
    return summary.allFriendRequests.filter(r => {
      if (friendsFilterMode === 'pending' && r.status !== 'PENDING') return false
      if (friendsFilterMode === 'satisfied' && r.status !== 'SATISFIED') return false

      if (searchQuery) {
        const normQuery = normalizeArabic(searchQuery)
        const reqNameMatch = normalizeArabic(r.requesterName).includes(normQuery)
        const reqPhoneMatch = normalizePhone(r.requesterPhone).includes(normQuery)
        const friendNameMatch = normalizeArabic(r.requestedName).includes(normQuery)
        if (!reqNameMatch && !reqPhoneMatch && !friendNameMatch) return false
      }

      return true
    })
  }, [summary, friendsFilterMode, searchQuery])

  // ── Manual Team Transfer Handler ───────────────────────────────────────────
  const handleExecuteTransfer = async () => {
    if (!transferParticipant || !transferTargetTeam) return

    setIsTransferring(true)
    try {
      const res = await overrideParticipantTeam(
        transferParticipant.id,
        transferParticipant.phone,
        transferTargetTeam
      )

      if (res.success) {
        setParticipants(prev =>
          prev.map(p =>
            p.id === transferParticipant.id || normalizePhone(p.phone) === normalizePhone(transferParticipant.phone)
              ? { ...p, team: transferTargetTeam }
              : p
          )
        )
        showToast(`تم نقل ${transferParticipant.name} بنجاح ✓`)
        setTransferParticipant(null)
        setTransferTargetTeam('')
        if (selectedParticipant) {
          setSelectedParticipant(prev => prev ? { ...prev, team: transferTargetTeam } : null)
        }
      } else {
        showToast(`خطأ: ${res.error || 'تعذر النقل'}`)
      }
    } catch (err) {
      console.error('Transfer failed:', err)
      showToast('حدث خطأ أثناء نقل المشترك')
    } finally {
      setIsTransferring(false)
    }
  }

  // ── Export CSV Handler ─────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (participants.length === 0) {
      showToast('لا توجد بيانات لتصديرها')
      return
    }

    const headers = ['ID', 'الاسم', 'الواتساب', 'النوع', 'الفريق', 'طلب أصدقاء', 'أسماء الأصدقاء', 'تاريخ التسجيل']
    const rows = participants.map(p => [
      `"${p.id}"`,
      `"${p.name}"`,
      `"${normalizePhone(p.phone)}"`,
      `"${p.gender === 'male' ? 'ولد' : 'بنت'}"`,
      `"${getTeamById(p.team).name}"`,
      `"${p.wantsFriends ? 'نعم' : 'لا'}"`,
      `"${p.friendNames.join(' ، ')}"`,
      `"${new Date(p.registrationTime).toLocaleString('ar-EG')}"`
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `karoz_sports_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    showToast('تم تصدير ملف Excel بنجاح ✓')
  }

  // ── Status Badge ───────────────────────────────────────────────────────────
  const renderStatusBadge = (status: FriendRequestStatus) => {
    switch (status) {
      case 'SATISFIED':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            ✓ في نفس الفريق
          </span>
        )
      case 'PENDING':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            ⏳ معلق (لم يسجل بعد)
          </span>
        )
      case 'UNSATISFIED':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            ⚠️ في فريق آخر
          </span>
        )
      default:
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-500/15 text-slate-300 border border-slate-500/30">
            • قيد المعالجة
          </span>
        )
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 🔐 CLEAN MINIMAL PIN GATE
  // ════════════════════════════════════════════════════════════════════════════
  if (!isAuthenticated) {
    return (
      <div
        className="min-h-screen pt-20 pb-12 px-4 flex flex-col items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #040d1e 0%, #0d1b3e 100%)' }}
      >
        <div className="w-full max-w-sm relative z-10 animate-float-up">
          <div className="glass-card rounded-3xl p-8 gold-glow border border-amber-500/30 text-center">
            {/* Logo */}
            <img src={logoImg} alt="أسرة الكاروز" className="w-20 h-20 mx-auto mb-4 rounded-2xl object-cover border border-amber-400/30 p-1 shadow-lg" />
            
            <h1 className="text-2xl font-black text-white mb-1">لوحة تحكم الأدمن</h1>
            <p className="text-slate-400 text-xs mb-6">اليوم الرياضي لأسرة الكاروز</p>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pinInput}
                  onChange={e => {
                    setPinInput(e.target.value)
                    setPinError('')
                  }}
                  autoFocus
                  dir="ltr"
                  className="w-full px-4 py-3.5 rounded-2xl text-white text-center text-2xl font-mono tracking-widest outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: pinError ? '1px solid #ef4444' : '1px solid rgba(245,166,35,0.3)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-white/5 cursor-pointer"
                >
                  {showPin ? 'إخفاء' : 'إظهار'}
                </button>
              </div>

              {pinError && <p className="text-red-400 text-xs font-bold text-center">{pinError}</p>}

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl font-black text-base transition-all hover:scale-102 active:scale-95 cursor-pointer shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #F5A623, #D97706)',
                  color: '#040d1e'
                }}
              >
                دخول ←
              </button>
            </form>

            {onNavigate && (
              <button
                onClick={() => onNavigate('home')}
                className="mt-6 text-xs text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
              >
                العودة للرئيسية ↗
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 🏆 CLEAN & SIMPLE DASHBOARD
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div
      className="min-h-screen pt-20 pb-16 px-4 sm:px-6 lg:px-8 text-slate-100 relative"
      style={{ background: 'linear-gradient(135deg, #040d1e 0%, #08142c 50%, #0d1b3e 100%)' }}
    >
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-float-up">
          <div className="bg-slate-900 border border-amber-500/40 text-amber-300 px-5 py-2.5 rounded-2xl shadow-2xl backdrop-blur-xl font-bold text-xs flex items-center gap-2">
            <span>✨</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Top Clean Header ── */}
        <div className="glass-card rounded-3xl p-5 border border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <img src={logoImg} alt="أسرة الكاروز" className="w-12 h-12 rounded-xl object-cover border border-amber-400/30 shadow-md" />
            <div className="text-right">
              <h1 className="text-xl font-black text-white">لوحة تحكم اليوم الرياضي 🏆</h1>
              <p className="text-xs text-slate-400">أسرة الكاروز — البداري</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            <button
              onClick={() => loadData(false)}
              disabled={isRefreshing}
              className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
              <span>{isRefreshing ? 'جاري التحديث...' : 'تحديث'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <span>📥</span>
              <span>تصدير Excel</span>
            </button>

            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-bold transition-all cursor-pointer"
            >
              خروج 🚪
            </button>
          </div>
        </div>

        {/* ── 3 Big Clean KPI Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Registrations */}
          <div className="glass-card rounded-3xl p-5 border border-amber-500/20 text-right">
            <p className="text-xs text-slate-400 font-bold mb-1">إجمالي المسجلين</p>
            <div className="flex items-baseline justify-between">
              <h2 className="text-3xl font-black text-white">{summary.totalParticipants} <span className="text-xs text-slate-400 font-normal">مشارك</span></h2>
              <span className="text-2xl">👥</span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 flex justify-between text-xs font-bold">
              <span className="text-blue-300">👦 {summary.totalMales} ولد ({summary.malePct}%)</span>
              <span className="text-pink-300">👧 {summary.totalFemales} بنت ({summary.femalePct}%)</span>
            </div>
          </div>

          {/* 6 Teams Average */}
          <div className="glass-card rounded-3xl p-5 border border-blue-500/20 text-right">
            <p className="text-xs text-slate-400 font-bold mb-1">توزيع الفرق الستة</p>
            <div className="flex items-baseline justify-between">
              <h2 className="text-3xl font-black text-blue-400">6 <span className="text-xs text-slate-400 font-normal">فرق</span></h2>
              <span className="text-2xl">🛡️</span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 flex justify-between text-xs font-bold text-slate-300">
              <span>متوسط الأعضاء: {summary.avgPerTeam} لاعب</span>
              <span className="text-emerald-400">✓ متزن</span>
            </div>
          </div>

          {/* Friend Requests */}
          <div className="glass-card rounded-3xl p-5 border border-emerald-500/20 text-right">
            <p className="text-xs text-slate-400 font-bold mb-1">رغبات الأصدقاء</p>
            <div className="flex items-baseline justify-between">
              <h2 className="text-3xl font-black text-emerald-400">{summary.totalFriendRequests} <span className="text-xs text-slate-400 font-normal">طلب</span></h2>
              <span className="text-2xl">🤝</span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 flex justify-between text-xs font-bold">
              <span className="text-emerald-300">✓ {summary.satisfiedRequests} مستوفى</span>
              <span className="text-amber-300">⏳ {summary.pendingRequests} معلق</span>
            </div>
          </div>
        </div>

        {/* ── Simple Clean Tab Bar ── */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          {([
            { id: 'teams', label: '🛡️ الفرق الستة', count: 6 },
            { id: 'participants', label: '👥 جدول المشتركين', count: summary.totalParticipants },
            { id: 'friends', label: '🤝 طلبات الأصدقاء', count: summary.totalFriendRequests }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-400/20 scale-102'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-white/10 text-amber-300'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1: 6 TEAMS CARDS
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'teams' && (
          <div className="space-y-4 animate-float-up">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.teamStats.map(ts => (
                <div
                  key={ts.team.id}
                  onClick={() => setSelectedTeamDetails(ts)}
                  className="glass-card rounded-3xl p-5 border transition-all hover:scale-102 cursor-pointer relative overflow-hidden"
                  style={{
                    borderColor: `${ts.team.color}44`,
                    background: `linear-gradient(145deg, rgba(13,27,62,0.9), ${ts.team.bg}66)`
                  }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-3xl">{ts.team.emoji}</span>
                      <div>
                        <h3 className="text-lg font-black" style={{ color: ts.team.color }}>
                          {ts.team.name}
                        </h3>
                        <p className="text-xs text-slate-400">{ts.total} لاعب مسجل</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      ✓ متزن
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden mb-3">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(ts.capacityPct, 10)}%`,
                        background: ts.team.color
                      }}
                    />
                  </div>

                  {/* Gender Split */}
                  <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-white/10">
                    <span className="text-blue-300">👦 {ts.males} أولاد ({ts.malePct}%)</span>
                    <span className="text-pink-300">👧 {ts.females} بنات ({ts.femalePct}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2: PARTICIPANTS TABLE
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'participants' && (
          <div className="space-y-4 animate-float-up">

            {/* Search & Team Filter Bar */}
            <div className="glass-card rounded-2xl p-4 border border-amber-500/20 space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو رقم الهاتف أو الصديق..."
                  dir="rtl"
                  className="w-full px-4 py-3 pr-10 rounded-xl text-white text-right outline-none text-sm"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(245,166,35,0.25)'
                  }}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-amber-400">🔍</span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-white/10 cursor-pointer"
                  >
                    مسح ✕
                  </button>
                )}
              </div>

              {/* Team Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                <button
                  onClick={() => setSelectedTeamFilter('all')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedTeamFilter === 'all' ? 'bg-amber-400 text-slate-950 font-black' : 'bg-white/5 text-slate-300'
                  }`}
                >
                  الكل ({participants.length})
                </button>
                {TEAMS.map(t => {
                  const count = participants.filter(p => p.team === t.id).length
                  const isSel = selectedTeamFilter === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTeamFilter(t.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                        isSel ? 'ring-2 ring-amber-400' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ background: t.bg, color: '#ffffff' }}
                    >
                      <span>{t.emoji}</span>
                      <span>{t.name}</span>
                      <span className="text-[10px] opacity-75">({count})</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Clean Table */}
            <div className="glass-card rounded-3xl border border-amber-500/20 overflow-hidden shadow-xl">
              {filteredParticipants.length === 0 ? (
                <p className="text-center py-12 text-slate-400 text-sm">لا توجد نتائج مطابقة</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5 text-slate-300 text-xs font-bold">
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">الاسم</th>
                        <th className="py-3 px-4">الواتساب</th>
                        <th className="py-3 px-4 text-center">النوع</th>
                        <th className="py-3 px-4 text-center">الفريق</th>
                        <th className="py-3 px-4">الأصدقاء</th>
                        <th className="py-3 px-4 text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredParticipants.map((p, idx) => {
                        const team = getTeamById(p.team)
                        return (
                          <tr key={p.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4 text-slate-500 text-xs font-mono">{idx + 1}</td>
                            <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                              <button
                                onClick={() => setSelectedParticipant(p)}
                                className="hover:text-amber-300 transition-colors text-right cursor-pointer"
                              >
                                {p.name}
                              </button>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap" dir="ltr">
                              <a
                                href={`https://wa.me/2${normalizePhone(p.phone)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-400 hover:underline font-mono text-xs inline-flex items-center gap-1"
                              >
                                <span>💬</span>
                                <span>{normalizePhone(p.phone)}</span>
                              </a>
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap text-xs">
                              {p.gender === 'male' ? '👦 ولد' : '👧 بنت'}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold"
                                style={{ background: team.bg, color: team.color }}
                              >
                                <span>{team.emoji}</span>
                                <span>{team.name}</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs text-amber-300">
                              {p.wantsFriends && p.friendNames.length > 0 ? p.friendNames.join(' ، ') : '—'}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setTransferParticipant(p)
                                  setTransferTargetTeam(p.team)
                                }}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-bold cursor-pointer"
                              >
                                نقل الفريق 🔄
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 3: FRIEND REQUESTS
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'friends' && (
          <div className="space-y-4 animate-float-up">

            {/* Filter Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setFriendsFilterMode('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  friendsFilterMode === 'all' ? 'bg-amber-400 text-slate-950 font-black' : 'glass-card text-slate-300'
                }`}
              >
                كل الطلبات ({summary.totalFriendRequests})
              </button>
              <button
                onClick={() => setFriendsFilterMode('pending')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  friendsFilterMode === 'pending' ? 'bg-amber-400 text-slate-950 font-black' : 'glass-card text-slate-300'
                }`}
              >
                ⏳ المعلقة فقط - لم يسجل الصديق بعد ({summary.pendingRequests})
              </button>
              <button
                onClick={() => setFriendsFilterMode('satisfied')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  friendsFilterMode === 'satisfied' ? 'bg-amber-400 text-slate-950 font-black' : 'glass-card text-slate-300'
                }`}
              >
                ✓ المستوفاة في نفس الفريق ({summary.satisfiedRequests})
              </button>
            </div>

            {/* Requests Table */}
            <div className="glass-card rounded-3xl border border-amber-500/20 overflow-hidden shadow-xl">
              {filteredFriendRequests.length === 0 ? (
                <p className="text-center py-12 text-slate-400 text-sm">لا توجد طلبات في هذا القسم</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5 text-slate-300 text-xs font-bold">
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">صاحب الطلب</th>
                        <th className="py-3 px-4">فريقه</th>
                        <th className="py-3 px-4">الصديق المطلوب</th>
                        <th className="py-3 px-4">حالة الصديق</th>
                        <th className="py-3 px-4 text-center">حالة الطلب</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredFriendRequests.map((req, rIdx) => {
                        const reqTeam = getTeamById(req.requesterTeam)
                        return (
                          <tr key={req.id || rIdx} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4 text-slate-500 text-xs font-mono">{rIdx + 1}</td>
                            <td className="py-3 px-4 font-bold text-white">{req.requesterName}</td>
                            <td className="py-3 px-4">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold"
                                style={{ background: reqTeam.bg, color: reqTeam.color }}
                              >
                                <span>{reqTeam.emoji}</span>
                                <span>{reqTeam.name}</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold text-amber-300">{req.requestedName}</td>
                            <td className="py-3 px-4 text-xs">
                              {req.matchedParticipant ? (
                                <span className="text-slate-200">
                                  مسجل في {getTeamById(req.matchedParticipant.team).name}
                                </span>
                              ) : (
                                <span className="text-slate-500 italic">لم يسجل بعد</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">{renderStatusBadge(req.status)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* ── Modal: Team Roster ── */}
      {selectedTeamDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-float-up">
          <div className="glass-card rounded-3xl p-6 max-w-lg w-full gold-glow border border-amber-500/30 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="text-3xl">{selectedTeamDetails.team.emoji}</span>
                <div>
                  <h3 className="text-xl font-black" style={{ color: selectedTeamDetails.team.color }}>
                    {selectedTeamDetails.team.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedTeamDetails.total} لاعب ({selectedTeamDetails.males} أولاد • {selectedTeamDetails.females} بنات)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTeamDetails(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl bg-white/5 cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="divide-y divide-white/5 max-h-72 overflow-y-auto mb-4 border border-white/10 rounded-2xl">
              {selectedTeamDetails.members.map((m, idx) => (
                <div key={m.id} className="p-3 flex items-center justify-between text-xs hover:bg-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-mono">{idx + 1}</span>
                    <span className="font-bold text-white">{m.name}</span>
                    <span className="text-slate-400">({m.gender === 'male' ? 'ولد' : 'بنت'})</span>
                  </div>
                  <span className="font-mono text-slate-400" dir="ltr">{normalizePhone(m.phone)}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelectedTeamDetails(null)}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Manual Transfer ── */}
      {transferParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-float-up">
          <div className="glass-card rounded-3xl p-6 max-w-sm w-full gold-glow border border-amber-500/40">
            <h3 className="text-lg font-black text-white text-center mb-1">
              نقل المشترك إلى فريق آخر
            </h3>
            <p className="text-slate-400 text-xs text-center mb-4">
              المشترك: <span className="text-amber-400 font-bold">{transferParticipant.name}</span>
            </p>

            <div className="grid grid-cols-2 gap-2 mb-5">
              {TEAMS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTransferTargetTeam(t.id)}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                    transferTargetTeam === t.id ? 'ring-2 ring-amber-400 scale-102' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ background: t.bg, color: '#ffffff', borderColor: t.color }}
                >
                  <span>{t.emoji}</span>
                  <span>{t.name}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleExecuteTransfer}
                disabled={isTransferring || transferTargetTeam === transferParticipant.team}
                className="flex-1 py-3 rounded-xl font-black text-xs transition-all cursor-pointer disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #F5A623, #D97706)',
                  color: '#040d1e'
                }}
              >
                {isTransferring ? 'جاري النقل...' : 'تأكيد النقل ✓'}
              </button>
              <button
                onClick={() => setTransferParticipant(null)}
                className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
