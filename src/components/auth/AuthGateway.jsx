import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogIn, Activity } from 'lucide-react';
import styles from './AuthGateway.module.css';

const AuthGateway = ({ children }) => {
  const { session, signInWithGoogle, loading, isSupabaseConfigured, missingSupabaseEnvVars } = useAuth();

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.logoArea}>
            <div className={styles.iconWrapper}>
              <Activity size={40} color="white" />
            </div>
            <h1 className={styles.title}>Configura Supabase</h1>
            <p className={styles.subtitle}>Faltan credenciales para iniciar sesión.</p>
          </div>

          <div className={styles.infoSection}>
            <h2 className={styles.welcomeText}>Variables requeridas</h2>
            <p className={styles.description}>
              Agrega estas variables en tu `.env` local y en Render antes de desplegar.
            </p>
            <div className={styles.envList}>
              {missingSupabaseEnvVars.map((envVar) => (
                <code key={envVar}>{envVar}</code>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.logoArea}>
            <div className={styles.iconWrapper}>
              <Activity size={40} color="white" />
            </div>
            <h1 className={styles.title}>NutriTrack</h1>
            <p className={styles.subtitle}>Tu nutrición, simplificada y segura</p>
          </div>

          <div className={styles.infoSection}>
            <h2 className={styles.welcomeText}>Bienvenido de nuevo</h2>
            <p className={styles.description}>
              Inicia sesión para sincronizar tus dietas, ingredientes y progreso en la nube.
            </p>
          </div>

          <button className={styles.loginBtn} onClick={signInWithGoogle}>
            <LogIn size={20} />
            <span>Continuar con Google</span>
          </button>
          
          <p className={styles.disclaimer}>
            Tus datos se almacenan de forma segura y privada.
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default AuthGateway;
