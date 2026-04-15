import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Beef, Plus, BarChart2, User } from 'lucide-react';
import styles from './BottomNav.module.css';

const BottomNav = () => {
  return (
    <nav className={styles.bottomNav}>
      <NavLink to="/" className={({ isActive }) => isActive ? styles.activeLink : styles.link}>
        <Home size={24} />
        <span>Inicio</span>
      </NavLink>
      <NavLink to="/ingredients" className={({ isActive }) => isActive ? styles.activeLink : styles.link}>
        <Beef size={24} />
        <span>Ingred.</span>
      </NavLink>
      <NavLink 
        to="/?action=add-meal" 
        className={styles.addButton} 
        aria-label="Añadir comida"
      >
        <div className={styles.addIconWrapper}>
          <Plus size={28} color="white" />
        </div>
      </NavLink>
      <NavLink to="/stats" className={({ isActive }) => isActive ? styles.activeLink : styles.link}>
        <BarChart2 size={24} />
        <span>Stats</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => isActive ? styles.activeLink : styles.link}>
        <User size={24} />
        <span>Perfil</span>
      </NavLink>
    </nav>
  );
};

export default BottomNav;
