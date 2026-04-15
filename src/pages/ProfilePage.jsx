import React, { useState, useEffect } from 'react';
import { useProfile } from '../hooks/useProfile';
import { useAuth } from '../context/AuthContext';
import { calculateTDEE, getActivityLabel } from '../utils/nutrition';
import { User, Moon, Sun, LogOut } from 'lucide-react';
import styles from './ProfilePage.module.css';

const ProfilePage = () => {
  const { profile, isLoading, updateProfile, setTheme } = useProfile();
  const { signOut } = useAuth();
  const [formData, setFormData] = useState(null);

  useEffect(() => {
    if (profile && !formData) {
      setFormData(profile);
    }
  }, [profile, formData]);

  if (isLoading || !formData) return <div className={styles.loading}>Cargando...</div>;

  const tdee = calculateTDEE(formData);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...formData, [name]: value };
    setFormData(updated);
    // Auto-save logic or could be a manual save button
    updateProfile({ [name]: name === 'sex' || name === 'activityLevel' || name === 'theme' ? value : parseFloat(value) });
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.avatar}>
          <User size={40} color="white" />
        </div>
        <div className={styles.headerInfo}>
          <h1 className={styles.name}>Tu Perfil</h1>
          <button 
            className={styles.headerThemeToggle}
            onClick={() => setTheme(profile.theme === 'dark' ? 'light' : 'dark')}
          >
            {profile.theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
        <p className={styles.subtitle}>Configura tus metas y preferencias</p>
      </header>

      <div className={styles.summaryCard}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Meta Diaria</span>
          <span className={styles.statValue}>{tdee} kcal</span>
          <span className={styles.statSub}>{formData.manualGoal > 0 ? '(Manual)' : '(Automático)'}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.stat}>
          <span className={styles.statLabel}>Personalizar Meta</span>
          <input 
            type="number" 
            name="manualGoal" 
            className={styles.manualInput} 
            value={formData.manualGoal || ''} 
            onChange={handleChange}
            placeholder="Ej: 2500"
          />
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Datos Físicos</h3>
        <div className={styles.grid}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Sexo</label>
            <select name="sex" className={styles.select} value={formData.sex} onChange={handleChange}>
              <option value="male">Hombre</option>
              <option value="female">Mujer</option>
            </select>
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Edad</label>
            <input type="number" name="age" className={styles.input} value={formData.age} onChange={handleChange} />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Peso (kg)</label>
            <input type="number" name="weightKg" className={styles.input} value={formData.weightKg} onChange={handleChange} />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Altura (cm)</label>
            <input type="number" name="heightCm" className={styles.input} value={formData.heightCm} onChange={handleChange} />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Nivel de Actividad</h3>
        <div className={styles.activityList}>
          {['sedentary', 'light', 'moderate', 'active', 'very_active'].map((level) => (
            <button
              key={level}
              className={`${styles.activityItem} ${formData.activityLevel === level ? styles.activeActivity : ''}`}
              onClick={() => handleChange({ target: { name: 'activityLevel', value: level } })}
            >
              <div className={styles.activityInfo}>
                <span className={styles.activityName}>{getActivityLabel(level)}</span>
              </div>
              {formData.activityLevel === level && <div className={styles.check}>✓</div>}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Cuenta</h3>
        <button className={styles.signOutBtn} onClick={signOut}>
          <LogOut size={18} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
