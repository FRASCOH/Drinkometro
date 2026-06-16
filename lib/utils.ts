// Drink type definitions
export const DRINK_TYPES = [
  { id: 'beer', emoji: '🍺', color: '#fbbf24' },
  { id: 'cocktail', emoji: '🍸', color: '#8b5cf6' },
  { id: 'wine', emoji: '🍷', color: '#ef4444' },
  { id: 'shot', emoji: '🥃', color: '#f97316' },
  { id: 'spirit', emoji: '🥂', color: '#3b82f6' },
  { id: 'nonAlcoholic', emoji: '🧃', color: '#34d399' },
  { id: 'other', emoji: '✨', color: '#f472b6' },
] as const;

// Mood definitions
export const MOODS = [
  { id: 'euphoric', emoji: '🤩', color: '#fbbf24' },
  { id: 'happy', emoji: '😄', color: '#34d399' },
  { id: 'relaxed', emoji: '😎', color: '#3b82f6' },
  { id: 'tipsy', emoji: '🤪', color: '#8b5cf6' },
  { id: 'wild', emoji: '🥳', color: '#f472b6' },
  { id: 'sober', emoji: '😐', color: '#6b7280' },
  { id: 'tired', emoji: '😴', color: '#64748b' },
  { id: 'sick', emoji: '🤮', color: '#ef4444' },
] as const;

// Currency definitions
export const CURRENCIES = [
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
] as const;

// Level definitions
export const LEVELS: { level: number; name: string; nameEn: string; emoji: string; xpRequired: number }[] = [
  { level: 1, name: 'Principiante', nameEn: 'Beginner', emoji: '🍼', xpRequired: 0 },
  { level: 2, name: 'Curioso', nameEn: 'Curious', emoji: '🧐', xpRequired: 100 },
  { level: 3, name: 'Esploratore', nameEn: 'Explorer', emoji: '🗺', xpRequired: 300 },
  { level: 4, name: 'Intenditore', nameEn: 'Connoisseur', emoji: '🎩', xpRequired: 600 },
  { level: 5, name: 'Veterano', nameEn: 'Veteran', emoji: '🏆', xpRequired: 1000 },
  { level: 6, name: 'Leggenda', nameEn: 'Legend', emoji: '👑', xpRequired: 2000 },
];

// Achievement definitions
export const ACHIEVEMENTS = [
  { id: 'first_drink', icon: '🍺', criteriaType: 'total_drinks', threshold: 1, xpReward: 10 },
  { id: 'selfie_star', icon: '📸', criteriaType: 'stories_posted', threshold: 10, xpReward: 50 },
  { id: 'globe_trotter', icon: '🌍', criteriaType: 'unique_locations', threshold: 5, xpReward: 50 },
  { id: 'on_fire', icon: '🔥', criteriaType: 'streak_days', threshold: 7, xpReward: 100 },
  { id: 'champion', icon: '🎯', criteriaType: 'challenges_won', threshold: 1, xpReward: 50 },
  { id: 'mixologist', icon: '🍸', criteriaType: 'unique_cocktails', threshold: 10, xpReward: 50 },
  { id: 'saver', icon: '💸', criteriaType: 'cheap_night', threshold: 1, xpReward: 30 },
  { id: 'social_butterfly', icon: '🤝', criteriaType: 'friends_count', threshold: 10, xpReward: 50 },
  { id: 'founder', icon: '🏛', criteriaType: 'clubs_created', threshold: 1, xpReward: 30 },
  { id: 'ten_drinks', icon: '🔟', criteriaType: 'total_drinks', threshold: 10, xpReward: 30 },
  { id: 'fifty_drinks', icon: '💯', criteriaType: 'total_drinks', threshold: 50, xpReward: 100 },
  { id: 'party_animal', icon: '🎉', criteriaType: 'drinks_single_night', threshold: 5, xpReward: 30 },
] as const;

// Types
export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  xp: number;
  level: number;
  streak_days: number;
  total_drinks: number;
  total_spent: number;
  created_at: string;
}

export interface Drink {
  id: string;
  user_id: string;
  drink_type: string;
  drink_name: string | null;
  quantity: number;
  quantity_unit: string;
  cost: number | null;
  currency: string;
  location: string | null;
  location_lat: number | null;
  location_lng: number | null;
  mood: string | null;
  mood_emoji: string | null;
  media_url: string | null;
  media_type: string | null;
  notes: string | null;
  created_at: string;
  // Joined fields
  profiles?: Profile;
  reactions_count?: number;
  comments_count?: number;
  user_reacted?: boolean;
}

export interface Story {
  id: string;
  user_id: string;
  drink_id: string | null;
  media_url: string;
  media_type: string;
  caption: string | null;
  expires_at: string;
  created_at: string;
  profiles?: Profile;
  views_count?: number;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  profiles?: Profile;
}

export interface Club {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  members_count?: number;
}

export interface Challenge {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  challenge_type: string;
  target_value: number | null;
  start_date: string;
  end_date: string;
  created_by: string;
  created_at: string;
  participants_count?: number;
  user_progress?: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  criteria_type: string;
  threshold: number;
  xp_reward: number;
  earned?: boolean;
  earned_at?: string;
}

// Helper functions
export function getLevel(xp: number) {
  let currentLevel = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.xpRequired) {
      currentLevel = lvl;
    }
  }
  const nextLevel = LEVELS.find(l => l.level === currentLevel.level + 1);
  const xpForNext = nextLevel ? nextLevel.xpRequired - xp : 0;
  const progress = nextLevel
    ? ((xp - currentLevel.xpRequired) / (nextLevel.xpRequired - currentLevel.xpRequired)) * 100
    : 100;

  return { ...currentLevel, xpForNext, progress: Math.min(progress, 100) };
}

export function getDrinkEmoji(type: string): string {
  return DRINK_TYPES.find(d => d.id === type)?.emoji || '🍹';
}

export function getMoodEmoji(mood: string): string {
  return MOODS.find(m => m.id === mood)?.emoji || '😐';
}

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find(c => c.code === code)?.symbol || '€';
}

export function timeAgo(dateStr: string, lang: 'it' | 'en' = 'it'): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return lang === 'it' ? 'Adesso' : 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${lang === 'it' ? 'fa' : 'ago'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${lang === 'it' ? 'ore fa' : 'h ago'}`;
  const days = Math.floor(hours / 24);
  return `${days} ${lang === 'it' ? 'giorni fa' : 'd ago'}`;
}

export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${amount.toFixed(2)}`;
}
