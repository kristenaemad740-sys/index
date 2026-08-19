export type Page = 'home' | 'register' | 'dashboard'
export type RegisterView = 'form' | 'confirm' | 'loading' | 'success' | 'error' | 'closed' | 'already_registered'
export type Gender = 'male' | 'female'

export interface FormData {
  name: string
  phone: string
  gender: Gender | ''
  preference: 'yes' | 'no' | ''
  friendsCount: number
  friendNames: string[]
}

export interface Participant {
  id: string
  name: string
  phone: string
  gender: Gender
  wantsFriends: boolean
  friendsCount: number
  friendNames: string[]
  team: string
  registrationTime: string
  friendParticipantId?: string
}

export interface Team {
  id: string
  name: string
  color: string
  bg: string
  light: string
  emoji: string
  glowClass: string
}

export const TEAMS: Team[] = [
  { id: 'red',    name: 'الفريق الأحمر',      color: '#DC2626', bg: '#7f1d1d', light: '#fee2e2', emoji: '🔴', glowClass: 'team-red-glow'    },
  { id: 'green',  name: 'الفريق الأخضر',      color: '#16A34A', bg: '#14532d', light: '#dcfce7', emoji: '🟢', glowClass: 'team-green-glow'  },
  { id: 'yellow', name: 'الفريق الأصفر',      color: '#CA8A04', bg: '#713f12', light: '#fef9c3', emoji: '🟡', glowClass: 'team-yellow-glow' },
  { id: 'black',  name: 'الفريق الأسود',      color: '#374151', bg: '#111827', light: '#f3f4f6', emoji: '⚫', glowClass: 'team-black-glow'  },
  { id: 'blue',   name: 'الفريق الأزرق',      color: '#2563EB', bg: '#1e3a8a', light: '#dbeafe', emoji: '🔵', glowClass: 'team-blue-glow'   },
  { id: 'purple', name: 'الفريق البنفسجي',    color: '#7C3AED', bg: '#4c1d95', light: '#ede9fe', emoji: '🟣', glowClass: 'team-purple-glow' },
]

export function getTeamById(id: string): Team {
  return TEAMS.find(t => t.id === id) ?? TEAMS[0]
}

export interface RegistrationRequest {
  name: string;
  phone: string;
  gender: "male" | "female";
  wantsFriends: boolean;
  friendsCount: number;
  friendNames: string[];
}

// ── Dashboard Types ──────────────────────────────────────────────────────────
export type FriendRequestStatus =
  | 'SATISFIED'
  | 'PENDING'
  | 'MATCHED'
  | 'AMBIGUOUS'
  | 'UNRESOLVED'
  | 'UNSATISFIED'

export interface FriendRequestRecord {
  id: string
  requesterId: string
  requesterName: string
  requesterPhone: string
  requesterTeam: string
  requestedName: string
  matchedParticipant: Participant | null
  status: FriendRequestStatus
  score: number
  details?: string
}

export interface TeamStats {
  team: Team
  customName?: string
  members: Participant[]
  total: number
  males: number
  females: number
  malePct: number
  femalePct: number
  capacityPct: number
  balanceStatus: 'balanced' | 'slight_imbalance' | 'significant_imbalance'
  deltaFromGlobalRatio: number
}

export interface DashboardSummary {
  totalParticipants: number
  totalMales: number
  totalFemales: number
  malePct: number
  femalePct: number
  teamCount: number
  avgPerTeam: number
  teamStats: TeamStats[]
  totalFriendRequests: number
  satisfiedRequests: number
  pendingRequests: number
  matchedRequests: number
  ambiguousRequests: number
  unresolvedRequests: number
  unsatisfiedRequests: number
  friendSatisfactionRate: number
  recentRegistrations: Participant[]
  allFriendRequests: FriendRequestRecord[]
  pendingFriendsList: FriendRequestRecord[]
}
