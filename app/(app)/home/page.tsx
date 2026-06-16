'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/lib/context';
import { timeAgo, getDrinkEmoji, getMoodEmoji, formatCurrency } from '@/lib/utils';
import type { Drink, Story, Profile } from '@/lib/utils';
import Link from 'next/link';

export default function HomePage() {
  const { user, profile } = useApp();
  const [drinks, setDrinks] = useState<(Drink & { profiles: Profile })[]>([]);
  const [stories, setStories] = useState<{ user_id: string; profiles: Profile; stories: Story[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      loadFeed();
      loadStories();
    }
  }, [user]);

  const loadFeed = async () => {
    try {
      // Get own drinks + friends' drinks
      const { data } = await supabase
        .from('drinks')
        .select('*, profiles(*)')
        .order('created_at', { ascending: false })
        .limit(50);

      setDrinks((data as any) || []);
    } catch (e) {
      console.error('Error loading feed:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadStories = async () => {
    try {
      const { data } = await supabase
        .from('stories')
        .select('*, profiles(*)')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (data) {
        // Group by user
        const grouped = data.reduce((acc: any, story: any) => {
          const existing = acc.find((g: any) => g.user_id === story.user_id);
          if (existing) {
            existing.stories.push(story);
          } else {
            acc.push({
              user_id: story.user_id,
              profiles: story.profiles,
              stories: [story],
            });
          }
          return acc;
        }, []);
        setStories(grouped);
      }
    } catch (e) {
      console.error('Error loading stories:', e);
    }
  };

  const handleReaction = async (drinkId: string) => {
    await supabase.from('drink_reactions').upsert({
      drink_id: drinkId,
      user_id: user.id,
      emoji: '🔥',
    });
    // Optimistic update
    setDrinks(prev => prev.map(d => {
      if (d.id === drinkId) {
        return { ...d, user_reacted: !d.user_reacted };
      }
      return d;
    }));
  };

  const downloadMedia = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      console.error('Download failed:', e);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Drinkometro</h1>
          {profile && (
            <div className="page-header-sub">
              Ciao {profile.display_name || profile.username}! 👋
            </div>
          )}
        </div>
        {profile && (
          <div className="badge badge-level">
            Lv.{profile.level} · {profile.xp} XP
          </div>
        )}
      </div>

      {/* Stories Bar */}
      <div className="stories-bar">
        {/* Your story */}
        <Link href="/add-drink" className="story-item">
          <div style={{ position: 'relative' }}>
            <div className="avatar-placeholder avatar-lg" style={{ opacity: 0.6 }}>
              {profile?.display_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="story-add-btn">+</div>
          </div>
          <span>La tua storia</span>
        </Link>

        {/* Friends' stories */}
        {stories.map((group) => (
          <Link key={group.user_id} href={`/stories/${group.user_id}`} className="story-item">
            <div className="avatar-story-ring unseen">
              <div className="avatar-placeholder avatar-lg">
                {group.profiles?.display_name?.[0]?.toUpperCase() || '?'}
              </div>
            </div>
            <span>{group.profiles?.display_name || group.profiles?.username}</span>
          </Link>
        ))}

        {stories.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 var(--space-md)', color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
            Le storie dei tuoi amici appariranno qui
          </div>
        )}
      </div>

      {/* Feed */}
      <div className="section">
        <div className="section-title">📱 Feed</div>

        {loading ? (
          <div className="stagger">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 200, marginBottom: 'var(--space-md)' }} />
            ))}
          </div>
        ) : drinks.length > 0 ? (
          <div className="stagger">
            {drinks.map((drink) => (
              <div key={drink.id} className="drink-card animate-fade-in-up">
                {/* Card Header */}
                <div className="drink-card-header">
                  <div className="drink-card-user">
                    <div className="avatar-placeholder avatar-md">
                      {drink.profiles?.display_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="drink-card-user-info">
                      <h3>{drink.profiles?.display_name || drink.profiles?.username}</h3>
                      <span>{timeAgo(drink.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Media */}
                {drink.media_url && (
                  <div style={{ position: 'relative' }}>
                    {drink.media_type === 'video' ? (
                      <video
                        className="drink-card-media"
                        src={drink.media_url}
                        controls
                        playsInline
                        muted
                        preload="metadata"
                      />
                    ) : (
                      <img
                        className="drink-card-media"
                        src={drink.media_url}
                        alt={drink.drink_name || 'Drink'}
                        loading="lazy"
                      />
                    )}
                    {/* Download button */}
                    <button
                      className="download-btn"
                      style={{ position: 'absolute', bottom: 8, right: 8 }}
                      onClick={() => downloadMedia(drink.media_url!, `drinkometro_${drink.id}`)}
                    >
                      ⬇️ Scarica
                    </button>
                  </div>
                )}

                {/* Body */}
                <div className="drink-card-body">
                  <div className="drink-card-drink-info">
                    <span className="drink-emoji">{getDrinkEmoji(drink.drink_type)}</span>
                    <div>
                      <div className="drink-name">{drink.drink_name || drink.drink_type}</div>
                      <div className="drink-type">{drink.drink_type}</div>
                    </div>
                  </div>

                  <div className="drink-card-meta">
                    <div className="drink-card-meta-item">📍 {drink.location || 'Non specificato'}</div>
                    <div className="drink-card-meta-item">📏 {drink.quantity} {drink.quantity_unit}</div>
                    {drink.cost != null && (
                      <div className="drink-card-meta-item">💰 {formatCurrency(drink.cost, drink.currency)}</div>
                    )}
                  </div>

                  {drink.mood && (
                    <div className="drink-card-mood">
                      {getMoodEmoji(drink.mood)} {drink.mood}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="drink-card-actions">
                    <button
                      onClick={() => handleReaction(drink.id)}
                      className={drink.user_reacted ? 'active' : ''}
                    >
                      🔥 Reagisci
                    </button>
                    <button>💬 Commenta</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state animate-fade-in">
            <div className="empty-state-icon">🍹</div>
            <div className="empty-state-title">Nessun drink ancora</div>
            <div className="empty-state-text">
              Premi il pulsante + per registrare il tuo primo drink!
            </div>
          </div>
        )}
      </div>
    </>
  );
}
