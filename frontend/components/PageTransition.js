import { AnimatePresence, motion } from 'framer-motion';

export default function PageTransition({ children, route }) {
  const variants = {
    initial: { opacity: 0, y: 16, filter: 'blur(4px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.24, ease: [0.22, 0.61, 0.36, 1] } },
    exit: { opacity: 0, y: 12, filter: 'blur(4px)', transition: { duration: 0.2, ease: [0.22, 0.61, 0.36, 1] } }
  };
  return (
    <AnimatePresence mode="wait">
      <motion.div key={route} initial="initial" animate="animate" exit="exit" variants={variants}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

