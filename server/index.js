require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const { query, initializeDB } = require('./db');
const authenticate = require('./auth');

const app = express();
const clientRootPath = path.join(__dirname, '..');
const clientDistPath = path.join(clientRootPath, 'dist');
const clientIndexPath = path.join(clientDistPath, 'index.html');
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
const PORT = process.env.PORT || (isProduction ? 3001 : 5173);

const numberOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toProfile = (row) => row && ({
  id: row.id,
  name: row.name,
  sex: row.sex,
  age: row.age,
  heightCm: numberOrNull(row.height_cm),
  weightKg: numberOrNull(row.weight_kg),
  activityLevel: row.activity_level,
  manualGoal: row.manual_kcal,
  weightFrequency: row.weight_frequency,
  theme: row.theme
});

const formatDate = (date) => {
  if (!(date instanceof Date)) return date;
  // Use UTC parts to guarantee the nominal date remains the same regardless of server/client timezone
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toWeightLog = (row) => row && ({
  id: row.id,
  date: formatDate(row.date),
  weightKg: numberOrNull(row.weight_kg)
});

const toIngredient = (row) => row && ({
  id: row.id,
  name: row.name,
  measureType: row.measure_type,
  kcal: numberOrNull(row.kcal),
  protein: numberOrNull(row.protein),
  fat: numberOrNull(row.fat),
  carbs: numberOrNull(row.carbs),
  servingLabel: row.serving_label,
  isPublic: row.is_public,
  userId: row.user_id,
  createdAt: row.created_at
});

const toEntry = (row) => row && ({
  id: row.id,
  date: formatDate(row.date),
  meals: row.meals || []
});

const attachIngredientsToMeals = (meals, ingredients) => {
  const ingredientsById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

  return (meals || []).map((meal) => ({
    ...meal,
    items: (meal.items || []).map((item) => ({
      ...item,
      ingredient: ingredientsById.get(String(item.ingredientId)) || null
    }))
  }));
};

const toTemplate = (row) => row && ({
  id: row.id,
  name: row.name,
  items: row.items || [],
  createdAt: row.created_at
});

const ensureProfile = async (user) => {
  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario';

  const result = await query(
    `INSERT INTO profiles (id, name, sex, age, height_cm, weight_kg, activity_level, weight_frequency, theme)
     VALUES ($1, $2, 'male', 30, 175, 75, 'moderate', 3, 'dark')
     ON CONFLICT (id) DO UPDATE
       SET name = COALESCE(profiles.name, EXCLUDED.name)
     RETURNING *`,
    [user.id, name]
  );

  return result.rows[0];
};

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// --- API ROUTES ---

// Initial setup: ensure profile exists
app.post('/api/init', authenticate, async (req, res) => {
  try {
    const profile = await ensureProfile(req.user);
    res.json({ success: true, profile: toProfile(profile) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Profile
app.get('/api/profile', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM profiles WHERE id = $1', [req.user.id]);
    const profile = result.rows[0] || await ensureProfile(req.user);
    res.json(toProfile(profile));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/profile', authenticate, async (req, res) => {
  const { name, sex, age, heightCm, weightKg, activityLevel, manualGoal, weightFrequency, theme } = req.body;
  try {
    const result = await query(
      `UPDATE profiles 
       SET name=$2, sex=$3, age=$4, height_cm=$5, weight_kg=$6, activity_level=$7, manual_kcal=$8, weight_frequency=$9, theme=$10, updated_at=NOW()
       WHERE id = $1 RETURNING *`,
      [req.user.id, name, sex, age, heightCm, weightKg, activityLevel, manualGoal, weightFrequency, theme]
    );
    res.json(toProfile(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ingredients
app.get('/api/ingredients', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM ingredients WHERE user_id = $1 OR is_public = true ORDER BY name ASC',
      [req.user.id]
    );
    res.json(result.rows.map(toIngredient));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ingredients', authenticate, async (req, res) => {
  const { name, measureType, kcal, protein, fat, carbs, servingLabel, isPublic } = req.body;
  try {
    const result = await query(
      `INSERT INTO ingredients (user_id, name, measure_type, kcal, protein, fat, carbs, serving_label, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.user.id, name, measureType, kcal, protein, fat, carbs, servingLabel, isPublic ?? true]
    );
    res.json(toIngredient(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/ingredients/:id', authenticate, async (req, res) => {
  const { name, measureType, kcal, protein, fat, carbs, servingLabel, isPublic } = req.body;
  try {
    const result = await query(
      `UPDATE ingredients
       SET name=$3, measure_type=$4, kcal=$5, protein=$6, fat=$7, carbs=$8, serving_label=$9, is_public=$10
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.user.id, name, measureType, kcal, protein, fat, carbs, servingLabel, isPublic]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }

    res.json(toIngredient(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/ingredients/:id', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM ingredients WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Day Entries
app.get('/api/entries/:date', authenticate, async (req, res) => {
  try {
    const [entryResult, ingredientResult] = await Promise.all([
      query('SELECT id, date::text, meals FROM day_entries WHERE user_id = $1 AND date = $2', [req.user.id, req.params.date]),
      query('SELECT * FROM ingredients WHERE user_id = $1 OR is_public = true', [req.user.id])
    ]);
    const entry = toEntry(entryResult.rows[0]) || { meals: [] };
    const ingredients = ingredientResult.rows.map(toIngredient);

    res.json({
      ...entry,
      meals: attachIngredientsToMeals(entry.meals, ingredients)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/entries', authenticate, async (req, res) => {
  const { date, meals } = req.body;
  try {
    const result = await query(
      `INSERT INTO day_entries (user_id, date, meals)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, date) DO UPDATE SET meals = $3 
       RETURNING id, date::text, meals`,
      [req.user.id, date, JSON.stringify(meals)]
    );
    const ingredientResult = await query('SELECT * FROM ingredients WHERE user_id = $1 OR is_public = true', [req.user.id]);
    const entry = toEntry(result.rows[0]);
    const ingredients = ingredientResult.rows.map(toIngredient);

    res.json({
      ...entry,
      meals: attachIngredientsToMeals(entry.meals, ingredients)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Meal Templates
app.get('/api/templates', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM meal_templates WHERE user_id = $1', [req.user.id]);
    res.json(result.rows.map(toTemplate));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/templates', authenticate, async (req, res) => {
  const { name, items } = req.body;
  try {
    const result = await query(
      `INSERT INTO meal_templates (user_id, name, items)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, name, JSON.stringify(items)]
    );
    res.json(toTemplate(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/templates/:id', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM meal_templates WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Weight Logs
app.get('/api/weights', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, date::text, weight_kg FROM weight_logs WHERE user_id = $1 ORDER BY date DESC',
      [req.user.id]
    );
    res.json(result.rows.map(toWeightLog));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/weights', authenticate, async (req, res) => {
  const { date, weightKg } = req.body;
  try {
    const result = await query(
      `INSERT INTO weight_logs (user_id, date, weight_kg)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, date) DO UPDATE SET weight_kg = $3 
       RETURNING id, date::text, weight_kg`,
      [req.user.id, date, weightKg]
    );
    res.json(toWeightLog(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/weights/:id', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM weight_logs WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const configureFrontend = async () => {
  if (isProduction) {
    if (!fs.existsSync(clientIndexPath)) {
      console.warn(`Frontend build not found at ${clientIndexPath}. Run npm run build before starting in production.`);

      app.get('*', (req, res) => {
        res.status(503).send('Frontend build not found. Run npm run build before starting the server.');
      });
      return;
    }

    app.use(express.static(clientDistPath));
    app.get('*', (req, res) => {
      res.sendFile(clientIndexPath);
    });
    return;
  }

  try {
    const { createServer } = await import('vite');
    const vite = await createServer({
      root: clientRootPath,
      appType: 'spa',
      server: {
        middlewareMode: true
      }
    });

    app.use(vite.middlewares);
    console.log('Vite dev middleware enabled');
  } catch (err) {
    console.error('Failed to start Vite dev middleware:', err);
    app.get('*', (req, res) => {
      res.status(503).send('Frontend dev server failed to start. Check the server logs.');
    });
  }
};

const startServer = async () => {
  await initializeDB();
  await configureFrontend();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
