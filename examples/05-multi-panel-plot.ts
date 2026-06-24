/**
 * 05 — Multi-panel plot
 *
 * Registers a momentum oscillator (rate-of-change) as a non-overlay indicator,
 * which forces `Plotting` to allocate its own subplot after the volume panel.
 * The resulting HTML therefore has five default-style stacked panels:
 *
 *   Equity [%]
 *   Profit / Loss
 *   OHLC (candlestick + SMA overlays + trade markers)
 *   Volume
 *   ROC(12) (oscillator subplot)
 *
 *   yarn example examples/05-multi-panel-plot.ts
 */

import { Backtest, Strategy, Context, crossover, crossunder, lookback } from '../lib';
import { SMA } from 'technicalindicators';
import * as path from 'path';

const data = require(path.join(__dirname, 'data/2330.json'));

const ROC = (values: number[], period: number): number[] => {
  return values.map((v, i) => {
    const prev = lookback(values, i, period);
    if (prev === undefined || prev === 0) return NaN;
    return ((v - prev) / prev) * 100;
  });
};

class SmaWithRoc extends Strategy {
  params = { n1: 20, n2: 60, rocPeriod: 12 };

  init(): void {
    const close = this.data.close;
    const sma20 = SMA.calculate({ period: this.params.n1, values: close });
    const sma60 = SMA.calculate({ period: this.params.n2, values: close });
    this.addIndicator('SMA20', sma20, { overlay: true, color: '#1f77b4' });
    this.addIndicator('SMA60', sma60, { overlay: true, color: '#ff7f0e' });

    // Force a separate subplot after volume — overlay: false:
    const roc = ROC(close, this.params.rocPeriod);
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
  const backtest = new Backtest(data, SmaWithRoc, { cash: 1_000_000, tradeOnClose: true });
  const stats = await backtest.run();
  stats.print();
  // Write the HTML without auto-opening — easier when running headlessly.
  // Set `openBrowser: true` (default) to launch automatically.
  backtest.plot({ openBrowser: false, filename: 'output.html' });
  console.log('Wrote output.html with an ROC subplot after volume.');
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

export { main };
