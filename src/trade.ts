import * as assert from 'assert';
import { Broker } from './broker';
import { Order } from './order';
import { TradeOptions } from './interfaces';

export class Trade {
  private _size: number;
  private _entryPrice: number;
  private _exitPrice?: number;
  private _entryBar: number;
  private _exitBar?: number;
  private _commission: number;
  private _slOrder?: Order;
  private _tpOrder?: Order;
  private _tag?: Record<string, string>;
  private _trailPercent?: number;
  private _trailAmount?: number;
  private _peakHigh?: number;
  private _peakLow?: number;

  constructor(private readonly broker: Broker, options: TradeOptions) {
    this._size = options.size;
    this._entryPrice = options.entryPrice;
    this._exitPrice = options.exitPrice;
    this._entryBar = options.entryBar;
    this._exitBar = options.exitBar;
    this._commission = options.commission ?? 0;
    this._slOrder = options.slOrder;
    this._tpOrder = options.tpOrder;
    this._tag = options.tag;
    this._trailPercent = options.trailPercent;
    this._trailAmount = options.trailAmount;
    if (this._trailPercent !== undefined || this._trailAmount !== undefined) {
      this._peakHigh = options.entryPrice;
      this._peakLow = options.entryPrice;
    }
  }

  /**
   * Trade size (volume; negative for short trades).
   */
  get size() {
    return this._size;
  }

  /**
   * Trade entry price.
   */
  get entryPrice() {
    return this._entryPrice;
  }

  /**
   * Trade exit price (or undefined if the trade is still active).
   */
  get exitPrice() {
    return this._exitPrice;
  }

  /**
   * Candlestick bar index of when the trade was entered.
   */
  get entryBar() {
    return this._entryBar;
  }

  /**
   * Candlestick bar index of when the trade was exited
   * (or undefined if the trade is still active).
   */
  get exitBar() {
    return this._exitBar;
  }

  /**
   * Total entry and exit commissions attributed to this trade.
   */
  get commission() {
    return this._commission;
  }

  /**
   * A tag value inherited from the `Order` that opened this trade.
   * This can be used to track trades and apply conditional logic / subgroup analysis.
   */
  get tag() {
    return this._tag;
  }

  /**
   * Get stop-loss order.
   */
  get slOrder() {
    return this._slOrder;
  }

  /**
   * Get take-profit order.
   */
  get tpOrder() {
    return this._tpOrder;
  }

  /**
   * Datetime of when the trade was entered.
   */
  get entryTime() {
    return this.broker.index[this._entryBar as number] as string;
  }

  /**
   * Datetime of when the trade was exited.
   */
  get exitTime() {
    return this.broker.index[this._exitBar as number] as string;
  }

  /**
   * True if the trade is long (trade size is positive).
   */
  get isLong() {
    return this._size > 0;
  }

  /**
   * True if the trade is short (trade size is negative).
   */
  get isShort() {
    return !this.isLong;
  }

  /**
   * Trade profit (positive) or loss (negative) in cash units.
   */
  get pl() {
    const price = this._exitPrice || this.broker.lastPrice;
    return this._size * (price - this._entryPrice) - this._commission;
  }

  /**
   * Trade profit (positive) or loss (negative) in percent.
   */
  get plPct() {
    const price = this._exitPrice || this.broker.lastPrice;
    const grossReturn = Math.sign(this._size) * (price / this._entryPrice - 1);
    return grossReturn - (this._commission / (Math.abs(this._size) * this._entryPrice));
  }

  /**
   * Trade total value in cash (volume * price).
   */
  get value() {
    const price = this._exitPrice || this.broker.lastPrice;
    return Math.abs(this._size) * price;
  }

  /**
   * Stop-loss price at which to close the trade.
   *
   * This variable is writable. By assigning it a new price value,
   * you create or modify the existing SL order.
   * By assigning it `undefined`, you cancel it.
   */
  get sl() {
    return this._slOrder?.stop as number;
  }

  /**
   * Set stop-loss price. Assigning a fixed price disables trailing mode.
   */
  set sl(price: number) {
    this._trailPercent = undefined;
    this._trailAmount = undefined;
    this._peakHigh = undefined;
    this._peakLow = undefined;
    this.setContingent('sl', price);
  }

  /**
   * `true` if this trade was opened with `trailPercent` or `trailAmount` and
   * trailing has not been disabled (e.g. via fixed `sl` assignment).
   */
  get isTrailing(): boolean {
    return this._trailPercent !== undefined || this._trailAmount !== undefined;
  }

  /**
   * Trailing stop distance as a fraction of price, or `undefined` if not in trailing mode.
   */
  get trailPercent(): number | undefined {
    return this._trailPercent;
  }

  /**
   * Trailing stop distance as an absolute price-unit difference, or `undefined` if not in trailing mode.
   */
  get trailAmount(): number | undefined {
    return this._trailAmount;
  }

  /**
   * Absolute distance between the current trailing peak and the active SL price.
   * Returns `undefined` when not trailing or no SL has been established yet.
   */
  get trailingDistance(): number | undefined {
    if (!this.isTrailing) return undefined;
    const peak = this.isLong ? this._peakHigh : this._peakLow;
    const slPrice = this._slOrder?.stop;
    if (peak === undefined || slPrice === undefined) return undefined;
    return Math.abs(peak - slPrice);
  }

  /**
   * Update internal peak-high (long) or peak-low (short) using the current bar's
   * extremes. No-op when the trade is not in trailing mode.
   */
  public updateTrailingPeak(barHigh: number, barLow: number): void {
    if (!this.isTrailing) return;
    if (this.isLong) {
      if (this._peakHigh === undefined || barHigh > this._peakHigh) {
        this._peakHigh = barHigh;
      }
    } else {
      if (this._peakLow === undefined || barLow < this._peakLow) {
        this._peakLow = barLow;
      }
    }
  }

  /**
   * Create or update the SL order to the given price without disturbing trailing state.
   * Used by the broker's trailing-stop loop; for fixed-SL assignment (which DOES
   * disable trailing) use the `sl` setter instead.
   */
  public applyTrailingSL(price: number): void {
    if (this._slOrder) {
      this._slOrder.replace({ stopPrice: price });
      return;
    }
    const order = this.broker.newOrder({
      size: -this._size,
      parentTrade: this,
      tag: this._tag,
      stopPrice: price,
    });
    this._slOrder = order;
  }

  /**
   * Compute the trailing-derived SL price from the current peak.
   * Returns `undefined` when not trailing or peak is not yet set.
   */
  public computeTrailingSL(): number | undefined {
    if (!this.isTrailing) return undefined;
    if (this.isLong) {
      /* istanbul ignore if */
      if (this._peakHigh === undefined) return undefined;
      if (this._trailPercent !== undefined) return this._peakHigh * (1 - this._trailPercent);
      /* istanbul ignore else */
      if (this._trailAmount !== undefined) return this._peakHigh - this._trailAmount;
      /* istanbul ignore next */
      return undefined;
    }
    /* istanbul ignore if */
    if (this._peakLow === undefined) return undefined;
    if (this._trailPercent !== undefined) return this._peakLow * (1 + this._trailPercent);
    /* istanbul ignore else */
    if (this._trailAmount !== undefined) return this._peakLow + this._trailAmount;
    /* istanbul ignore next */
    return undefined;
  }

  /**
   * Take-profit price at which to close the trade.
   *
   * This property is writable. By assigning it a new price value,
   * you create or modify the existing TP order.
   * By assigning it `undefined`, you cancel it.
   */
  get tp() {
    return this._tpOrder?.limit as number;
  }

  /**
   * Set take-profit price.
   */
  set tp(price: number) {
    this.setContingent('tp', price);
  }

  /**
   * Place new `Order` to close `portion` of the trade at next market price.
   */
  public close(portion = 1) {
    assert(portion > 0 && portion <= 1, 'portion must be a fraction between 0 and 1');
    const size = Math.max(1, Math.round(Math.abs(this._size) * portion)) * Math.sign(-this._size);
    const order = new Order(this.broker, { size, parentTrade: this, tag: this.tag });
    this.broker.orders.push(order);
  }

  /**
   * Replace the trade.
   */
  public replace(options: Partial<TradeOptions>) {
    if (options.size !== undefined) this._size = options.size;
    if (options.entryPrice !== undefined) this._entryPrice = options.entryPrice;
    if (options.exitPrice !== undefined) this._exitPrice = options.exitPrice;
    if (options.entryBar !== undefined) this._entryBar = options.entryBar;
    if (options.exitBar !== undefined) this._exitBar = options.exitBar;
    if (options.commission !== undefined) this._commission = options.commission;
    if (options.slOrder !== undefined) this._slOrder = options.slOrder;
    if (options.tpOrder !== undefined) this._tpOrder = options.tpOrder;
    if (options.tag !== undefined) this._tag = options.tag;
    if (options.trailPercent !== undefined) {
      this._trailPercent = options.trailPercent;
      this._trailAmount = undefined;
      if (this._peakHigh === undefined) this._peakHigh = this._entryPrice;
      if (this._peakLow === undefined) this._peakLow = this._entryPrice;
    }
    if (options.trailAmount !== undefined) {
      this._trailAmount = options.trailAmount;
      this._trailPercent = undefined;
      if (this._peakHigh === undefined) this._peakHigh = this._entryPrice;
      if (this._peakLow === undefined) this._peakLow = this._entryPrice;
    }
    return this;
  }

  /**
   * Copy the trade.
   */
  public copy(options: Partial<TradeOptions>) {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this).replace(options);
  }

  private setContingent(type: string, price: number) {
    assert(type === 'sl' || type === 'tp');
    assert(price === 0 || price < Number.POSITIVE_INFINITY);

    const order = (type === 'sl') ? this._slOrder : this._tpOrder;
    if (order) order.cancel();
    if (price) {
      const options = (type === 'sl') ? { stopPrice: price } : { limitPrice: price };
      const order = this.broker.newOrder({ size: -this.size, parentTrade: this, tag: this.tag, ...options });
      if (type === 'sl') this._slOrder = order;
      if (type === 'tp') this._tpOrder = order;
    }
  }
}
