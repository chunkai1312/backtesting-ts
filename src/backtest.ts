import { HistoricalData } from './historical-data';
import { Strategy as BaseStrategy } from './strategy';
import { Broker } from './broker';
import { Trade } from './trade';
import { Stats, StatsResults } from './stats';
import {
  HistoricalDataInput,
  BacktestOptions,
  Context,
  OptimizeOptions,
  OptimizeResult,
  OptimizeRun,
  ParamHeatmap,
  PlottingOptions,
} from './interfaces';
import { StatsIndex } from './enums';
import { mulberry32, sampleWithoutReplacement } from './utils/random';

export class Backtest {
  private _data: HistoricalData;
  private _stats?: Stats;

  constructor(data: HistoricalDataInput,
    private readonly Strategy: new (data: HistoricalData, broker: Broker) => BaseStrategy,
    private readonly options?: BacktestOptions,
  ) {
    if (!(Strategy.prototype instanceof BaseStrategy)) {
      throw new TypeError('Invalid `Strategy`');
    }

    this._data = new HistoricalData(data);

    if (this._data.close.some(value => value > (options?.cash || 10000))) {
      console.warn('Some prices are larger than initial cash value.');
    }
  }

  get data() {
    return this._data;
  }

  get stats() {
    return this._stats;
  }

  /**
   * Run the backtest for the strategy.
   */
  public async run(options?: { params?: Record<string, number> }) {
    const data = this.data;
    const {
      finalizeTrades = false,
      ...brokerOptions
    } = this.options ?? {};
    const broker = new Broker(data, {
      cash: 10000,
      commission: 0,
      margin: 1,
      tradeOnClose: false,
      hedging: false,
      exclusiveOrders: false,
      ...brokerOptions,
    });
    const strategy = new this.Strategy(data, broker);

    // @ts-ignore
    if (options?.params) strategy.params = options.params;

    strategy.init();

    const iterator = this.runner(strategy);

    for await (const context of iterator) {
      broker.next();
      strategy.next(context as Context);
    }
    if (finalizeTrades) {
      broker.trades.forEach(t => t.close());
      broker.last();
    }

    const stats = new Stats(
      data,
      strategy,
      broker.equities,
      broker.closedTrades as Trade[],
      { riskFreeRate: 0 },
    ).compute();

    this._stats = stats;

    return stats;
  }

  /**
   * Optimize strategy parameters across a parameter grid.
   *
   * Returns an `OptimizeResult` with the best `Stats`, the winning parameter
   * combination, the score, and optionally a 2D heatmap or every executed run.
   */
  public async optimize(options: OptimizeOptions): Promise<OptimizeResult> {
    const params = options.params;
    if (!params || !Object.keys(params).length || Object.values(params).some(arr => !arr.length)) {
      throw new Error('Need some strategy parameters to optimize');
    }
    if (options.max !== undefined && options.maximize !== undefined) {
      throw new TypeError('Provide either `maximize` or the deprecated `max`, not both');
    }
    if (options.method === 'random' && options.maxTries === undefined) {
      throw new TypeError('`method: "random"` requires `maxTries`');
    }
    if (options.returnHeatmap && Object.keys(params).length < 2) {
      throw new Error('returnHeatmap requires at least 2 params');
    }

    const maximize: StatsIndex | ((stats: StatsResults) => number) =
      options.maximize ?? options.max ?? StatsIndex.EquityFinal;

    const allCombos = this.expandParams(params);
    const constraint = options.constraint;
    const filtered = constraint ? allCombos.filter(constraint) : allCombos;

    if (!filtered.length) {
      throw new Error('All combinations were filtered by constraint');
    }

    const seed = options.seed ?? Date.now();
    const rng = mulberry32(seed);
    const shouldSample =
      options.method === 'random' ||
      (options.maxTries !== undefined && filtered.length > options.maxTries);
    const selected = shouldSample
      ? sampleWithoutReplacement(filtered, options.maxTries as number, rng)
      : filtered;

    const runs: OptimizeRun[] = await Promise.all(
      selected.map(async params => {
        const stats = await this.run({ params });
        const score = this.scoreStats(stats, maximize);
        return { params, score, stats };
      }),
    );

    const ranked = runs.filter(r => !Number.isNaN(r.score));
    if (!ranked.length) {
      throw new Error('All combinations produced NaN scores; cannot rank');
    }

    let best = ranked[0];
    for (let i = 1; i < ranked.length; i++) {
      if (ranked[i].score > best.score) best = ranked[i];
    }

    this._stats = best.stats;

    const result: OptimizeResult = {
      best: best.stats,
      bestParams: best.params,
      bestScore: best.score,
    };
    if (options.returnAll) result.all = runs;
    if (options.returnHeatmap) {
      result.heatmap = this.buildHeatmap(runs, params, maximize);
    }
    return result;
  }

  private expandParams(params: Record<string, number[]>): Record<string, number>[] {
    const keys = Object.keys(params);
    const result: Record<string, number>[] = [];
    const combine = (index: number, current: Record<string, number>): void => {
      if (index === keys.length) {
        result.push(current);
        return;
      }
      const key = keys[index];
      const values = params[key];
      for (let i = 0; i < values.length; i++) {
        combine(index + 1, { ...current, [key]: values[i] });
      }
    };
    combine(0, {});
    return result;
  }

  private scoreStats(stats: Stats, maximize: StatsIndex | ((s: StatsResults) => number)): number {
    const results = stats.results;
    /* istanbul ignore if */
    if (!results) return NaN;
    const value = typeof maximize === 'function' ? maximize(results) : results[maximize];
    return typeof value === 'number' ? value : NaN;
  }

  private buildHeatmap(
    runs: OptimizeRun[],
    params: Record<string, number[]>,
    maximize: StatsIndex | ((s: StatsResults) => number),
  ): ParamHeatmap {
    const keys = Object.keys(params);
    const xLabel = keys[0];
    const yLabel = keys[1];
    const xValues = [...new Set(params[xLabel])].sort((a, b) => a - b);
    const yValues = [...new Set(params[yLabel])].sort((a, b) => a - b);
    const z = yValues.map(() => xValues.map(() => Number.NEGATIVE_INFINITY));

    for (const run of runs) {
      if (Number.isNaN(run.score)) continue;
      const xi = xValues.indexOf(run.params[xLabel]);
      const yi = yValues.indexOf(run.params[yLabel]);
      /* istanbul ignore if */
      if (xi < 0 || yi < 0) continue;
      if (run.score > z[yi][xi]) z[yi][xi] = run.score;
    }
    // Replace cells that received no run (still -Infinity) with NaN for clarity.
    for (let i = 0; i < z.length; i++) {
      for (let j = 0; j < z[i].length; j++) {
        if (z[i][j] === Number.NEGATIVE_INFINITY) z[i][j] = NaN;
      }
    }

    return {
      xLabel,
      yLabel,
      xValues,
      yValues,
      z,
      metric: typeof maximize === 'function' ? 'custom' : maximize,
    };
  }

  /**
   * Print the results of the backtest run.
   */
  public print() {
    if (!this.stats) {
      throw new Error('First issue `backtest.run()` to obtain results');
    }
    this.stats.print();

    return this;
  }

  /**
   * Plot the backtest result chart.
   */
  public plot(options?: PlottingOptions): Backtest {
    if (!this.stats) {
      throw new Error('First issue `backtest.run()` to obtain results');
    }
    this.stats.plot(options);

    return this;
  }

  private * runner(strategy: BaseStrategy) {
    const data = strategy.data;
    for (let i = 0, context = {}; i < data.length; i++) {
      const index = i;
      const bar = {
        date: data.date[i],
        open: data.open[i],
        high: data.high[i],
        low: data.low[i],
        close: data.close[i],
        volume: data.volume[i],
      };

      const indicators = new Map(
        Object
          .keys(strategy.indicators)
          .map(key => [key, strategy.indicators[key][i]])
      );

      const signals = new Map(
        Object
          .keys(strategy.signals)
          .map(key => [key, strategy.signals[key][i]])
      );

      const prev = context;
      const current = { index, data: bar, indicators, signals };
      context = { ...current, prev };

      yield context;
    }
  }
}
