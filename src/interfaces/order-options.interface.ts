export interface OrderOptions {
  size?: number;
  limitPrice?: number;
  stopPrice?: number;
  slPrice?: number;
  tpPrice?: number;
  tag?: Record<string, string>;
}
