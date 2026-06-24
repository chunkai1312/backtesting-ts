export interface TradeOptions {
  size: number;
  entryPrice: number;
  entryBar: number;
  exitPrice?: number;
  exitBar?: number;
  tag?: Record<string, string>;
}
