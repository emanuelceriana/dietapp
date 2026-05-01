const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const applyIngredientCleanup = process.argv.includes('--apply-ingredients');
const applyMealCleanup = process.argv.includes('--apply-meals');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const normalizeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const buildMealSignature = (meal) => {
  const items = Array.isArray(meal && meal.items)
    ? meal.items
      .map((item) => `${String((item && item.ingredientId) || '')}:${normalizeNumber(item && item.quantity)}`)
      .sort()
      .join('|')
    : '';

  return `${normalizeText(meal && meal.name)}::${items}`;
};

const buildIngredientGroupKey = (ingredient) => ([
  ingredient.user_id || 'public',
  normalizeText(ingredient.name),
  ingredient.measure_type || '',
  normalizeNumber(ingredient.kcal),
  normalizeNumber(ingredient.protein),
  normalizeNumber(ingredient.fat),
  normalizeNumber(ingredient.carbs),
  normalizeText(ingredient.serving_label),
  ingredient.is_public ? 'public' : 'private'
].join('::'));

const auditEntries = (entries) => {
  const ingredientUsage = new Set();
  const repeatedMealEntries = [];
  const duplicateMealIdEntries = [];
  const missingMealIds = [];
  const mealCleanupPlan = [];

  for (const entry of entries) {
    const meals = Array.isArray(entry.meals) ? entry.meals : [];
    const signatureCounts = new Map();
    const idCounts = new Map();
    const seenSignatures = new Set();
    const seenIds = new Set();
    const dedupedMeals = [];
    const removedMeals = [];

    for (const meal of meals) {
      const mealId = meal && meal.id ? String(meal.id) : null;
      const signature = buildMealSignature(meal);

      if (mealId) {
        idCounts.set(mealId, (idCounts.get(mealId) || 0) + 1);
      } else {
        missingMealIds.push({
          entryId: entry.id,
          userId: entry.user_id,
          date: entry.date,
          mealName: (meal && meal.name) || ''
        });
      }

      signatureCounts.set(signature, (signatureCounts.get(signature) || 0) + 1);

      const duplicateById = mealId ? seenIds.has(mealId) : false;
      const duplicateBySignature = seenSignatures.has(signature);

      if (duplicateById || duplicateBySignature) {
        removedMeals.push({
          id: mealId,
          name: (meal && meal.name) || '',
          duplicateById,
          duplicateBySignature
        });
        continue;
      }

      if (mealId) {
        seenIds.add(mealId);
      }
      seenSignatures.add(signature);
      dedupedMeals.push(meal);

      for (const item of (meal && meal.items) || []) {
        if (item && item.ingredientId) {
          ingredientUsage.add(String(item.ingredientId));
        }
      }
    }

    const repeatedMeals = [...signatureCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([signature, count]) => ({ signature, count }));

    if (repeatedMeals.length > 0) {
      repeatedMealEntries.push({
        entryId: entry.id,
        userId: entry.user_id,
        date: entry.date,
        mealCount: meals.length,
        repeatedMeals
      });
    }

    const repeatedIds = [...idCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([id, count]) => ({ id, count }));

    if (repeatedIds.length > 0) {
      duplicateMealIdEntries.push({
        entryId: entry.id,
        userId: entry.user_id,
        date: entry.date,
        repeatedIds
      });
    }

    if (removedMeals.length > 0) {
      mealCleanupPlan.push({
        entryId: entry.id,
        userId: entry.user_id,
        date: entry.date,
        originalMeals: meals.length,
        cleanedMeals: dedupedMeals.length,
        removedMeals,
        dedupedMeals
      });
    }
  }

  return {
    ingredientUsage,
    repeatedMealEntries,
    duplicateMealIdEntries,
    missingMealIds,
    mealCleanupPlan
  };
};

const auditIngredients = (ingredients, ingredientUsage) => {
  const groups = new Map();

  for (const ingredient of ingredients) {
    const key = buildIngredientGroupKey(ingredient);
    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push({
      ...ingredient,
      isUsed: ingredientUsage.has(String(ingredient.id))
    });
  }

  const duplicateGroups = [];
  const ingredientCleanupPlan = [];

  for (const rows of groups.values()) {
    if (rows.length < 2) continue;

    const sortedRows = [...rows].sort((a, b) => {
      if (a.isUsed !== b.isUsed) return a.isUsed ? -1 : 1;
      return String(a.id).localeCompare(String(b.id));
    });

    duplicateGroups.push({
      userId: sortedRows[0].user_id,
      normalizedName: normalizeText(sortedRows[0].name),
      measureType: sortedRows[0].measure_type,
      kcal: normalizeNumber(sortedRows[0].kcal),
      protein: normalizeNumber(sortedRows[0].protein),
      fat: normalizeNumber(sortedRows[0].fat),
      carbs: normalizeNumber(sortedRows[0].carbs),
      servingLabel: normalizeText(sortedRows[0].serving_label),
      isPublic: Boolean(sortedRows[0].is_public),
      rows: sortedRows.map((row) => ({
        id: row.id,
        isUsed: row.isUsed
      }))
    });

    const hasUsedRow = sortedRows.some((row) => row.isUsed);
    const rowsToDelete = hasUsedRow
      ? sortedRows.filter((row) => !row.isUsed)
      : sortedRows.slice(1);

    if (rowsToDelete.length > 0) {
      ingredientCleanupPlan.push({
        keepId: sortedRows[0].id,
        deleteIds: rowsToDelete.map((row) => row.id),
        group: duplicateGroups[duplicateGroups.length - 1]
      });
    }
  }

  return {
    duplicateGroups,
    ingredientCleanupPlan
  };
};

const chunk = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const run = async () => {
  const [entriesResult, ingredientsResult] = await Promise.all([
    pool.query('SELECT id, user_id, date::text AS date, meals FROM day_entries ORDER BY date ASC, id ASC'),
    pool.query('SELECT id, user_id, name, measure_type, kcal, protein, fat, carbs, serving_label, is_public FROM ingredients ORDER BY id ASC')
  ]);

  const entryAudit = auditEntries(entriesResult.rows);
  const ingredientAudit = auditIngredients(ingredientsResult.rows, entryAudit.ingredientUsage);

  const ingredientIdsToDelete = ingredientAudit.ingredientCleanupPlan.flatMap((plan) => plan.deleteIds);
  const mealEntriesToClean = entryAudit.mealCleanupPlan;

  const summary = {
    totalEntries: entriesResult.rowCount,
    repeatedMealEntries: entryAudit.repeatedMealEntries.length,
    duplicateMealIdEntries: entryAudit.duplicateMealIdEntries.length,
    missingMealIdsCount: entryAudit.missingMealIds.length,
    duplicateIngredientGroups: ingredientAudit.duplicateGroups.length,
    duplicateUnusedIngredientIds: ingredientIdsToDelete.length,
    mealEntriesEligibleForCleanup: mealEntriesToClean.length,
    repeatedMealEntriesSample: entryAudit.repeatedMealEntries.slice(0, 20),
    duplicateMealIdEntriesSample: entryAudit.duplicateMealIdEntries.slice(0, 20),
    missingMealIdsSample: entryAudit.missingMealIds.slice(0, 20),
    duplicateIngredientGroupsSample: ingredientAudit.duplicateGroups.slice(0, 20),
    ingredientCleanupPlanSample: ingredientAudit.ingredientCleanupPlan.slice(0, 20).map((plan) => ({
      keepId: plan.keepId,
      deleteIds: plan.deleteIds,
      group: plan.group
    })),
    mealCleanupPlanSample: mealEntriesToClean.slice(0, 20).map((plan) => ({
      entryId: plan.entryId,
      userId: plan.userId,
      date: plan.date,
      originalMeals: plan.originalMeals,
      cleanedMeals: plan.cleanedMeals,
      removedMeals: plan.removedMeals
    }))
  };

  if (!applyIngredientCleanup && !applyMealCleanup) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (applyIngredientCleanup && ingredientIdsToDelete.length > 0) {
      for (const ids of chunk(ingredientIdsToDelete, 200)) {
        await client.query('DELETE FROM ingredients WHERE id = ANY($1::uuid[])', [ids]);
      }
    }

    if (applyMealCleanup && mealEntriesToClean.length > 0) {
      for (const plan of mealEntriesToClean) {
        await client.query('UPDATE day_entries SET meals = $2::jsonb WHERE id = $1', [
          plan.entryId,
          JSON.stringify(plan.dedupedMeals)
        ]);
      }
    }

    await client.query('COMMIT');

    console.log(JSON.stringify({
      ...summary,
      appliedIngredientCleanup: applyIngredientCleanup ? ingredientIdsToDelete.length : 0,
      appliedMealCleanup: applyMealCleanup ? mealEntriesToClean.length : 0
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
