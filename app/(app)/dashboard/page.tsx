'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/lib/context';
import { formatCurrency, getDrinkEmoji } from '@/lib/utils';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export default function DashboardPage() {
  const { user, profile, currency } = useApp();
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [stats, setStats] = useState({
    totalDrinks: 0,
    totalSpent: 0,
    favoriteDrink: '',
    favoritePlace: '',
    avgPerDay: 0,
    streak: 0,
  });
  const [drinksByType, setDrinksByType] = useState<Record<string, number>>({});
  const [dailyDrinks, setDailyDrinks] = useState<{ date: string; count: number; spent: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const barChartRef = useRef<HTMLCanvasElement>(null);
  const donutChartRef = useRef<HTMLCanvasElement>(null);
  const lineChartRef = useRef<HTMLCanvasElement>(null);
  const barChartInstance = useRef<Chart | null>(null);
  const donutChartInstance = useRef<Chart | null>(null);
  const lineChartInstance = useRef<Chart | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (user) loadStats();
  }, [user, period]);

  useEffect(() => {
    renderCharts();
    return () => {
      barChartInstance.current?.destroy();
      donutChartInstance.current?.destroy();
      lineChartInstance.current?.destroy();
    };
  }, [dailyDrinks, drinksByType]);

  const loadStats = async () => {
    setLoading(true);
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
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (!drinks) {
        setLoading(false);
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

      setStats({
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
      console.error('Error loading stats:', e);
    } finally {
      setLoading(false);
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

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Statistiche</h1>
          <div className="page-header-sub">Le tue bevute in numeri</div>
        </div>
      </div>

      {/* Period Tabs */}
      <div className="date-tabs">
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

      {loading ? (
        <div className="stagger" style={{ padding: '0 var(--space-md)' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: 80, marginBottom: 'var(--space-md)' }} />
          ))}
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="stats-grid stagger" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="stat-card">
              <div className="stat-card-icon">🍹</div>
              <div className="stat-card-value">{stats.totalDrinks}</div>
              <div className="stat-card-label">Drink totali</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">💰</div>
              <div className="stat-card-value">{formatCurrency(stats.totalSpent, currency)}</div>
              <div className="stat-card-label">Spesa totale</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">{getDrinkEmoji(stats.favoriteDrink)}</div>
              <div className="stat-card-value" style={{ fontSize: 'var(--font-lg)' }}>{stats.favoriteDrink}</div>
              <div className="stat-card-label">Drink preferito</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">📍</div>
              <div className="stat-card-value" style={{ fontSize: 'var(--font-base)' }}>{stats.favoritePlace}</div>
              <div className="stat-card-label">Luogo preferito</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">📊</div>
              <div className="stat-card-value">{stats.avgPerDay}</div>
              <div className="stat-card-label">Media/giorno</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">🔥</div>
              <div className="stat-card-value">{stats.streak}</div>
              <div className="stat-card-label">Streak (giorni)</div>
            </div>
          </div>

          {/* Charts */}
          {dailyDrinks.length > 0 ? (
            <>
              <div className="section">
                <div className="section-title">📊 Drink nel tempo</div>
                <div className="chart-container">
                  <canvas ref={barChartRef}></canvas>
                </div>
              </div>

              <div className="section">
                <div className="section-title">🍩 Per tipologia</div>
                <div className="chart-container" style={{ aspectRatio: '1/1', maxWidth: 280, margin: '0 auto' }}>
                  <canvas ref={donutChartRef}></canvas>
                </div>
              </div>

              <div className="section">
                <div className="section-title">💸 Spesa nel tempo</div>
                <div className="chart-container">
                  <canvas ref={lineChartRef}></canvas>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-title">Nessun dato per questo periodo</div>
              <div className="empty-state-text">Registra dei drink per vedere le statistiche!</div>
            </div>
          )}
        </>
      )}
    </>
  );
}
