import React from 'react';
import { Search, X } from 'lucide-react';
import styles from './SearchInput.module.css';

const SearchInput = ({ value, onChange, placeholder = 'Buscar...' }) => {
  return (
    <div className={styles.container}>
      <Search className={styles.icon} size={20} />
      <input
        type="text"
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button className={styles.clear} onClick={() => onChange('')}>
          <X size={18} />
        </button>
      )}
    </div>
  );
};

export default SearchInput;
