import { Variants } from 'framer-motion';

/**
 * animations.ts — Framer Motion variants centralizados
 * Baseados no prompt "Senior UI/UX Engineer" (spring physics)
 * Uso: <motion.div variants={fadeUp} initial="hidden" animate="show" />
 */

// ── Fade + slide para cima (entrada padrão) ──
// Suavizado: menor stiffness, maior damping, menor y
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 200, damping: 28 },
  },
};

// ── Fade simples (sem movimento) ──
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};

// ── Scale + fade (para cards, modais) ──
// Suavizado: menor scale dip e física mais calma
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 250, damping: 32 },
  },
};

// ── Container com stagger — filhos aparecem em sequência ──
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

// ── Item do stagger (usado dentro de staggerContainer) ──
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 220, damping: 30 },
  },
};

// ── Slide da direita (page transition) ──
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 16 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring' as const, stiffness: 180, damping: 28 },
  },
  exit: {
    opacity: 0,
    x: -8,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

// ── Spring hover para botões (use no whileHover/whileTap) ──
export const buttonSpring = {
  whileHover: { scale: 1.02, transition: { type: 'spring' as const, stiffness: 350, damping: 20 } },
  whileTap:   { scale: 0.98, transition: { type: 'spring' as const, stiffness: 500, damping: 25 } },
};

// ── Card hover (levita) ──
export const cardHover = {
  whileHover: {
    y: -2,
    boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
    transition: { type: 'spring' as const, stiffness: 250, damping: 22 },
  },
};
