import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, ReferenceLine
} from 'recharts';
import { 
  format, addWeeks, subWeeks, addMonths, subMonths, 
  addYears, subYears, startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  startOfYear, endOfYear, parseISO, eachMonthOfInterval, eachDayOfInterval
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Scale, Utensils } from 'lucide-react';
import { useStats } from '../hooks/useStats';
import { useProfile } from '../hooks/useProfile';
import { useWeights } from '../hooks/useWeights';
import { calculateTDEE } from '../utils/nutrition';
import {
  buildProgressSummary,
  calculateNutritionStreak,
  downloadTextFile,
  getPendingWeightDates,
  getWeightTargetDays
} from '../utils/progress';
import AdherenceCard from '../components/progress/AdherenceCard';
import WeightLogCard from '../components/progress/WeightLogCard';
import styles from './StatsPage.module.css';

const StatsPage = () => {
  const [activeTab, setActiveTab] = useState('nutrition');
  const [viewDate, setViewDate] = useState(new Date());
  const [period, setPeriod] = useState('week');
  const [exportStatus, setExportStatus] = useState('');

  const currentInterval = useMemo(() => {
    if (period === 'week') {
      return {
        start: startOfWeek(viewDate, { weekStartsOn: 1 }),
        end: endOfWeek(viewDate, { weekStartsOn: 1 })
      };
    }

    if (period === 'month') {
      return {
        start: startOfMonth(viewDate),
        end: endOfMonth(viewDate)
      };
    }

    return {
      start: startOfYear(viewDate),
      end: endOfYear(viewDate)
    };
  }, [viewDate, period]);

  const adherenceBaseDate = period === 'week' ? viewDate : new Date();
  const adherenceInterval = useMemo(() => ({
    start: startOfWeek(adherenceBaseDate, { weekStartsOn: 1 }),
    end: endOfWeek(adherenceBaseDate, { weekStartsOn: 1 })
  }), [adherenceBaseDate]);

  const { data: nutritionData, isLoading: statsLoading } = useStats(currentInterval);
  const { data: adherenceNutritionData, isLoading: adherenceLoading } = useStats(adherenceInterval);
  const { data: streakNutritionData } = useStats(30);
  const { profile, isLoading: profileLoading, updateProfile } = useProfile();
  const { weights, addWeight, deleteWeight, isLoading: weightsLoading } = useWeights();

  const filteredWeights = useMemo(() => {
    return weights
      .filter((weight) => {
        const date = parseISO(weight.date);
        return date >= currentInterval.start && date <= currentInterval.end;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [weights, currentInterval]);

  const averageWeight = useMemo(() => {
    if (filteredWeights.length === 0) return null;
    const sum = filteredWeights.reduce((acc, weight) => acc + weight.weightKg, 0);
    return (sum / filteredWeights.length).toFixed(1);
  }, [filteredWeights]);

  const weightChartData = useMemo(() => {
    if (period === 'year') {
      return eachMonthOfInterval(currentInterval).map((monthDate) => {
        const monthKey = format(monthDate, 'yyyy-MM');
        const monthWeights = filteredWeights.filter((weight) => weight.date.startsWith(monthKey));
        const average = monthWeights.length > 0
          ? monthWeights.reduce((acc, weight) => acc + weight.weightKg, 0) / monthWeights.length
          : null;

        return {
          date: format(monthDate, 'yyyy-MM-dd'),
          weightKg: average ? Math.round(average * 10) / 10 : null
        };
      });
    }

    const weightsByDate = new Map(filteredWeights.map((weight) => [weight.date, weight]));
    return eachDayOfInterval(currentInterval).map((date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return {
        date: dateStr,
        weightKg: weightsByDate.get(dateStr)?.weightKg ?? null
      };
    });
  }, [filteredWeights, currentInterval, period]);

  const periodTotals = useMemo(() => {
    return nutritionData.reduce((acc, day) => ({
      kcal: acc.kcal + day.kcal,
      protein: acc.protein + day.protein,
      carbs: acc.carbs + day.carbs,
      fat: acc.fat + day.fat,
    }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  }, [nutritionData]);

  const activeNutritionDays = useMemo(() => {
    return nutritionData.filter((day) => day.kcal > 0);
  }, [nutritionData]);

  const averageDailyKcal = useMemo(() => {
    if (activeNutritionDays.length === 0) return 0;
    return Math.round(periodTotals.kcal / activeNutritionDays.length);
  }, [activeNutritionDays, periodTotals.kcal]);

  const adherenceWeights = useMemo(() => (
    weights
      .filter((weight) => {
        const date = parseISO(weight.date);
        return date >= adherenceInterval.start && date <= adherenceInterval.end;
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  ), [adherenceInterval, weights]);

  const adherenceTargetDays = useMemo(
    () => getWeightTargetDays(adherenceBaseDate, profile?.weightFrequency || 3),
    [adherenceBaseDate, profile?.weightFrequency]
  );

  const completedAdherenceWeights = useMemo(() => {
    const loggedDates = new Set(adherenceWeights.map((weight) => weight.date));
    return adherenceTargetDays.filter((date) => loggedDates.has(format(date, 'yyyy-MM-dd'))).length;
  }, [adherenceTargetDays, adherenceWeights]);

  const pendingWeightDates = useMemo(
    () => getPendingWeightDates(adherenceWeights, adherenceBaseDate, profile?.weightFrequency || 3),
    [adherenceBaseDate, adherenceWeights, profile?.weightFrequency]
  );

  const adherenceNutritionDays = useMemo(
    () => adherenceNutritionData.filter((day) => day.kcal > 0).length,
    [adherenceNutritionData]
  );

  const nutritionStreak = useMemo(
    () => calculateNutritionStreak(streakNutritionData, new Date()),
    [streakNutritionData]
  );

  const nutritionChartData = useMemo(() => {
    if (period !== 'year') {
      return nutritionData.map((day) => ({
        ...day,
        tooltipLabel: format(parseISO(day.date), 'EEEE d MMMM', { locale: es })
      }));
    }

    const months = new Map();
    nutritionData.forEach((day) => {
      const monthKey = format(parseISO(day.date), 'yyyy-MM');
      const month = months.get(monthKey) || { totalKcal: 0, daysLogged: 0 };
      month.totalKcal += day.kcal;
      month.daysLogged += day.kcal > 0 ? 1 : 0;
      months.set(monthKey, month);
    });

    return eachMonthOfInterval(currentInterval).map((monthDate) => {
      const monthKey = format(monthDate, 'yyyy-MM');
      const month = months.get(monthKey) || { totalKcal: 0, daysLogged: 0 };

      return {
        date: monthKey,
        displayDate: format(monthDate, 'MMM', { locale: es }),
        tooltipLabel: format(monthDate, 'MMMM yyyy', { locale: es }),
        kcal: month.daysLogged > 0 ? Math.round(month.totalKcal / month.daysLogged) : 0,
        totalKcal: month.totalKcal,
        daysLogged: month.daysLogged
      };
    });
  }, [nutritionData, period, currentInterval]);

  const pieData = useMemo(() => {
    return [
      { name: 'Proteínas', value: periodTotals.protein, color: 'var(--color-protein)' },
      { name: 'Carbos', value: periodTotals.carbs, color: 'var(--color-carbs)' },
      { name: 'Grasas', value: periodTotals.fat, color: 'var(--color-fat)' },
    ].filter((macro) => macro.value > 0);
  }, [periodTotals]);

  const navigate = (direction) => {
    const fn = direction === 'next' 
      ? (period === 'week' ? addWeeks : period === 'month' ? addMonths : addYears)
      : (period === 'week' ? subWeeks : period === 'month' ? subMonths : subYears);
    setViewDate(fn(viewDate, 1));
  };

  const handleFrequencyChange = async (frequency) => {
    try {
      await updateProfile({ weightFrequency: frequency });
    } catch (err) {
      console.error('Error updating weight frequency:', err);
    }
  };

  const getPeriodLabel = () => {
    if (period === 'week') {
      return `Semana del ${format(currentInterval.start, 'd MMM', { locale: es })} al ${format(currentInterval.end, 'd MMM', { locale: es })}`;
    }
    if (period === 'month') {
      return format(viewDate, 'MMMM yyyy', { locale: es });
    }
    return format(viewDate, 'yyyy', { locale: es });
  };

  const nutritionTarget = calculateTDEE(profile);

  const getAdherenceLabel = () => (
    `Seguimiento ${format(adherenceInterval.start, 'd MMM', { locale: es })} - ${format(adherenceInterval.end, 'd MMM', { locale: es })}`
  );

  const handleExportSummary = () => {
    const title = period === 'week'
      ? 'Resumen semanal'
      : period === 'month'
        ? 'Resumen mensual'
        : 'Resumen anual';
    const summary = buildProgressSummary({
      title,
      intervalLabel: getPeriodLabel(),
      nutritionTarget,
      nutritionData,
      periodTotals,
      averageDailyKcal,
      weights: filteredWeights,
      weightGoal: period === 'week'
        ? getWeightTargetDays(viewDate, profile.weightFrequency).length
        : filteredWeights.length,
      nutritionStreak,
      pendingWeightDates
    });

    const filename = `dietapp-${period}-${format(currentInterval.start, 'yyyy-MM-dd')}.txt`;
    downloadTextFile(filename, summary);
    setExportStatus(`Resumen exportado: ${filename}`);
  };

  const adherenceReminder = pendingWeightDates.length > 0
    ? `Te faltan ${pendingWeightDates.length} pesaje(s) sugeridos: ${pendingWeightDates
      .map((date) => format(date, 'EEE d MMM', { locale: es }))
      .join(', ')}.`
    : 'Semana cerrada: ya completaste todos los pesajes sugeridos.';

  if (profileLoading || !profile || statsLoading || adherenceLoading) {
    return <div className={styles.loading}>Cargando estadísticas...</div>;
  }

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

      <div className={styles.navigation}>
        <div className={styles.periodSelector}>
          {['week', 'month', 'year'].map((periodOption) => (
            <button
              key={periodOption}
              className={`${styles.periodBtn} ${period === periodOption ? styles.activePeriod : ''}`}
              onClick={() => { setPeriod(periodOption); setViewDate(new Date()); }}
            >
              {periodOption === 'week' ? 'Semana' : periodOption === 'month' ? 'Mes' : 'Año'}
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

      <AdherenceCard
        title="Adherencia y recordatorios"
        label={getAdherenceLabel()}
        nutritionDays={adherenceNutritionDays}
        nutritionGoal={5}
        streakDays={nutritionStreak}
        weightCount={completedAdherenceWeights}
        weightGoal={adherenceTargetDays.length}
        reminder={adherenceReminder}
        onExport={handleExportSummary}
      />

      {exportStatus && <p className={styles.exportStatus}>{exportStatus}</p>}

      {activeTab === 'nutrition' ? (
        <div className={styles.nutritionView}>
          <div className={`${styles.chartCard} card`}>
            <h3 className={styles.chartTitle}>
              {period === 'year' ? 'Promedio diario por mes' : 'Calorías por día'}
            </h3>
            <div className={styles.barChartContainer}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={nutritionChartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                  <XAxis 
                    dataKey="displayDate" 
                    axisLine={false} 
                    tickLine={false} 
                    interval={period === 'month' ? 4 : 0}
                    tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} 
                  />
                  <Tooltip 
                    cursor={{ fill: 'var(--border-subtle)' }}
                    formatter={(value) => [`${value} kcal`, period === 'year' ? 'Promedio diario' : 'Calorías']}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipLabel || ''}
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-card)', 
                      borderColor: 'var(--border-subtle)',
                      borderRadius: '12px',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <ReferenceLine y={nutritionTarget} stroke="var(--accent-primary)" strokeDasharray="4 4" />
                  <Bar 
                    dataKey="kcal" 
                    fill="var(--accent-primary)" 
                    radius={[4, 4, 0, 0]} 
                    barSize={period === 'week' ? 30 : period === 'month' ? 8 : 18}
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
              <h3 className={styles.chartTitle}>Distribución del período</h3>
              <div className={styles.pieChartContainer}>
                {(() => {
                  const totalMacros = periodTotals.protein + periodTotals.carbs + periodTotals.fat;
                  const formattedPieData = pieData.map((macro) => ({
                    ...macro,
                    displayName: `${macro.name} (${totalMacros > 0 ? Math.round((macro.value / totalMacros) * 100) : 0}%)`
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
                <span className={styles.statVal}>{averageDailyKcal}</span>
                <span className={styles.statLab}>kcal / día</span>
                <span className={styles.statLab}>{periodTotals.kcal} kcal en total</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.weightView}>
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
              {weightsLoading ? (
                <div className={styles.noData}>
                  <p>Cargando peso...</p>
                </div>
              ) : filteredWeights.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={weightChartData} margin={{ top: 20, right: 14, left: 14, bottom: 0 }}>
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
                      padding={{ left: 12, right: 12 }}
                      interval={period === 'month' ? 4 : 0}
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
                      connectNulls={false}
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
            onFrequencyChange={handleFrequencyChange}
            baseDate={viewDate}
          />
        </div>
      )}
    </div>
  );
};

export default StatsPage;
