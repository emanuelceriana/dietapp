import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';
import { 
  format, addWeeks, subWeeks, addMonths, subMonths, 
  addYears, subYears, startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  startOfYear, endOfYear, parseISO, isWithinInterval 
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Scale, Utensils } from 'lucide-react';
import { useStats } from '../hooks/useStats';
import { useProfile } from '../hooks/useProfile';
import { useWeights } from '../hooks/useWeights';
import { calculateTDEE } from '../utils/nutrition';
import WeightLogCard from '../components/progress/WeightLogCard';
import styles from './StatsPage.module.css';

const StatsPage = () => {
  const [activeTab, setActiveTab] = useState('nutrition'); // 'nutrition' or 'weight'
  const [viewDate, setViewDate] = useState(new Date());
  const [period, setPeriod] = useState('week'); // 'week', 'month', 'year'

  const { data: nutritionData, isLoading: statsLoading } = useStats(7);
  const { profile, isLoading: profileLoading } = useProfile();
  const { weights, addWeight, deleteWeight, isLoading: weightsLoading } = useWeights();
  
  const currentInterval = useMemo(() => {
    let start, end;
    if (period === 'week') {
      start = startOfWeek(viewDate, { weekStartsOn: 1 });
      end = endOfWeek(viewDate, { weekStartsOn: 1 });
    } else if (period === 'month') {
      start = startOfMonth(viewDate);
      end = endOfMonth(viewDate);
    } else {
      start = startOfYear(viewDate);
      end = endOfYear(viewDate);
    }
    return { start, end };
  }, [viewDate, period]);

  const filteredWeights = useMemo(() => {
    return weights
      .filter(w => {
        const d = parseISO(w.date);
        return d >= currentInterval.start && d <= currentInterval.end;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [weights, currentInterval]);

  const averageWeight = useMemo(() => {
    if (filteredWeights.length === 0) return null;
    const sum = filteredWeights.reduce((acc, w) => acc + w.weightKg, 0);
    return (sum / filteredWeights.length).toFixed(1);
  }, [filteredWeights]);

  const navigate = (direction) => {
    const fn = direction === 'next' 
      ? (period === 'week' ? addWeeks : period === 'month' ? addMonths : addYears)
      : (period === 'prev' ? subWeeks : period === 'month' ? subMonths : subYears);
    setViewDate(fn(viewDate, 1));
  };

  if (statsLoading || profileLoading || !profile) {
    return <div className={styles.loading}>Cargando estadísticas...</div>;
  }

  const nutritionTarget = calculateTDEE(profile);

  const weeklyTotals = nutritionData.reduce((acc, day) => ({
    protein: acc.protein + day.protein,
    carbs: acc.carbs + day.carbs,
    fat: acc.fat + day.fat,
  }), { protein: 0, carbs: 0, fat: 0 });

  const pieData = [
    { name: 'Proteínas', value: weeklyTotals.protein, color: 'var(--color-protein)' },
    { name: 'Carbos', value: weeklyTotals.carbs, color: 'var(--color-carbs)' },
    { name: 'Grasas', value: weeklyTotals.fat, color: 'var(--color-fat)' },
  ].filter(d => d.value > 0);

  const getPeriodLabel = () => {
    if (period === 'week') {
      return `Semana del ${format(currentInterval.start, 'd MMM', { locale: es })} al ${format(currentInterval.end, 'd MMM', { locale: es })}`;
    }
    if (period === 'month') {
      return format(viewDate, 'MMMM yyyy', { locale: es });
    }
    return format(viewDate, 'yyyy', { locale: es });
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.tabContainer}>
          <button 
            className={`${styles.tab} ${activeTab === 'nutrition' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('nutrition')}
          >
            <Utensils size={18} />
            <span>Nutrición</span>
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'weight' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('weight')}
          >
            <Scale size={18} />
            <span>Peso</span>
          </button>
        </div>
      </header>

      {activeTab === 'nutrition' ? (
        <div className={styles.nutritionView}>
          <div className={`${styles.chartCard} card`}>
            <h3 className={styles.chartTitle}>Calorías por día</h3>
            <div className={styles.barChartContainer}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={nutritionData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                  <XAxis 
                    dataKey="displayDate" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} 
                  />
                  <Tooltip 
                    cursor={{ fill: 'var(--border-subtle)' }}
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-card)', 
                      borderColor: 'var(--border-subtle)',
                      borderRadius: '12px',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <Bar 
                    dataKey="kcal" 
                    fill="var(--accent-primary)" 
                    radius={[4, 4, 0, 0]} 
                    barSize={30}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={styles.legend}>
              <div className={styles.targetLine} />
              <span>Objetivo: {nutritionTarget} kcal</span>
            </div>
          </div>

          <div className={styles.grid}>
            <div className={`${styles.chartCard} card`}>
              <h3 className={styles.chartTitle}>Distribución semanal</h3>
              <div className={styles.pieChartContainer}>
                {(() => {
                  const totalMacros = weeklyTotals.protein + weeklyTotals.carbs + weeklyTotals.fat;
                  const formattedPieData = pieData.map(d => ({
                    ...d,
                    displayName: `${d.name} (${totalMacros > 0 ? Math.round((d.value / totalMacros) * 100) : 0}%)`
                  }));

                  return (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={formattedPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                          nameKey="displayName"
                          labelLine={false}
                        >
                          {formattedPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'var(--bg-card)', 
                            borderColor: 'var(--border-subtle)',
                            borderRadius: '12px'
                          }}
                        />
                        <Legend 
                          iconType="circle" 
                          verticalAlign="bottom" 
                          height={40}
                          formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500' }}>{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </div>

            <div className={`${styles.summaryCard} card`}>
              <h3 className={styles.chartTitle}>Promedio diario</h3>
              <div className={styles.statBox}>
                <span className={styles.statVal}>
                  {(() => {
                    const activeDays = nutritionData.filter(d => d.kcal > 0);
                    return activeDays.length > 0 
                      ? Math.round(activeDays.reduce((acc, d) => acc + d.kcal, 0) / activeDays.length)
                      : 0;
                  })()}
                </span>
                <span className={styles.statLab}>kcal / día</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.weightView}>
          <div className={styles.navigation}>
            <div className={styles.periodSelector}>
              {['week', 'month', 'year'].map(p => (
                <button 
                  key={p} 
                  className={`${styles.periodBtn} ${period === p ? styles.activePeriod : ''}`}
                  onClick={() => { setPeriod(p); setViewDate(new Date()); }}
                >
                  {p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : 'Año'}
                </button>
              ))}
            </div>
            <div className={styles.navControls}>
              <button className={styles.navBtn} onClick={() => navigate('prev')}>
                <ChevronLeft size={20} />
              </button>
              <span className={styles.periodLabel}>{getPeriodLabel()}</span>
              <button className={styles.navBtn} onClick={() => navigate('next')}>
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className={`${styles.chartCard} card`}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Tendencia de Peso</h3>
              {averageWeight && (
                <div className={styles.avgBadge}>
                  Promedio: <strong>{averageWeight} kg</strong>
                </div>
              )}
            </div>
            
            <div className={styles.lineChartContainer}>
              {filteredWeights.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={filteredWeights} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                      tickFormatter={(val) => format(parseISO(val), period === 'year' ? 'MMM' : 'd MMM', { locale: es })}
                    />
                    <YAxis 
                      hide
                      domain={['auto', 'auto']}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--bg-card)', 
                        borderColor: 'var(--border-subtle)',
                        borderRadius: '12px',
                        color: 'var(--text-primary)'
                      }}
                      labelFormatter={(val) => format(parseISO(val), 'EEEE d MMMM', { locale: es })}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="weightKg" 
                      stroke="var(--accent-primary)" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorWeight)" 
                      dot={{ fill: 'var(--accent-primary)', strokeWidth: 2, r: 4, stroke: 'var(--bg-card)' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.noData}>
                  <p>No hay datos de peso para este periodo.</p>
                </div>
              )}
            </div>
          </div>

          <WeightLogCard 
            weights={weights} 
            frequency={profile.weightFrequency} 
            onAdd={addWeight}
            onDelete={deleteWeight}
            baseDate={viewDate}
          />
        </div>
      )}
    </div>
  );
};

export default StatsPage;
