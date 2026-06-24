/**
 * 06 — Trade statistics
 *
 * Reads aggregate metrics from Stats.results, inspects Stats.tradeLog, and
 * contrasts finalizeTrades: false with finalizeTrades: true for an open trade.
 *
 *   yarn example examples/06-trade-statistics.ts
 */

import {
  Backtest,
  Strategy,
  Context,
  StatsIndex,
  TradeLogColumn,
  crossover,
  crossunder,
} from '../lib';
import { SMA } from 'technicalindicators';
import * as path from 'path';

const data = require(path.join(__dirname, 'data/2330.json'));

class SmaCross extends Strategy {
  params = { n1: 20, n2: 60 };

  init(): void {
    const close = this.data.close;
    this.addIndicator('fast', SMA.calculate({ period: this.params.n1, values: close }));
    this.addIndicator('slow', SMA.calculate({ period: this.params.n2, values: close }));
    this.addSignal('up', crossover(this.getIndicator('fast') as number[], this.getIndicator('slow') as number[]));
    this.addSignal('down', crossunder(this.getIndicator('fast') as number[], this.getIndicator('slow') as number[]));
  }

  next(ctx: Context): void {
    if (ctx.index < this.params.n2) return;
    if (ctx.signals.get('up')) this.buy({ size: 1000, tag: { strategy: 'sma-cross' } });
    if (ctx.signals.get('down')) this.sell({ size: 1000, tag: { strategy: 'sma-cross' } });
  }
}

class BuyAndHold extends Strategy {
  init(): void {
    // no-op
  }

  next(ctx: Context): void {
    if (ctx.index === 1 && this.trades.length === 0 && this.orders.length === 0) {
      this.buy({ size: 1000, tag: { strategy: 'buy-and-hold' } });
    }
  }
}

async function main(): Promise<void> {
  const stats = await new Backtest(data, SmaCross, {
    cash: 1_000_000,
    tradeOnClose: true,
    finalizeTrades: true,
  }).run();

  const r = stats.results;
  if (!r) throw new Error('no results');

  console.log('--- Trade quality ---');
  console.log(`# Trades:         ${r[StatsIndex.Trades]}`);
  console.log(`Win Rate [%]:     ${Number(r[StatsIndex.WinRate]).toFixed(2)}`);
  console.log(`Avg. Win [%]:     ${Number(r[StatsIndex.AvgWinPct]).toFixed(4)}`);
  console.log(`Avg. Loss [%]:    ${Number(r[StatsIndex.AvgLossPct]).toFixed(4)}`);
  console.log(`Profit Factor:    ${Number(r[StatsIndex.ProfitFactor]).toFixed(4)}`);
  console.log(`Kelly Criterion:  ${Number(r[StatsIndex.KellyCriterion]).toFixed(4)}`);

  const firstTrade = stats.tradeLog?.[0];
  if (firstTrade) {
    console.log('\nFirst trade log row:');
    console.log({
      tag: firstTrade[TradeLogColumn.Tag],
      entryTime: firstTrade[TradeLogColumn.EntryTime],
      exitTime: firstTrade[TradeLogColumn.ExitTime],
      pnl: firstTrade[TradeLogColumn.PnL],
      returnPct: firstTrade[TradeLogColumn.ReturnPct],
    });
  }

  const openStats = await new Backtest(data, BuyAndHold, {
    cash: 1_000_000,
    tradeOnClose: true,
  }).run();
  const finalizedStats = await new Backtest(data, BuyAndHold, {
    cash: 1_000_000,
    tradeOnClose: true,
    finalizeTrades: true,
  }).run();

  console.log('\n--- finalizeTrades comparison ---');
  console.log(`Default closed trades: ${openStats.tradeLog?.length ?? 0}`);
  console.log(`finalizeTrades closed trades: ${finalizedStats.tradeLog?.length ?? 0}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

export { main };
