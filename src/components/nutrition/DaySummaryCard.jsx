import React, { useEffect, useRef, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import styles from './DaySummaryCard.module.css';

const CALORIE_ANIMATION_MS = 3000;

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const useAnimatedNumber = (value, resetKey, duration) => {
  const frameRef = useRef(null);
  const previousKeyRef = useRef(resetKey);
  const currentValueRef = useRef(0);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const nextValue = Math.max(Number(value) || 0, 0);
    const shouldReduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const shouldReset = previousKeyRef.current !== resetKey;
    const startValue = shouldReset ? 0 : currentValueRef.current;

    previousKeyRef.current = resetKey;

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }

    if (shouldReduceMotion || duration <= 0 || startValue === nextValue) {
      currentValueRef.current = nextValue;
      setDisplayValue(nextValue);
      return undefined;
    }

    currentValueRef.current = startValue;
    setDisplayValue(startValue);

    const startedAt = performance.now();
    const delta = nextValue - startValue;

    const animate = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const animatedValue = startValue + delta * easeOutCubic(progress);

      currentValueRef.current = animatedValue;
      setDisplayValue(animatedValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value, resetKey, duration]);

  return displayValue;
};

const DaySummaryCard = ({ totals, target, animationKey = 'day-summary' }) => {
  const safeTarget = Math.max(Number(target) || 0, 1);
  const totalKcal = Math.max(Number(totals.kcal) || 0, 0);
  const animatedKcal = useAnimatedNumber(totalKcal, animationKey, CALORIE_ANIMATION_MS);
  const roundedAnimatedKcal = Math.round(animatedKcal);
  const isOverKcal = totalKcal > safeTarget;
  const isAnimatedOverKcal = animatedKcal > safeTarget;
  const percent = Math.round((totalKcal / safeTarget) * 100);
  
  const kcalData = isAnimatedOverKcal 
    ? [
        { name: 'Meta', value: safeTarget },
        { name: 'Excedente', value: animatedKcal - safeTarget },
      ]
    : [
        { name: 'Consumido', value: animatedKcal },
        { name: 'Restante', value: Math.max(safeTarget - animatedKcal, 0) },
      ];

  const kcalColors = isAnimatedOverKcal 
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
              key={animationKey}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={75}
              paddingAngle={isAnimatedOverKcal ? 0 : 5}
              dataKey="value"
              startAngle={90}
              endAngle={450}
              stroke="none"
              isAnimationActive={false}
            >
              {kcalData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={kcalColors[index]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className={styles.chartOverlay}>
          <span className={`${styles.kcalValue} ${isOverKcal ? styles.overageText : ''}`}>{roundedAnimatedKcal}</span>
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
              <span className={styles.macroValue}>{totals.protein}g / {Math.round((safeTarget * 0.3) / 4)}g</span>
            </div>
            {renderProgressBar(totals.protein, (safeTarget * 0.3) / 4, 'var(--color-protein)')}
          </div>
          
          <div className={styles.macroItem}>
            <div className={styles.macroHeader}>
              <span className={styles.macroName}>Carbos</span>
              <span className={styles.macroValue}>{totals.carbs}g / {Math.round((safeTarget * 0.45) / 4)}g</span>
            </div>
            {renderProgressBar(totals.carbs, (safeTarget * 0.45) / 4, 'var(--color-carbs)')}
          </div>
          
          <div className={styles.macroItem}>
            <div className={styles.macroHeader}>
              <span className={styles.macroName}>Grasas</span>
              <span className={styles.macroValue}>{totals.fat}g / {Math.round((safeTarget * 0.25) / 9)}g</span>
            </div>
            {renderProgressBar(totals.fat, (safeTarget * 0.25) / 9, 'var(--color-fat)')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DaySummaryCard;
