// expect: none
// UI motion in an app, not a video: MOTION-* rules only apply to Remotion and GSAP code.
import { motion } from 'framer-motion';

export function Steps({ items }: { items: string[] }) {
  return (
    <ol>
      {items.map((label, i) => (
        <motion.li key={label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05, type: 'spring', bounce: 0.4 }}>
          {label}
        </motion.li>
      ))}
    </ol>
  );
}
