require('dotenv').config();
const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    })
  : null;

const query = (text, params) => {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured');
  }

  return pool.query(text, params);
};

const initializeDB = async () => {
  if (!pool) {
    console.warn('DATABASE_URL is not configured. API database routes will fail until it is set.');
    return;
  }

  try {
    // Create Tables
    await query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY,
        name TEXT,
        sex TEXT,
        age INTEGER,
        height_cm NUMERIC,
        weight_kg NUMERIC,
        activity_level TEXT,
        manual_kcal INTEGER,
        theme TEXT DEFAULT 'dark',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ingredients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        measure_type TEXT NOT NULL,
        kcal NUMERIC NOT NULL,
        protein NUMERIC DEFAULT 0,
        fat NUMERIC DEFAULT 0,
        carbs NUMERIC DEFAULT 0,
        serving_label TEXT,
        is_public BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS day_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        meals JSONB DEFAULT '[]'::jsonb,
        UNIQUE(user_id, date)
      );

      CREATE TABLE IF NOT EXISTS meal_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        items JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Migration: Add is_public to existing ingredients table if it doesn't exist
    await query(`
      ALTER TABLE ingredients 
      ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
    `);

    // Migration: Ensure ALL current ingredients are marked as public to fulfill the user request
    await query(`
      UPDATE ingredients SET is_public = true;
    `);

    // Migration: Disable RLS on ingredients table to allow global access via our backend logic
    await query(`
      ALTER TABLE ingredients DISABLE ROW LEVEL SECURITY;
    `);

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

module.exports = {
  query,
  pool,
  initializeDB
};
