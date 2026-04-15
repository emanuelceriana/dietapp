import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

export function useTemplates() {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTemplates = async () => {
    try {
      const data = await apiFetch('/templates');
      setTemplates(data);
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const addTemplate = async (template) => {
    const newTemplate = await apiFetch('/templates', {
      method: 'POST',
      body: JSON.stringify(template)
    });
    setTemplates(prev => [...prev, newTemplate]);
    return newTemplate;
  };

  const deleteTemplate = async (id) => {
    await apiFetch(`/templates/${id}`, { method: 'DELETE' });
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  return {
    templates,
    isLoading,
    addTemplate,
    deleteTemplate,
    refresh: fetchTemplates
  };
}
