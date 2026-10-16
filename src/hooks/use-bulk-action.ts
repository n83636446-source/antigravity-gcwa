'use client';

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';

export type BulkFailure = { name: string; message: string };
export type BulkResult = { successCount: number; failures: BulkFailure[] };

type RunBulkOptions<T> = {
  items: T[];
  getName: (item: T) => string;
  action: (item: T) => Promise<unknown>;
  successLabel: (count: number) => string;
  failureTitle: string;
};

export function useBulkAction() {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = React.useState(false);

  async function runBulk<T>(options: RunBulkOptions<T>): Promise<BulkResult> {
    const { items, getName, action, successLabel, failureTitle } = options;
    setIsRunning(true);
    const failures: BulkFailure[] = [];
    let successCount = 0;

    for (const item of items) {
      try {
        await action(item);
        successCount++;
      } catch (error) {
        failures.push({
          name: getName(item),
          message: error instanceof Error && error.message ? error.message : 'Une erreur est survenue.',
        });
      }
    }

    setIsRunning(false);

    const describe = () => {
      const shown = failures.slice(0, 3).map((f) => `"${f.name}" : ${f.message}`).join(' | ');
      const rest = failures.length - 3;
      return rest > 0 ? `${shown} | … et ${rest} autre${rest > 1 ? 's' : ''}` : shown;
    };

    if (failures.length === 0) {
      toast({ title: successLabel(successCount) });
    } else if (successCount > 0) {
      toast({
        variant: 'destructive',
        title: `${successLabel(successCount)}, ${failures.length} échec${failures.length > 1 ? 's' : ''}`,
        description: describe(),
      });
    } else {
      toast({ variant: 'destructive', title: failureTitle, description: describe() });
    }

    return { successCount, failures };
  }

  return { runBulk, isRunning };
}
