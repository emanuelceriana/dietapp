import { format, addDays, subDays, startOfDay, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

export const formatDate = (date) => format(date, 'yyyy-MM-dd');

export const getDisplayDate = (date) => {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  
  if (isSameDay(target, today)) return 'Hoy';
  if (isSameDay(target, addDays(today, 1))) return 'Mañana';
  if (isSameDay(target, subDays(today, 1))) return 'Ayer';
  
  return format(date, "EEEE d 'de' MMMM", { locale: es });
};

export const getDaysAround = (centerDate, range = 7) => {
  const days = [];
  for (let i = -range; i <= range; i++) {
    days.push(addDays(centerDate, i));
  }
  return days;
};
