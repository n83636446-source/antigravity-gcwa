'use client';

import * as React from 'react';
import { TableHead } from '@/components/ui/table';

// Pour l'instant, ce composant est une simple enveloppe autour de TableHead.
// Nous y ajouterons la logique de glisser-déposer dans les prochaines étapes.
export const DraggableHeader = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ children, ...props }, ref) => {
  return (
    <TableHead ref={ref} {...props}>
      {children}
    </TableHead>
  );
});

DraggableHeader.displayName = 'DraggableHeader';
