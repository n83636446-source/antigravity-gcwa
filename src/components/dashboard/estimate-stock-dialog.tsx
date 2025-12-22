"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Bot, Loader2, BarChartBig, ShoppingCart, HelpCircle } from 'lucide-react';
import type { Product, Supplier } from '@/lib/types';
import { runStockEstimation } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { StockLevelEstimationOutput } from '@/ai/flows/stock-level-estimation';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

type EstimateStockDialogProps = {
  product: Product;
  supplier: Supplier;
};

export function EstimateStockDialog({ product, supplier }: EstimateStockDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StockLevelEstimationOutput | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);

    const formData = new FormData(event.currentTarget);
    const response = await runStockEstimation(product.name, product.stock, formData);

    if (response.success && response.data) {
      setResult(response.data);
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: response.error || 'An unknown error occurred.',
      });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Bot className="mr-2 h-4 w-4" />
          Estimate Need
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>AI Stock Estimation</DialogTitle>
            <DialogDescription>
              Estimate restocking needs for '{product.name}' using AI.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="safetyStockLevel" className="text-right">
                Safety Stock
              </Label>
              <Input
                id="safetyStockLevel"
                name="safetyStockLevel"
                type="number"
                defaultValue={product.lowStockThreshold}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="leadTimeDays" className="text-right">
                Lead Time (Days)
              </Label>
              <Input
                id="leadTimeDays"
                name="leadTimeDays"
                type="number"
                defaultValue="7"
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="upcomingTrends" className="text-right pt-2">
                Trends
              </Label>
              <Textarea
                id="upcomingTrends"
                name="upcomingTrends"
                placeholder="e.g., Upcoming holiday sale, new marketing campaign"
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Bot className="mr-2 h-4 w-4" />
              )}
              Estimate
            </Button>
          </DialogFooter>
        </form>
        {result && (
          <div className="mt-4">
            <Alert>
              <HelpCircle className="h-4 w-4" />
              <AlertTitle>Estimation Result</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-4 text-sm">
                  <p>{result.reasoning}</p>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center">
                      <BarChartBig className="mr-2 h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Estimated Need</span>
                    </div>
                    <span className="font-bold text-lg">{result.estimatedNeed} units</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-secondary p-3">
                    <div className="flex items-center">
                      <ShoppingCart className="mr-2 h-5 w-5 text-primary" />
                      <span className="font-medium">Suggested Order</span>
                    </div>
                    <span className="font-bold text-lg text-primary">
                      {result.suggestedOrderQuantity} units
                    </span>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
