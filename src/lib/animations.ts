/**
 * animations.ts — Framer Motion variants centralizados
 * Baseados no prompt "Senior UI/UX Engineer" (spring physics)
 * Uso: <motion.div variants={fadeUp} initial="hidden" animate="show" />
 */

// ── Fade + slide para cima (entrada padrão) ──
export const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
};

// ── Fade simples (sem movimento) ──
export const fadeIn = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
};

// ── Scale + fade (para cards, modais) ──
export const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 28 },
  },
};

// ── Container com stagger — filhos aparecem em sequência ──
export const staggerContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,   // 70ms entre cada filho
      delayChildren: 0.05,
    },
  },
};

// ── Item do stagger (usado dentro de staggerContainer) ──
export const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 350, damping: 26 },
  },
};

// ── Slide da direita (page transition) ──
export const slideInRight = {
  hidden: { opacity: 0, x: 24 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 280, damping: 26 },
  },
  exit: {
    opacity: 0,
    x: -12,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
};

// ── Spring hover para botões (use no whileHover/whileTap) ──
export const buttonSpring = {
  whileHover: { scale: 1.03, transition: { type: 'spring', stiffness: 400, damping: 15 } },
  whileTap:   { scale: 0.97, transition: { type: 'spring', stiffness: 600, damping: 20 } },
};

// ── Card hover (levita) ──
export const cardHover = {
  whileHover: {
    y: -3,
    boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  },
};
