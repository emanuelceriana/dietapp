import React, { useEffect, useMemo, useState, useTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import CalendarStrip from '../components/calendar/CalendarStrip';
import DaySummaryCard from '../components/nutrition/DaySummaryCard';
import MealCard from '../components/meals/MealCard';
import RecentMealsStrip from '../components/meals/RecentMealsStrip';
import Modal from '../components/ui/Modal';
import MealBuilder from '../components/meals/MealBuilder';
import { useDayEntries, useAllEntryDates } from '../hooks/useDayEntries';
import { useIngredients } from '../hooks/useIngredients';
import { useRecentMeals } from '../hooks/useRecentMeals';
import { useProfile } from '../hooks/useProfile';
import { calculateEntryNutrition, calculateTDEE } from '../utils/nutrition';
import { formatDate } from '../utils/dates';
import styles from './HomePage.module.css';

const HomePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [mealSaveError, setMealSaveError] = useState('');
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

  const {
    entry,
    isLoading: entriesLoading,
    isSaving: isSavingMeals,
    hasLoaded: entriesLoaded,
    addMeal,
    updateMeal,
    deleteMeal
  } = useDayEntries(selectedDate);
  const activeDates = useAllEntryDates(selectedDate);
  const { ingredients } = useIngredients();
  const { recentMeals, isLoading: recentMealsLoading } = useRecentMeals(selectedDate);
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

  const handleOpenAdd = () => {
    setMealSaveError('');
    setEditingMeal(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (meal) => {
    setMealSaveError('');
    setEditingMeal(meal);
    setIsModalOpen(true);
  };

  const handleSaveMeal = (mealData) => {
    const mealId = editingMeal?.id;
    setMealSaveError('');
    setIsModalOpen(false);
    setEditingMeal(null);

    const savePromise = mealId
      ? updateMeal(mealId, mealData)
      : addMeal(mealData);

    savePromise.catch((err) => {
      setMealSaveError('No pude guardar la comida. Intentá de nuevo en unos segundos.');
      console.error('Error saving meal:', err);
    });
  };

  const duplicateMeal = (meal) => ({
    name: meal.name,
    items: (meal.items || []).map((item) => ({
      ingredientId: item.ingredientId,
      quantity: item.quantity
    }))
  });

  const handleReuseMeal = async (meal) => {
    setMealSaveError('');

    try {
      await addMeal(duplicateMeal(meal));
    } catch (err) {
      setMealSaveError('No pude repetir la comida. Intentá de nuevo en unos segundos.');
      console.error('Error reusing meal:', err);
    }
  };

  const totals = calculateEntryNutrition(entry, ingredients);
  const displayActiveDates = useMemo(() => {
    const nextDates = new Set(activeDates);
    const selectedDateStr = formatDate(selectedDate);

    if ((entry?.meals?.length || 0) > 0) {
      nextDates.add(selectedDateStr);
    } else {
      nextDates.delete(selectedDateStr);
    }

    return nextDates;
  }, [activeDates, entry?.meals?.length, selectedDate]);
  const target = profile ? calculateTDEE(profile) : 2000;
  const isChangingDay = isDatePending || entriesLoading;
  const hasMeals = entry?.meals?.length > 0;
  const showInitialMealsLoading = entriesLoading && !entriesLoaded;
  const mealsCount = entry?.meals?.length || 0;
  const syncStatusLabel = isSavingMeals
    ? 'Guardando...'
    : isChangingDay
      ? 'Actualizando...'
      : '';
  const handleDateSelect = (date) => {
    startDateTransition(() => setSelectedDate(date));
  };

  return (
    <div className={styles.container}>
      <CalendarStrip 
        selectedDate={selectedDate} 
        onDateSelect={handleDateSelect} 
        activeDates={displayActiveDates}
      />
      
      <div className={styles.content}>
        <DaySummaryCard
          totals={totals}
          target={target}
          mealsCount={mealsCount}
          animationKey={formatDate(selectedDate)}
        />
        
        <section className={styles.mealsSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Comidas</h2>
            {syncStatusLabel && <span className={styles.syncStatus}>{syncStatusLabel}</span>}
            {hasMeals && (
              <button className={styles.inlineAddBtn} onClick={handleOpenAdd}>
                + Añadir
              </button>
            )}
          </div>

          {mealSaveError && (
            <div className={styles.errorBanner} role="status">
              {mealSaveError}
            </div>
          )}

          <RecentMealsStrip
            meals={recentMeals}
            ingredients={ingredients}
            isLoading={recentMealsLoading}
            onUseMeal={handleReuseMeal}
          />
          
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
                  onDuplicate={handleReuseMeal}
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
