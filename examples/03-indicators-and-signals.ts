/**
 * 03 — Indicators and signals
 *
 * Shows how to register indicators, derive boolean signals, and combine helper
 * functions inside Strategy.next().
 *
 *   yarn example examples/03-indicators-and-signals.ts
 */

import {
  Backtest,
  Strategy,
  Context,
  crossover,
  crossunder,
  lookback,
  barsSince,
  resampleApply,
  mean,
} from '../lib';
import { SMA } from 'technicalindicators';
import * as path from 'path';

const data = require(path.join(__dirname, 'data/2330.json'));

class IndicatorSignalStrategy extends Strategy {
  params = { fast: 20, slow: 60 };

  init(): void {
    const close = this.data.close;
    const fast = SMA.calculate({ period: this.params.fast, values: close });
    const slow = SMA.calculate({ period: this.params.slow, values: close });
    const weeklyMean = resampleApply(this.data.date, close, 'W', mean);

    this.addIndicator('fastSMA', fast, { overlay: true, color: '#1f77b4' });
    this.addIndicator('slowSMA', slow, { overlay: true, color: '#ff7f0e' });
    this.addIndicator('weeklyMeanClose', weeklyMean, { overlay: true, color: '#2ca02c', plot: false });

    this.addSignal(
      'crossUp',
      crossover(this.getIndicator('fastSMA') as number[], this.getIndicator('slowSMA') as number[]),
    );
    this.addSignal(
      'crossDown',
      crossunder(this.getIndicator('fastSMA') as number[], this.getIndicator('slowSMA') as number[]),
    );
  }

  next(ctx: Context): void {
    if (ctx.index < this.params.slow) return;

    const closeFiveBarsAgo = lookback(this.data.close, ctx.index, 5);
    const barsSinceDown = barsSince(this.signals.crossDown, ctx.index);
    const momentumPositive = closeFiveBarsAgo !== undefined && ctx.data.close > closeFiveBarsAgo;

    if (ctx.signals.get('crossUp') && barsSinceDown > 5 && momentumPositive) {
      this.buy({ size: 500, tag: { signal: 'crossUp' } });
    }

    if (ctx.signals.get('crossDown')) {
      this.position?.close();
    }
  }
}

async function main(): Promise<void> {
  const backtest = new Backtest(data, IndicatorSignalStrategy, {
    cash: 1_000_000,
    tradeOnClose: true,
    finalizeTrades: true,
  });
  const stats = await backtest.run();
  stats.print();
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

export { main };
