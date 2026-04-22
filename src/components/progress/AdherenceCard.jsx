import React from 'react';
import { Download, Flame, Scale, Utensils } from 'lucide-react';
import styles from './AdherenceCard.module.css';

const AdherenceCard = ({
  title,
  label,
  nutritionDays,
  nutritionGoal,
  streakDays,
  weightCount,
  weightGoal,
  reminder,
  onExport
}) => (
  <section className={`${styles.card} card`}>
    <div className={styles.header}>
      <div>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.subtitle}>{label}</p>
      </div>

      <button className={styles.exportBtn} onClick={onExport}>
        <Download size={16} />
        <span>Exportar</span>
      </button>
    </div>

    <div className={styles.metrics}>
      <div className={styles.metric}>
        <div className={styles.iconBox}>
          <Utensils size={18} />
        </div>
        <div>
          <span className={styles.metricLabel}>Nutrición</span>
          <strong className={styles.metricValue}>{nutritionDays}/{nutritionGoal}</strong>
        </div>
      </div>

      <div className={styles.metric}>
        <div className={styles.iconBox}>
          <Flame size={18} />
        </div>
        <div>
          <span className={styles.metricLabel}>Racha</span>
          <strong className={styles.metricValue}>{streakDays} día(s)</strong>
        </div>
      </div>

      <div className={styles.metric}>
        <div className={styles.iconBox}>
          <Scale size={18} />
        </div>
        <div>
          <span className={styles.metricLabel}>Pesajes</span>
          <strong className={styles.metricValue}>{weightCount}/{weightGoal}</strong>
        </div>
      </div>
    </div>

    <div className={styles.reminder}>
      {reminder}
    </div>
  </section>
);

export default AdherenceCard;
