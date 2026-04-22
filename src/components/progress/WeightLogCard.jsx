import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  
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

  const isTargetDay = useCallback((date) => {
    const day = date.getDay();
    if (frequency === 1) return day === 3;
    if (frequency === 3) return [1, 3, 5].includes(day);
    if (frequency === 5) return [1, 2, 3, 4, 5].includes(day);
    if (frequency === 7) return true;
    return false;
  }, [frequency]);

  const daysOfWeek = useMemo(() => eachDayOfInterval({ start, end }), [start, end]);

  const weekWeights = useMemo(() => weights.filter((weight) => {
    const date = parseISO(weight.date);
    return date >= start && date <= end;
  }), [end, start, weights]);

  const weightsByDate = useMemo(() => new Map(weekWeights.map((weight) => [weight.date, weight])), [weekWeights]);

  const targetDates = useMemo(() => daysOfWeek
    .filter((day) => isTargetDay(day))
    .map((day) => format(day, 'yyyy-MM-dd')), [daysOfWeek, isTargetDay]);

  const suggestedDateStr = useMemo(() => {
    const missingTargetDate = targetDates.find((dayStr) => !weightsByDate.has(dayStr));
    if (missingTargetDate === todayStr) return todayStr;

    const todayIsMissingTarget = targetDates.includes(todayStr) && !weightsByDate.has(todayStr);
    if (todayIsMissingTarget) return todayStr;
    if (missingTargetDate) return missingTargetDate;

    const latestLoggedDate = [...weekWeights]
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.date;

    return latestLoggedDate || startStr;
  }, [startStr, targetDates, todayStr, weekWeights, weightsByDate]);

  useEffect(() => {
    setSelectedDateStr((currentDate) => {
      if (currentDate < startStr || currentDate > endStr) {
        return suggestedDateStr;
      }

      const hasWeightForSelectedDay = weightsByDate.has(currentDate);
      const hasPendingTargetDays = targetDates.some((dayStr) => !weightsByDate.has(dayStr));

      if (hasWeightForSelectedDay && hasPendingTargetDays) {
        return suggestedDateStr;
      }

      return currentDate;
    });
  }, [endStr, startStr, suggestedDateStr, targetDates, weightsByDate]);

  const selectedWeight = weightsByDate.get(selectedDateStr) || null;

  useEffect(() => {
    setInputValue(selectedWeight ? String(selectedWeight.weightKg) : '');
    setSubmitError('');
  }, [selectedDateStr, selectedWeight]);

  const selectedDateObj = daysOfWeek.find((day) => format(day, 'yyyy-MM-dd') === selectedDateStr) || new Date();
  const completedTargetCount = targetDates.filter((dayStr) => weightsByDate.has(dayStr)).length;
  const remainingTargetCount = targetDates.length - completedTargetCount;
  const selectedDayIsTarget = targetDates.includes(selectedDateStr);

  const helperText = selectedWeight
    ? 'Podés actualizar este pesaje si querés corregirlo.'
    : selectedDayIsTarget
      ? remainingTargetCount > 0
        ? 'Día sugerido según tu frecuencia semanal.'
        : 'Ya completaste todos los días sugeridos de esta semana.'
      : 'Podés registrar un pesaje extra fuera de los días sugeridos.';

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!inputValue || isSubmitting) return;

    setSubmitError('');
    setIsSubmitting(true);

    try {
      await onAdd(selectedDateStr, inputValue);
    } catch (err) {
      setSubmitError('No pude registrar el peso. Intentá de nuevo.');
      console.error('Error saving weight:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFrequencyChange = (nextFrequency) => {
    setFrequency(nextFrequency);
    onFrequencyChange?.(nextFrequency);
  };

  const handleDelete = async (event, weightId) => {
    event.stopPropagation();
    setSubmitError('');

    try {
      await onDelete(weightId);
    } catch (err) {
      setSubmitError('No pude borrar el pesaje. Intentá de nuevo.');
      console.error('Error deleting weight:', err);
    }
  };

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
          {completedTargetCount} / {targetDates.length}
        </div>
      </div>
      <div className={styles.slotsScroller}>
        <div className={styles.slotsGrid}>
          {daysOfWeek.map((day) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const weight = weightsByDate.get(dayStr);
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
                      onClick={(event) => handleDelete(event, weight.id)}
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
      </div>

      <form className={styles.inputArea} onSubmit={handleAdd}>
        <div className={styles.inputInfo}>
          {selectedWeight ? 'Editar' : 'Registrar para el'} <strong>{format(selectedDateObj, "EEEE d 'de' MMMM", { locale: es })}</strong>
        </div>
        <div className={styles.helperText}>{helperText}</div>
        <div className={styles.inputGroup}>
          <input
            type="number"
            step="0.1"
            placeholder={selectedWeight ? 'Actualizar peso (kg)' : 'Peso (kg)'}
            className={styles.input}
            value={inputValue}
            disabled={isSubmitting}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button type="submit" className={styles.addBtn} disabled={!inputValue || isSubmitting}>
            {isSubmitting ? 'Guardando...' : selectedWeight ? 'Actualizar' : 'Registrar'}
          </button>
        </div>
        {submitError && <div className={styles.errorText}>{submitError}</div>}
      </form>
    </div>
  );
};

export default WeightLogCard;
