'use client';

import { useState, useEffect, useRef, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/lib/context';
import { getLevel, formatCurrency, getDrinkEmoji } from '@/lib/utils';
import type { Profile, Achievement, Story } from '@/lib/utils';
import { Chart, registerables } from 'chart.js';
import Link from 'next/link';

Chart.register(...registerables);

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const { user, currency, lang } = useApp();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Highlights state
  const [hasStories, setHasStories] = useState(false);
  const [lastStoryMedia, setLastStoryMedia] = useState<string | null>(null);
  const [lastStoryMediaType, setLastStoryMediaType] = useState<string | null>(null);

  // Achievements state
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  // Dashboard state
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [dashboardStats, setDashboardStats] = useState({
    totalDrinks: 0,
    totalSpent: 0,
    favoriteDrink: '',
    favoritePlace: '',
    avgPerDay: 0,
    streak: 0,
  });
  const [drinksByType, setDrinksByType] = useState<Record<string, number>>({});
  const [dailyDrinks, setDailyDrinks] = useState<{ date: string; count: number; spent: number }[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Chart refs
  const barChartRef = useRef<HTMLCanvasElement>(null);
  const donutChartRef = useRef<HTMLCanvasElement>(null);
  const lineChartRef = useRef<HTMLCanvasElement>(null);
  const barChartInstance = useRef<Chart | null>(null);
  const donutChartInstance = useRef<Chart | null>(null);
  const lineChartInstance = useRef<Chart | null>(null);

  const isSelf = user?.id === userId;
  const canShowDashboard = isSelf || isFriend;

  useEffect(() => {
    loadProfile();
    checkFriendship();
    loadHighlights();
    loadAchievements();
  }, [userId, user]);

  useEffect(() => {
    if (canShowDashboard) {
      loadDashboardStats();
    }
  }, [userId, canShowDashboard, period]);

  useEffect(() => {
    if (canShowDashboard && dailyDrinks.length > 0) {
      renderCharts();
    }
    return () => {
      barChartInstance.current?.destroy();
      donutChartInstance.current?.destroy();
      lineChartInstance.current?.destroy();
    };
  }, [dailyDrinks, drinksByType, canShowDashboard]);

  const loadProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data);
    setLoading(false);
  };

  const checkFriendship = async () => {
    if (!user || isSelf) return;
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

  const loadHighlights = async () => {
    try {
      const { data } = await supabase
        .from('stories')
        .select('media_url, media_type')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        setHasStories(true);
        setLastStoryMedia(data[0].media_url);
        setLastStoryMediaType(data[0].media_type);
      } else {
        setHasStories(false);
        setLastStoryMedia(null);
        setLastStoryMediaType(null);
      }
    } catch (e) {
      console.error('Error loading highlights:', e);
    }
  };

  const loadAchievements = async () => {
    try {
      const { data: allAchievements } = await supabase.from('achievements').select('*');
      const { data: userAchievements } = await supabase
        .from('user_achievements')
        .select('achievement_id, earned_at')
        .eq('user_id', userId);

      const earnedIds = new Set(userAchievements?.map(ua => ua.achievement_id) || []);
      const merged = allAchievements?.map(a => ({
        ...a,
        earned: earnedIds.has(a.id),
        earned_at: userAchievements?.find(ua => ua.achievement_id === a.id)?.earned_at,
      })) || [];

      setAchievements(merged);
    } catch (e) {
      console.error('Error loading achievements:', e);
    }
  };

  const loadDashboardStats = async () => {
    setDashboardLoading(true);
    const now = new Date();
    let startDate: Date;

    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    try {
      const { data: drinks } = await supabase
        .from('drinks')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (!drinks) {
        setDashboardLoading(false);
        return;
      }

      // Calculate stats
      const totalDrinks = drinks.length;
      const totalSpent = drinks.reduce((sum, d) => sum + (d.cost || 0), 0);
      const days = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
      const avgPerDay = totalDrinks / days;

      // Favorite drink type
      const typeCounts: Record<string, number> = {};
      drinks.forEach(d => {
        typeCounts[d.drink_type] = (typeCounts[d.drink_type] || 0) + 1;
      });
      const favoriteDrink = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

      // Favorite place
      const placeCounts: Record<string, number> = {};
      drinks.forEach(d => {
        if (d.location) placeCounts[d.location] = (placeCounts[d.location] || 0) + 1;
      });
      const favoritePlace = Object.entries(placeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

      setDashboardStats({
        totalDrinks,
        totalSpent,
        favoriteDrink,
        favoritePlace,
        avgPerDay: Math.round(avgPerDay * 10) / 10,
        streak: profile?.streak_days || 0,
      });

      setDrinksByType(typeCounts);

      // Daily breakdown
      const daily: Record<string, { count: number; spent: number }> = {};
      drinks.forEach(d => {
        const day = new Date(d.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
        if (!daily[day]) daily[day] = { count: 0, spent: 0 };
        daily[day].count++;
        daily[day].spent += d.cost || 0;
      });
      setDailyDrinks(Object.entries(daily).map(([date, data]) => ({ date, ...data })));

    } catch (e) {
      console.error('Error loading dashboard stats:', e);
    } finally {
      setDashboardLoading(false);
    }
  };

  const renderCharts = () => {
    const chartTextColor = 'rgba(255,255,255,0.6)';
    const gridColor = 'rgba(255,255,255,0.06)';

    // Bar Chart — Drinks per day
    if (barChartRef.current && dailyDrinks.length > 0) {
      barChartInstance.current?.destroy();
      barChartInstance.current = new Chart(barChartRef.current, {
        type: 'bar',
        data: {
          labels: dailyDrinks.map(d => d.date),
          datasets: [{
            label: 'Drink',
            data: dailyDrinks.map(d => d.count),
            backgroundColor: 'rgba(139, 92, 246, 0.6)',
            borderColor: '#8b5cf6',
            borderWidth: 1,
            borderRadius: 8,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: chartTextColor, font: { size: 10 } }, grid: { color: gridColor } },
            y: { ticks: { color: chartTextColor, stepSize: 1 }, grid: { color: gridColor }, beginAtZero: true },
          },
        },
      });
    }

    // Donut Chart — By type
    if (donutChartRef.current && Object.keys(drinksByType).length > 0) {
      donutChartInstance.current?.destroy();
      const typeColors = ['#8b5cf6', '#f472b6', '#34d399', '#fbbf24', '#3b82f6', '#ef4444', '#f97316'];
      const labels = Object.keys(drinksByType);
      donutChartInstance.current = new Chart(donutChartRef.current, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: Object.values(drinksByType),
            backgroundColor: typeColors.slice(0, labels.length),
            borderWidth: 0,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: chartTextColor, padding: 12, font: { size: 11 } },
            },
          },
        },
      });
    }

    // Line Chart — Spending over time
    if (lineChartRef.current && dailyDrinks.length > 0) {
      lineChartInstance.current?.destroy();
      lineChartInstance.current = new Chart(lineChartRef.current, {
        type: 'line',
        data: {
          labels: dailyDrinks.map(d => d.date),
          datasets: [{
            label: 'Spesa (€)',
            data: dailyDrinks.map(d => d.spent),
            borderColor: '#f472b6',
            backgroundColor: 'rgba(244, 114, 182, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#f472b6',
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: chartTextColor, font: { size: 10 } }, grid: { color: gridColor } },
            y: { ticks: { color: chartTextColor }, grid: { color: gridColor }, beginAtZero: true },
          },
        },
      });
    }
  };

  const sendRequest = async () => {
    if (!user) return;
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
            {levelInfo.emoji} Lv.{levelInfo.level} — {lang === 'it' ? levelInfo.name : levelInfo.nameEn}
          </span>
        </div>

        {/* Profile Stats */}
        <div className="profile-stats">
          <div className="profile-stat">
            <div className="profile-stat-value">{profile.total_drinks}</div>
            <div className="profile-stat-label">Drink</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-value">{formatCurrency(Number(profile.total_spent), currency)}</div>
            <div className="profile-stat-label">Speso</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-value">{profile.streak_days}</div>
            <div className="profile-stat-label">🔥 Streak</div>
          </div>
        </div>

        {!isSelf && (
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

      {/* Highlights / Storia in evidenza */}
      {hasStories && (
        <div className="section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
          <div className="section-title" style={{ width: '100%', textAlign: 'center' }}>✨ Storie in Evidenza</div>
          <Link href={`/stories/${userId}?all=true`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', color: 'inherit', gap: '8px', marginTop: 'var(--space-sm)' }}>
            <div className="avatar-story-ring unseen" style={{ padding: '3px' }}>
              <div className="avatar-placeholder avatar-lg" style={{ overflow: 'hidden', padding: 0, width: '70px', height: '70px' }}>
                {lastStoryMediaType === 'video' ? (
                  <video src={lastStoryMedia || undefined} style={{ width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted />
                ) : (
                  <img src={lastStoryMedia || undefined} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Copertina Storia" />
                )}
              </div>
            </div>
            <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600 }}>Ricordi 🎬</span>
          </Link>
        </div>
      )}

      {/* Dashboard Section */}
      <div className="section">
        <div className="section-title">📊 Dashboard</div>
        
        {canShowDashboard ? (
          <>
            {/* Period Tabs */}
            <div className="date-tabs" style={{ padding: 0 }}>
              {(['today', 'week', 'month'] as const).map(p => (
                <button
                  key={p}
                  className={`date-tab ${period === p ? 'active' : ''}`}
                  onClick={() => setPeriod(p)}
                >
                  {p === 'today' ? 'Oggi' : p === 'week' ? 'Settimana' : 'Mese'}
                </button>
              ))}
            </div>

            {dashboardLoading ? (
              <div className="stagger">
                {[1, 2, 3].map(i => (
                  <div key={i} className="skeleton" style={{ height: 80, marginBottom: 'var(--space-md)' }} />
                ))}
              </div>
            ) : (
              <>
                {/* Stats Grid */}
                <div className="stats-grid stagger" style={{ marginBottom: 'var(--space-lg)' }}>
                  <div className="stat-card">
                    <div className="stat-card-icon">🍹</div>
                    <div className="stat-card-value">{dashboardStats.totalDrinks}</div>
                    <div className="stat-card-label">Drink totali</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-icon">💰</div>
                    <div className="stat-card-value">{formatCurrency(dashboardStats.totalSpent, currency)}</div>
                    <div className="stat-card-label">Spesa totale</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-icon">{getDrinkEmoji(dashboardStats.favoriteDrink)}</div>
                    <div className="stat-card-value" style={{ fontSize: 'var(--font-lg)' }}>{dashboardStats.favoriteDrink}</div>
                    <div className="stat-card-label">Drink preferito</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-icon">📍</div>
                    <div className="stat-card-value" style={{ fontSize: 'var(--font-base)' }}>{dashboardStats.favoritePlace}</div>
                    <div className="stat-card-label">Luogo preferito</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-icon">📊</div>
                    <div className="stat-card-value">{dashboardStats.avgPerDay}</div>
                    <div className="stat-card-label">Media/giorno</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-icon">🔥</div>
                    <div className="stat-card-value">{dashboardStats.streak}</div>
                    <div className="stat-card-label">Streak (giorni)</div>
                  </div>
                </div>

                {/* Charts */}
                {dailyDrinks.length > 0 ? (
                  <>
                    <div className="section" style={{ padding: 0, marginBottom: 'var(--space-lg)' }}>
                      <div className="section-title" style={{ fontSize: 'var(--font-sm)' }}>📊 Drink nel tempo</div>
                      <div className="chart-container">
                        <canvas ref={barChartRef}></canvas>
                      </div>
                    </div>

                    <div className="section" style={{ padding: 0, marginBottom: 'var(--space-lg)' }}>
                      <div className="section-title" style={{ fontSize: 'var(--font-sm)' }}>🍩 Per tipologia</div>
                      <div className="chart-container" style={{ aspectRatio: '1/1', maxWidth: 280, margin: '0 auto' }}>
                        <canvas ref={donutChartRef}></canvas>
                      </div>
                    </div>

                    <div className="section" style={{ padding: 0, marginBottom: 'var(--space-lg)' }}>
                      <div className="section-title" style={{ fontSize: 'var(--font-sm)' }}>💸 Spesa nel tempo</div>
                      <div className="chart-container">
                        <canvas ref={lineChartRef}></canvas>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">📊</div>
                    <div className="empty-state-title">Nessun dato per questo periodo</div>
                    <div className="empty-state-text">Non ci sono drink registrati in questo periodo temporale.</div>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="glass-card animate-scale-up" style={{ textAlign: 'center', padding: 'var(--space-2xl) var(--space-md)', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🔒</div>
            <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>Profilo Privato</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', maxWidth: 280, margin: '0 auto' }}>
              Invia una richiesta di amicizia per sbloccare la dashboard, i grafici e le statistiche dei drink!
            </p>
          </div>
        )}
      </div>

      {/* Achievements */}
      <div className="section" style={{ paddingBottom: 'var(--space-2xl)' }}>
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
    </>
  );
}
