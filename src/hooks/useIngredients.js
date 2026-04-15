import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

export function useIngredients() {
  const [ingredients, setIngredients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchIngredients = async () => {
    try {
      const data = await apiFetch('/ingredients');
      setIngredients(data);
    } catch (err) {
      console.error('Error fetching ingredients:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIngredients();
  }, []);

  const addIngredient = async (ingredient) => {
    const newIng = await apiFetch('/ingredients', {
      method: 'POST',
      body: JSON.stringify(ingredient)
    });
    setIngredients(prev => [...prev, newIng]);
    return newIng;
  };

  const updateIngredient = async (id, changes) => {
    const updated = await apiFetch(`/ingredients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(changes)
    });
    setIngredients(prev => prev.map(ing => ing.id === id ? updated : ing));
    return updated;
  };

  const deleteIngredient = async (id) => {
    await apiFetch(`/ingredients/${id}`, { method: 'DELETE' });
    setIngredients(prev => prev.filter(ing => ing.id !== id));
  };

  return {
    ingredients,
    isLoading,
    addIngredient,
    updateIngredient,
    deleteIngredient,
    refresh: fetchIngredients
  };
}
