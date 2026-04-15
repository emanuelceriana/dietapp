import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import styles from './DaySummaryCard.module.css';

const DaySummaryCard = ({ totals, target }) => {
  const isOverKcal = totals.kcal > target;
  const percent = Math.round((totals.kcal / target) * 100);
  
  const kcalData = isOverKcal 
    ? [
        { name: 'Meta', value: target },
        { name: 'Excedente', value: totals.kcal - target },
      ]
    : [
        { name: 'Consumido', value: totals.kcal },
        { name: 'Restante', value: Math.max(target - totals.kcal, 0) },
      ];

  const kcalColors = isOverKcal 
    ? ['var(--accent-primary)', 'var(--accent-danger)']
    : ['var(--accent-primary)', 'var(--border-subtle)'];

  const renderProgressBar = (current, goal, color) => {
    const isOver = current > goal;
    const ratio = isOver ? (goal / current) * 100 : (current / goal) * 100;
    
    if (isOver) {
      return (
        <div className={styles.barContainer}>
          <div 
            className={styles.bar} 
            style={{ width: `${ratio}%`, backgroundColor: color }} 
          />
          <div 
            className={styles.bar} 
            style={{ width: `${100 - ratio}%`, backgroundColor: 'var(--accent-danger)' }} 
          />
        </div>
      );
    }

    return (
      <div className={styles.barContainer}>
        <div 
          className={styles.bar} 
          style={{ width: `${ratio}%`, backgroundColor: color }} 
        />
      </div>
    );
  };

  return (
    <div className={`${styles.card} card`}>
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie
              data={kcalData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={75}
              paddingAngle={isOverKcal ? 0 : 5}
              dataKey="value"
              startAngle={90}
              endAngle={450}
              stroke="none"
            >
              {kcalData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={kcalColors[index]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className={styles.chartOverlay}>
          <span className={`${styles.kcalValue} ${isOverKcal ? styles.overageText : ''}`}>{totals.kcal}</span>
          <span className={styles.kcalLabel}>kcal</span>
        </div>
      </div>

      <div className={styles.info}>
        <div className={styles.mainInfo}>
          <h3 className={styles.title}>Presupuesto Diario</h3>
          <p className={`${styles.subtitle} ${isOverKcal ? styles.overageSub : ''}`}>
            {isOverKcal ? `Te has pasado un ${percent - 100}%` : `Has consumido el ${percent}% de tu meta`}
          </p>
        </div>
        
        <div className={styles.macros}>
          <div className={styles.macroItem}>
            <div className={styles.macroHeader}>
              <span className={styles.macroName}>Proteínas</span>
              <span className={styles.macroValue}>{totals.protein}g / {Math.round((target * 0.3) / 4)}g</span>
            </div>
            {renderProgressBar(totals.protein, (target * 0.3) / 4, 'var(--color-protein)')}
          </div>
          
          <div className={styles.macroItem}>
            <div className={styles.macroHeader}>
              <span className={styles.macroName}>Carbos</span>
              <span className={styles.macroValue}>{totals.carbs}g / {Math.round((target * 0.45) / 4)}g</span>
            </div>
            {renderProgressBar(totals.carbs, (target * 0.45) / 4, 'var(--color-carbs)')}
          </div>
          
          <div className={styles.macroItem}>
            <div className={styles.macroHeader}>
              <span className={styles.macroName}>Grasas</span>
              <span className={styles.macroValue}>{totals.fat}g / {Math.round((target * 0.25) / 9)}g</span>
            </div>
            {renderProgressBar(totals.fat, (target * 0.25) / 9, 'var(--color-fat)')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DaySummaryCard;
