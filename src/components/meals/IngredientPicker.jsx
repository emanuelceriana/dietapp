import React, { useState } from 'react';
import SearchInput from '../ui/SearchInput';
import IngredientCard from '../ingredients/IngredientCard';
import { useIngredients } from '../../hooks/useIngredients';
import { useAuth } from '../../context/AuthContext';
import styles from './IngredientPicker.module.css';

const IngredientPicker = ({ onSelect, onCancel }) => {
  const { user } = useAuth();
  const { ingredients, isLoading } = useIngredients();
  const [search, setSearch] = useState('');

  const filteredItems = ingredients.filter(ing => 
    ing.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <div className={styles.searchBox}>
        <SearchInput 
          value={search} 
          onChange={setSearch} 
          placeholder="Buscar ingrediente..." 
        />
      </div>
      
      <div className={styles.list}>
        {isLoading ? (
          <div className={styles.loading}>Cargando...</div>
        ) : filteredItems.length > 0 ? (
          filteredItems.map(ing => (
            <IngredientCard 
              key={ing.id} 
              ingredient={ing} 
              currentUserId={user?.id}
              onClick={() => onSelect(ing)} 
            />
          ))
        ) : (
          <div className={styles.empty}>No se encontraron ingredientes</div>
        )}
      </div>
      
      <button className={styles.cancelBtn} onClick={onCancel}>
        Cancelar
      </button>
    </div>
  );
};

export default IngredientPicker;
