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
