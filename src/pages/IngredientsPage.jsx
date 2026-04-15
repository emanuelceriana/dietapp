import React, { useState } from 'react';
import { useIngredients } from '../hooks/useIngredients';
import { useAuth } from '../context/AuthContext';
import IngredientCard from '../components/ingredients/IngredientCard';
import SearchInput from '../components/ui/SearchInput';
import { Plus } from 'lucide-react';
import Modal from '../components/ui/Modal';
import IngredientForm from '../components/ingredients/IngredientForm';
import styles from './IngredientsPage.module.css';

const IngredientsPage = () => {
  const { user } = useAuth();
  const { ingredients, isLoading, addIngredient, updateIngredient, deleteIngredient } = useIngredients();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);

  const filteredIngredients = ingredients.filter(ing => 
    ing.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenAdd = () => {
    setEditingIngredient(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ingredient) => {
    // Check ownership before allowing edit
    const isOwner = ingredient.userId === user?.id || !ingredient.userId;
    if (!isOwner) return; // Silent return or could show a toast
    
    setEditingIngredient(ingredient);
    setIsModalOpen(true);
  };

  const handleSaveIngredient = async (data) => {
    try {
      if (editingIngredient) {
        await updateIngredient(editingIngredient.id, data);
      } else {
        await addIngredient(data);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving ingredient:', err);
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
        <p className={styles.subtitle}>Gestiona tus alimentos e ingredientes</p>
      </header>

      <div className={styles.searchContainer}>
        <SearchInput 
          value={search} 
          onChange={setSearch} 
          placeholder="Buscar ingrediente..." 
        />
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
        onClick={handleOpenAdd}
      >
        <Plus size={32} />
      </button>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingIngredient ? 'Editar Ingrediente' : 'Nuevo Ingrediente'}
      >
        <IngredientForm 
          onSubmit={handleSaveIngredient} 
          initialData={editingIngredient} 
        />
      </Modal>
    </div>
  );
};

export default IngredientsPage;
