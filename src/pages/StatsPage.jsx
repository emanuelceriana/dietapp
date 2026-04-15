import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { useStats } from '../hooks/useStats';
import { useProfile } from '../hooks/useProfile';
import { calculateTDEE } from '../utils/nutrition';
import styles from './StatsPage.module.css';

const StatsPage = () => {
  const { data, isLoading: statsLoading } = useStats(7);
  const { profile, isLoading: profileLoading } = useProfile();
  
  if (statsLoading || profileLoading || !profile) {
    return <div className={styles.loading}>Cargando estadísticas...</div>;
  }

  const target = calculateTDEE(profile);

  // Calculate overall weekly distribution
  const weeklyTotals = data.reduce((acc, day) => ({
    protein: acc.protein + day.protein,
    carbs: acc.carbs + day.carbs,
    fat: acc.fat + day.fat,
  }), { protein: 0, carbs: 0, fat: 0 });

  const pieData = [
    { name: 'Proteínas', value: weeklyTotals.protein, color: 'var(--color-protein)' },
    { name: 'Carbos', value: weeklyTotals.carbs, color: 'var(--color-carbs)' },
    { name: 'Grasas', value: weeklyTotals.fat, color: 'var(--color-fat)' },
  ].filter(d => d.value > 0);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Estadísticas</h1>
        <p className={styles.subtitle}>Tu progreso en los últimos 7 días</p>
      </header>

      <div className={`${styles.chartCard} card`}>
        <h3 className={styles.chartTitle}>Calorías por día</h3>
        <div className={styles.barChartContainer}>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
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
          <span>Objetivo: {target} kcal</span>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={`${styles.chartCard} card`}>
          <h3 className={styles.chartTitle}>Distribución Mensual</h3>
          <div className={styles.pieChartContainer}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${styles.summaryCard} card`}>
          <h3 className={styles.chartTitle}>Promedio Semanal</h3>
          <div className={styles.statBox}>
            <span className={styles.statVal}>
              {Math.round(data.reduce((acc, d) => acc + d.kcal, 0) / 7)}
            </span>
            <span className={styles.statLab}>kcal / día</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsPage;
