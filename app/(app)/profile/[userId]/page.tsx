'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/lib/context';
import { getLevel, formatCurrency } from '@/lib/utils';
import type { Profile } from '@/lib/utils';
import Link from 'next/link';

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const { user, currency } = useApp();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadProfile();
    checkFriendship();
  }, [userId]);

  const loadProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data);
    setLoading(false);
  };

  const checkFriendship = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('friendships')
      .select('status')
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${user.id})`)
      .single();

    if (data) {
      if (data.status === 'accepted') setIsFriend(true);
      else if (data.status === 'pending') setPendingRequest(true);
    }
  };

  const sendRequest = async () => {
    await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: userId,
    });
    setPendingRequest(true);
  };

  if (loading || !profile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-2xl)' }}>
        <div className="spinner" />
      </div>
    );
  }

  const levelInfo = getLevel(profile.xp);

  return (
    <>
      <div className="page-header">
        <Link href="/friends" style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
          ← Indietro
        </Link>
      </div>

      <div className="profile-header animate-fade-in-up">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} className="avatar avatar-xl" style={{ margin: '0 auto var(--space-md)', display: 'block', width: '88px', height: '88px', borderRadius: '50%', objectFit: 'cover' }} alt="Avatar" />
        ) : (
          <div className="avatar-placeholder avatar-xl" style={{ margin: '0 auto var(--space-md)' }}>
            {profile.display_name?.[0]?.toUpperCase() || profile.username[0].toUpperCase()}
          </div>
        )}
        <div className="profile-name">{profile.display_name || profile.username}</div>
        <div className="profile-username">@{profile.username}</div>
        {profile.bio && <div className="profile-bio">{profile.bio}</div>}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
          <span className="badge badge-level">
            {levelInfo.emoji} Lv.{levelInfo.level}
          </span>
        </div>

        <div className="profile-stats">
          <div className="profile-stat">
            <div className="profile-stat-value">{profile.total_drinks}</div>
            <div className="profile-stat-label">Drink</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-value">{profile.streak_days}</div>
            <div className="profile-stat-label">🔥 Streak</div>
          </div>
        </div>

        {user?.id !== userId && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-lg)' }}>
            {isFriend ? (
              <span className="badge badge-success">✓ Amici</span>
            ) : pendingRequest ? (
              <span className="badge">⏳ In attesa</span>
            ) : (
              <button className="glass-btn glass-btn-primary" onClick={sendRequest}>
                ➕ Aggiungi amico
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
