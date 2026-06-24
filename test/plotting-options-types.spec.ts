import { IndicatorOptions, OrderOptions, PlottingOptions, Strategy, TradeOptions } from '../src';
import { Order } from '../src/order';
import { Trade } from '../src/trade';

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

describe('core order API type surface', () => {
  it('accepts omitted public order size for strategy defaults', () => {
    const withoutSize: OrderOptions = { tag: { source: 'default-size' } };

    expect(withoutSize).toEqual({ tag: { source: 'default-size' } });
  });

  it('rejects removed order option keys at compile time', () => {
    // @ts-expect-error price is intentionally not a public order execution override.
    const withPrice: OrderOptions = { size: 1, price: 100 };
    // @ts-expect-error trailPercent is intentionally removed from core order options.
    const withTrailPercent: OrderOptions = { size: 1, trailPercent: 0.05 };
    // @ts-expect-error trailAmount is intentionally removed from core order options.
    const withTrailAmount: OrderOptions = { size: 1, trailAmount: 10 };

    expect([withPrice, withTrailPercent, withTrailAmount]).toHaveLength(3);
  });

  it('rejects removed public order members at compile time', () => {
    const assertOrderSurface = (order: Order) => {
      // @ts-expect-error parentTrade is intentionally internal.
      order.parentTrade;
      // @ts-expect-error trailPercent is intentionally removed from Order.
      order.trailPercent;
      // @ts-expect-error trailAmount is intentionally removed from Order.
      order.trailAmount;
    };

    expect(typeof assertOrderSurface).toBe('function');
  });
});

describe('core trade API type surface', () => {
  it('rejects removed trade option keys at compile time', () => {
    // @ts-expect-error commission is intentionally internal to broker accounting.
    const withCommission: TradeOptions = { size: 1, entryPrice: 100, entryBar: 0, commission: 1 };
    // @ts-expect-error slOrder is intentionally internal contingent-order state.
    const withSlOrder: TradeOptions = { size: 1, entryPrice: 100, entryBar: 0, slOrder: {} };
    // @ts-expect-error tpOrder is intentionally internal contingent-order state.
    const withTpOrder: TradeOptions = { size: 1, entryPrice: 100, entryBar: 0, tpOrder: {} };
    // @ts-expect-error trailPercent is intentionally removed from trade options.
    const withTrailPercent: TradeOptions = { size: 1, entryPrice: 100, entryBar: 0, trailPercent: 0.05 };
    // @ts-expect-error trailAmount is intentionally removed from trade options.
    const withTrailAmount: TradeOptions = { size: 1, entryPrice: 100, entryBar: 0, trailAmount: 10 };

    expect([withCommission, withSlOrder, withTpOrder, withTrailPercent, withTrailAmount]).toHaveLength(5);
  });

  it('rejects removed public trade members at compile time', () => {
    const assertTradeSurface = (trade: Trade) => {
      // @ts-expect-error commission is intentionally internal.
      trade.commission;
      // @ts-expect-error slOrder is intentionally internal contingent-order state.
      trade.slOrder;
      // @ts-expect-error tpOrder is intentionally internal contingent-order state.
      trade.tpOrder;
      // @ts-expect-error isTrailing is intentionally removed from core Trade.
      trade.isTrailing;
      // @ts-expect-error trailPercent is intentionally removed from core Trade.
      trade.trailPercent;
      // @ts-expect-error trailAmount is intentionally removed from core Trade.
      trade.trailAmount;
      // @ts-expect-error trailingDistance is intentionally removed from core Trade.
      trade.trailingDistance;
      // @ts-expect-error updateTrailingPeak is intentionally removed from core Trade.
      trade.updateTrailingPeak(100, 90);
      // @ts-expect-error applyTrailingSL is intentionally removed from core Trade.
      trade.applyTrailingSL();
      // @ts-expect-error computeTrailingSL is intentionally removed from core Trade.
      trade.computeTrailingSL();
    };

    expect(typeof assertTradeSurface).toBe('function');
  });
});

describe('strategy API type surface', () => {
  it('keeps indicator plotting metadata internal at compile time', () => {
    const assertStrategySurface = (strategy: Strategy) => {
      // @ts-expect-error indicator plotting metadata is intentionally internal.
      strategy.getIndicatorOptions('SMA');
    };

    expect(typeof assertStrategySurface).toBe('function');
  });
});
