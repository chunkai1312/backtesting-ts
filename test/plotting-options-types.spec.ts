import { IndicatorOptions, PlottingOptions } from '../src';

describe('plotting option type surface', () => {
  it('accepts strict backtesting.py parity plotting options', () => {
    const options: PlottingOptions = {
      filename: 'result.html',
      openBrowser: false,
      plotWidth: 1200,
      plotEquity: true,
      plotReturn: true,
      plotPL: true,
      plotVolume: true,
      plotDrawdown: true,
      plotTrades: true,
      smoothEquity: true,
      relativeEquity: true,
      superimpose: 'M',
      resample: 'W',
      reverseIndicators: true,
      showLegend: false,
    };

    expect(options).toMatchObject({
      filename: 'result.html',
      plotReturn: true,
      plotDrawdown: true,
      superimpose: 'M',
      resample: 'W',
    });
  });

  it('accepts indicator plotting metadata for parity rendering', () => {
    const options: IndicatorOptions = {
      overlay: false,
      color: ['#1f77b4', '#ff7f0e'],
      scatter: true,
      plot: false,
    };

    expect(options).toEqual({
      overlay: false,
      color: ['#1f77b4', '#ff7f0e'],
      scatter: true,
      plot: false,
    });
  });

  it('rejects removed JS-only plotting options at compile time', () => {
    // @ts-expect-error plotPrice is intentionally removed from PlottingOptions.
    const withPlotPrice: PlottingOptions = { plotPrice: false };
    // @ts-expect-error plotSuperimposedOhlc is intentionally replaced by superimpose.
    const withPlotSuperimposedOhlc: PlottingOptions = { plotSuperimposedOhlc: false };
    // @ts-expect-error superimposedOhlcRule is intentionally replaced by superimpose.
    const withSuperimposedOhlcRule: PlottingOptions = { superimposedOhlcRule: 'Q' };

    expect([withPlotPrice, withPlotSuperimposedOhlc, withSuperimposedOhlcRule]).toHaveLength(3);
  });
});
