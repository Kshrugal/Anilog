import React from 'react';
import { motion, useIsPresent } from 'framer-motion';

export const LibraryGrid = React.forwardRef<HTMLDivElement, { children: React.ReactNode; className: string; variants: any }>(function LibraryGrid({ children, className, variants }, ref) {
  const present = useIsPresent();
  // The outgoing grid may fade, but must never intercept input or remain in the accessibility tree.
  const inert = present ? {} : { inert: '' };
  return <motion.div ref={ref} {...inert} aria-hidden={!present || undefined} style={{ pointerEvents: present ? undefined : 'none' }} className={className} variants={variants} initial="hidden" animate="show" exit={{ opacity: 0, scale: 0.95 }}>{children}</motion.div>;
});
