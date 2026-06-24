/**
 * 04 — Optimization
 *
 * Searches an SMA(n1, n2) grid using:
 *   - constraint:    skip combinations where n1 >= n2
 *   - maxTries:      sample at most 12 valid combinations
 *   - maximize:      custom objective = Sharpe / |MaxDrawdown|
 *   - returnHeatmap: collect a 2D parameter heatmap
 *
 *   yarn example examples/04-optimization.ts
 */

import {
  Backtest,
  Strategy,
  Context,
  Plotting,
  StatsIndex,
  crossover,
  crossunder,
} from '../lib';
import { SMA } from 'technicalindicators';
import * as path from 'path';

const data = require(path.join(__dirname, 'data/2330.json'));

class SmaCross extends Strategy {
  params = { n1: 5, n2: 60 };

  init(): void {
    const close = this.data.close;
    const fast = SMA.calculate({ period: this.params.n1, values: close });
    const slow = SMA.calculate({ period: this.params.n2, values: close });
    this.addIndicator('fast', fast);
    this.addIndicator('slow', slow);
    this.addSignal('up', crossover(this.getIndicator('fast') as number[], this.getIndicator('slow') as number[]));
    this.addSignal('down', crossunder(this.getIndicator('fast') as number[], this.getIndicator('slow') as number[]));
  }

  next(ctx: Context): void {
    if (ctx.index < this.params.n2) return;
    if (ctx.signals.get('up')) this.buy({ size: 1000 });
    if (ctx.signals.get('down')) this.sell({ size: 1000 });
  }
}

async function main(): Promise<void> {
  const backtest = new Backtest(data, SmaCross, { cash: 1_000_000, tradeOnClose: true });

  const result = await backtest.optimize({
    params: {
      n1: [5, 10, 15, 20, 30],
      n2: [40, 60, 90, 120, 180],
    },
    constraint: p => p.n1 < p.n2,
    maxTries: 12,
    seed: 42,
    maximize: results => {
      const sharpe = Number(results[StatsIndex.SharpeRatio]) || 0;
      const maxDrawdown = Math.abs(Number(results[StatsIndex.MaxDrawdown]) || 1);
      return sharpe / maxDrawdown;
    },
    returnHeatmap: true,
    returnAll: true,
  });

  console.log(`Best params: ${JSON.stringify(result.bestParams)}`);
  console.log(`Best score (Sharpe / |MaxDD|): ${result.bestScore.toFixed(4)}`);
  console.log(`Combinations evaluated: ${result.all?.length ?? 0}`);

  if (result.heatmap) {
    new Plotting(result.best, { openBrowser: false }).plotHeatmap(result.heatmap, {
      filename: 'optimization-heatmap.html',
      openBrowser: false,
    });
    console.log('Wrote optimization-heatmap.html');
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

export { main };
