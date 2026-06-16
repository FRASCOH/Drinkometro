'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/lib/context';
import type { Club } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ClubsPage() {
  const { user } = useApp();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newClubName, setNewClubName] = useState('');
  const [newClubDesc, setNewClubDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (user) loadClubs();
  }, [user]);

  const loadClubs = async () => {
    try {
      // Get clubs where user is a member
      const { data: memberships } = await supabase
        .from('club_members')
        .select('club_id')
        .eq('user_id', user.id);

      if (memberships && memberships.length > 0) {
        const clubIds = memberships.map(m => m.club_id);
        const { data } = await supabase
          .from('clubs')
          .select('*')
          .in('id', clubIds);
        
        // Count members for each club
        if (data) {
          const clubsWithCount = await Promise.all(data.map(async (club) => {
            const { count } = await supabase
              .from('club_members')
              .select('*', { count: 'exact', head: true })
              .eq('club_id', club.id);
            return { ...club, members_count: count || 0 };
          }));
          setClubs(clubsWithCount);
        }
      }
    } catch (e) {
      console.error('Error loading clubs:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClub = async () => {
    if (!newClubName.trim()) return;
    setCreating(true);

    try {
      const { data: club, error } = await supabase
        .from('clubs')
        .insert({
          name: newClubName,
          description: newClubDesc || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add creator as admin member
      await supabase.from('club_members').insert({
        club_id: club.id,
        user_id: user.id,
        role: 'admin',
      });

      // Award XP for creating club
      await supabase
        .from('profiles')
        .update({ xp: (await supabase.from('profiles').select('xp').eq('id', user.id).single()).data?.xp + 30 })
        .eq('id', user.id);

      setShowCreate(false);
      setNewClubName('');
      setNewClubDesc('');
      router.push(`/clubs/${club.id}`);
    } catch (e) {
      console.error('Error creating club:', e);
    } finally {
      setCreating(false);
    }
  };

  const clubEmojis = ['🏆', '🎯', '🔥', '⚡', '🌟', '💎', '🎪', '🎲'];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Club</h1>
          <div className="page-header-sub">I tuoi gruppi</div>
        </div>
        <button className="glass-btn glass-btn-sm glass-btn-primary" onClick={() => setShowCreate(true)}>
          + Crea
        </button>
      </div>

      {/* Create Club Modal */}
      {showCreate && (
        <div className="section animate-fade-in-up">
          <div className="glass-card">
            <div className="section-title">🏆 Crea un nuovo Club</div>
            <div className="glass-input-wrapper">
              <label htmlFor="club-name">Nome del club</label>
              <input
                id="club-name"
                type="text"
                className="glass-input"
                placeholder="Es. I Bevitori, Cocktail Lovers..."
                value={newClubName}
                onChange={(e) => setNewClubName(e.target.value)}
              />
            </div>
            <div className="glass-input-wrapper">
              <label htmlFor="club-desc">Descrizione (opzionale)</label>
              <input
                id="club-desc"
                type="text"
                className="glass-input"
                placeholder="Descrivi il tuo club..."
                value={newClubDesc}
                onChange={(e) => setNewClubDesc(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className="glass-btn glass-btn-primary glass-btn-full" onClick={handleCreateClub} disabled={creating}>
                {creating ? '⏳ Creazione...' : '🏆 Crea Club'}
              </button>
              <button className="glass-btn" onClick={() => setShowCreate(false)}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Club List */}
      <div className="section">
        {loading ? (
          <div className="stagger">
            {[1, 2].map(i => (
              <div key={i} className="skeleton" style={{ height: 80, marginBottom: 'var(--space-md)' }} />
            ))}
          </div>
        ) : clubs.length > 0 ? (
          <div className="stagger">
            {clubs.map((club, i) => (
              <Link key={club.id} href={`/clubs/${club.id}`}>
                <div className="club-card">
                  <div className="club-card-avatar">
                    {clubEmojis[i % clubEmojis.length]}
                  </div>
                  <div className="club-card-info">
                    <h3>{club.name}</h3>
                    <span>
                      {club.members_count || 0} membri
                      {club.description && ` · ${club.description}`}
                    </span>
                  </div>
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🏆</div>
            <div className="empty-state-title">Nessun club ancora</div>
            <div className="empty-state-text">Crea il tuo primo club e invita i tuoi amici!</div>
          </div>
        )}
      </div>
    </>
  );
}
