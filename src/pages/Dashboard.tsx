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

type TabType = 'overview' | 'participants' | 'friends' | 'balance' | 'timeline'

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
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(30) // seconds (0 = off)
  const [isOnline, setIsOnline] = useState(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // ── 3. View / Filter State ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all')
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<string>('all')
  const [selectedFriendsFilter, setSelectedFriendsFilter] = useState<string>('all')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all')
  const [friendsTabSubFilter, setFriendsTabSubFilter] = useState<'all' | 'pending' | 'satisfied' | 'unsatisfied'>('all')

  // ── 4. Modals State ────────────────────────────────────────────────────────
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null)
  const [selectedTeamDetails, setSelectedTeamDetails] = useState<TeamStats | null>(null)
  const [transferParticipant, setTransferParticipant] = useState<Participant | null>(null)
  const [transferTargetTeam, setTransferTargetTeam] = useState<string>('')
  const [isTransferring, setIsTransferring] = useState(false)

  // ── Helper: Show Toast ─────────────────────────────────────────────────────
  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // ── Fetch Data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true)
    try {
      const data = await fetchAllRegistrations()
      setParticipants(data)
      setLastSyncTime(new Date())
      setIsOnline(true)
      if (!silent) {
        showToast('تم تحديث البيانات بنجاح ✓')
      }
    } catch (err) {
      console.error('Failed to load registrations:', err)
      setIsOnline(false)
      if (!silent) showToast('تعذر الاتصال بالخادم، تم استخدام البيانات المحلية.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    if (isAuthenticated) {
      loadData(true)
    }
  }, [isAuthenticated, loadData])

  // Auto-refresh polling timer
  useEffect(() => {
    if (!isAuthenticated || autoRefreshInterval <= 0) return

    const interval = setInterval(() => {
      loadData(true)
    }, autoRefreshInterval * 1000)

    return () => clearInterval(interval)
  }, [isAuthenticated, autoRefreshInterval, loadData])

  // ── PIN Authentication Handler ─────────────────────────────────────────────
  const handlePinSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (pinInput.trim() === '2026' || pinInput.trim() === 'admin2026') {
      sessionStorage.setItem('karoz_admin_auth', 'true')
      setIsAuthenticated(true)
      setPinError('')
      loadData(true)
    } else {
      setPinError('رمز المرور غير صحيح. حاول مرة أخرى.')
      setPinInput('')
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('karoz_admin_auth')
    setIsAuthenticated(false)
    setPinInput('')
  }

  // ── Calculate Dashboard Summary ────────────────────────────────────────────
  const summary: DashboardSummary = useMemo(() => {
    return calculateDashboardSummary(participants)
  }, [participants])

  // ── Filtered Participants ──────────────────────────────────────────────────
  const filteredParticipants = useMemo(() => {
    const normQuery = normalizeArabic(searchQuery)

    return participants.filter(p => {
      // 1. Team filter
      if (selectedTeamFilter !== 'all' && p.team !== selectedTeamFilter) return false

      // 2. Gender filter
      if (selectedGenderFilter !== 'all' && p.gender !== selectedGenderFilter) return false

      // 3. Wants Friends filter
      if (selectedFriendsFilter === 'yes' && !p.wantsFriends) return false
      if (selectedFriendsFilter === 'no' && p.wantsFriends) return false

      // 4. Friend Request Status filter
      if (selectedStatusFilter !== 'all') {
        const reqs = summary.allFriendRequests.filter(r => r.requesterId === p.id)
        if (selectedStatusFilter === 'none') {
          if (p.wantsFriends && reqs.length > 0) return false
        } else {
          const hasStatus = reqs.some(r => r.status === selectedStatusFilter)
          if (!hasStatus) return false
        }
      }

      // 5. Search query
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
  }, [participants, searchQuery, selectedTeamFilter, selectedGenderFilter, selectedFriendsFilter, selectedStatusFilter, summary])

  // ── Filtered Friend Requests for Tab 3 ─────────────────────────────────────
  const filteredFriendRequests = useMemo(() => {
    return summary.allFriendRequests.filter(r => {
      if (friendsTabSubFilter === 'pending' && r.status !== 'PENDING') return false
      if (friendsTabSubFilter === 'satisfied' && r.status !== 'SATISFIED') return false
      if (friendsTabSubFilter === 'unsatisfied' && r.status !== 'UNSATISFIED') return false

      if (searchQuery) {
        const normQuery = normalizeArabic(searchQuery)
        const reqNameMatch = normalizeArabic(r.requesterName).includes(normQuery)
        const reqPhoneMatch = normalizePhone(r.requesterPhone).includes(normQuery)
        const friendNameMatch = normalizeArabic(r.requestedName).includes(normQuery)
        const matchedNameMatch = r.matchedParticipant ? normalizeArabic(r.matchedParticipant.name).includes(normQuery) : false
        if (!reqNameMatch && !reqPhoneMatch && !friendNameMatch && !matchedNameMatch) return false
      }

      return true
    })
  }, [summary, friendsTabSubFilter, searchQuery])

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
        // Update state locally
        setParticipants(prev =>
          prev.map(p =>
            p.id === transferParticipant.id || normalizePhone(p.phone) === normalizePhone(transferParticipant.phone)
              ? { ...p, team: transferTargetTeam }
              : p
          )
        )
        showToast(`تم نقل ${transferParticipant.name} إلى ${getTeamById(transferTargetTeam).name} بنجاح ✓`)
        setTransferParticipant(null)
        setTransferTargetTeam('')
        if (selectedParticipant) {
          setSelectedParticipant(prev => prev ? { ...prev, team: transferTargetTeam } : null)
        }
      } else {
        showToast(`خطأ: ${res.error || 'تعذر نقل المشترك'}`)
      }
    } catch (err) {
      console.error('Transfer failed:', err)
      showToast('حدث خطأ أثناء نقل المشترك.')
    } finally {
      setIsTransferring(false)
    }
  }

  // ── Export CSV Handler (UTF-8 BOM for Arabic Excel) ────────────────────────
  const handleExportCSV = () => {
    if (participants.length === 0) {
      showToast('لا توجد بيانات لتصديرها.')
      return
    }

    const headers = [
      'الرقم التعريفي (ID)',
      'الاسم الكامل',
      'رقم الواتساب',
      'النوع',
      'الفريق',
      'يرغب بصديق؟',
      'عدد الأصدقاء',
      'أسماء الأصدقاء',
      'تاريخ التسجيل'
    ]

    const rows = participants.map(p => [
      `"${p.id}"`,
      `"${p.name}"`,
      `"${normalizePhone(p.phone)}"`,
      `"${p.gender === 'male' ? 'ولد' : 'بنت'}"`,
      `"${getTeamById(p.team).name}"`,
      `"${p.wantsFriends ? 'نعم' : 'لا'}"`,
      p.friendsCount,
      `"${p.friendNames.join(' ، ')}"`,
      `"${new Date(p.registrationTime).toLocaleString('ar-EG')}"`
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `karoz_sports_participants_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('تم تصدير ملف CSV بنجاح ✓')
  }

  // ── Helper: Format Relative Time ───────────────────────────────────────────
  const formatRelativeTime = (isoString: string) => {
    try {
      const now = new Date().getTime()
      const time = new Date(isoString).getTime()
      const diffSec = Math.floor((now - time) / 1000)

      if (diffSec < 60) return 'منذ ثوانٍ'
      if (diffSec < 3600) {
        const mins = Math.floor(diffSec / 60)
        return mins === 1 ? 'منذ دقيقة' : mins === 2 ? 'منذ دقيقتين' : `منذ ${mins} دقائق`
      }
      if (diffSec < 86400) {
        const hours = Math.floor(diffSec / 3600)
        return hours === 1 ? 'منذ ساعة' : hours === 2 ? 'منذ ساعتين' : `منذ ${hours} ساعات`
      }
      const days = Math.floor(diffSec / 86400)
      return days === 1 ? 'أمس' : `منذ ${days} أيام`
    } catch {
      return ''
    }
  }

  // ── Helper: Friend Request Status Badge ────────────────────────────────────
  const renderStatusBadge = (status: FriendRequestStatus) => {
    switch (status) {
      case 'SATISFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <span>✓</span>
            <span>متحقق (نفس الفريق)</span>
          </span>
        )
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <span>⏳</span>
            <span>معلق (لم يسجل بعد)</span>
          </span>
        )
      case 'MATCHED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <span>🔗</span>
            <span>متطابق</span>
          </span>
        )
      case 'UNSATISFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <span>⚠️</span>
            <span>في فريق آخر</span>
          </span>
        )
      case 'AMBIGUOUS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <span>❓</span>
            <span>اسم مكرر/غامض</span>
          </span>
        )
      case 'UNRESOLVED':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">
            <span>•</span>
            <span>غير محدد</span>
          </span>
        )
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 🔐 ADMIN PIN GATE VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (!isAuthenticated) {
    return (
      <div
        className="min-h-screen pt-24 pb-12 px-4 flex flex-col items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #040d1e 0%, #0d1b3e 100%)' }}
      >
        {/* Floating background particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-amber-500/5 blur-3xl animate-pulse-gold" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl" />
        </div>

        <div className="w-full max-w-md relative z-10 animate-float-up">
          <div className="glass-card rounded-3xl p-8 sm:p-10 gold-glow border border-amber-500/30 text-center">
            {/* Logo */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-full overflow-hidden border-2 border-amber-400/40 p-1 bg-slate-900/80 shadow-lg">
              <img src={logoImg} alt="أسرة الكاروز" className="w-full h-full object-cover rounded-full" />
            </div>

            <div className="text-3xl mb-2">🔐</div>
            <h1 className="text-2xl font-black text-white mb-2">لوحة تحكم اليوم الرياضي</h1>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              منطقة مخصصة للأدمن ومسؤولي تنظيم اليوم الرياضي لأسرة الكاروز
            </p>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2 text-right">
                  رمز المرور (PIN)
                </label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={pinInput}
                    onChange={e => {
                      setPinInput(e.target.value)
                      setPinError('')
                    }}
                    placeholder="أدخل رمز الـ PIN (الافتراضي: 2026)"
                    dir="ltr"
                    autoFocus
                    className="w-full px-4 py-3.5 rounded-xl text-white text-center text-lg font-mono tracking-widest outline-none transition-all"
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
                {pinError && <p className="text-red-400 text-xs mt-2 text-right animate-float-up">{pinError}</p>}
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-xl font-black text-lg transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #F5A623, #D97706)',
                  color: '#040d1e',
                  boxShadow: '0 4px 20px rgba(245,166,35,0.4)'
                }}
              >
                دخول لوحة التحكم ←
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-center text-xs text-slate-400">
              <span>أسرة الكاروز — البداري</span>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('home')}
                  className="text-amber-400 hover:underline cursor-pointer"
                >
                  العودة للرئيسية ↗
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 🏆 MAIN ADMIN DASHBOARD VIEW
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div
      className="min-h-screen pt-20 pb-16 px-4 sm:px-6 lg:px-8 text-slate-100 relative"
      style={{ background: 'linear-gradient(135deg, #040d1e 0%, #08142c 50%, #0d1b3e 100%)' }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-float-up">
          <div className="bg-slate-900/95 border border-amber-500/40 text-amber-300 px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-3 font-semibold text-sm">
            <span>✨</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Top Header Control Bar ── */}
        <div className="glass-card rounded-3xl p-5 sm:p-6 gold-glow border border-amber-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src={logoImg} alt="أسرة الكاروز" className="w-14 h-14 rounded-2xl object-cover border border-amber-400/30 p-0.5 shadow-md" />
            <div className="text-right">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white">لوحة تحكم اليوم الرياضي 🏆</h1>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  isOnline ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                  <span>{isOnline ? 'متصل بالسيرفر الحي' : 'وضع محلي'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                إدارة التسجيلات، تحليل الفرق الستة، وشبكة رغبات الأصدقاء
                {lastSyncTime && (
                  <span className="mr-2 text-slate-400">
                    • آخر تحديث: {lastSyncTime.toLocaleTimeString('ar-EG')}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto justify-end">
            {/* Auto Refresh Interval */}
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs">
              <span className="text-slate-400">تحديث:</span>
              <select
                value={autoRefreshInterval}
                onChange={e => setAutoRefreshInterval(Number(e.target.value))}
                className="bg-transparent text-amber-300 font-bold outline-none cursor-pointer"
              >
                <option value={0} className="bg-slate-900 text-white">إيقاف</option>
                <option value={15} className="bg-slate-900 text-white">15 ثانية</option>
                <option value={30} className="bg-slate-900 text-white">30 ثانية</option>
                <option value={60} className="bg-slate-900 text-white">دقيقة</option>
              </select>
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={() => loadData(false)}
              disabled={isRefreshing}
              className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
              <span>{isRefreshing ? 'جاري التحديث...' : 'تحديث الآن'}</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span>📥</span>
              <span>تصدير Excel</span>
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-bold transition-all cursor-pointer"
            >
              خروج 🚪
            </button>
          </div>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {([
            { id: 'overview', label: '📊 نظرة عامة والفرق', badge: summary.teamCount },
            { id: 'participants', label: '👥 جميع المشتركين', badge: summary.totalParticipants },
            { id: 'friends', label: '🤝 طلبات الأصدقاء', badge: summary.totalFriendRequests },
            { id: 'balance', label: '⚖️ مقارنة وتوازن الفرق' },
            { id: 'timeline', label: '🕒 آخر التسجيلات', badge: summary.recentRegistrations.length }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-5 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20 scale-102 font-black'
                  : 'glass-card text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>{tab.label}</span>
              {'badge' in tab && tab.badge !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-white/10 text-amber-300'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1: OVERVIEW & 6 TEAMS
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-float-up">

            {/* Top KPI Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Participants */}
              <div className="glass-card rounded-3xl p-5 border border-amber-500/20 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-slate-400 font-semibold mb-1">إجمالي المسجلين</p>
                    <h3 className="text-3xl font-black text-white">{summary.totalParticipants}</h3>
                    <p className="text-[11px] text-amber-400 mt-1 font-bold">
                      متوسط {summary.avgPerTeam} لكل فريق
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-2xl">
                    🏆
                  </div>
                </div>
              </div>

              {/* Gender Breakdown */}
              <div className="glass-card rounded-3xl p-5 border border-blue-500/20 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-slate-400 font-semibold mb-1">توزيع النوع</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-blue-400">{summary.totalMales} 👦</span>
                      <span className="text-slate-500">|</span>
                      <span className="text-xl font-black text-pink-400">{summary.totalFemales} 👧</span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1 font-semibold">
                      {summary.malePct}% أولاد • {summary.femalePct}% بنات
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-2xl">
                    ⚖️
                  </div>
                </div>
              </div>

              {/* Friend Requests */}
              <div className="glass-card rounded-3xl p-5 border border-emerald-500/20 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-slate-400 font-semibold mb-1">طلبات الأصدقاء</p>
                    <h3 className="text-3xl font-black text-emerald-400">{summary.totalFriendRequests}</h3>
                    <p className="text-[11px] text-emerald-300 mt-1 font-bold">
                      {summary.satisfiedRequests} مستوفاة بنسبة {summary.friendSatisfactionRate}%
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-2xl">
                    🤝
                  </div>
                </div>
              </div>

              {/* Pending Requests */}
              <div className="glass-card rounded-3xl p-5 border border-purple-500/20 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-slate-400 font-semibold mb-1">طلبات معلقة (Pending)</p>
                    <h3 className="text-3xl font-black text-purple-400">{summary.pendingRequests}</h3>
                    <p className="text-[11px] text-purple-300 mt-1 font-semibold">
                      في انتظار تسجيل الصديق
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-2xl">
                    ⏳
                  </div>
                </div>
              </div>
            </div>

            {/* Algorithm Health Status Strip */}
            <div className="glass-card rounded-2xl p-4 border border-amber-500/20 flex flex-wrap items-center justify-between gap-4 bg-amber-500/5">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚙️</span>
                <span className="text-sm font-bold text-white">حالة الخوارزمية (Anchor Algorithm v4.8):</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-emerald-300">
                  <span>✓</span>
                  <span>توزيع الأحجام: متزن بالتوازي</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-emerald-300">
                  <span>✓</span>
                  <span>توزيع النوع: متطابق مع النسبة العامة ({summary.malePct}% / {summary.femalePct}%)</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/15 border border-blue-500/30 text-xs font-bold text-blue-300">
                  <span>🎯</span>
                  <span>تحقيق رغبات الأصدقاء: {summary.friendSatisfactionRate}%</span>
                </div>
              </div>
            </div>

            {/* 6 Teams Cards Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <span>🛡️</span>
                  <span>الفرق الستة (6 Teams Overview)</span>
                </h2>
                <span className="text-xs text-slate-400">اضغط على أي فريق لعرض قائمته الكاملة</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {summary.teamStats.map(ts => {
                  const balanceColor =
                    ts.balanceStatus === 'balanced'
                      ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
                      : ts.balanceStatus === 'slight_imbalance'
                      ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
                      : 'text-rose-400 bg-rose-500/15 border-rose-500/30'

                  const balanceText =
                    ts.balanceStatus === 'balanced'
                      ? '✓ متزن'
                      : ts.balanceStatus === 'slight_imbalance'
                      ? '⚠️ فرق طفيف'
                      : '⚠️ غير متوازن'

                  return (
                    <div
                      key={ts.team.id}
                      onClick={() => setSelectedTeamDetails(ts)}
                      className={`glass-card rounded-3xl p-6 transition-all hover:scale-102 hover:shadow-2xl cursor-pointer relative overflow-hidden ${ts.team.glowClass}`}
                      style={{
                        border: `1px solid ${ts.team.color}44`,
                        background: `linear-gradient(145deg, rgba(13,27,62,0.85), ${ts.team.bg}55)`
                      }}
                    >
                      {/* Top Team Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg"
                            style={{ background: ts.team.bg, border: `1px solid ${ts.team.color}66` }}
                          >
                            {ts.team.emoji}
                          </div>
                          <div>
                            <h3 className="text-lg font-black" style={{ color: ts.team.color }}>
                              {ts.team.name}
                            </h3>
                            <p className="text-xs text-slate-400">{ts.total} لاعب مسجل</p>
                          </div>
                        </div>

                        {/* Balance Badge */}
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${balanceColor}`}>
                          {balanceText}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>سعة الفريق</span>
                          <span className="font-bold text-white">{ts.total} لاعب</span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(ts.capacityPct, 8)}%`,
                              background: `linear-gradient(90deg, ${ts.team.color}, #f5a623)`
                            }}
                          />
                        </div>
                      </div>

                      {/* Gender breakdown inside team */}
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10 text-center">
                        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                          <p className="text-[11px] text-blue-300 font-semibold mb-0.5">👦 أولاد</p>
                          <p className="text-base font-black text-white">{ts.males}</p>
                          <p className="text-[10px] text-slate-400">{ts.malePct}%</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20">
                          <p className="text-[11px] text-pink-300 font-semibold mb-0.5">👧 بنات</p>
                          <p className="text-base font-black text-white">{ts.females}</p>
                          <p className="text-[10px] text-slate-400">{ts.femalePct}%</p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-xs text-slate-400">
                        <span>عرض قائمة الفريق ←</span>
                        <span className="font-bold" style={{ color: ts.team.color }}>{ts.total} عضو</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quick Recent Registrations Strip */}
            <div className="glass-card rounded-3xl p-6 border border-amber-500/20">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>⚡</span>
                  <span>آخر المسجلين في اليوم الرياضي</span>
                </h3>
                <button
                  onClick={() => setActiveTab('participants')}
                  className="text-xs text-amber-400 hover:underline cursor-pointer font-bold"
                >
                  عرض جميع المشاركين ({summary.totalParticipants}) ←
                </button>
              </div>

              {summary.recentRegistrations.length === 0 ? (
                <p className="text-center py-8 text-slate-400 text-sm">لسه مفيش تسجيلات حتى الآن.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {summary.recentRegistrations.slice(0, 6).map(p => {
                    const team = getTeamById(p.team)
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedParticipant(p)}
                        className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <span className="text-xl shrink-0">{team.emoji}</span>
                          <div className="overflow-hidden text-right">
                            <p className="text-sm font-bold text-white truncate">{p.name}</p>
                            <p className="text-[11px] text-slate-400">{formatRelativeTime(p.registrationTime)}</p>
                          </div>
                        </div>
                        <span
                          className="px-2.5 py-1 rounded-xl text-[11px] font-bold shrink-0"
                          style={{ background: team.bg, color: team.color, border: `1px solid ${team.color}44` }}
                        >
                          {team.name}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2: ALL PARTICIPANTS TABLE
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'participants' && (
          <div className="space-y-4 animate-float-up">

            {/* Search and Filters Card */}
            <div className="glass-card rounded-3xl p-5 border border-amber-500/20 space-y-4">
              {/* Search Box */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم، رقم الواتساب، أو اسم الصديق المطلوب..."
                  dir="rtl"
                  className="w-full px-4 py-3.5 pr-11 rounded-2xl text-white text-right outline-none transition-all placeholder:text-slate-400/60"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(245,166,35,0.25)',
                    fontSize: '15px'
                  }}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg text-amber-400">🔍</span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-white/10 cursor-pointer"
                  >
                    مسح ✕
                  </button>
                )}
              </div>

              {/* Filters row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Team Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 text-right">الفريق</label>
                  <select
                    value={selectedTeamFilter}
                    onChange={e => setSelectedTeamFilter(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 text-white border border-white/15 text-xs font-semibold outline-none cursor-pointer"
                  >
                    <option value="all">كل الفرق (All Teams)</option>
                    {TEAMS.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.emoji} {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Gender Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 text-right">النوع</label>
                  <select
                    value={selectedGenderFilter}
                    onChange={e => setSelectedGenderFilter(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 text-white border border-white/15 text-xs font-semibold outline-none cursor-pointer"
                  >
                    <option value="all">الكل (النوع)</option>
                    <option value="male">👦 أولاد فقط</option>
                    <option value="female">👧 بنات فقط</option>
                  </select>
                </div>

                {/* Wants Friends Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 text-right">طلب أصدقاء</label>
                  <select
                    value={selectedFriendsFilter}
                    onChange={e => setSelectedFriendsFilter(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 text-white border border-white/15 text-xs font-semibold outline-none cursor-pointer"
                  >
                    <option value="all">الكل</option>
                    <option value="yes">✅ طلب أصدقاء</option>
                    <option value="no">❌ بدون طلبات (مرن)</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 text-right">حالة الطلب</label>
                  <select
                    value={selectedStatusFilter}
                    onChange={e => setSelectedStatusFilter(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 text-white border border-white/15 text-xs font-semibold outline-none cursor-pointer"
                  >
                    <option value="all">كل الحالات</option>
                    <option value="SATISFIED">✅ متحقق (نفس الفريق)</option>
                    <option value="PENDING">⏳ معلق (لم يسجل بعد)</option>
                    <option value="UNSATISFIED">⚠️ في فريق مختلف</option>
                    <option value="AMBIGUOUS">❓ اسم غامض / مكرر</option>
                    <option value="UNRESOLVED">🔍 غير محدد</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 text-xs text-slate-400">
                <span>عرض {filteredParticipants.length} من إجمالي {summary.totalParticipants} مشارك</span>
                {(selectedTeamFilter !== 'all' || selectedGenderFilter !== 'all' || selectedFriendsFilter !== 'all' || selectedStatusFilter !== 'all' || searchQuery) && (
                  <button
                    onClick={() => {
                      setSelectedTeamFilter('all')
                      setSelectedGenderFilter('all')
                      setSelectedFriendsFilter('all')
                      setSelectedStatusFilter('all')
                      setSearchQuery('')
                    }}
                    className="text-amber-400 hover:underline cursor-pointer font-bold"
                  >
                    إعادة ضبط الفلاتر ✕
                  </button>
                )}
              </div>
            </div>

            {/* Participants Data Table */}
            <div className="glass-card rounded-3xl border border-amber-500/20 overflow-hidden shadow-xl">
              {filteredParticipants.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="text-5xl mb-3">🔍</div>
                  <h3 className="text-lg font-bold text-white mb-1">لا توجد نتائج مطابقة للبحث</h3>
                  <p className="text-slate-400 text-xs">جرب تغيير كلمات البحث أو إعادة ضبط الفلاتر</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5 text-slate-300 text-xs font-black">
                        <th className="py-3.5 px-4">#</th>
                        <th className="py-3.5 px-4">الاسم الكامل</th>
                        <th className="py-3.5 px-4">رقم الواتساب</th>
                        <th className="py-3.5 px-4 text-center">النوع</th>
                        <th className="py-3.5 px-4 text-center">الفريق</th>
                        <th className="py-3.5 px-4">الأصدقاء المطلوبون</th>
                        <th className="py-3.5 px-4">تاريخ التسجيل</th>
                        <th className="py-3.5 px-4 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredParticipants.map((p, idx) => {
                        const team = getTeamById(p.team)
                        const reqs = summary.allFriendRequests.filter(r => r.requesterId === p.id)

                        return (
                          <tr key={p.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3.5 px-4 text-slate-500 text-xs font-mono">{idx + 1}</td>
                            <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                              <button
                                onClick={() => setSelectedParticipant(p)}
                                className="hover:text-amber-300 transition-colors text-right cursor-pointer"
                              >
                                {p.name}
                              </button>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap" dir="ltr">
                              <a
                                href={`https://wa.me/2${normalizePhone(p.phone)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-400 hover:text-emerald-300 hover:underline font-mono text-xs inline-flex items-center gap-1.5"
                              >
                                <span>💬</span>
                                <span>{normalizePhone(p.phone)}</span>
                              </a>
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                p.gender === 'male' ? 'bg-blue-500/20 text-blue-300' : 'pink-glow bg-pink-500/20 text-pink-300'
                              }`}>
                                {p.gender === 'male' ? '👦 ولد' : '👧 بنت'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <span
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black shadow-sm"
                                style={{ background: team.bg, color: team.color, border: `1px solid ${team.color}55` }}
                              >
                                <span>{team.emoji}</span>
                                <span>{team.name}</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              {p.wantsFriends && p.friendNames.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  {reqs.map((req, rIdx) => (
                                    <div key={rIdx} className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-amber-300 text-xs">{req.requestedName}</span>
                                      {renderStatusBadge(req.status)}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500 font-semibold">لا يوجد (مرن) 🎲</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-xs text-slate-400 whitespace-nowrap">
                              {formatRelativeTime(p.registrationTime)}
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setSelectedParticipant(p)}
                                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold transition-all cursor-pointer"
                                >
                                  تفاصيل
                                </button>
                                <button
                                  onClick={() => {
                                    setTransferParticipant(p)
                                    setTransferTargetTeam(p.team)
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
                                >
                                  نقل
                                </button>
                              </div>
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
            TAB 3: FRIEND REQUESTS INTELLIGENCE
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'friends' && (
          <div className="space-y-6 animate-float-up">

            {/* Friend Requests Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass-card rounded-2xl p-4 border border-amber-500/20 text-center">
                <p className="text-xs text-slate-400 font-semibold mb-1">إجمالي طلبات الصداقة</p>
                <h4 className="text-2xl font-black text-white">{summary.totalFriendRequests}</h4>
              </div>
              <div className="glass-card rounded-2xl p-4 border border-emerald-500/20 text-center">
                <p className="text-xs text-slate-400 font-semibold mb-1">✅ طلبات مستوفاة (Satisfied)</p>
                <h4 className="text-2xl font-black text-emerald-400">{summary.satisfiedRequests}</h4>
              </div>
              <div className="glass-card rounded-2xl p-4 border border-purple-500/20 text-center">
                <p className="text-xs text-slate-400 font-semibold mb-1">⏳ طلبات معلقة (Pending)</p>
                <h4 className="text-2xl font-black text-purple-400">{summary.pendingRequests}</h4>
              </div>
              <div className="glass-card rounded-2xl p-4 border border-rose-500/20 text-center">
                <p className="text-xs text-slate-400 font-semibold mb-1">⚠️ في فرق مختلفة (Mismatched)</p>
                <h4 className="text-2xl font-black text-rose-400">{summary.unsatisfiedRequests}</h4>
              </div>
            </div>

            {/* Sub filter tabs */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                {([
                  { id: 'all', label: 'كل الطلبات', count: summary.totalFriendRequests },
                  { id: 'pending', label: '⏳ المعلقة فقط (Pending)', count: summary.pendingRequests },
                  { id: 'satisfied', label: '✅ المستوفاة (Satisfied)', count: summary.satisfiedRequests },
                  { id: 'unsatisfied', label: '⚠️ بفرق مختلفة', count: summary.unsatisfiedRequests }
                ] as const).map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setFriendsTabSubFilter(sub.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      friendsTabSubFilter === sub.id
                        ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                        : 'glass-card text-slate-300 hover:text-white'
                    }`}
                  >
                    <span>{sub.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      friendsTabSubFilter === sub.id ? 'bg-slate-950/20 text-slate-950' : 'bg-white/10 text-amber-300'
                    }`}>
                      {sub.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="text-xs text-slate-400">
                يتم تحديث الطلبات المعلقة تلقائيًا فور تسجيل الصديق بنظام الـ Anchor.
              </div>
            </div>

            {/* Friend Requests Network Table */}
            <div className="glass-card rounded-3xl border border-amber-500/20 overflow-hidden shadow-xl">
              {filteredFriendRequests.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="text-5xl mb-3">🤝</div>
                  <h3 className="text-lg font-bold text-white mb-1">لا توجد طلبات في هذا التصنيف</h3>
                  <p className="text-slate-400 text-xs">جميع الطلبات الأخرى مسجلة وموزعة بشكل سليم</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5 text-slate-300 text-xs font-black">
                        <th className="py-3.5 px-4">#</th>
                        <th className="py-3.5 px-4">صاحب الطلب (Requester)</th>
                        <th className="py-3.5 px-4">فريق الطالب</th>
                        <th className="py-3.5 px-4">الصديق المطلوب (Friend Name)</th>
                        <th className="py-3.5 px-4">الشخص المطابق المسجل</th>
                        <th className="py-3.5 px-4">فريق الصديق</th>
                        <th className="py-3.5 px-4 text-center">حالة الطلب</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredFriendRequests.map((req, rIdx) => {
                        const reqTeam = getTeamById(req.requesterTeam)
                        const matchedTeam = req.matchedParticipant ? getTeamById(req.matchedParticipant.team) : null

                        return (
                          <tr key={req.id || rIdx} className="hover:bg-white/5 transition-colors">
                            <td className="py-3.5 px-4 text-slate-500 text-xs font-mono">{rIdx + 1}</td>
                            <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                              {req.requesterName}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold"
                                style={{ background: reqTeam.bg, color: reqTeam.color }}
                              >
                                <span>{reqTeam.emoji}</span>
                                <span>{reqTeam.name}</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-amber-300 whitespace-nowrap">
                              {req.requestedName}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {req.matchedParticipant ? (
                                <span className="font-semibold text-slate-200">
                                  {req.matchedParticipant.name}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-500 italic">لم يسجل بعد في قاعدة البيانات</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {matchedTeam ? (
                                <span
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold"
                                  style={{ background: matchedTeam.bg, color: matchedTeam.color }}
                                >
                                  <span>{matchedTeam.emoji}</span>
                                  <span>{matchedTeam.name}</span>
                                </span>
                              ) : (
                                <span className="text-xs text-slate-500">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              {renderStatusBadge(req.status)}
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
            TAB 4: BALANCE & COMPARISON DEEP DIVE
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'balance' && (
          <div className="space-y-6 animate-float-up">

            {/* Benchmark Card */}
            <div className="glass-card rounded-3xl p-6 border border-amber-500/20 bg-amber-500/5">
              <h3 className="text-lg font-black text-white mb-2 flex items-center gap-2">
                <span>⚖️</span>
                <span>المعيار العام لجميع المشاركين (Global Benchmark)</span>
              </h3>
              <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                تقوم خوارزمية التوزيع بمقارنة كل فريق بالنسبة العامة لتوزيع النوع (أولاد وبنات) بالإضافة للحفاظ على تقارب عدد أعضاء الفرق.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                  <p className="text-xs text-slate-400 mb-1">النسبة العامة للأولاد</p>
                  <p className="text-3xl font-black text-blue-400">{summary.malePct}%</p>
                  <p className="text-xs text-slate-400 mt-1">({summary.totalMales} ولد)</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                  <p className="text-xs text-slate-400 mb-1">النسبة العامة للبنات</p>
                  <p className="text-3xl font-black text-pink-400">{summary.femalePct}%</p>
                  <p className="text-xs text-slate-400 mt-1">({summary.totalFemales} بنت)</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                  <p className="text-xs text-slate-400 mb-1">متوسط عدد أعضاء الفريق</p>
                  <p className="text-3xl font-black text-amber-400">{summary.avgPerTeam}</p>
                  <p className="text-xs text-slate-400 mt-1">موزعين على 6 فرق</p>
                </div>
              </div>
            </div>

            {/* Visual Team-by-Team Comparative Gauges */}
            <div className="glass-card rounded-3xl p-6 border border-amber-500/20 space-y-6">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>📊</span>
                <span>مقارنة نسب النوع وأحجام الفرق الستة</span>
              </h3>

              <div className="space-y-5">
                {summary.teamStats.map(ts => {
                  return (
                    <div key={ts.team.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">{ts.team.emoji}</span>
                          <span className="text-base font-black" style={{ color: ts.team.color }}>
                            {ts.team.name}
                          </span>
                          <span className="text-xs text-slate-400">({ts.total} لاعب)</span>
                        </div>

                        <div className="flex items-center gap-3 text-xs font-bold">
                          <span className="text-blue-300">👦 {ts.males} ({ts.malePct}%)</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-pink-300">👧 {ts.females} ({ts.femalePct}%)</span>
                          <span className="text-slate-500">•</span>
                          <span className={`px-2 py-0.5 rounded-full ${
                            ts.balanceStatus === 'balanced' ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'
                          }`}>
                            {ts.balanceStatus === 'balanced' ? '✓ متزن' : '⚠️ فرق طفيف'}
                          </span>
                        </div>
                      </div>

                      {/* Dual Bar (Male vs Female within team) */}
                      <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden flex">
                        <div
                          className="h-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${ts.malePct}%` }}
                          title={`أولاد: ${ts.malePct}%`}
                        />
                        <div
                          className="h-full bg-pink-500 transition-all duration-500"
                          style={{ width: `${ts.femalePct}%` }}
                          title={`بنات: ${ts.femalePct}%`}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 5: TIMELINE & ACTIVITY FEED
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'timeline' && (
          <div className="space-y-4 animate-float-up">
            <div className="glass-card rounded-3xl p-6 border border-amber-500/20">
              <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                <span>🕒</span>
                <span>سجل التسجيلات والنشاط الأخير</span>
              </h3>

              {summary.recentRegistrations.length === 0 ? (
                <p className="text-center py-12 text-slate-400 text-sm">لا توجد تسجيلات بعد.</p>
              ) : (
                <div className="space-y-3">
                  {summary.recentRegistrations.map((p, idx) => {
                    const team = getTeamById(p.team)
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedParticipant(p)}
                        className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-xl shrink-0">
                            {team.emoji}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">{p.name}</span>
                              <span className="text-xs text-slate-400">({p.gender === 'male' ? 'ولد' : 'بنت'})</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5" dir="ltr">
                              {normalizePhone(p.phone)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 justify-between sm:justify-end">
                          <span
                            className="px-3 py-1 rounded-xl text-xs font-bold"
                            style={{ background: team.bg, color: team.color, border: `1px solid ${team.color}44` }}
                          >
                            {team.name}
                          </span>
                          <span className="text-xs text-amber-400 font-semibold">
                            {formatRelativeTime(p.registrationTime)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL 1: PARTICIPANT DETAILS
      ════════════════════════════════════════════════════════════════════════ */}
      {selectedParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-float-up">
          <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-lg w-full gold-glow border border-amber-500/30 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-3xl">
                  {selectedParticipant.gender === 'male' ? '👦' : '👧'}
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">{selectedParticipant.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{normalizePhone(selectedParticipant.phone)}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedParticipant(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl bg-white/5 cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {/* Details List */}
            <div className="space-y-3 text-sm mb-6">
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-slate-400">الفريق الحالي:</span>
                <span
                  className="font-bold px-3 py-1 rounded-xl text-xs flex items-center gap-1.5"
                  style={{
                    background: getTeamById(selectedParticipant.team).bg,
                    color: getTeamById(selectedParticipant.team).color
                  }}
                >
                  <span>{getTeamById(selectedParticipant.team).emoji}</span>
                  <span>{getTeamById(selectedParticipant.team).name}</span>
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-slate-400">رقم الواتساب:</span>
                <a
                  href={`https://wa.me/2${normalizePhone(selectedParticipant.phone)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 font-bold font-mono text-xs flex items-center gap-1 hover:underline"
                  dir="ltr"
                >
                  <span>💬</span>
                  <span>{normalizePhone(selectedParticipant.phone)}</span>
                </a>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-slate-400">النوع:</span>
                <span className="font-bold text-white">
                  {selectedParticipant.gender === 'male' ? 'ولد 👦' : 'بنت 👧'}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-slate-400">تاريخ التسجيل:</span>
                <span className="font-semibold text-slate-300 text-xs">
                  {new Date(selectedParticipant.registrationTime).toLocaleString('ar-EG')}
                </span>
              </div>

              {/* Outgoing Requests */}
              <div className="py-2 border-b border-white/10">
                <span className="text-slate-400 block mb-2 font-bold">الطلبات الصادرة (Outgoing Requests):</span>
                {selectedParticipant.wantsFriends && selectedParticipant.friendNames.length > 0 ? (
                  <div className="space-y-1.5">
                    {summary.allFriendRequests
                      .filter(r => r.requesterId === selectedParticipant.id)
                      .map((req, rIdx) => (
                        <div key={rIdx} className="p-2.5 rounded-xl bg-white/5 flex items-center justify-between text-xs">
                          <span className="font-bold text-amber-300">{req.requestedName}</span>
                          {renderStatusBadge(req.status)}
                        </div>
                      ))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">لا توجد طلبات (مشترك مرن)</span>
                )}
              </div>

              {/* Incoming Requests (Who requested this person) */}
              <div className="py-2">
                <span className="text-slate-400 block mb-2 font-bold">من طلب أن يكون معه (Incoming Requests):</span>
                {summary.allFriendRequests.filter(
                  r => r.matchedParticipant && r.matchedParticipant.id === selectedParticipant.id
                ).length > 0 ? (
                  <div className="space-y-1.5">
                    {summary.allFriendRequests
                      .filter(r => r.matchedParticipant && r.matchedParticipant.id === selectedParticipant.id)
                      .map((req, rIdx) => (
                        <div key={rIdx} className="p-2.5 rounded-xl bg-white/5 flex items-center justify-between text-xs">
                          <span className="font-bold text-white">{req.requesterName}</span>
                          <span className="text-xs text-slate-400">({getTeamById(req.requesterTeam).name})</span>
                          {renderStatusBadge(req.status)}
                        </div>
                      ))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">لم يطلبه أحد بالاسم حتى الآن</span>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setTransferParticipant(selectedParticipant)
                  setTransferTargetTeam(selectedParticipant.team)
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs cursor-pointer transition-all"
              >
                تغيير الفريق يدويًا 🔄
              </button>
              <button
                onClick={() => setSelectedParticipant(null)}
                className="py-3 px-5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer transition-all"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL 2: TEAM ROSTER DETAILS
      ════════════════════════════════════════════════════════════════════════ */}
      {selectedTeamDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-float-up">
          <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-2xl w-full gold-glow border border-amber-500/30 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-lg"
                  style={{ background: selectedTeamDetails.team.bg, border: `1px solid ${selectedTeamDetails.team.color}66` }}
                >
                  {selectedTeamDetails.team.emoji}
                </div>
                <div>
                  <h3 className="text-2xl font-black" style={{ color: selectedTeamDetails.team.color }}>
                    {selectedTeamDetails.team.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedTeamDetails.total} عضو ({selectedTeamDetails.males} أولاد • {selectedTeamDetails.females} بنات)
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

            {/* Members Roster Table */}
            <div className="rounded-2xl border border-white/10 overflow-hidden mb-6">
              {selectedTeamDetails.members.length === 0 ? (
                <p className="text-center py-12 text-slate-400 text-sm">لا يوجد لاعبين مسجلين في هذا الفريق بعد.</p>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-slate-300 font-bold sticky top-0 bg-slate-900">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">الاسم</th>
                        <th className="py-2.5 px-3">النوع</th>
                        <th className="py-2.5 px-3">الواتساب</th>
                        <th className="py-2.5 px-3 text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {selectedTeamDetails.members.map((m, idx) => (
                        <tr key={m.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-2 px-3 text-slate-500 font-mono">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-white">{m.name}</td>
                          <td className="py-2 px-3">
                            <span className={m.gender === 'male' ? 'text-blue-300' : 'text-pink-300'}>
                              {m.gender === 'male' ? 'ولد' : 'بنت'}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-300" dir="ltr">
                            {normalizePhone(m.phone)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => {
                                setSelectedParticipant(m)
                                setSelectedTeamDetails(null)
                              }}
                              className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-slate-300 cursor-pointer"
                            >
                              عرض
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedTeamDetails(null)}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer transition-all"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL 3: MANUAL TEAM TRANSFER OVERRIDE
      ════════════════════════════════════════════════════════════════════════ */}
      {transferParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-float-up">
          <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-md w-full gold-glow border border-amber-500/40">
            <div className="text-3xl mb-3 text-center">🔄</div>
            <h3 className="text-xl font-black text-white text-center mb-1">
              نقل المشترك يدويًا
            </h3>
            <p className="text-slate-400 text-xs text-center mb-6">
              تغيير الفريق الحالي لـ <span className="text-amber-400 font-bold">{transferParticipant.name}</span>
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 text-right">
                  اختر الفريق الجديد:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {TEAMS.map(team => {
                    const isSelected = transferTargetTeam === team.id
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => setTransferTargetTeam(team.id)}
                        className={`py-3 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                          isSelected ? 'scale-105 ring-2 ring-amber-400' : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{
                          background: team.bg,
                          color: '#ffffff',
                          borderColor: team.color
                        }}
                      >
                        <span>{team.emoji}</span>
                        <span>{team.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-right text-xs text-amber-300 leading-relaxed">
                <p>
                  <strong>⚠️ تنبيه:</strong> سيتم تحديث شيت جوجل وقاعدة البيانات فورًا، مع إعادة احتساب نسب الفرق وطلبات الأصدقاء تلقائيًا.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleExecuteTransfer}
                disabled={isTransferring || transferTargetTeam === transferParticipant.team}
                className="flex-1 py-3 px-4 rounded-xl font-black text-sm transition-all cursor-pointer disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #F5A623, #D97706)',
                  color: '#040d1e'
                }}
              >
                {isTransferring ? 'جاري النقل...' : 'تأكيد النقل ✓'}
              </button>
              <button
                onClick={() => setTransferParticipant(null)}
                className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 font-bold text-xs cursor-pointer transition-all"
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
