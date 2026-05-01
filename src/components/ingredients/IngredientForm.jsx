import React, { useRef, useState } from 'react';
import styles from './IngredientForm.module.css';

const IngredientForm = ({ onSubmit, initialData, isSaving = false }) => {
  const [formData, setFormData] = useState(initialData || {
    name: '',
    measureType: 'per_100g',
    servingLabel: '',
    kcal: '',
    protein: '',
    fat: '',
    carbs: '',
    isPublic: true
  });
  const [saveError, setSaveError] = useState('');
  const submitLockRef = useRef(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSaveError('');
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleTypeChange = (type) => {
    setSaveError('');
    setFormData(prev => ({ ...prev, measureType: type }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLockRef.current || isSaving) return;

    submitLockRef.current = true;
    setSaveError('');

    // Basic validation and formatting
    const submission = {
      ...formData,
      kcal: parseFloat(formData.kcal) || 0,
      protein: parseFloat(formData.protein) || 0,
      fat: parseFloat(formData.fat) || 0,
      carbs: parseFloat(formData.carbs) || 0,
    };

    try {
      await onSubmit(submission);
    } catch (err) {
      setSaveError('No pude guardar el ingrediente. Revisá la conexión e intentá de nuevo.');
      submitLockRef.current = false;
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.inputGroup}>
        <label className={styles.label}>Nombre del Alimento</label>
        <input
          className={styles.input}
          name="name"
          value={formData.name}
          disabled={isSaving}
          onChange={handleChange}
          placeholder="Ej: Pechuga de Pollo"
          required
        />
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label}>Tipo de Medida</label>
        <div className={styles.toggleGroup}>
          <button
            type="button"
            className={`${styles.toggle} ${formData.measureType === 'per_100g' ? styles.active : ''}`}
            disabled={isSaving}
            onClick={() => handleTypeChange('per_100g')}
          >
            Por 100g/ml
          </button>
          <button
            type="button"
            className={`${styles.toggle} ${formData.measureType === 'per_serving' ? styles.active : ''}`}
            disabled={isSaving}
            onClick={() => handleTypeChange('per_serving')}
          >
            Por Porción
          </button>
        </div>
      </div>

      {formData.measureType === 'per_serving' && (
        <div className={styles.inputGroup}>
          <label className={styles.label}>Etiqueta de Porción</label>
          <input
            className={styles.input}
            name="servingLabel"
            value={formData.servingLabel}
            disabled={isSaving}
            onChange={handleChange}
            placeholder="Ej: 1 rebanada, 1 huevo"
          />
        </div>
      )}

      <div className={styles.macrosGrid}>
        <div className={styles.inputGroup}>
          <label className={styles.label}>Calorías (kcal)</label>
          <input
            className={styles.input}
            type="number"
            step="0.1"
            name="kcal"
            value={formData.kcal}
            disabled={isSaving}
            onChange={handleChange}
            required
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.label}>Proteínas (g)</label>
          <input
            className={styles.input}
            type="number"
            step="0.1"
            name="protein"
            value={formData.protein}
            disabled={isSaving}
            onChange={handleChange}
            required
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.label}>Carbohidratos (g)</label>
          <input
            className={styles.input}
            type="number"
            step="0.1"
            name="carbs"
            value={formData.carbs}
            disabled={isSaving}
            onChange={handleChange}
            required
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.label}>Grasas (g)</label>
          <input
            className={styles.input}
            type="number"
            step="0.1"
            name="fat"
            value={formData.fat}
            disabled={isSaving}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className={styles.checkboxGroup}>
        <input
          type="checkbox"
          id="isPublic"
          name="isPublic"
          checked={formData.isPublic}
          disabled={isSaving}
          onChange={handleChange}
          className={styles.checkbox}
        />
        <label htmlFor="isPublic" className={styles.checkboxLabel}>
          Compartir con la comunidad
        </label>
        <p className={styles.checkboxHelp}>
          Otros usuarios podrán ver y usar este alimento en sus dietas.
        </p>
      </div>

      {saveError && <div className={styles.errorText}>{saveError}</div>}

      <button type="submit" className={styles.submitBtn} disabled={isSaving}>
        {isSaving ? 'Guardando...' : 'Guardar Ingrediente'}
      </button>
    </form>
  );
};

export default IngredientForm;
