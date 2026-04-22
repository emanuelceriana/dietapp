import {
  eachDayOfInterval,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
  subDays
} from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDate } from './dates';

export const getWeightTargetDays = (baseDate, frequency = 3) => {
  const week = eachDayOfInterval({
    start: startOfWeek(baseDate, { weekStartsOn: 1 }),
    end: endOfWeek(baseDate, { weekStartsOn: 1 })
  });

  return week.filter((date) => {
    const day = date.getDay();
    if (frequency === 1) return day === 3;
    if (frequency === 3) return [1, 3, 5].includes(day);
    if (frequency === 5) return [1, 2, 3, 4, 5].includes(day);
    return true;
  });
};

export const getPendingWeightDates = (weights, baseDate, frequency = 3) => {
  const weightsByDate = new Set((weights || []).map((weight) => weight.date));

  return getWeightTargetDays(baseDate, frequency).filter((date) => (
    !weightsByDate.has(formatDate(date))
  ));
};

export const calculateNutritionStreak = (dailyStats, anchorDate = new Date()) => {
  const daysByDate = new Map((dailyStats || []).map((day) => [day.date, day]));
  let streak = 0;
  let cursor = anchorDate;

  while ((daysByDate.get(formatDate(cursor))?.kcal || 0) > 0) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }

  return streak;
};

export const getWeightTrendLabel = (weights = []) => {
  if (weights.length < 2) return 'Sin tendencia suficiente';

  const sortedWeights = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const first = Number(sortedWeights[0]?.weightKg) || 0;
  const last = Number(sortedWeights[sortedWeights.length - 1]?.weightKg) || 0;
  const delta = Math.round((last - first) * 10) / 10;

  if (Math.abs(delta) < 0.1) {
    return 'Peso estable';
  }

  return delta > 0
    ? `Subiendo ${delta.toFixed(1)} kg`
    : `Bajando ${Math.abs(delta).toFixed(1)} kg`;
};

export const downloadTextFile = (filename, content) => {
  const file = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = window.URL.createObjectURL(file);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const buildProgressSummary = ({
  title,
  intervalLabel,
  nutritionTarget,
  nutritionData,
  periodTotals,
  averageDailyKcal,
  weights,
  weightGoal,
  nutritionStreak,
  pendingWeightDates
}) => {
  const loggedDays = (nutritionData || []).filter((day) => day.kcal > 0).length;
  const avgWeight = weights.length > 0
    ? (weights.reduce((acc, weight) => acc + (Number(weight.weightKg) || 0), 0) / weights.length).toFixed(1)
    : null;
  const weightTrend = getWeightTrendLabel(weights);
  const pendingWeightLabel = pendingWeightDates.length > 0
    ? pendingWeightDates.map((date) => format(date, 'EEE d MMM', { locale: es })).join(', ')
    : 'Sin pendientes';
  const weightLines = weights.length > 0
    ? weights
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((weight) => `- ${format(parseISO(weight.date), 'EEE d MMM', { locale: es })}: ${weight.weightKg} kg`)
      .join('\n')
    : '- Sin registros';

  return [
    `DietApp - ${title}`,
    `Periodo: ${intervalLabel}`,
    `Objetivo diario: ${nutritionTarget} kcal`,
    '',
    'Nutricion',
    `- Dias con comidas: ${loggedDays}/${nutritionData.length}`,
    `- Promedio diario: ${averageDailyKcal} kcal`,
    `- Total calorias: ${periodTotals.kcal} kcal`,
    `- Proteinas: ${periodTotals.protein} g`,
    `- Carbohidratos: ${periodTotals.carbs} g`,
    `- Grasas: ${periodTotals.fat} g`,
    '',
    'Peso',
    `- Registros: ${weights.length}/${weightGoal}`,
    `- Promedio: ${avgWeight ? `${avgWeight} kg` : 'Sin datos'}`,
    `- Tendencia: ${weightTrend}`,
    weightLines,
    '',
    'Adherencia',
    `- Racha actual: ${nutritionStreak} dia(s)`,
    `- Pesajes pendientes: ${pendingWeightLabel}`
  ].join('\n');
};
