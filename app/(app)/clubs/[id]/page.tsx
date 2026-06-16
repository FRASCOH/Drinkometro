'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/lib/context';
import type { Profile, Challenge } from '@/lib/utils';
import { formatCurrency, getLevel } from '@/lib/utils';
import Link from 'next/link';

export default function ClubDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useApp();
  const [club, setClub] = useState<any>(null);
  const [members, setMembers] = useState<(Profile & { role: string })[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [tab, setTab] = useState<'leaderboard' | 'challenges' | 'members'>('leaderboard');
  const [loading, setLoading] = useState(true);
  const [showNewChallenge, setShowNewChallenge] = useState(false);
  const [challengeForm, setChallengeForm] = useState({
    title: '', description: '', challenge_type: 'most_drinks', target_value: 10,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friendsList, setFriendsList] = useState<Profile[]>([]);
  const [inviteSearch, setInviteSearch] = useState('');
  const supabase = createClient();

  useEffect(() => {
    loadClub();
    loadMembers();
    loadChallenges();
  }, [id]);

  const loadClub = async () => {
    const { data } = await supabase.from('clubs').select('*').eq('id', id).single();
    setClub(data);
    setLoading(false);
  };

  const loadMembers = async () => {
    const { data } = await supabase
      .from('club_members')
      .select('role, profiles(*)')
      .eq('club_id', id);
    
    const membersList = data?.map((m: any) => ({ ...m.profiles, role: m.role })) || [];
    // Sort by XP for leaderboard
    membersList.sort((a: any, b: any) => (b.xp || 0) - (a.xp || 0));
    setMembers(membersList);
  };

  const loadChallenges = async () => {
    const { data } = await supabase
      .from('challenges')
      .select('*')
      .eq('club_id', id)
      .order('created_at', { ascending: false });
    setChallenges(data || []);
  };

  const createChallenge = async () => {
    await supabase.from('challenges').insert({
      club_id: id,
      ...challengeForm,
      start_date: new Date(challengeForm.start_date).toISOString(),
      end_date: new Date(challengeForm.end_date).toISOString(),
      created_by: user.id,
    });
    setShowNewChallenge(false);
    loadChallenges();
  };

  const loadFriendsToInvite = async () => {
    try {
      const { data: f1 } = await supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, profiles!friendships_addressee_id_fkey(*)')
        .eq('requester_id', user.id)
        .eq('status', 'accepted');

      const { data: f2 } = await supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, profiles!friendships_requester_id_fkey(*)')
        .eq('addressee_id', user.id)
        .eq('status', 'accepted');

      const allFriends: any[] = [];
      f1?.forEach((f: any) => { if (f.profiles) allFriends.push(f.profiles); });
      f2?.forEach((f: any) => { if (f.profiles) allFriends.push(f.profiles); });

      const memberIds = new Set(members.map(m => m.id));
      const filtered = allFriends.filter(f => !memberIds.has(f.id));
      setFriendsList(filtered);
    } catch (e) {
      console.error('Error loading friends to invite:', e);
    }
  };

  const openInviteModal = () => {
    setShowInviteModal(true);
    setInviteSearch('');
    loadFriendsToInvite();
  };

  const handleAddMember = async (friendId: string) => {
    const { error } = await supabase.from('club_members').insert({
      club_id: id,
      user_id: friendId,
      role: 'member',
    });

    if (!error) {
      setFriendsList(prev => prev.filter(f => f.id !== friendId));
      loadMembers();
    }
  };

  const getRankStyle = (index: number) => {
    if (index === 0) return 'gold';
    if (index === 1) return 'silver';
    if (index === 2) return 'bronze';
    return 'default';
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-xl)' }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  return (
    <>
      {/* Club Header */}
      <div className="page-header">
        <div>
          <Link href="/clubs" style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
            ← Club
          </Link>
          <h1>{club?.name || 'Club'}</h1>
          <div className="page-header-sub">{members.length} membri</div>
        </div>
        <button className="glass-btn glass-btn-sm" onClick={openInviteModal}>
          ➕ Invita
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'leaderboard' ? 'active' : ''}`} onClick={() => setTab('leaderboard')}>
          🏆 Classifica
        </button>
        <button className={`tab ${tab === 'challenges' ? 'active' : ''}`} onClick={() => setTab('challenges')}>
          🎯 Sfide
        </button>
        <button className={`tab ${tab === 'members' ? 'active' : ''}`} onClick={() => setTab('members')}>
          👥 Membri
        </button>
      </div>

      {/* Leaderboard Tab */}
      {tab === 'leaderboard' && (
        <div className="section">
          <div className="glass-card-flat">
            {members.map((member, i) => (
              <div key={member.id} className="leaderboard-item animate-slide-in" style={{ animationDelay: `${i * 60}ms` }}>
                <div className={`leaderboard-rank ${getRankStyle(i)}`}>
                  {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                </div>
                {member.avatar_url ? (
                  <img src={member.avatar_url} className="avatar avatar-md" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                ) : (
                  <div className="avatar-placeholder avatar-md">
                    {member.display_name?.[0]?.toUpperCase() || member.username?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="leaderboard-info">
                  <h4>{member.display_name || member.username}</h4>
                  <span>Lv.{member.level} · {member.total_drinks} drink</span>
                </div>
                <div className="leaderboard-score">{member.xp}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Challenges Tab */}
      {tab === 'challenges' && (
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-md)' }}>
            <button className="glass-btn glass-btn-sm glass-btn-primary" onClick={() => setShowNewChallenge(true)}>
              + Nuova Sfida
            </button>
          </div>

          {showNewChallenge && (
            <div className="challenge-card animate-fade-in-up" style={{ marginBottom: 'var(--space-lg)' }}>
              <div className="section-title">🎯 Nuova Sfida</div>
              <div className="glass-input-wrapper">
                <label>Titolo</label>
                <input className="glass-input" placeholder="Es. Chi beve di più questa settimana?"
                  value={challengeForm.title} onChange={e => setChallengeForm({...challengeForm, title: e.target.value})} />
              </div>
              <div className="glass-input-wrapper">
                <label>Tipo</label>
                <select className="glass-select" value={challengeForm.challenge_type}
                  onChange={e => setChallengeForm({...challengeForm, challenge_type: e.target.value})}>
                  <option value="most_drinks">🍹 Chi beve di più</option>
                  <option value="most_types">🎨 Chi prova più tipi</option>
                  <option value="most_locations">📍 Chi visita più locali</option>
                  <option value="cheapest_night">💸 Chi spende meno</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <div className="glass-input-wrapper" style={{ flex: 1 }}>
                  <label>Inizio</label>
                  <input type="date" className="glass-input" value={challengeForm.start_date}
                    onChange={e => setChallengeForm({...challengeForm, start_date: e.target.value})} />
                </div>
                <div className="glass-input-wrapper" style={{ flex: 1 }}>
                  <label>Fine</label>
                  <input type="date" className="glass-input" value={challengeForm.end_date}
                    onChange={e => setChallengeForm({...challengeForm, end_date: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button className="glass-btn glass-btn-primary glass-btn-full" onClick={createChallenge}>
                  🎯 Crea Sfida
                </button>
                <button className="glass-btn" onClick={() => setShowNewChallenge(false)}>Annulla</button>
              </div>
            </div>
          )}

          {challenges.length > 0 ? (
            <div className="stagger">
              {challenges.map(ch => {
                const isActive = new Date(ch.end_date) > new Date();
                return (
                  <div key={ch.id} className="challenge-card">
                    <div className="challenge-card-header">
                      <div className="challenge-card-title">{ch.title || ch.challenge_type}</div>
                      <span className={`badge ${isActive ? '' : 'badge-secondary'}`}>
                        {isActive ? '🟢 Attiva' : '⏹ Terminata'}
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
                      {ch.challenge_type === 'most_drinks' ? '🍹 Chi beve di più' :
                       ch.challenge_type === 'most_types' ? '🎨 Chi prova più tipi' :
                       ch.challenge_type === 'most_locations' ? '📍 Chi visita più locali' : '💸 Chi spende meno'}
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                      {new Date(ch.start_date).toLocaleDateString('it-IT')} → {new Date(ch.end_date).toLocaleDateString('it-IT')}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🎯</div>
              <div className="empty-state-title">Nessuna sfida</div>
              <div className="empty-state-text">Crea la prima sfida per il tuo club!</div>
            </div>
          )}
        </div>
      )}

      {/* Members Tab */}
      {tab === 'members' && (
        <div className="section">
          <div className="glass-card-flat stagger">
            {members.map(member => (
              <Link key={member.id} href={`/profile/${member.id}`} className="friend-item">
                {member.avatar_url ? (
                  <img src={member.avatar_url} className="avatar avatar-md" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                ) : (
                  <div className="avatar-placeholder avatar-md">
                    {member.display_name?.[0]?.toUpperCase() || member.username?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="friend-info">
                  <h4>{member.display_name || member.username}</h4>
                  <span>@{member.username} · {member.role === 'admin' ? '👑 Admin' : 'Membro'}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal Overlay */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: 'var(--space-md)'
        }}>
          <div className="glass-card animate-scale-up" onClick={(e) => e.stopPropagation()} style={{
            width: '100%', maxWidth: '450px', padding: 'var(--space-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <h3 style={{ margin: 0 }}>Invita Amici</h3>
              <button className="glass-btn glass-btn-sm" onClick={() => setShowInviteModal(false)} style={{ minWidth: 'auto', padding: 'var(--space-xs) var(--space-sm)' }}>✕</button>
            </div>
            
            <div className="search-bar" style={{ margin: 'var(--space-md) 0' }}>
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Cerca tra i tuoi amici..."
                value={inviteSearch}
                onChange={(e) => setInviteSearch(e.target.value)}
              />
            </div>
            
            <div className="invite-list" style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {friendsList.filter(f => 
                (f.display_name || '').toLowerCase().includes(inviteSearch.toLowerCase()) || 
                f.username.toLowerCase().includes(inviteSearch.toLowerCase())
              ).length > 0 ? (
                friendsList.filter(f => 
                  (f.display_name || '').toLowerCase().includes(inviteSearch.toLowerCase()) || 
                  f.username.toLowerCase().includes(inviteSearch.toLowerCase())
                ).map((friend) => (
                  <div key={friend.id} className="friend-item" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 'var(--space-xs)' }}>
                    {friend.avatar_url ? (
                      <img src={friend.avatar_url} className="avatar avatar-md" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                    ) : (
                      <div className="avatar-placeholder avatar-md" style={{ width: '40px', height: '40px' }}>
                        {friend.display_name?.[0]?.toUpperCase() || friend.username[0].toUpperCase()}
                      </div>
                    )}
                    <div className="friend-info" style={{ flex: 1, marginLeft: 'var(--space-sm)' }}>
                      <h4 style={{ margin: 0 }}>{friend.display_name || friend.username}</h4>
                      <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>@{friend.username}</span>
                    </div>
                    <button className="glass-btn glass-btn-sm glass-btn-primary" onClick={() => handleAddMember(friend.id)}>
                      Invita
                    </button>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: 'var(--space-lg) 0', color: 'var(--text-muted)' }}>
                  Nessun amico da invitare
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
