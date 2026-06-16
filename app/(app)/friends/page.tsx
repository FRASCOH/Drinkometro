'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/lib/context';
import type { Profile } from '@/lib/utils';
import Link from 'next/link';

export default function FriendsPage() {
  const { user } = useApp();
  const [tab, setTab] = useState<'friends' | 'requests'>('friends');
  const [friends, setFriends] = useState<(Profile & { friendship_id: string })[]>([]);
  const [requests, setRequests] = useState<(Profile & { friendship_id: string })[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      loadFriends();
      loadRequests();
      loadSuggestions();
    }
  }, [user]);

  const loadFriends = async () => {
    try {
      const { data } = await supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, profiles!friendships_addressee_id_fkey(*)')
        .eq('requester_id', user.id)
        .eq('status', 'accepted');

      const { data: data2 } = await supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, profiles!friendships_requester_id_fkey(*)')
        .eq('addressee_id', user.id)
        .eq('status', 'accepted');

      const allFriends: any[] = [];
      data?.forEach((f: any) => {
        if (f.profiles) allFriends.push({ ...f.profiles, friendship_id: f.id });
      });
      data2?.forEach((f: any) => {
        if (f.profiles) allFriends.push({ ...f.profiles, friendship_id: f.id });
      });

      setFriends(allFriends);
    } catch (e) {
      console.error('Error loading friends:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    try {
      const { data } = await supabase
        .from('friendships')
        .select('id, requester_id, profiles!friendships_requester_id_fkey(*)')
        .eq('addressee_id', user.id)
        .eq('status', 'pending');

      const reqs = data?.map((r: any) => ({ ...r.profiles, friendship_id: r.id })) || [];
      setRequests(reqs);
    } catch (e) {
      console.error('Error loading requests:', e);
    }
  };

  const loadSuggestions = async () => {
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id)
        .limit(30);

      const { data: friendships } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      const friendIds = new Set(
        friendships?.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id) || []
      );

      const filtered = profiles?.filter(p => !friendIds.has(p.id)).slice(0, 5) || [];
      setSuggestions(filtered);
    } catch (e) {
      console.error('Error loading suggestions:', e);
    }
  };

  const searchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .neq('id', user.id)
      .limit(10);

    setSearchResults(data || []);
  };

  const sendRequest = async (friendId: string) => {
    await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: friendId,
    });
    setSearchResults(prev => prev.filter(u => u.id !== friendId));
    setSuggestions(prev => prev.filter(u => u.id !== friendId));
  };

  const acceptRequest = async (friendshipId: string) => {
    await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);
    loadFriends();
    loadRequests();
  };

  const declineRequest = async (friendshipId: string) => {
    await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    loadRequests();
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Amici</h1>
          <div className="page-header-sub">{friends.length} amici</div>
        </div>
      </div>

      {/* Search */}
      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Cerca utenti per username..."
          value={searchQuery}
          onChange={(e) => searchUsers(e.target.value)}
        />
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="section animate-fade-in">
          <div className="section-title">🔎 Risultati della ricerca</div>
          <div className="glass-card-flat">
            {searchResults.map((u) => (
              <div key={u.id} className="friend-item">
                {u.avatar_url ? (
                  <img src={u.avatar_url} className="avatar avatar-md" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                ) : (
                  <div className="avatar-placeholder avatar-md">
                    {u.display_name?.[0]?.toUpperCase() || u.username[0].toUpperCase()}
                  </div>
                )}
                <div className="friend-info">
                  <h4>{u.display_name || u.username}</h4>
                  <span>@{u.username} · Lv.{u.level}</span>
                </div>
                <button className="glass-btn glass-btn-sm glass-btn-primary" onClick={() => sendRequest(u.id)}>
                  Aggiungi
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {!searchQuery && suggestions.length > 0 && (
        <div className="section animate-fade-in" style={{ marginBottom: 'var(--space-md)' }}>
          <div className="section-title">✨ Consigliati per te</div>
          <div className="glass-card-flat">
            {suggestions.map((u) => (
              <div key={u.id} className="friend-item">
                {u.avatar_url ? (
                  <img src={u.avatar_url} className="avatar avatar-md" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                ) : (
                  <div className="avatar-placeholder avatar-md">
                    {u.display_name?.[0]?.toUpperCase() || u.username[0].toUpperCase()}
                  </div>
                )}
                <div className="friend-info">
                  <h4>{u.display_name || u.username}</h4>
                  <span>@{u.username} · Lv.{u.level}</span>
                </div>
                <button className="glass-btn glass-btn-sm glass-btn-primary" onClick={() => sendRequest(u.id)}>
                  Aggiungi
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'friends' ? 'active' : ''}`} onClick={() => setTab('friends')}>
          I miei amici
        </button>
        <button className={`tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
          Richieste {requests.length > 0 && `(${requests.length})`}
        </button>
      </div>

      {tab === 'friends' ? (
        <div className="section">
          {loading ? (
            <div className="stagger">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ height: 60, marginBottom: 'var(--space-sm)' }} />
              ))}
            </div>
          ) : friends.length > 0 ? (
            <div className="glass-card-flat stagger">
              {friends.map((friend) => (
                <Link key={friend.id} href={`/profile/${friend.id}`} className="friend-item">
                  {friend.avatar_url ? (
                    <img src={friend.avatar_url} className="avatar avatar-md" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                  ) : (
                    <div className="avatar-placeholder avatar-md">
                      {friend.display_name?.[0]?.toUpperCase() || friend.username[0].toUpperCase()}
                    </div>
                  )}
                  <div className="friend-info">
                    <h4>{friend.display_name || friend.username}</h4>
                    <span>@{friend.username} · Lv.{friend.level} · {friend.total_drinks} drink</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <div className="empty-state-title">Nessun amico ancora</div>
              <div className="empty-state-text">Cerca amici per username per iniziare!</div>
            </div>
          )}
        </div>
      ) : (
        <div className="section">
          {requests.length > 0 ? (
            <div className="glass-card-flat stagger">
              {requests.map((req) => (
                <div key={req.id} className="friend-item">
                  {req.avatar_url ? (
                    <img src={req.avatar_url} className="avatar avatar-md" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                  ) : (
                    <div className="avatar-placeholder avatar-md">
                      {req.display_name?.[0]?.toUpperCase() || req.username[0].toUpperCase()}
                    </div>
                  )}
                  <div className="friend-info">
                    <h4>{req.display_name || req.username}</h4>
                    <span>@{req.username}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                    <button className="glass-btn glass-btn-sm glass-btn-primary" onClick={() => acceptRequest(req.friendship_id)}>
                      ✓
                    </button>
                    <button className="glass-btn glass-btn-sm" onClick={() => declineRequest(req.friendship_id)}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📬</div>
              <div className="empty-state-title">Nessuna richiesta</div>
              <div className="empty-state-text">Le richieste di amicizia appariranno qui</div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
