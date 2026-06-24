export interface PlottingOptions {
  openBrowser?: boolean;
  filename?: string;
  /** Fixed plot width in pixels. Default stretches to the available width. */
  plotWidth?: number;
  /** Render the equity curve panel (with Peak/Final/MaxDD/MaxDdDuration annotations). Default `true`. */
  plotEquity?: boolean;
  /** Render the return curve panel. Default `false`. */
  plotReturn?: boolean;
  /** Render the per-trade profit/loss panel. Default `true`. */
  plotPL?: boolean;
  /** Render the volume bar panel. Default `true`. */
  plotVolume?: boolean;
  /** Render a standalone drawdown panel. Default `false`. */
  plotDrawdown?: boolean;
  /** Render trade segments on the OHLC panel. Default `true`. */
  plotTrades?: boolean;
  /** Smooth the equity curve between trade exits and key points. Default `false`. */
  smoothEquity?: boolean;
  /**
   * Display the equity panel as percentage gain/loss from the starting equity instead of
   * absolute dollars. Default `true` (matches backtesting.py); set `false` for raw $ scale.
   */
  relativeEquity?: boolean;
  /** Render a coarser-resolution OHLC overlay. Default `true`; pass a rule string to force one. */
  superimpose?: boolean | string;
  /** Resample oversized plots. Default `true`; pass a rule string to force one. */
  resample?: boolean | string;
  /** Reverse non-overlay indicator panel order. Default `true`. */
  reverseIndicators?: boolean;
  /** Show plot legends. Default `true`. */
  showLegend?: boolean;
}
