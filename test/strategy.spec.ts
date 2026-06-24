import { HistoricalData } from '../src/historical-data';
import { Strategy } from '../src/strategy';
import { Broker } from '../src/broker';
import { SmaCross } from './sma-cross.strategy';

describe('Strategy', () => {
  let strategy: Strategy;
  let data: HistoricalData;
  let broker: Broker;

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
  });

  describe('constructor()', () => {
    it('should be instance of Strategy', () => {
      expect(strategy).toBeInstanceOf(Strategy);
    });
  });

  describe('.data', () => {
    it('should return the data', () => {
      expect(strategy.data).toBe(data);
    });
  });

  describe('.equity', () => {
    it('should return the equity of the broker', () => {
      expect(strategy.equity).toBe(10000);
    });
  });

  describe('.position', () => {
    it('should return the position of the broker', () => {
      expect(strategy.position).toBe(broker.position);
    });
  });

  describe('.orders', () => {
    it('should return the orders of the broker', () => {
      expect(strategy.orders).toBe(broker.orders);
    });
  });

  describe('.trades', () => {
    it('should return the trades of the broker', () => {
      expect(strategy.trades).toBe(broker.trades);
    });
  });

  describe('.closedTrades', () => {
    it('should return the closed trades of the broker', () => {
      expect(strategy.closedTrades).toBe(broker.closedTrades);
    });
  });

  describe('.indicators', () => {
    it('should return the indicators', () => {
      expect(strategy.indicators).toEqual({});
    });
  });

  describe('.signals', () => {
    it('should return the signals object', () => {
      expect(strategy.signals).toEqual({});
    });
  });

  describe('.buy()', () => {
    it('should allow buying with size as positive integer', () => {
      expect(() => strategy.buy({ size: 10 })).not.toThrow();
      expect(strategy.orders[0].size).toBe(10);
    });

    it('should allow buying with size as positive fraction', () => {
      expect(() => strategy.buy({ size: 0.5 })).not.toThrow();
      expect(strategy.orders[0].size).toBe(0.5);
    });

    it('should not allow buying with size as negative number', () => {
      expect(() => strategy.buy({ size: -1 })).toThrow();
    });

    it('should not allow buying with size as zero', () => {
      expect(() => strategy.buy({ size: 0 })).toThrow();
    });
  });

  describe('.sell()', () => {
    it('should allow selling with size as positive integer', () => {
      expect(() => strategy.sell({ size: 10 })).not.toThrow();
      expect(strategy.orders[0].size).toBe(-10);
    });

    it('should allow selling with size as positive fraction', () => {
      expect(() => strategy.sell({ size: 0.5 })).not.toThrow();
      expect(strategy.orders[0].size).toBe(-0.5);
    });

    it('should not allow selling with size as negative number', () => {
      expect(() => strategy.sell({ size: -1 })).toThrow();
    });

    it('should not allow selling with size as zero', () => {
      expect(() => strategy.sell({ size: 0 })).toThrow();
    });
  });

  describe('.addIndicator()', () => {
    it('should add an indicator with the name and values', () => {
      const name = 'I';
      const values = Array(strategy.data.length).fill(1);
      strategy.addIndicator(name, values);
      expect(strategy.indicators[name]).toEqual(values);
    });

    it('should pad the values array if it is shorter than the data index', () => {
      const name = 'I';
      const values = [1, 2, 3];
      strategy.addIndicator(name, values);
      const paded = Array(strategy.data.length - values.length).fill(null).concat(values);
      expect(strategy.indicators[name]).toEqual(paded);
    });

    it('should default plotting options to overlay=true and empty color', () => {
      strategy.addIndicator('I', Array(strategy.data.length).fill(1));
      expect(strategy.getIndicatorOptions('I')).toEqual({
        overlay: true,
        color: '',
        scatter: false,
        plot: true,
      });
    });

    it('should accept overlay:false to mark the indicator as a subplot', () => {
      strategy.addIndicator('RSI', Array(strategy.data.length).fill(50), { overlay: false });
      expect(strategy.getIndicatorOptions('RSI')).toEqual({
        overlay: false,
        color: '',
        scatter: false,
        plot: true,
      });
    });

    it('should accept a color option', () => {
      strategy.addIndicator('SMA', Array(strategy.data.length).fill(1), { color: '#1f77b4' });
      expect(strategy.getIndicatorOptions('SMA')).toEqual({
        overlay: true,
        color: '#1f77b4',
        scatter: false,
        plot: true,
      });
    });

    it('should accept scatter and plot indicator options', () => {
      strategy.addIndicator('points', Array(strategy.data.length).fill(1), {
        color: ['#1f77b4', '#ff7f0e'],
        scatter: true,
        plot: false,
      });
      expect(strategy.getIndicatorOptions('points')).toEqual({
        overlay: true,
        color: ['#1f77b4', '#ff7f0e'],
        scatter: true,
        plot: false,
      });
    });
  });

  describe('.getIndicatorOptions()', () => {
    it('returns undefined for an unknown indicator', () => {
      expect(strategy.getIndicatorOptions('unknown')).toBeUndefined();
    });
  });

  describe('.getIndicator()', () => {
    it('should return the indicator', () => {
      const name = 'I';
      const values = Array(strategy.data.length).fill(1);
      strategy.addIndicator(name, values);
      expect(strategy.getIndicator(name)).toEqual(values);
    });

    it('should return undefined when the indicator does not exist', () => {
      expect(strategy.getIndicator('unknown')).toBeUndefined();
    });
  });

  describe('.addSignal()', () => {
    it('should add a signal with the name and values', () => {
      const name = 'S';
      const values = Array(strategy.data.length).fill(true);
      strategy.addSignal(name, values);
      expect(strategy.signals[name]).toEqual(values);
    });

    it('should pad the values array if it is shorter than the data index', () => {
      const name = 'S';
      const values = [true, true, true];
      strategy.addSignal(name, values);
      const paded = Array(strategy.data.length - values.length).fill(null).concat(values);
      expect(strategy.signals[name]).toEqual(paded);
    });
  });

  describe('.getSignal()', () => {
    it('should return the signal', () => {
      const name = 'S';
      const values = Array(strategy.data.length).fill(true);
      strategy.addSignal(name, values);
      expect(strategy.getSignal(name)).toEqual(values);
    });

    it('should return undefined when the signal does not exist', () => {
      expect(strategy.getSignal('unknown')).toBeUndefined();
    });
  });

  describe('.toString()', () => {
    it('should return the name of the constructor with params if params exist', () => {
      expect(strategy.toString()).toBe(`${strategy.constructor.name}(n1=20,n2=60)`);
    });

    it('should return the name of the constructor if params are empty', () => {
      // @ts-ignore
      strategy['params'] = {};
      expect(strategy.toString()).toBe(strategy.constructor.name);
    });
  });
});
