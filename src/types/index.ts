export type Page = 'home' | 'register'
export type RegisterView = 'form' | 'confirm' | 'loading' | 'success' | 'error' | 'closed'
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
  { id: 'red',    name: 'الفريق الأحمر',  color: '#DC2626', bg: '#7f1d1d', light: '#fee2e2', emoji: '🔴', glowClass: 'team-red-glow'    },
  { id: 'green',  name: 'الفريق الأخضر',  color: '#16A34A', bg: '#14532d', light: '#dcfce7', emoji: '🟢', glowClass: 'team-green-glow'  },
  { id: 'yellow', name: 'الفريق الأصفر',  color: '#CA8A04', bg: '#713f12', light: '#fef9c3', emoji: '🟡', glowClass: 'team-yellow-glow' },
  { id: 'black',  name: 'الفريق الأسود',  color: '#374151', bg: '#111827', light: '#f3f4f6', emoji: '⚫', glowClass: 'team-black-glow'  },
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
