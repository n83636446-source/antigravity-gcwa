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

const MAX_FAILURE_LINES = 5;
const FAILURE_TOAST_DURATION_MS = 15000;

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

    const renderFailures = () => {
      const shown = failures.slice(0, MAX_FAILURE_LINES);
      const rest = failures.length - shown.length;
      return React.createElement(
        'ul',
        { className: 'mt-1 space-y-1' },
        ...shown.map((f, index) =>
          React.createElement(
            'li',
            { key: `failure-${index}` },
            React.createElement('span', { className: 'font-semibold' }, f.name),
            ` : ${f.message}`
          )
        ),
        rest > 0
          ? React.createElement('li', { key: 'rest', className: 'italic' }, `… et ${rest} autre${rest > 1 ? 's' : ''}`)
          : null
      );
    };

    if (failures.length === 0) {
      toast({ title: successLabel(successCount) });
    } else if (successCount > 0) {
      toast({
        variant: 'destructive',
        title: `${successLabel(successCount)}, ${failures.length} refusé${failures.length > 1 ? 's' : ''}`,
        description: renderFailures(),
        duration: FAILURE_TOAST_DURATION_MS,
      });
    } else {
      toast({
        variant: 'destructive',
        title: failureTitle,
        description: renderFailures(),
        duration: FAILURE_TOAST_DURATION_MS,
      });
    }

    return { successCount, failures };
  }

  return { runBulk, isRunning };
}
