'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/lib/context';
import { timeAgo, getDrinkEmoji, getMoodEmoji, formatCurrency } from '@/lib/utils';
import type { Drink, Story, Profile } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { user, profile } = useApp();
  const [drinks, setDrinks] = useState<any[]>([]);
  const [stories, setStories] = useState<{ user_id: string; profiles: Profile; stories: Story[] }[]>([]);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeCommentsDrinkId, setActiveCommentsDrinkId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      loadFeed();
      loadStories();
    }
  }, [user]);

  const loadFeed = async () => {
    try {
      const { data } = await supabase
        .from('drinks')
        .select('*, profiles(*), drink_reactions(*), drink_comments(*, profiles(*))')
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
      const { data: storiesData } = await supabase
        .from('stories')
        .select('*, profiles(*)')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (storiesData && user) {
        const { data: userViews } = await supabase
          .from('story_views')
          .select('story_id')
          .eq('viewer_id', user.id);

        const viewedSet = new Set<string>(userViews?.map(v => v.story_id) || []);
        setViewedStoryIds(viewedSet);

        // Group by user
        const grouped = storiesData.reduce((acc: any, story: any) => {
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
    if (!user) return;

    const drink = drinks.find(d => d.id === drinkId);
    const existingReaction = drink?.drink_reactions?.find((r: any) => r.user_id === user.id);

    try {
      if (existingReaction) {
        await supabase
          .from('drink_reactions')
          .delete()
          .eq('id', existingReaction.id);

        setDrinks(prev => prev.map(d => {
          if (d.id === drinkId) {
            return {
              ...d,
              drink_reactions: d.drink_reactions.filter((r: any) => r.user_id !== user.id)
            };
          }
          return d;
        }));
      } else {
        const { data, error } = await supabase
          .from('drink_reactions')
          .insert({
            drink_id: drinkId,
            user_id: user.id,
            emoji: '🔥',
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setDrinks(prev => prev.map(d => {
            if (d.id === drinkId) {
              return {
                ...d,
                drink_reactions: [...(d.drink_reactions || []), data]
              };
            }
            return d;
          }));
        }
      }
    } catch (e) {
      console.error('Error processing reaction:', e);
    }
  };

  const handleAddComment = async (drinkId: string) => {
    if (!commentText.trim() || !user) return;

    try {
      const { data, error } = await supabase
        .from('drink_comments')
        .insert({
          drink_id: drinkId,
          user_id: user.id,
          content: commentText.trim()
        })
        .select('*, profiles(*)')
        .single();

      if (error) throw error;
      if (data) {
        setDrinks(prev => prev.map(d => {
          if (d.id === drinkId) {
            return {
              ...d,
              drink_comments: [...(d.drink_comments || []), data]
            };
          }
          return d;
        }));
        setCommentText('');
      }
    } catch (e) {
      console.error('Error adding comment:', e);
    }
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

  const handleDeleteDrink = async (drinkId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo drink?')) return;

    try {
      const { error } = await supabase
        .from('drinks')
        .delete()
        .eq('id', drinkId);

      if (error) throw error;
      setDrinks(prev => prev.filter(d => d.id !== drinkId));
    } catch (e) {
      console.error('Error deleting drink:', e);
      alert('Errore durante l\'eliminazione del drink.');
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
        {(() => {
          const myGroup = stories.find(s => s.user_id === user?.id);
          const myLastStory = myGroup?.stories?.[0];
          const myHasUnseen = myGroup ? myGroup.stories.some((s: any) => !viewedStoryIds.has(s.id)) : false;

          return (
            <Link href={myLastStory ? `/stories/${user?.id}` : '/add-drink'} className="story-item">
              <div style={{ position: 'relative' }}>
                <div className={`avatar-story-ring ${myLastStory ? (myHasUnseen ? 'unseen' : 'seen') : ''}`}>
                  <div className="avatar-placeholder avatar-lg" style={{ overflow: 'hidden', padding: 0 }}>
                    {myLastStory ? (
                      myLastStory.media_type === 'video' ? (
                        <video src={myLastStory.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted />
                      ) : (
                        <img src={myLastStory.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Tu" />
                      )
                    ) : (
                      profile?.display_name?.[0]?.toUpperCase() || '?'
                    )}
                  </div>
                </div>
                {!myLastStory && <div className="story-add-btn">+</div>}
              </div>
              <span>La tua storia</span>
            </Link>
          );
        })()}

        {/* Friends' stories */}
        {stories.filter(group => group.user_id !== user?.id).map((group) => {
          const lastStory = group.stories[0];
          const hasUnseen = group.stories.some((story: any) => !viewedStoryIds.has(story.id));

          return (
            <Link key={group.user_id} href={`/stories/${group.user_id}`} className="story-item">
              <div className={`avatar-story-ring ${hasUnseen ? 'unseen' : 'seen'}`}>
                <div className="avatar-placeholder avatar-lg" style={{ overflow: 'hidden', padding: 0 }}>
                  {lastStory.media_type === 'video' ? (
                    <video src={lastStory.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted />
                  ) : (
                    <img src={lastStory.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  )}
                </div>
              </div>
              <span>{group.profiles?.display_name || group.profiles?.username}</span>
            </Link>
          );
        })}

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
                  {drink.user_id === user?.id && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => router.push(`/add-drink?edit=${drink.id}`)} 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '4px' }} 
                        title="Modifica"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleDeleteDrink(drink.id)} 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '4px' }} 
                        title="Elimina"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
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
                      className={drink.drink_reactions?.some((r: any) => r.user_id === user?.id) ? 'active' : ''}
                    >
                      🔥 {drink.drink_reactions?.length || 0}
                    </button>
                    <button 
                      onClick={() => setActiveCommentsDrinkId(activeCommentsDrinkId === drink.id ? null : drink.id)}
                      className={activeCommentsDrinkId === drink.id ? 'active' : ''}
                    >
                      💬 {drink.drink_comments?.length || 0}
                    </button>
                  </div>

                  {/* Comments Drawer */}
                  {activeCommentsDrinkId === drink.id && (
                    <div style={{ marginTop: 'var(--space-md)', borderTop: '1px solid var(--glass-border)', paddingTop: 'var(--space-md)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', maxHeight: '180px', overflowY: 'auto', marginBottom: 'var(--space-md)' }}>
                        {drink.drink_comments?.map((c: any) => (
                          <div key={c.id} style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start', fontSize: 'var(--font-sm)' }}>
                            <div className="avatar-placeholder avatar-sm" style={{ width: 28, height: 28, fontSize: '0.75rem', flexShrink: 0 }}>
                              {c.profiles?.display_name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div style={{ background: 'var(--glass-bg)', padding: '6px 12px', borderRadius: 'var(--radius-md)', flex: 1 }}>
                              <span style={{ fontWeight: 600, marginRight: 8 }}>{c.profiles?.display_name || c.profiles?.username}</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{c.content}</span>
                            </div>
                          </div>
                        ))}
                        {(!drink.drink_comments || drink.drink_comments.length === 0) && (
                          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)', textAlign: 'center', padding: '8px 0' }}>
                            Nessun commento. Sii il primo a commentare!
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          className="glass-input"
                          style={{ padding: '8px 12px', fontSize: 'var(--font-sm)', borderRadius: 'var(--radius-md)', flex: 1 }}
                          placeholder="Scrivi un commento..."
                          value={commentText}
                          onChange={e => setCommentText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddComment(drink.id); }}
                        />
                        <button 
                          onClick={() => handleAddComment(drink.id)} 
                          className="glass-btn glass-btn-primary" 
                          style={{ padding: '8px 16px', fontSize: 'var(--font-sm)', borderRadius: 'var(--radius-md)' }}
                        >
                          Invia
                        </button>
                      </div>
                    </div>
                  )}
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
