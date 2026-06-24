import { HistoricalData } from '../src/historical-data';
import { Broker } from '../src/broker';
import { Strategy } from '../src/strategy';
import { Stats } from '../src/stats';
import { Plotting } from '../src/plotting';
import { Trade } from '../src/trade';
import { StatsIndex } from '../src/enums';
import { SmaCross } from './sma-cross.strategy';

class EmptyStrategy extends Strategy {
  init(): void { /* no-op */ }
  next(): void { /* no-op */ }
}

describe('Stats', () => {
  let data: HistoricalData;
  let broker: Broker;
  let strategy: Strategy;
  let equity: number[];
  let trades: Trade[];

  beforeEach(() => {
    data = new HistoricalData(require('./fixtures/2330.json'));
    broker = new Broker(data, {
      cash: 10000,
      commission: 0,
      margin: 1,
      tradeOnClose: false,
      hedging: false,
      exclusiveOrders: false,
    });
    strategy = new SmaCross(data, broker);
    equity = Array(data.length).fill(10000);
    trades = [new Trade(broker, { size: 10, entryPrice: 100, entryBar: 0, exitPrice: 110, exitBar: 1 })];
  });

  describe('constructor()', () => {
    it('should create a Stats instance', () => {
      const stats = new Stats(data, strategy, equity, trades, { riskFreeRate: 0 });
      expect(stats).toBeInstanceOf(Stats);
    });
  });

  describe('.compute()', () => {
    it('should compute the stats of the strategy and get the results', () => {
      const stats = new Stats(data, strategy, equity, trades, { riskFreeRate: 0 });
      expect(stats.equityCurve).toBeUndefined();
      expect(stats.tradeLog).toBeUndefined();
      expect(stats.results).toBeUndefined();
      stats.compute();
      expect(stats.equityCurve).toBeDefined();
      expect(stats.tradeLog).toBeDefined();
      expect(stats.results).toBeDefined();
    });

    it('computes buy-and-hold return from the first indicator-ready bar', () => {
      const warmupData = new HistoricalData([
        { date: '2024-01-01', open: 100, high: 100, low: 100, close: 100 },
        { date: '2024-01-02', open: 110, high: 110, low: 110, close: 110 },
        { date: '2024-01-03', open: 121, high: 121, low: 121, close: 121 },
        { date: '2024-01-04', open: 133.1, high: 133.1, low: 133.1, close: 133.1 },
        { date: '2024-01-05', open: 146.41, high: 146.41, low: 146.41, close: 146.41 },
      ]);
      const warmupBroker = new Broker(warmupData, {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      });
      const warmupStrategy = new EmptyStrategy(warmupData, warmupBroker);
      warmupStrategy.addIndicator('readyAtThirdBar', [121, 133.1, 146.41]);

      const stats = new Stats(
        warmupData,
        warmupStrategy,
        Array(warmupData.length).fill(10000),
        [],
        { riskFreeRate: 0 },
      ).compute();

      expect(stats.results?.[StatsIndex.BuyAndHoldReturn]).toBeCloseTo(21, 6);
    });

    it('computes buy-and-hold return from the first bar when no indicator warm-up exists', () => {
      const noWarmupData = new HistoricalData([
        { date: '2024-01-01', open: 100, high: 100, low: 100, close: 100 },
        { date: '2024-01-02', open: 110, high: 110, low: 110, close: 110 },
        { date: '2024-01-03', open: 121, high: 121, low: 121, close: 121 },
      ]);
      const noWarmupBroker = new Broker(noWarmupData, {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      });
      const noWarmupStrategy = new EmptyStrategy(noWarmupData, noWarmupBroker);

      const stats = new Stats(
        noWarmupData,
        noWarmupStrategy,
        Array(noWarmupData.length).fill(10000),
        [],
        { riskFreeRate: 0 },
      ).compute();

      expect(stats.results?.[StatsIndex.BuyAndHoldReturn]).toBeCloseTo(21, 6);
    });
  });

  describe('.print()', () => {
    it('should print the results', () => {
      const stats = new Stats(data, strategy, equity, trades, { riskFreeRate: 0 });
      stats.compute();
      const tableSpy = jest.spyOn(console, 'table').mockImplementation(() => undefined);
      stats.print();
      expect(tableSpy).toBeCalledWith(stats.results);
      tableSpy.mockRestore();
    });

    it('should throw error when missing results', () => {
      expect(() => {
        const stats = new Stats(data, strategy, equity, trades, { riskFreeRate: 0 });
        stats.print();
      }).toThrow(Error);
    });
  });

  describe('.plot()', () => {
    it('should plot the equity curve', () => {
      const stats = new Stats(data, strategy, equity, trades, { riskFreeRate: 0 });
      stats.compute();
      const plotMock = jest.spyOn(Plotting.prototype, 'plot').mockImplementation(function (this: Plotting) {
        expect((this as unknown as { options: unknown }).options).toMatchObject({ plotVolume: false });
      });
      stats.plot({ plotVolume: false });
      expect(plotMock).toBeCalled();
      plotMock.mockRestore();
    });

    it('should throw error when missing results', () => {
      expect(() => {
        const stats = new Stats(data, strategy, equity, trades, { riskFreeRate: 0 });
        stats.plot();
      }).toThrow(Error);
    });
  });

  describe('Kelly and trade aggregates', () => {
    const buildTrades = (specs: Array<{ size: number; entry: number; exit: number; bar: number }>): Trade[] =>
      specs.map(s => new Trade(broker, {
        size: s.size,
        entryPrice: s.entry,
        entryBar: s.bar,
        exitPrice: s.exit,
        exitBar: s.bar + 1,
      }));

    const computeResults = (forTrades: Trade[]) => {
      const results = new Stats(data, strategy, equity, forTrades, { riskFreeRate: 0 })
        .compute()
        .results;
      if (!results) throw new Error('expected results');
      return results;
    };

    it('computes Kelly Criterion for mixed wins and losses', () => {
      const winning = Array(4).fill(0).map((_, i) => ({ size: 10, entry: 100, exit: 105, bar: i }));
      const losing = Array(2).fill(0).map((_, i) => ({ size: 10, entry: 100, exit: 97.5, bar: i + 4 }));
      const results = computeResults(buildTrades([...winning, ...losing]));

      expect(results[StatsIndex.AvgWinPct]).toBeCloseTo(5, 6);
      expect(results[StatsIndex.AvgLossPct]).toBeCloseTo(-2.5, 6);
      expect(results[StatsIndex.WinLossRatio]).toBeCloseTo(2, 6);
      expect(results[StatsIndex.KellyCriterion]).toBeCloseTo(0.5, 6);
    });

    it('computes Kelly Criterion from cash P/L when trade sizes differ', () => {
      const results = computeResults(buildTrades([
        { size: 10, entry: 100, exit: 110, bar: 0 },
        { size: 1, entry: 100, exit: 120, bar: 1 },
        { size: 10, entry: 100, exit: 95, bar: 2 },
      ]));

      expect(results[StatsIndex.AvgWinPct]).toBeCloseTo(15, 6);
      expect(results[StatsIndex.AvgLossPct]).toBeCloseTo(-5, 6);
      expect(results[StatsIndex.WinLossRatio]).toBeCloseTo(3, 6);
      expect(results[StatsIndex.KellyCriterion]).toBeCloseTo(0.388889, 6);
    });

    it('all-wins sets Kelly to win rate, ratio to Infinity, AvgLoss to 0', () => {
      const allWins = buildTrades(Array(3).fill(0).map((_, i) => ({ size: 10, entry: 100, exit: 110, bar: i })));
      const results = computeResults(allWins);

      expect(results[StatsIndex.AvgLossPct]).toBe(0);
      expect(results[StatsIndex.WinLossRatio]).toBe(Infinity);
      expect(results[StatsIndex.KellyCriterion]).toBeCloseTo(1, 6);
    });

    it('all-losses sets Kelly to 0, ratio to 0, AvgWin to 0', () => {
      const allLosses = buildTrades(Array(3).fill(0).map((_, i) => ({ size: 10, entry: 100, exit: 90, bar: i })));
      const results = computeResults(allLosses);

      expect(results[StatsIndex.AvgWinPct]).toBe(0);
      expect(results[StatsIndex.WinLossRatio]).toBe(0);
      expect(results[StatsIndex.KellyCriterion]).toBe(0);
    });

    it('no trades sets all four new keys to NaN', () => {
      const results = computeResults([]);

      expect(results[StatsIndex.AvgWinPct]).toBeNaN();
      expect(results[StatsIndex.AvgLossPct]).toBeNaN();
      expect(results[StatsIndex.WinLossRatio]).toBeNaN();
      expect(results[StatsIndex.KellyCriterion]).toBeNaN();
    });

    it('the four new keys are placed after SQN in insertion order', () => {
      const results = computeResults(trades);
      const keys = Object.keys(results);
      const sqnIdx = keys.indexOf(StatsIndex.SQN);
      expect(keys.slice(sqnIdx + 1, sqnIdx + 5)).toEqual([
        StatsIndex.AvgWinPct,
        StatsIndex.AvgLossPct,
        StatsIndex.WinLossRatio,
        StatsIndex.KellyCriterion,
      ]);
    });
  });
});
