'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/lib/context';
import { getLevel, getDrinkEmoji, formatCurrency, CURRENCIES } from '@/lib/utils';
import type { Profile, Achievement } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProfilePage() {
  const { user, profile, setProfile, lang, setLang, currency, setCurrency } = useApp();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ display_name: '', bio: '', username: '' });
  const [showSettings, setShowSettings] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (user) loadAchievements();
  }, [user]);

  useEffect(() => {
    if (profile) {
      setEditForm({
        display_name: profile.display_name || '',
        bio: profile.bio || '',
        username: profile.username,
      });
    }
  }, [profile]);

  const loadAchievements = async () => {
    const { data: allAchievements } = await supabase.from('achievements').select('*');
    const { data: userAchievements } = await supabase
      .from('user_achievements')
      .select('achievement_id, earned_at')
      .eq('user_id', user.id);

    const earnedIds = new Set(userAchievements?.map(ua => ua.achievement_id) || []);
    const merged = allAchievements?.map(a => ({
      ...a,
      earned: earnedIds.has(a.id),
      earned_at: userAchievements?.find(ua => ua.achievement_id === a.id)?.earned_at,
    })) || [];

    setAchievements(merged);
  };

  const handleSaveProfile = async () => {
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: editForm.display_name,
        bio: editForm.bio,
      })
      .eq('id', user.id);

    if (!error && profile) {
      setProfile({
        ...profile,
        display_name: editForm.display_name,
        bio: editForm.bio,
      });
      setEditing(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!profile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-2xl)' }}>
        <div className="spinner" />
      </div>
    );
  }

  const levelInfo = getLevel(profile.xp);

  return (
    <>
      {/* Profile Header */}
      <div className="profile-header animate-fade-in-up">
        <div className="avatar-placeholder avatar-xl" style={{ margin: '0 auto var(--space-md)' }}>
          {profile.display_name?.[0]?.toUpperCase() || profile.username[0].toUpperCase()}
        </div>
        <div className="profile-name">{profile.display_name || profile.username}</div>
        <div className="profile-username">@{profile.username}</div>
        {profile.bio && <div className="profile-bio">{profile.bio}</div>}

        {/* Level Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
          <span className="badge badge-level">
            {levelInfo.emoji} Lv.{levelInfo.level} — {lang === 'it' ? levelInfo.name : levelInfo.nameEn}
          </span>
        </div>

        {/* XP Progress */}
        <div style={{ maxWidth: 240, margin: 'var(--space-md) auto 0', textAlign: 'center' }}>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${levelInfo.progress}%` }} />
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
            {profile.xp} XP · {levelInfo.xpForNext > 0 ? `${levelInfo.xpForNext} XP al prossimo livello` : 'Livello massimo!'}
          </div>
        </div>

        {/* Profile Stats */}
        <div className="profile-stats">
          <div className="profile-stat">
            <div className="profile-stat-value">{profile.total_drinks}</div>
            <div className="profile-stat-label">Drink</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-value">{formatCurrency(profile.total_spent, currency)}</div>
            <div className="profile-stat-label">Speso</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-value">{profile.streak_days}</div>
            <div className="profile-stat-label">🔥 Streak</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'center', marginTop: 'var(--space-lg)' }}>
          <button className="glass-btn glass-btn-sm" onClick={() => setEditing(true)}>
            ✏️ Modifica
          </button>
          <button className="glass-btn glass-btn-sm" onClick={() => setShowSettings(!showSettings)}>
            ⚙️ Impostazioni
          </button>
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="section animate-fade-in-up">
          <div className="glass-card">
            <div className="section-title">✏️ Modifica Profilo</div>
            <div className="glass-input-wrapper">
              <label>Nome visualizzato</label>
              <input className="glass-input" value={editForm.display_name}
                onChange={e => setEditForm({...editForm, display_name: e.target.value})} />
            </div>
            <div className="glass-input-wrapper">
              <label>Bio</label>
              <input className="glass-input" value={editForm.bio} placeholder="Racconta qualcosa di te..."
                onChange={e => setEditForm({...editForm, bio: e.target.value})} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className="glass-btn glass-btn-primary glass-btn-full" onClick={handleSaveProfile}>
                💾 Salva
              </button>
              <button className="glass-btn" onClick={() => setEditing(false)}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings */}
      {showSettings && (
        <div className="section animate-fade-in-up">
          <div className="glass-card">
            <div className="section-title">⚙️ Impostazioni</div>
            <div className="glass-input-wrapper">
              <label>🌐 Lingua</label>
              <select className="glass-select" value={lang} onChange={e => setLang(e.target.value as any)}>
                <option value="it">🇮🇹 Italiano</option>
                <option value="en">🇬🇧 English</option>
              </select>
            </div>
            <div className="glass-input-wrapper">
              <label>💱 Valuta predefinita</label>
              <select className="glass-select" value={currency} onChange={e => setCurrency(e.target.value)}>
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.symbol} {c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Achievements */}
      <div className="section">
        <div className="section-title">🏅 Achievement ({achievements.filter(a => a.earned).length}/{achievements.length})</div>
        <div className="achievement-grid stagger">
          {achievements.map(a => (
            <div key={a.id} className={`achievement-item ${!a.earned ? 'locked' : ''}`}>
              <span className="achievement-icon">{a.icon}</span>
              <span className="achievement-name">
                {lang === 'it' ? a.name : (a as any).name_en || a.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Logout */}
      <div className="section" style={{ paddingBottom: 'var(--space-2xl)' }}>
        <button className="glass-btn glass-btn-full" onClick={handleLogout}
          style={{ color: 'var(--accent-danger)' }}>
          🚪 Esci
        </button>
      </div>
    </>
  );
}
