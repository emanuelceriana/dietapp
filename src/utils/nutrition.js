/**
 * Mifflin-St Jeor Equation
 * 
 * BMR = 10 * weight (kg) + 6.25 * height (cm) - 5 * age + s
 * s is +5 for males and -161 for females
 */
export const calculateBMR = (profile) => {
  if (!profile) return 0;
  const { sex, weightKg, heightCm, age } = profile;
  const s = sex === 'male' ? 5 : -161;
  return (10 * weightKg) + (6.25 * heightCm) - (5 * age) + s;
};

const MACRO_SPLIT = {
  protein: 0.3,
  carbs: 0.45,
  fat: 0.25
};

const MACRO_META = {
  protein: { label: 'Proteína', labelLower: 'proteína', kcalPerGram: 4 },
  carbs: { label: 'Carbos', labelLower: 'carbos', kcalPerGram: 4 },
  fat: { label: 'Grasas', labelLower: 'grasas', kcalPerGram: 9 }
};

const roundMacro = (value) => Math.round((Number(value) || 0) * 10) / 10;

const getIngredientFromItem = (item, ingredients = []) => (
  ingredients.find((ingredient) => ingredient.id === item.ingredientId) || item.ingredient
);

export const getMacroTargets = (targetKcal) => {
  const safeTarget = Math.max(Number(targetKcal) || 0, 0);

  return {
    kcal: Math.round(safeTarget),
    protein: Math.round((safeTarget * MACRO_SPLIT.protein) / 4),
    carbs: Math.round((safeTarget * MACRO_SPLIT.carbs) / 4),
    fat: Math.round((safeTarget * MACRO_SPLIT.fat) / 9)
  };
};

export const calculateMealNutrition = (meal, ingredients = []) => {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

  (meal?.items || []).forEach((item) => {
    const ingredient = getIngredientFromItem(item, ingredients);
    if (!ingredient) return;

    const quantity = Number(item.quantity) || 0;
    const factor = ingredient.measureType === 'per_serving'
      ? quantity
      : quantity / 100;

    totals.kcal += (Number(ingredient.kcal) || 0) * factor;
    totals.protein += (Number(ingredient.protein) || 0) * factor;
    totals.carbs += (Number(ingredient.carbs) || 0) * factor;
    totals.fat += (Number(ingredient.fat) || 0) * factor;
  });

  return {
    kcal: Math.round(totals.kcal),
    protein: roundMacro(totals.protein),
    carbs: roundMacro(totals.carbs),
    fat: roundMacro(totals.fat)
  };
};

export const calculateEntryNutrition = (entry, ingredients = []) => {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

  (entry?.meals || []).forEach((meal) => {
    const mealTotals = calculateMealNutrition(meal, ingredients);
    totals.kcal += mealTotals.kcal;
    totals.protein += mealTotals.protein;
    totals.carbs += mealTotals.carbs;
    totals.fat += mealTotals.fat;
  });

  return {
    kcal: Math.round(totals.kcal),
    protein: roundMacro(totals.protein),
    carbs: roundMacro(totals.carbs),
    fat: roundMacro(totals.fat)
  };
};

export const calculateRemainingNutrition = (totals, targetKcal) => {
  const macroTargets = getMacroTargets(targetKcal);

  return {
    kcal: Math.round(macroTargets.kcal - (Number(totals?.kcal) || 0)),
    protein: roundMacro(macroTargets.protein - (Number(totals?.protein) || 0)),
    carbs: roundMacro(macroTargets.carbs - (Number(totals?.carbs) || 0)),
    fat: roundMacro(macroTargets.fat - (Number(totals?.fat) || 0))
  };
};

export const getPerMealBudget = (totals, targetKcal, mealsCount = 0, dailyMealGoal = 4) => {
  const remaining = calculateRemainingNutrition(totals, targetKcal);
  const remainingMeals = Math.max(dailyMealGoal - Math.max(Number(mealsCount) || 0, 0), 1);

  return {
    remainingMeals,
    kcal: Math.max(Math.round(remaining.kcal / remainingMeals), 0),
    protein: Math.max(roundMacro(remaining.protein / remainingMeals), 0),
    carbs: Math.max(roundMacro(remaining.carbs / remainingMeals), 0),
    fat: Math.max(roundMacro(remaining.fat / remainingMeals), 0)
  };
};

export const getMacroFocus = (remainingNutrition, targetKcal) => {
  const macroTargets = getMacroTargets(targetKcal);
  const positiveGaps = Object.entries(MACRO_META)
    .map(([key, meta]) => {
      const remaining = Math.max(Number(remainingNutrition?.[key]) || 0, 0);
      const target = Math.max(Number(macroTargets?.[key]) || 0, 1);

      return {
        key,
        label: meta.label,
        labelLower: meta.labelLower,
        remaining: roundMacro(remaining),
        ratio: remaining / target,
        kcalGap: remaining * meta.kcalPerGram
      };
    })
    .filter((macro) => macro.remaining > 0)
    .sort((a, b) => (
      b.ratio - a.ratio ||
      b.kcalGap - a.kcalGap ||
      b.remaining - a.remaining
    ));

  if (positiveGaps.length === 0) {
    return {
      primary: null,
      secondary: null,
      focusLabel: 'Macros cubiertos',
      recommendation: ''
    };
  }

  const [primary, secondary] = positiveGaps;
  const includeSecondary = Boolean(secondary && secondary.ratio >= 0.38);

  return {
    primary,
    secondary: includeSecondary ? secondary : null,
    focusLabel: includeSecondary
      ? `${primary.label} y ${secondary.labelLower}`
      : `${primary.label} +${Math.round(primary.remaining)}g`,
    recommendation: includeSecondary
      ? `${primary.labelLower} y ${secondary.labelLower}`
      : primary.labelLower
  };
};

export const getMacroSuggestion = (remainingNutrition, targetKcal) => {
  const macroFocus = getMacroFocus(remainingNutrition, targetKcal);

  if (!macroFocus.primary) {
    return 'Ya cubriste tus macros objetivo. Si comés algo más, priorizá volumen y proteína magra.';
  }

  if (macroFocus.secondary) {
    return `Te conviene priorizar ${macroFocus.recommendation} para recuperar mejor el balance del día.`;
  }

  if (macroFocus.primary.key === 'protein') {
    return 'Te conviene priorizar proteína magra para cerrar el día sin subir demasiado las calorías.';
  }

  if (macroFocus.primary.key === 'carbs') {
    return 'Te faltan carbohidratos: una fuente compleja te va a ayudar a completar energía y rendimiento.';
  }

  return 'Tu mayor hueco está en grasas: sumá una porción chica de grasas saludables y equilibrá la próxima comida.';
};

/**
 * TDEE Multipliers
 */
const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,        // Little or no exercise
  light: 1.375,         // Light exercise 1-3 days/week
  moderate: 1.55,       // Moderate exercise 3-5 days/week
  active: 1.725,         // Hard exercise 6-7 days/week
  very_active: 1.9       // Very hard exercise & physical job or 2x training
};

export const calculateTDEE = (profile) => {
  if (!profile) return 0;
  
  // Use manual goal if provided and valid
  if (profile.manualGoal && profile.manualGoal > 0) {
    return Math.round(profile.manualGoal);
  }

  const bmr = calculateBMR(profile);
  const multiplier = ACTIVITY_MULTIPLIERS[profile.activityLevel] || 1.2;
  return Math.round(bmr * multiplier);
};

export const getActivityLabel = (level) => {
  const labels = {
    sedentary: 'Sedentario',
    light: 'Actividad Ligera',
    moderate: 'Actividad Moderada',
    active: 'Activo',
    very_active: 'Muy Activo'
  };
  return labels[level] || level;
};
