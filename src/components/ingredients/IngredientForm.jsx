import React, { useState } from 'react';
import styles from './IngredientForm.module.css';

const IngredientForm = ({ onSubmit, initialData }) => {
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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleTypeChange = (type) => {
    setFormData(prev => ({ ...prev, measureType: type }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Basic validation and formatting
    const submission = {
      ...formData,
      kcal: parseFloat(formData.kcal) || 0,
      protein: parseFloat(formData.protein) || 0,
      fat: parseFloat(formData.fat) || 0,
      carbs: parseFloat(formData.carbs) || 0,
    };
    onSubmit(submission);
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.inputGroup}>
        <label className={styles.label}>Nombre del Alimento</label>
        <input
          className={styles.input}
          name="name"
          value={formData.name}
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
            onClick={() => handleTypeChange('per_100g')}
          >
            Por 100g/ml
          </button>
          <button
            type="button"
            className={`${styles.toggle} ${formData.measureType === 'per_serving' ? styles.active : ''}`}
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

      <button type="submit" className={styles.submitBtn}>
        Guardar Ingrediente
      </button>
    </form>
  );
};

export default IngredientForm;
