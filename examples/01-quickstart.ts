/**
 * 01 — Quickstart
 *
 * Load OHLCV, declare a moving-average crossover strategy, run the backtest,
 * print stats, and write a standard HTML plot.
 *
 *   yarn example examples/01-quickstart.ts
 */

import { Backtest, Strategy, Context, crossover, crossunder } from '../lib';
import { SMA } from 'technicalindicators';
import * as path from 'path';

const data = require(path.join(__dirname, 'data/2330.json'));

class SmaCross extends Strategy {
  params = { n1: 20, n2: 60 };

  init(): void {
    const close = this.data.close;
    const lineA = SMA.calculate({ period: this.params.n1, values: close });
    const lineB = SMA.calculate({ period: this.params.n2, values: close });
    this.addIndicator('lineA', lineA, { overlay: true, color: '#1f77b4' });
    this.addIndicator('lineB', lineB, { overlay: true, color: '#ff7f0e' });
    this.addSignal('crossUp', crossover(this.getIndicator('lineA') as number[], this.getIndicator('lineB') as number[]));
    this.addSignal('crossDown', crossunder(this.getIndicator('lineA') as number[], this.getIndicator('lineB') as number[]));
  }

  next(ctx: Context): void {
    const { index, signals } = ctx;
    if (index < this.params.n1 || index < this.params.n2) return;
    if (signals.get('crossUp')) this.buy({ size: 1000 });
    if (signals.get('crossDown')) this.sell({ size: 1000 });
  }
}

async function main(): Promise<void> {
  const backtest = new Backtest(data, SmaCross, { cash: 1_000_000, tradeOnClose: true });
  const stats = await backtest.run();
  stats.print();
  stats.plot({ filename: 'quickstart.html', openBrowser: false });
  console.log('Wrote quickstart.html');
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

export { main };
