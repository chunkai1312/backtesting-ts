import { Order } from '../order';

export interface TradeOptions {
  size: number;
  entryPrice: number;
  entryBar: number;
  exitPrice?: number;
  exitBar?: number;
  commission?: number;
  slOrder?: Order;
  tpOrder?: Order;
  tag?: Record<string, string>;
  /** Trailing stop distance as a fraction of price; mutually exclusive with `trailAmount`. */
  trailPercent?: number;
  /** Trailing stop distance as an absolute price-unit difference; mutually exclusive with `trailPercent`. */
  trailAmount?: number;
}
