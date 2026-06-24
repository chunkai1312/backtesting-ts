/**
 * 02 — Order management
 *
 * Demonstrates market orders with initial SL / TP brackets, tag metadata,
 * and active-trade stop management via writable trade.sl / trade.tp.
 *
 *   yarn example examples/02-order-management.ts
 */

import { Backtest, Strategy, Context, TradeLogColumn } from '../lib';
import * as path from 'path';

const data = require(path.join(__dirname, 'data/2330.json'));

class BracketOrderStrategy extends Strategy {
  init(): void {
    // no indicators needed; this example focuses on order fields and trade updates.
  }

  next(ctx: Context): void {
    if (ctx.index === 1 && this.trades.length === 0 && this.orders.length === 0) {
      const close = ctx.data.close;
      this.buy({
        size: 500,
        slPrice: close * 0.92,
        tpPrice: close * 1.18,
        tag: { setup: 'bracket-entry' },
      });
    }

    for (const trade of this.trades) {
      if (trade.isLong && ctx.index > trade.entryBar + 5) {
        const tighterStop = Math.max(trade.sl ?? 0, ctx.data.close * 0.95);
        trade.sl = tighterStop;
      }

      if (ctx.index === 30) {
        trade.tp = undefined;
      }

      if (ctx.index === 45) {
        trade.close();
      }
    }
  }
}

async function main(): Promise<void> {
  const backtest = new Backtest(data, BracketOrderStrategy, {
    cash: 1_000_000,
    tradeOnClose: true,
    finalizeTrades: true,
  });
  const stats = await backtest.run();
  stats.print();

  const trades = stats.tradeLog ?? [];
  console.log('\nClosed trades:');
  for (const t of trades.slice(0, 3)) {
    console.log({
      tag: t[TradeLogColumn.Tag],
      entry: t[TradeLogColumn.EntryPrice],
      exit: t[TradeLogColumn.ExitPrice],
      pnl: t[TradeLogColumn.PnL],
    });
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

export { main };
