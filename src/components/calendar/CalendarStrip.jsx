import React, { useRef, useEffect } from 'react';
import { format, isSameDay, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { formatDate } from '../../utils/dates';
import styles from './CalendarStrip.module.css';

const CalendarStrip = ({ selectedDate, onDateSelect, activeDates }) => {
  const scrollRef = useRef(null);
  const datePickerRef = useRef(null);
  
  // Generate a range of days around selectedDate
  const days = [];
  for (let i = -15; i <= 15; i++) {
    days.push(addDays(selectedDate, i));
  }

  useEffect(() => {
    // Scroll to center on mount or when date changes significantly
    if (scrollRef.current) {
      const activeItem = scrollRef.current.querySelector(`.${styles.active}`);
      if (activeItem) {
        scrollRef.current.scrollTo({
          left: activeItem.offsetLeft - scrollRef.current.offsetWidth / 2 + activeItem.offsetWidth / 2,
          behavior: 'smooth'
        });
      }
    }
  }, [selectedDate]);

  const handleDatePickerChange = (e) => {
    const date = new Date(e.target.value + 'T12:00:00'); // Use local noon to avoid TZ issues
    if (!isNaN(date.getTime())) {
      onDateSelect(date);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.monthInfo} onClick={() => datePickerRef.current?.showPicker()}>
          <h2 className={styles.monthName}>
            {format(selectedDate, 'MMMM yyyy', { locale: es })}
          </h2>
          <CalendarIcon size={16} className={styles.pickerIcon} />
          <input 
            type="date"
            ref={datePickerRef}
            className={styles.hiddenPicker}
            onChange={handleDatePickerChange}
            value={format(selectedDate, 'yyyy-MM-dd')}
          />
        </div>
      </div>

      <div className={styles.scrollArea} ref={scrollRef}>
        {days.map((date) => {
          const selected = isSameDay(date, selectedDate);
          const isToday = isSameDay(date, new Date());
          const hasData = activeDates?.has(formatDate(date));
          
          return (
            <button
              key={date.toISOString()}
              className={`${styles.dayButton} ${selected ? styles.active : ''}`}
              onClick={() => onDateSelect(date)}
            >
              <span className={styles.weekday}>
                {format(date, 'EEE', { locale: es }).replace('.', '')}
              </span>
              <div className={`${styles.dateNumber} ${isToday ? styles.today : ''}`}>
                {format(date, 'd')}
                {hasData && <div className={styles.dot} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarStrip;
