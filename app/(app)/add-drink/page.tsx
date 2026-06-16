'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/lib/context';
import { useRouter, useSearchParams } from 'next/navigation';
import { DRINK_TYPES, MOODS, CURRENCIES, getDrinkEmoji, getCurrencySymbol } from '@/lib/utils';

function AddDrinkContent() {
  const { user, currency } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get('edit');
  const supabase = createClient();

  const [drinkType, setDrinkType] = useState('');
  const [drinkName, setDrinkName] = useState('');
  const [quantity, setQuantity] = useState('330');
  const [quantityUnit, setQuantityUnit] = useState('ml');
  const [cost, setCost] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [location, setLocation] = useState('');
  const [mood, setMood] = useState('');
  const [moodEmoji, setMoodEmoji] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [existingMediaUrl, setExistingMediaUrl] = useState('');
  const [publishStory, setPublishStory] = useState(false);
  const [storyCaption, setStoryCaption] = useState('');
  const [captionColor, setCaptionColor] = useState('white');
  const [loading, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (editId && user) {
      loadDrinkToEdit(editId);
    }
  }, [editId, user]);

  const loadDrinkToEdit = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('drinks')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        if (data.user_id !== user?.id) {
          router.push('/home');
          return;
        }
        setDrinkType(data.drink_type);
        setDrinkName(data.drink_name || '');
        setQuantity(data.quantity.toString());
        setQuantityUnit(data.quantity_unit);
        setCost(data.cost ? data.cost.toString() : '');
        setSelectedCurrency(data.currency);
        setLocation(data.location || '');
        setMood(data.mood || '');
        setMoodEmoji(data.mood_emoji || '');
        if (data.media_url) {
          setExistingMediaUrl(data.media_url);
          setMediaPreview(data.media_url);
          setMediaType(data.media_type || 'image');
        }
      }
    } catch (e) {
      console.error('Error loading drink to edit:', e);
    }
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Compress image if needed
    if (file.type.startsWith('image/')) {
      compressImage(file).then(compressed => {
        setMediaFile(compressed);
        setMediaType('image');
        setMediaPreview(URL.createObjectURL(compressed));
      });
    } else if (file.type.startsWith('video/')) {
      setMediaFile(file);
      setMediaType('video');
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 800;
        let { width, height } = img;

        if (width > height && width > MAX_SIZE) {
          height = (height * MAX_SIZE) / width;
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width = (width * MAX_SIZE) / height;
          height = MAX_SIZE;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          resolve(new File([blob!], file.name, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.7);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 480 }, height: { ideal: 640 } },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4',
      });

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        const file = new File([blob], `video_${Date.now()}.webm`, { type: recorder.mimeType });
        setMediaFile(file);
        setMediaType('video');
        setMediaPreview(URL.createObjectURL(blob));
        setRecording(false);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);

      // 5 second countdown
      let count = 5;
      setCountdown(5);
      const interval = setInterval(() => {
        count--;
        setCountdown(count);
        if (count <= 0) {
          clearInterval(interval);
          recorder.stop();
        }
      }, 1000);
    } catch (err) {
      console.error('Camera access denied:', err);
      alert('Permesso fotocamera negato. Abilita l\'accesso alla fotocamera nelle impostazioni.');
    }
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview('');
  };

  const handleSave = async () => {
    if (!drinkType || !user) return;
    setSaving(true);

    try {
      let mediaUrl = existingMediaUrl;

      // Upload media if present
      if (mediaFile) {
        const ext = mediaFile.name.split('.').pop() || 'jpg';
        const fileName = `${user.id}/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('media')
          .upload(fileName, mediaFile, { cacheControl: '86400' });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('media')
          .getPublicUrl(fileName);
        mediaUrl = urlData.publicUrl;
      } else if (!mediaPreview) {
        mediaUrl = '';
      }

      const drinkData = {
        user_id: user.id,
        drink_type: drinkType,
        drink_name: drinkName || null,
        quantity: parseFloat(quantity) || 0,
        quantity_unit: quantityUnit,
        cost: cost ? parseFloat(cost) : null,
        currency: selectedCurrency,
        location: location || null,
        mood: mood || null,
        mood_emoji: moodEmoji || null,
        media_url: mediaUrl || null,
        media_type: mediaFile ? mediaType : (mediaPreview ? mediaType : null),
        notes: storyCaption.trim() || null,
      };

      let drink;
      let drinkError;

      if (editId) {
        const { data, error } = await supabase
          .from('drinks')
          .update(drinkData)
          .eq('id', editId)
          .select()
          .single();
        drink = data;
        drinkError = error;
      } else {
        const { data, error } = await supabase
          .from('drinks')
          .insert(drinkData)
          .select()
          .single();
        drink = data;
        drinkError = error;
      }

      if (drinkError) throw drinkError;

      // Create story if toggled
      if (publishStory && mediaUrl && drink) {
        await supabase.from('stories').insert({
          user_id: user.id,
          drink_id: drink.id,
          media_url: mediaUrl,
          media_type: mediaType,
          caption: storyCaption.trim() || `${getDrinkEmoji(drinkType)} ${drinkName || drinkType}`,
          caption_color: captionColor,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      setSaved(true);
      // Show confetti
      createConfetti();

      setTimeout(() => {
        router.push('/home');
      }, 1500);
    } catch (err) {
      console.error('Error saving drink:', err);
      alert('Errore nel salvataggio. Riprova.');
    } finally {
      setSaving(false);
    }
  };

  const createConfetti = () => {
    const colors = ['#8b5cf6', '#f472b6', '#34d399', '#fbbf24', '#3b82f6', '#ef4444'];
    for (let i = 0; i < 50; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = `${Math.random() * 0.5}s`;
      piece.style.animationDuration = `${2 + Math.random() * 2}s`;
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 4000);
    }
  };

  if (saved) {
    return (
      <div className="auth-page">
        <div className="auth-logo animate-bounce-in">🎉</div>
        <h1 className="auth-title">{editId ? 'Drink modificato!' : 'Drink salvato!'}</h1>
        <p className="auth-subtitle">{editId ? 'I dati sono stati aggiornati' : '+10 XP guadagnati'}</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{editId ? 'Modifica Drink' : 'Aggiungi Drink'}</h1>
          <div className="page-header-sub">{editId ? 'Aggiorna i dettagli del tuo drink' : 'Registra cosa stai bevendo'}</div>
        </div>
        <button onClick={() => router.back()} className="glass-btn glass-btn-sm">
          ✕
        </button>
      </div>

      <div className="section animate-fade-in-up">
        {/* Drink Type Selection */}
        <div className="section-title">🍹 Tipo di Drink</div>
        <div className="drink-type-grid">
          {DRINK_TYPES.map((type) => (
            <button
              key={type.id}
              className={`drink-type-option ${drinkType === type.id ? 'selected' : ''}`}
              onClick={() => setDrinkType(type.id)}
            >
              <span className="type-emoji">{type.emoji}</span>
              <span className="type-label">{type.id === 'beer' ? 'Birra' : type.id === 'cocktail' ? 'Cocktail' : type.id === 'wine' ? 'Vino' : type.id === 'shot' ? 'Shot' : type.id === 'spirit' ? 'Superalcolico' : type.id === 'nonAlcoholic' ? 'Analcolico' : 'Altro'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        {/* Drink Name */}
        <div className="glass-input-wrapper">
          <label htmlFor="drink-name">Nome del drink</label>
          <input
            id="drink-name"
            type="text"
            className="glass-input"
            placeholder="Es. Spritz, IPA, Mojito..."
            value={drinkName}
            onChange={(e) => setDrinkName(e.target.value)}
          />
        </div>

        {/* Quantity */}
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <div className="glass-input-wrapper" style={{ flex: 2 }}>
            <label htmlFor="drink-quantity">Quantità</label>
            <input
              id="drink-quantity"
              type="number"
              className="glass-input"
              placeholder="330"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="0"
              step="any"
            />
          </div>
          <div className="glass-input-wrapper" style={{ flex: 1 }}>
            <label htmlFor="drink-unit">Unità</label>
            <select
              id="drink-unit"
              className="glass-select"
              value={quantityUnit}
              onChange={(e) => setQuantityUnit(e.target.value)}
            >
              <option value="ml">ml</option>
              <option value="cl">cl</option>
              <option value="l">l</option>
              <option value="pz">pezzi</option>
            </select>
          </div>
        </div>

        {/* Cost + Currency */}
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <div className="glass-input-wrapper" style={{ flex: 2 }}>
            <label htmlFor="drink-cost">Costo</label>
            <input
              id="drink-cost"
              type="number"
              className="glass-input"
              placeholder="0.00"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>
          <div className="glass-input-wrapper" style={{ flex: 1 }}>
            <label htmlFor="drink-currency">Valuta</label>
            <select
              id="drink-currency"
              className="glass-select"
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Location */}
        <div className="glass-input-wrapper">
          <label htmlFor="drink-location">📍 Luogo</label>
          <input
            id="drink-location"
            type="text"
            className="glass-input"
            placeholder="Es. Bar Roma, Casa di Marco..."
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
      </div>

      {/* Mood */}
      <div className="section">
        <div className="section-title">😄 Come ti senti?</div>
        <div className="emoji-grid">
          {MOODS.map((m) => (
            <button
              key={m.id}
              className={`emoji-option ${mood === m.id ? 'selected' : ''}`}
              onClick={() => { setMood(m.id); setMoodEmoji(m.emoji); }}
            >
              <span className="emoji">{m.emoji}</span>
              <span className="emoji-label">{m.id === 'euphoric' ? 'Euforico' : m.id === 'happy' ? 'Felice' : m.id === 'relaxed' ? 'Rilassato' : m.id === 'tipsy' ? 'Brillo' : m.id === 'wild' ? 'Scatenato' : m.id === 'sober' ? 'Sobrio' : m.id === 'tired' ? 'Stanco' : 'Malato'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Media */}
      <div className="section">
        <div className="section-title">📸 Foto / Video</div>

        {recording ? (
          <div style={{ textAlign: 'center' }}>
            <video ref={videoRef} style={{ width: '100%', borderRadius: 'var(--radius-md)', maxHeight: 300 }} autoPlay playsInline muted />
            <div style={{
              fontSize: 'var(--font-3xl)',
              fontWeight: 900,
              background: 'var(--accent-gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginTop: 'var(--space-md)',
            }}>
              {countdown}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>Registrazione in corso...</div>
          </div>
        ) : mediaPreview ? (
          <div className="media-preview">
            {mediaType === 'video' ? (
              <video src={mediaPreview} controls playsInline style={{ width: '100%' }} />
            ) : (
              <img src={mediaPreview} alt="Preview" />
            )}
            <button className="media-preview-remove" onClick={removeMedia}>✕</button>
          </div>
        ) : (
          <div className="media-buttons">
            <button className="media-btn" onClick={() => photoInputRef.current?.click()}>
              <span className="media-btn-icon">📸</span>
              Scatta foto
            </button>
            <button className="media-btn" onClick={startVideoRecording}>
              <span className="media-btn-icon">🎥</span>
              Video 5s
            </button>
            <button className="media-btn" onClick={() => fileInputRef.current?.click()}>
              <span className="media-btn-icon">🖼</span>
              Galleria
            </button>
          </div>
        )}

        {/* Hidden inputs */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleMediaSelect}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={handleMediaSelect}
        />
      </div>

      {/* Publish to Story Toggle */}
      {mediaFile && (
        <div className="section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: publishStory ? 'var(--space-md)' : 0 }}>
            <div>
              <div style={{ fontWeight: 600 }}>📱 Pubblica nella storia</div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                Visibile agli amici per 24 ore
              </div>
            </div>
            <div
              className={`glass-toggle ${publishStory ? 'active' : ''}`}
              onClick={() => setPublishStory(!publishStory)}
              role="switch"
              aria-checked={publishStory}
            />
          </div>

          {publishStory && (
            <div className="glass-input-wrapper animate-fade-in-up" style={{ marginTop: 'var(--space-md)' }}>
              <label htmlFor="story-text">Testo sulla storia</label>
              <input
                id="story-text"
                type="text"
                className="glass-input"
                placeholder="Scrivi un testo che apparirà sulla storia..."
                value={storyCaption}
                onChange={(e) => setStoryCaption(e.target.value)}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Colore testo:</span>
                <button
                  type="button"
                  onClick={() => setCaptionColor('white')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: captionColor === 'white' ? 'white' : 'var(--glass-bg)',
                    color: captionColor === 'white' ? 'black' : 'white',
                    border: '1px solid var(--glass-border)',
                    fontSize: 'var(--font-xs)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'all 0.2s'
                  }}
                >
                  ⚪ Bianco
                </button>
                <button
                  type="button"
                  onClick={() => setCaptionColor('black')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: captionColor === 'black' ? 'white' : 'var(--glass-bg)',
                    color: captionColor === 'black' ? 'black' : 'white',
                    border: '1px solid var(--glass-border)',
                    fontSize: 'var(--font-xs)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'all 0.2s'
                  }}
                >
                  ⚫ Nero
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save Button */}
      <div className="section" style={{ paddingBottom: 'var(--space-2xl)' }}>
        <button
          className="glass-btn glass-btn-primary glass-btn-full"
          onClick={handleSave}
          disabled={!drinkType || loading}
          style={{ padding: '16px', fontSize: 'var(--font-md)' }}
        >
          {loading ? '⏳ Salvataggio...' : (editId ? '💾 Aggiorna Drink' : '🍹 Salva Drink')}
        </button>
      </div>
    </>
  );
}

export default function AddDrinkPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-2xl)' }}>
        <div className="spinner" />
      </div>
    }>
      <AddDrinkContent />
    </Suspense>
  );
}
