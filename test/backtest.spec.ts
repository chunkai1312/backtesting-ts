import { Backtest } from '../src';
import { Strategy } from '../src/strategy';
import { Stats } from '../src/stats';
import { StatsIndex, TradeLogColumn } from '../src/enums';
import { SmaCross } from './sma-cross.strategy';

class BuyAndHold extends Strategy {
  init() { /* no-op */ }
  next(ctx: { index: number }) {
    if (ctx.index === 1) this.buy({ size: 100 });
  }
}

class MultipleOpenTrades extends Strategy {
  init() { /* no-op */ }
  next(ctx: { index: number }) {
    if (ctx.index === 0 || ctx.index === 1) this.buy({ size: 100 });
  }
}

class FinalBarMarketOrderWithOpenTrades extends Strategy {
  init() { /* no-op */ }
  next(ctx: { index: number }) {
    if (ctx.index === 0 || ctx.index === 1) this.buy({ size: 100, tag: { source: 'cleanup' } });
    if (ctx.index === 3) this.buy({ size: 100, tag: { source: 'final-bar' } });
  }
}

describe('Backtest', () => {
  const data = require('./fixtures/2330.json');
  const cleanupData = [
    { date: '2024-01-01', open: 100, high: 100, low: 100, close: 100 },
    { date: '2024-01-02', open: 100, high: 100, low: 100, close: 100 },
    { date: '2024-01-03', open: 120, high: 120, low: 120, close: 120 },
    { date: '2024-01-04', open: 130, high: 130, low: 130, close: 130 },
  ];

  describe('constructor()', () => {
    beforeEach(() => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should create a Backtest instance', () => {
      const backtest = new Backtest(data, SmaCross);
      expect(backtest).toBeInstanceOf(Backtest);
    });

    it('should create a Backtest instance with options', () => {
      const backtest = new Backtest(data, SmaCross, { cash: 1000000 });
      expect(backtest).toBeInstanceOf(Backtest);
    });

    it('should print warning when some prices are larger than initial cash value', () => {
      const backtest = new Backtest(data, SmaCross, { cash: 100 });
      expect(backtest).toBeInstanceOf(Backtest);
      expect(console.warn).toBeCalledWith('Some prices are larger than initial cash value.');
    });

    it('should throw error when Strategy is invalid', () => {
      expect(() => {
        // @ts-ignore
        new Backtest(data, {});
      }).toThrow(TypeError);
    });

    it('should throw error when data is empty', () => {
      expect(() => {
        new Backtest([], SmaCross);
      }).toThrow(TypeError);
    });

    it('should throw error when some data fields are missing', () => {
      expect(() => {
        // @ts-ignore
        new Backtest([{ date: '2023-01-03' }], SmaCross);
      }).toThrow(TypeError);
    });
  });

  describe('.run()', () => {
    it('should run backtest and generate stats', async () => {
      const backtest = new Backtest(data, SmaCross, {
        cash: 1000000,
        tradeOnClose: true,
      });
      expect(backtest.stats).toBeUndefined();
      await backtest.run();
      expect(backtest.stats).toBeDefined();
    });

    it('should auto-close open trades that remain at the last bar', async () => {
      const backtest = new Backtest(data, BuyAndHold, { cash: 1000000 });
      const stats = await backtest.run();
      expect(stats.tradeLog?.length).toBe(1);
    });

    it('should auto-close multiple open trades that remain at the last bar', async () => {
      const backtest = new Backtest(cleanupData, MultipleOpenTrades, { cash: 1000000 });
      const stats = await backtest.run();

      expect(stats.results?.[StatsIndex.Trades]).toBe(2);
      expect(stats.tradeLog?.length).toBe(2);
      expect(stats.tradeLog?.map(t => t[TradeLogColumn.PnL])).toEqual([3000, 1000]);
      expect(stats.tradeLog?.map(t => t[TradeLogColumn.ExitBar])).toEqual([3, 3]);
    });

    it('should not skip cleanup close orders after a final-bar market order', async () => {
      const backtest = new Backtest(cleanupData, FinalBarMarketOrderWithOpenTrades, { cash: 1000000 });
      const stats = await backtest.run();

      expect(stats.results?.[StatsIndex.Trades]).toBe(2);
      expect(stats.tradeLog?.length).toBe(2);
      expect(stats.tradeLog?.map(t => t[TradeLogColumn.PnL])).toEqual([3000, 1000]);
      expect(stats.tradeLog?.map(t => t[TradeLogColumn.Tag])).toEqual([
        { source: 'cleanup' },
        { source: 'cleanup' },
      ]);
    });
  });

  describe('.optimize()', () => {
    it('should optimize strategy parameters and return OptimizeResult', async () => {
      const backtest = new Backtest(data, SmaCross);
      expect(backtest.stats).toBeUndefined();
      const result = await backtest.optimize({ params: { n1: [5, 10, 20], n2: [60, 120, 240] } });
      expect(backtest.stats).toBe(result.best);
      expect(result.best).toBeInstanceOf(Stats);
      expect(typeof result.bestScore).toBe('number');
      expect(Object.keys(result.bestParams).sort()).toEqual(['n1', 'n2']);
      expect(result.heatmap).toBeUndefined();
      expect(result.all).toBeUndefined();
    });

    it('should throw error when no parameters provided', async () => {
      const backtest = new Backtest(data, SmaCross);
      // @ts-ignore
      await expect(() => backtest.optimize({})).rejects.toThrow();
    });

    it('should throw error when parameters are empty', async () => {
      const backtest = new Backtest(data, SmaCross);
      await expect(() => backtest.optimize({ params: {} })).rejects.toThrow();
    });

    it('should throw error when a parameter array is empty', async () => {
      const backtest = new Backtest(data, SmaCross);
      await expect(() => backtest.optimize({ params: { n1: [] } })).rejects.toThrow();
    });

    it('should throw TypeError when both maximize and max are provided', async () => {
      const backtest = new Backtest(data, SmaCross);
      await expect(() => backtest.optimize({
        params: { n1: [5], n2: [60] },
        maximize: StatsIndex.SharpeRatio,
        max: StatsIndex.Return,
      })).rejects.toThrow(TypeError);
    });

    it('should throw TypeError when method=random has no maxTries', async () => {
      const backtest = new Backtest(data, SmaCross);
      await expect(() => backtest.optimize({
        params: { n1: [5], n2: [60] },
        method: 'random',
      })).rejects.toThrow(TypeError);
    });

    it('should apply constraint to filter combinations', async () => {
      const backtest = new Backtest(data, SmaCross);
      const result = await backtest.optimize({
        params: { n1: [5, 10, 20], n2: [10, 20] },
        constraint: p => p.n1 < p.n2,
        returnAll: true,
      });
      // Valid combos under n1 < n2: {5,10}, {5,20}, {10,20} = 3
      expect(result.all?.length).toBe(3);
      expect(result.all?.every(r => r.params.n1 < r.params.n2)).toBe(true);
    });

    it('should throw when constraint filters all combinations', async () => {
      const backtest = new Backtest(data, SmaCross);
      await expect(() => backtest.optimize({
        params: { n1: [5, 10], n2: [60] },
        constraint: () => false,
      })).rejects.toThrow('All combinations were filtered by constraint');
    });

    it('maxTries should cap the number of executed combinations', async () => {
      const backtest = new Backtest(data, SmaCross);
      const result = await backtest.optimize({
        params: { n1: [5, 10, 20, 30], n2: [60, 120, 240] },
        maxTries: 5,
        seed: 42,
        returnAll: true,
      });
      expect(result.all?.length).toBe(5);
    });

    it('maxTries larger than total combos runs all combos', async () => {
      const backtest = new Backtest(data, SmaCross);
      const result = await backtest.optimize({
        params: { n1: [5, 10], n2: [60] },
        maxTries: 100,
        returnAll: true,
      });
      expect(result.all?.length).toBe(2);
    });

    it('same seed reproduces the same bestParams', async () => {
      const backtest = new Backtest(data, SmaCross);
      const a = await backtest.optimize({
        params: { n1: [5, 10, 20, 30], n2: [60, 120, 240] },
        maxTries: 3,
        seed: 42,
      });
      const b = await backtest.optimize({
        params: { n1: [5, 10, 20, 30], n2: [60, 120, 240] },
        maxTries: 3,
        seed: 42,
      });
      expect(a.bestParams).toEqual(b.bestParams);
    });

    it('maximize as a function ranks by custom score', async () => {
      const backtest = new Backtest(data, SmaCross);
      const result = await backtest.optimize({
        params: { n1: [5, 10], n2: [60] },
        maximize: stats => Number(stats[StatsIndex.SharpeRatio]) || 0,
        returnAll: true,
      });
      // best.score should equal the best Sharpe across runs
      if (!result.all) throw new Error('expected all');
      const sharpes = result.all.map(r => r.score);
      expect(result.bestScore).toBe(Math.max(...sharpes));
    });

    it('maximize function returning NaN excludes the combo from ranking', async () => {
      const backtest = new Backtest(data, SmaCross);
      let toggle = true;
      const result = await backtest.optimize({
        params: { n1: [5, 10], n2: [60] },
        maximize: () => (toggle = !toggle) ? 1 : NaN,
      });
      expect(result.bestScore).toBe(1);
    });

    it('deprecated max alias still works and produces the same result as maximize', async () => {
      const backtest = new Backtest(data, SmaCross);
      const a = await backtest.optimize({
        params: { n1: [5, 10], n2: [60] },
        max: StatsIndex.EquityFinal,
      });
      const b = await backtest.optimize({
        params: { n1: [5, 10], n2: [60] },
        maximize: StatsIndex.EquityFinal,
      });
      expect(a.bestParams).toEqual(b.bestParams);
    });

    it('returnAll populates one entry per executed combo', async () => {
      const backtest = new Backtest(data, SmaCross);
      const result = await backtest.optimize({
        params: { n1: [5, 10], n2: [60, 120] },
        returnAll: true,
      });
      expect(result.all?.length).toBe(4);
      expect(result.all?.every(r => typeof r.score === 'number' && r.stats instanceof Stats)).toBe(true);
    });

    it('returnHeatmap on 2-param grid returns ParamHeatmap with correct shape', async () => {
      const backtest = new Backtest(data, SmaCross);
      const result = await backtest.optimize({
        params: { n1: [5, 10, 20], n2: [60, 120] },
        returnHeatmap: true,
      });
      const heatmap = result.heatmap;
      if (!heatmap) throw new Error('expected heatmap');
      expect(heatmap.xLabel).toBe('n1');
      expect(heatmap.yLabel).toBe('n2');
      expect(heatmap.xValues).toEqual([5, 10, 20]);
      expect(heatmap.yValues).toEqual([60, 120]);
      expect(heatmap.z.length).toBe(2);
      expect(heatmap.z[0].length).toBe(3);
      expect(heatmap.metric).toBe(StatsIndex.EquityFinal);
    });

    it('returnHeatmap throws on 1-param grid', async () => {
      const backtest = new Backtest(data, SmaCross);
      await expect(() => backtest.optimize({
        params: { n1: [5, 10, 20] },
        returnHeatmap: true,
      })).rejects.toThrow();
    });

    it('returnHeatmap with custom maximize sets metric to "custom"', async () => {
      const backtest = new Backtest(data, SmaCross);
      const result = await backtest.optimize({
        params: { n1: [5, 10], n2: [60, 120] },
        maximize: stats => Number(stats[StatsIndex.EquityFinal]) || 0,
        returnHeatmap: true,
      });
      expect(result.heatmap?.metric).toBe('custom');
    });

    it('best matches Backtest.stats so backtest.print() still works', async () => {
      const backtest = new Backtest(data, SmaCross);
      const result = await backtest.optimize({ params: { n1: [5], n2: [60] } });
      expect(backtest.stats).toBe(result.best);
    });

    it('ranks correctly when later combos yield higher scores', async () => {
      const backtest = new Backtest(data, SmaCross);
      // Encode score from Strategy string so it is monotonic in n1, deterministic across promise resolution order.
      const result = await backtest.optimize({
        params: { n1: [5, 10, 20], n2: [60] },
        maximize: stats => {
          const m = (stats[StatsIndex.Strategy] as string).match(/n1=(\d+)/);
          return m ? parseInt(m[1], 10) : 0;
        },
      });
      expect(result.bestParams.n1).toBe(20);
      expect(result.bestScore).toBe(20);
    });

    it('throws when maximize points to a string-typed stat (all scores NaN)', async () => {
      const backtest = new Backtest(data, SmaCross);
      await expect(() => backtest.optimize({
        params: { n1: [5], n2: [60] },
        maximize: StatsIndex.Strategy,
      })).rejects.toThrow('All combinations produced NaN scores');
    });

    it('heatmap leaves cells with NaN-scored or filtered-out runs as NaN', async () => {
      const backtest = new Backtest(data, SmaCross);
      let count = 0;
      const result = await backtest.optimize({
        params: { n1: [5, 10], n2: [60, 120] },
        maximize: () => (count++ % 2 === 0 ? 1 : NaN),
        returnHeatmap: true,
      });
      if (!result.heatmap) throw new Error('expected heatmap');
      const cells = result.heatmap.z.flat();
      expect(cells.some(c => Number.isNaN(c))).toBe(true);
      expect(cells.some(c => c === 1)).toBe(true);
    });

    it('heatmap leaves cells unfilled by constraint as NaN', async () => {
      const backtest = new Backtest(data, SmaCross);
      const result = await backtest.optimize({
        params: { n1: [5, 10], n2: [60, 120] },
        constraint: p => p.n1 < p.n2 / 6, // {5,60} valid (5<10), {5,120} valid (5<20), {10,60} invalid (10<10? no), {10,120} valid (10<20)
        returnHeatmap: true,
      });
      // Cell for n1=10, n2=60 should be NaN because constraint excluded it
      const heatmap = result.heatmap;
      if (!heatmap) throw new Error('expected heatmap');
      const xi = heatmap.xValues.indexOf(10);
      const yi = heatmap.yValues.indexOf(60);
      expect(Number.isNaN(heatmap.z[yi][xi])).toBe(true);
    });
  });

  describe('.print()', () => {
    it('should print the results of the backtest run', async () => {
      const backtest = new Backtest(data, SmaCross);
      await backtest.run();
      Stats.prototype.print = jest.fn();
      expect(backtest.print()).toBeInstanceOf(Backtest);
      expect(Stats.prototype.print).toBeCalled();
    });

    it('should throw error when missing results', () => {
      const backtest = new Backtest(data, SmaCross);
      expect(() => backtest.print()).toThrow(Error);
    });
  });

  describe('.plot()', () => {
    it('should plot the equity curve of the backtest run', async () => {
      const backtest = new Backtest(data, SmaCross);
      await backtest.run();
      Stats.prototype.plot = jest.fn();
      expect(backtest.plot()).toBeInstanceOf(Backtest);
      expect(Stats.prototype.plot).toBeCalled();
    });

    it('should throw error when missing results', () => {
      const backtest = new Backtest(data, SmaCross);
      expect(() => backtest.plot()).toThrow(Error);
    });
  });
});
