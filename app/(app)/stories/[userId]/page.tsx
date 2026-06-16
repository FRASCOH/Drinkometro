'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/lib/context';
import type { Story, Profile } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function StoryViewerPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const { user } = useApp();
  const [stories, setStories] = useState<Story[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [storyUser, setStoryUser] = useState<Profile | null>(null);
  const [paused, setPaused] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const STORY_DURATION = 5000; // 5 seconds

  useEffect(() => {
    loadStories();
  }, [userId]);

  useEffect(() => {
    if (stories.length === 0 || paused) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev + (100 / (STORY_DURATION / 50));
        if (next >= 100) {
          goNext();
          return 0;
        }
        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [currentIndex, stories.length, paused]);

  useEffect(() => {
    // Mark as viewed
    if (stories[currentIndex] && user) {
      supabase.from('story_views').upsert(
        { story_id: stories[currentIndex].id, viewer_id: user.id },
        { onConflict: 'story_id,viewer_id' }
      ).then(() => {});
    }
  }, [currentIndex]);

  const loadStories = async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setStoryUser(profile);

    const { data } = await supabase
      .from('stories')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });

    setStories(data || []);
  };

  const goNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      router.back();
    }
  }, [currentIndex, stories.length, router]);

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    }
  };

  const handleTap = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) {
      goPrev();
    } else {
      goNext();
    }
  };

  const handleDeleteStory = async () => {
    const currentStory = stories[currentIndex];
    if (!currentStory || !confirm('Sei sicuro di voler eliminare questa storia?')) return;

    try {
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', currentStory.id);

      if (error) throw error;

      const updatedStories = stories.filter((_, i) => i !== currentIndex);
      if (updatedStories.length === 0) {
        router.back();
      } else {
        setStories(updatedStories);
        setCurrentIndex(prev => Math.min(prev, updatedStories.length - 1));
        setProgress(0);
      }
    } catch (e) {
      console.error('Error deleting story:', e);
      alert('Errore durante l\'eliminazione della storia.');
    }
  };

  const sendReaction = async (emoji: string) => {
    if (!stories[currentIndex]) return;
    await supabase.from('story_reactions').insert({
      story_id: stories[currentIndex].id,
      user_id: user.id,
      emoji,
    });
  };

  if (stories.length === 0) {
    return (
      <div className="story-viewer" onClick={() => router.back()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)' }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  const currentStory = stories[currentIndex];

  return (
    <div className="story-viewer">
      {/* Progress bars */}
      <div className="story-progress-bar">
        {stories.map((_, i) => (
          <div key={i} className="story-progress-segment">
            <div
              className="story-progress-fill"
              style={{
                width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%',
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="story-viewer-header">
        {storyUser?.avatar_url ? (
          <img src={storyUser.avatar_url} className="avatar avatar-sm" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} alt="" />
        ) : (
          <div className="avatar-placeholder avatar-sm" style={{ width: 36, height: 36, fontSize: '0.9rem' }}>
            {storyUser?.display_name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>
            {storyUser?.display_name || storyUser?.username}
          </div>
        </div>
        {storyUser?.id === user?.id && (
          <button 
            onClick={handleDeleteStory} 
            style={{ color: 'var(--accent-danger)', fontSize: '1.2rem', padding: 8, marginRight: 8, background: 'none', border: 'none', cursor: 'pointer' }}
            title="Elimina storia"
          >
            🗑️
          </button>
        )}
        <button onClick={() => router.back()} style={{ color: 'white', fontSize: '1.2rem', padding: 8, background: 'none', border: 'none', cursor: 'pointer' }}>
          ✕
        </button>
      </div>

      {/* Media */}
      <div
        className="story-viewer-media"
        onClick={handleTap}
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {currentStory.media_type === 'video' ? (
          <video
            src={currentStory.media_url}
            autoPlay
            playsInline
            muted
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        ) : (
          <img
            src={currentStory.media_url}
            alt="Story"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        )}

        {/* Caption Overlay */}
        {currentStory.caption && (
          <div 
            style={{
              position: 'absolute',
              bottom: '15%',
              left: '10%',
              right: '10%',
              textAlign: 'center',
              color: (currentStory as any).caption_color === 'black' ? '#000000' : '#ffffff',
              fontSize: '1.4rem',
              fontWeight: 800,
              textShadow: (currentStory as any).caption_color === 'black'
                ? '0 0 10px rgba(255, 255, 255, 0.95), 0 0 3px rgba(255, 255, 255, 0.8)'
                : '0 0 10px rgba(0, 0, 0, 0.95), 0 0 3px rgba(0, 0, 0, 0.8)',
              padding: '8px 16px',
              pointerEvents: 'none',
              wordWrap: 'break-word',
              zIndex: 10
            }}
          >
            {currentStory.caption}
          </div>
        )}
      </div>

      {/* Footer — Reactions */}
      <div className="story-viewer-footer">
        {['🔥', '😍', '😂', '😮', '👏', '💯'].map(emoji => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            style={{
              fontSize: '1.5rem',
              padding: '8px 12px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              transition: 'transform 0.2s',
            }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(1.3)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
