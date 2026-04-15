import React, { useState, useEffect, useTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import CalendarStrip from '../components/calendar/CalendarStrip';
import DaySummaryCard from '../components/nutrition/DaySummaryCard';
import MealCard from '../components/meals/MealCard';
import Modal from '../components/ui/Modal';
import MealBuilder from '../components/meals/MealBuilder';
import { useDayEntries, useAllEntryDates } from '../hooks/useDayEntries';
import { useIngredients } from '../hooks/useIngredients';
import { useProfile } from '../hooks/useProfile';
import { calculateTDEE } from '../utils/nutrition';
import { formatDate } from '../utils/dates';
import styles from './HomePage.module.css';

const HomePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [isDatePending, startDateTransition] = useTransition();

  useEffect(() => {
    if (searchParams.get('action') === 'add-meal') {
      setEditingMeal(null);
      setIsModalOpen(true);
      // Clean up params after opening
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { entry, isLoading: entriesLoading, hasLoaded: entriesLoaded, addMeal, updateMeal, deleteMeal } = useDayEntries(selectedDate);
  const activeDates = useAllEntryDates();
  const { ingredients } = useIngredients();
  const { profile, isLoading: profileLoading, error: profileError, refresh: refreshProfile } = useProfile();

  if (profileLoading) {
    return <div className={styles.loading}>Cargando...</div>;
  }

  if (profileError || !profile) {
    return (
      <div className={styles.emptyState}>
        <p>No pude cargar tu perfil desde el servidor.</p>
        <button
          className="button-primary"
          style={{ marginTop: '1rem', background: 'var(--accent-primary)', color: 'white', padding: '10px 20px', borderRadius: '8px' }}
          onClick={refreshProfile}
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Calculation logic for daily totals
  const calculateTotals = () => {
    let totals = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
    
    if (!entry || !entry.meals) return totals;
    
    entry.meals.forEach(meal => {
      meal.items.forEach(item => {
        const ingredient = ingredients.find(ing => ing.id === item.ingredientId) || item.ingredient;
        if (ingredient) {
          const factor = ingredient.measureType === 'per_serving' 
            ? item.quantity 
            : item.quantity / 100;
          
          totals.kcal += (ingredient.kcal || 0) * factor;
          totals.protein += (ingredient.protein || 0) * factor;
          totals.carbs += (ingredient.carbs || 0) * factor;
          totals.fat += (ingredient.fat || 0) * factor;
        }
      });
    });
    
    return {
      kcal: Math.round(totals.kcal),
      protein: Math.round(totals.protein * 10) / 10,
      carbs: Math.round(totals.carbs * 10) / 10,
      fat: Math.round(totals.fat * 10) / 10,
    };
  };

  const handleOpenAdd = () => {
    setEditingMeal(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (meal) => {
    setEditingMeal(meal);
    setIsModalOpen(true);
  };

  const handleSaveMeal = async (mealData) => {
    try {
      if (editingMeal) {
        await updateMeal(editingMeal.id, mealData);
      } else {
        await addMeal(mealData);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving meal:', err);
    }
  };

  const totals = calculateTotals();
  const target = profile ? calculateTDEE(profile) : 2000;
  const isChangingDay = isDatePending || entriesLoading;
  const hasMeals = entry?.meals?.length > 0;
  const showInitialMealsLoading = entriesLoading && !entriesLoaded;
  const handleDateSelect = (date) => {
    startDateTransition(() => setSelectedDate(date));
  };

  return (
    <div className={styles.container}>
      <CalendarStrip 
        selectedDate={selectedDate} 
        onDateSelect={handleDateSelect} 
        activeDates={activeDates}
      />
      
      <div className={styles.content}>
        <DaySummaryCard totals={totals} target={target} animationKey={formatDate(selectedDate)} />
        
        <section className={styles.mealsSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Comidas</h2>
            {isChangingDay && <span className={styles.syncStatus}>Actualizando...</span>}
            {hasMeals && (
              <button className={styles.inlineAddBtn} onClick={handleOpenAdd}>
                + Añadir
              </button>
            )}
          </div>
          
          {showInitialMealsLoading ? (
            <div className={styles.mealSkeletonList} aria-label="Cargando comidas">
              <div className={styles.mealSkeleton} />
              <div className={styles.mealSkeleton} />
            </div>
          ) : hasMeals ? (
            <div className={`${styles.mealList} ${isChangingDay ? styles.updating : ''}`}>
              {entry.meals.map((meal) => (
                <MealCard 
                  key={meal.id} 
                  meal={meal} 
                  ingredients={ingredients} 
                  onDelete={deleteMeal}
                  onEdit={handleOpenEdit}
                />
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <p>No hay comidas registradas para este día.</p>
              <button 
                className="button-primary" 
                style={{ marginTop: '1rem', background: 'var(--accent-primary)', color: 'white', padding: '10px 20px', borderRadius: '8px' }}
                onClick={handleOpenAdd}
              >
                Añadir Comida
              </button>
            </div>
          )}
        </section>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingMeal ? 'Editar Comida' : 'Nueva Comida'}
      >
        <MealBuilder 
          onSave={handleSaveMeal} 
          initialMeal={editingMeal} 
          allIngredients={ingredients}
        />
      </Modal>
    </div>
  );
};

export default HomePage;
