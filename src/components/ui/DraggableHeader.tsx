'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TableHead } from '@/components/ui/table';

export const DraggableHeader = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & { id: string }
>(({ children, id, className, style, ...props }, ref) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const combinedStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'move',
  };

  return (
    <TableHead
      ref={setNodeRef}
      style={combinedStyle}
      className={className}
      {...props}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center">
        {children}
      </div>
    </TableHead>
  );
});

DraggableHeader.displayName = 'DraggableHeader';
