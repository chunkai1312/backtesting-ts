import * as assert from 'assert';
import { Broker } from './broker';
import { HistoricalData } from './historical-data';
import { Context, OrderOptions } from './interfaces';

export interface IndicatorOptions {
  /** Render the indicator on the OHLC panel (true) or in its own subplot after volume (false). Default `true`. */
  overlay?: boolean;
  /** Plotly color for the indicator trace, or one color per line for multi-line indicators. */
  color?: string | string[];
  /** Render the indicator as markers instead of a continuous line. Default `false`. */
  scatter?: boolean;
  /** Include the indicator in chart output. Default `true`. */
  plot?: boolean;
}

export abstract class Strategy {
  private _indicators: Record<string, number[] | Record<string, number>[]> = {};
  private _indicatorMeta: Record<string, Required<IndicatorOptions>> = {};
  private _signals: Record<string, boolean[]> = {};

  constructor(public readonly data: HistoricalData, private readonly broker: Broker) {}

  get equity() {
    return this.broker.equity;
  }

  get position() {
    return this.broker.position;
  }

  get orders() {
    return this.broker.orders;
  }

  get trades() {
    return this.broker.trades;
  }

  get closedTrades() {
    return this.broker.closedTrades;
  }

  get indicators() {
    return this._indicators;
  }

  get signals() {
    return this._signals;
  }

  /**
   * Initialize the strategy.
   * Declare indicators and signals.
   */
  abstract init(): void;

  /**
   * Implement the strategy decisions.
   */
  abstract next(context: Context): void;

  /**
   * Place a new long order.
   */
  public buy(options: Omit<OrderOptions, 'trade'>) {
    assert(
      (options.size > 0) && (options.size < 1 || Math.round(options.size) === options.size),
      'size must be a positive fraction of equity, or a positive whole number of units',
    );
    return this.broker.newOrder(options);
  }

  /**
   * Place a new short order.
   */
  public sell(options: Omit<OrderOptions, 'trade'>) {
    assert(
      (options.size > 0) && (options.size < 1 || Math.round(options.size) === options.size),
      'size must be a positive fraction of equity, or a positive whole number of units',
    );
    return this.broker.newOrder({ ...options, size: -options.size });
  }

  /**
   * Add an indicator. The optional `options` controls how the plotter renders it:
   * `overlay: true` (default) draws the indicator on the OHLC panel; `overlay: false`
   * gives it its own subplot after volume. `plot: false` hides non-overlay indicators
   * and starts overlay indicators as legend-only traces.
   */
  public addIndicator(
    name: string,
    values: number[] | Record<string, number>[],
    options?: IndicatorOptions,
  ): void {
    if (values.length < this.data.length) {
      values = Array(this.data.length - values.length).fill(null).concat(values);
    }
    this._indicators[name] = values;
    this._indicatorMeta[name] = {
      overlay: options?.overlay ?? true,
      color: options?.color ?? '',
      scatter: options?.scatter ?? false,
      plot: options?.plot ?? true,
    };
  }

  /**
   * Get the indicator values.
   */
  public getIndicator(name: string) {
    return this._indicators[name];
  }

  /**
   * Add a signal.
   */
  public addSignal(name: string, values: boolean[]) {
    if (values.length < this.data.length) {
      values = Array(this.data.length - values.length).fill(null).concat(values);
    }
    this._signals[name] = values;
  }

  /**
   * Get the signal.
   */
  public getSignal(name: string) {
    return this._signals[name];
  }

  /**
   * Get the strategy name.
   */
  public toString() {
    // @ts-ignore
    if (this.params && Object.keys(this.params).length) {
      // @ts-ignore
      const params = Object.entries(this.params)
        .map(([key, value]) => `${key}=${value}`);
      return `${this.constructor.name}(${params.join(',')})`
    }
    return this.constructor.name;
  }
}
