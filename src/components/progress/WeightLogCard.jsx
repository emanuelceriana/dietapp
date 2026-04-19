import React, { useState, useEffect } from 'react';
import { Scale, Plus } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import styles from './WeightLogCard.module.css';

const WeightLogCard = ({ 
  weights, 
  frequency: defaultFrequency = 3, 
  onAdd, 
  onDelete,
  onFrequencyChange,
  baseDate = new Date() 
}) => {
  const [inputValue, setInputValue] = useState('');
  const [frequency, setFrequency] = useState(defaultFrequency);
  
  const start = startOfWeek(baseDate, { weekStartsOn: 1 });
  const end = endOfWeek(baseDate, { weekStartsOn: 1 });
  const startStr = format(start, 'yyyy-MM-dd');
  const endStr = format(end, 'yyyy-MM-dd');
  
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDateStr, setSelectedDateStr] = useState(
    isSameDay(new Date(), baseDate) ? todayStr : startStr
  );

  useEffect(() => {
    if (selectedDateStr < startStr || selectedDateStr > endStr) {
      setSelectedDateStr(startStr);
    }
  }, [selectedDateStr, startStr, endStr]);

  useEffect(() => {
    setFrequency(defaultFrequency);
  }, [defaultFrequency]);

  const daysOfWeek = eachDayOfInterval({ start, end });
  
  const weekWeights = weights.filter(w => {
    const d = parseISO(w.date);
    return d >= start && d <= end;
  });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!inputValue) return;
    onAdd(selectedDateStr, inputValue);
    setInputValue('');
  };

  const isTargetDay = (date) => {
    const day = date.getDay();
    if (frequency === 1) return day === 3;
    if (frequency === 3) return [1, 3, 5].includes(day);
    if (frequency === 5) return [1, 2, 3, 4, 5].includes(day);
    if (frequency === 7) return true;
    return false;
  };

  const handleFrequencyChange = (nextFrequency) => {
    setFrequency(nextFrequency);
    onFrequencyChange?.(nextFrequency);
  };

  const selectedDateObj = daysOfWeek.find(d => format(d, 'yyyy-MM-dd') === selectedDateStr) || new Date();

  return (
    <div className={`${styles.card} card`}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.iconBox}>
            <Scale size={20} />
          </div>
          <div className={styles.titleContent}>
            <h3 className={styles.title}>Pesajes de la Semana</h3>
            <div className={styles.freqSelector}>
              {[1, 3, 5, 7].map(f => (
                <button
                  key={f}
                  className={`${styles.freqBtn} ${frequency === f ? styles.freqActive : ''}`}
                  onClick={() => handleFrequencyChange(f)}
                >
                  {f}d
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.progressBadge}>
          {weekWeights.length} / {frequency}
        </div>
      </div>
      <div className={styles.slotsGrid}>
        {daysOfWeek.map((day) => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const weight = weekWeights.find(w => w.date === dayStr);
          const isSelected = selectedDateStr === dayStr;
          const target = isTargetDay(day);
          
          return (
            <div 
              key={dayStr} 
              className={`
                ${styles.slot} 
                ${weight ? styles.filled : ''} 
                ${isSelected ? styles.selected : ''}
                ${!weight && target ? styles.target : ''}
              `}
              onClick={() => setSelectedDateStr(dayStr)}
            >
              <span className={styles.dayLabel}>
                {format(day, 'EEE', { locale: es }).charAt(0).toUpperCase()}
              </span>
              
              {weight ? (
                <div className={styles.weightValueMini}>
                  <span className={styles.weightNumber}>{weight.weightKg}</span>
                  <button 
                    className={styles.deleteBtn} 
                    onClick={(e) => { e.stopPropagation(); onDelete(weight.id); }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className={styles.emptySlot}>
                  <Plus size={14} className={styles.plusIcon} />
                </div>
              )}
              
              <span className={styles.dayNumber}>{format(day, 'd')}</span>
            </div>
          );
        })}
      </div>

      <form className={styles.inputArea} onSubmit={handleAdd}>
        <div className={styles.inputInfo}>
          Registrar para el <strong>{format(selectedDateObj, "EEEE d 'de' MMMM", { locale: es })}</strong>
        </div>
        <div className={styles.inputGroup}>
          <input
            type="number"
            step="0.1"
            placeholder="Peso (kg)"
            className={styles.input}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button type="submit" className={styles.addBtn} disabled={!inputValue}>
            Registrar
          </button>
        </div>
      </form>
    </div>
  );
};

export default WeightLogCard;
