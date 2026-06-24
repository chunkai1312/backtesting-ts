/**
 * 05 — Plotting
 *
 * Registers overlay indicators plus a non-overlay oscillator subplot, then
 * writes a standard backtesting.py-like multi-panel HTML chart.
 *
 *   yarn example examples/05-plotting.ts
 */

import { Backtest, Strategy, Context, crossover, crossunder, lookback } from '../lib';
import { SMA } from 'technicalindicators';
import * as path from 'path';

const data = require(path.join(__dirname, 'data/2330.json'));

const ROC = (values: number[], period: number): number[] =>
  values.map((value, i) => {
    const prev = lookback(values, i, period);
    if (prev === undefined || prev === 0) return NaN;
    return ((value - prev) / prev) * 100;
  });

class SmaWithRoc extends Strategy {
  params = { n1: 20, n2: 60, rocPeriod: 12 };

  init(): void {
    const close = this.data.close;
    const sma20 = SMA.calculate({ period: this.params.n1, values: close });
    const sma60 = SMA.calculate({ period: this.params.n2, values: close });
    const roc = ROC(close, this.params.rocPeriod);

    this.addIndicator('SMA20', sma20, { overlay: true, color: '#1f77b4' });
    this.addIndicator('SMA60', sma60, { overlay: true, color: '#ff7f0e' });
    this.addIndicator('ROC(12)', roc, { overlay: false, color: '#2ca02c' });

    this.addSignal('up', crossover(this.getIndicator('SMA20') as number[], this.getIndicator('SMA60') as number[]));
    this.addSignal('down', crossunder(this.getIndicator('SMA20') as number[], this.getIndicator('SMA60') as number[]));
  }

  next(ctx: Context): void {
    if (ctx.index < this.params.n2) return;
    if (ctx.signals.get('up')) this.buy({ size: 1000 });
    if (ctx.signals.get('down')) this.sell({ size: 1000 });
  }
}

async function main(): Promise<void> {
  const backtest = new Backtest(data, SmaWithRoc, {
    cash: 1_000_000,
    tradeOnClose: true,
    finalizeTrades: true,
  });
  const stats = await backtest.run();
  stats.print();
  backtest.plot({
    filename: 'plotting.html',
    openBrowser: false,
    plotReturn: true,
    plotDrawdown: true,
    superimpose: 'M',
    resample: true,
  });
  console.log('Wrote plotting.html');
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

export { main };
