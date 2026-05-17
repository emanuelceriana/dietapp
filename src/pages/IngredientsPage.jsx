import React, { useRef, useState } from 'react';
import { useIngredients } from '../hooks/useIngredients';
import { useAuth } from '../context/AuthContext';
import IngredientCard from '../components/ingredients/IngredientCard';
import SearchInput from '../components/ui/SearchInput';
import { ChefHat, Plus } from 'lucide-react';
import Modal from '../components/ui/Modal';
import IngredientForm from '../components/ingredients/IngredientForm';
import RecipeForm from '../components/ingredients/RecipeForm';
import styles from './IngredientsPage.module.css';

const IngredientsPage = () => {
  const { user } = useAuth();
  const { ingredients, isLoading, addIngredient, updateIngredient, deleteIngredient } = useIngredients();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('ingredient');
  const [filterType, setFilterType] = useState('all');
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [isSavingIngredient, setIsSavingIngredient] = useState(false);
  const saveIngredientLockRef = useRef(false);

  const recipeCount = ingredients.filter((ing) => ing.sourceType === 'recipe').length;
  const foodCount = ingredients.length - recipeCount;

  const filteredIngredients = ingredients.filter((ing) => 
    ing.name.toLowerCase().includes(search.toLowerCase()) &&
    (filterType === 'all' || (filterType === 'recipes' ? ing.sourceType === 'recipe' : ing.sourceType !== 'recipe'))
  );

  const handleOpenAdd = (type = 'ingredient') => {
    setEditingIngredient(null);
    setModalType(type);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ingredient) => {
    // Check ownership before allowing edit
    const isOwner = ingredient.userId === user?.id || !ingredient.userId;
    if (!isOwner) return; // Silent return or could show a toast
    
    setEditingIngredient(ingredient);
    setModalType(ingredient.sourceType === 'recipe' ? 'recipe' : 'ingredient');
    setIsModalOpen(true);
  };

  const handleSaveIngredient = async (data) => {
    if (saveIngredientLockRef.current) return;

    saveIngredientLockRef.current = true;
    setIsSavingIngredient(true);

    try {
      if (editingIngredient) {
        await updateIngredient(editingIngredient.id, data);
      } else {
        await addIngredient(data);
      }
      setIsModalOpen(false);
      setEditingIngredient(null);
    } catch (err) {
      console.error('Error saving ingredient:', err);
      throw err;
    } finally {
      saveIngredientLockRef.current = false;
      setIsSavingIngredient(false);
    }
  };

  const handleDeleteIngredient = async (id) => {
    if (confirm('¿Estás seguro de que quieres eliminar este ingrediente?')) {
      try {
        await deleteIngredient(id);
      } catch (err) {
        console.error('Error deleting ingredient:', err);
      }
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Biblioteca</h1>
        <p className={styles.subtitle}>Gestiona alimentos, ingredientes y recetas</p>
      </header>

      <section className={styles.recipePanel}>
        <div>
          <h2 className={styles.panelTitle}>Recetas</h2>
          <p className={styles.panelText}>Combiná ingredientes existentes y guardalos como alimento reutilizable.</p>
        </div>
        <button className={styles.recipeBtn} onClick={() => handleOpenAdd('recipe')}>
          <ChefHat size={18} />
          <span>Nueva receta</span>
        </button>
      </section>

      <div className={styles.searchContainer}>
        <SearchInput 
          value={search} 
          onChange={setSearch} 
          placeholder="Buscar ingrediente..." 
        />
      </div>

      <div className={styles.filterTabs} aria-label="Filtrar biblioteca">
        <button
          className={`${styles.filterTab} ${filterType === 'all' ? styles.activeTab : ''}`}
          onClick={() => setFilterType('all')}
        >
          Todos <span>{ingredients.length}</span>
        </button>
        <button
          className={`${styles.filterTab} ${filterType === 'foods' ? styles.activeTab : ''}`}
          onClick={() => setFilterType('foods')}
        >
          Ingredientes <span>{foodCount}</span>
        </button>
        <button
          className={`${styles.filterTab} ${filterType === 'recipes' ? styles.activeTab : ''}`}
          onClick={() => setFilterType('recipes')}
        >
          Recetas <span>{recipeCount}</span>
        </button>
      </div>

      <div className={styles.list}>
        {isLoading ? (
          <div className={styles.empty}>Cargando ingredientes...</div>
        ) : filteredIngredients.length > 0 ? (
          filteredIngredients.map(ingredient => (
            <IngredientCard 
              key={ingredient.id} 
              ingredient={ingredient} 
              currentUserId={user?.id}
              onClick={handleOpenEdit}
              onDelete={handleDeleteIngredient}
            />
          ))
        ) : (
          <div className={styles.empty}>
            {search ? 'No se encontraron resultados' : 'Aún no tienes ingredientes guardados'}
          </div>
        )}
      </div>

      <button 
        className={styles.fab} 
        aria-label="Añadir ingrediente"
        onClick={() => handleOpenAdd('ingredient')}
      >
        <Plus size={32} />
      </button>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          if (isSavingIngredient) return;
          setIsModalOpen(false);
          setEditingIngredient(null);
        }}
        title={editingIngredient
          ? (modalType === 'recipe' ? 'Editar Receta' : 'Editar Ingrediente')
          : (modalType === 'recipe' ? 'Nueva Receta' : 'Nuevo Ingrediente')}
        disableClose={isSavingIngredient}
      >
        {modalType === 'recipe' ? (
          <RecipeForm
            onSubmit={handleSaveIngredient}
            initialData={editingIngredient}
            allIngredients={ingredients.filter((ing) => ing.id !== editingIngredient?.id)}
            isSaving={isSavingIngredient}
          />
        ) : (
          <IngredientForm 
            onSubmit={handleSaveIngredient} 
            initialData={editingIngredient} 
            isSaving={isSavingIngredient}
          />
        )}
      </Modal>
    </div>
  );
};

export default IngredientsPage;
