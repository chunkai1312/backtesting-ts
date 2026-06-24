import { sumBy } from 'lodash';
import { HistoricalData } from '../src/historical-data';
import { Broker } from '../src/broker';
import { Order } from '../src/order';
import { Trade } from '../src/trade';

describe('Broker', () => {
  let data: HistoricalData;

  beforeEach(() => {
    data = new HistoricalData(require('./fixtures/2330.json'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const baseOptions = (commission = 0) => ({
    cash: 10000,
    commission,
    margin: 1,
    tradeOnClose: false,
    hedging: false,
    exclusiveOrders: false,
  });

  const buildData = (bars: Array<{ open: number; high?: number; low?: number; close?: number }>) =>
    new HistoricalData(bars.map((bar, i) => ({
      date: new Date(2024, 0, i + 1).toISOString().slice(0, 10),
      open: bar.open,
      high: bar.high ?? bar.open,
      low: bar.low ?? bar.open,
      close: bar.close ?? bar.open,
      volume: 0,
    })));

  describe('constructor()', () => {
    it('should create a new broker', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      const broker = new Broker(data, options);
      expect(broker).toBeInstanceOf(Broker);
    });

    it('should throw error when cash is negative', () => {
      const options = {
        cash: -10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      expect(() => new Broker(data, options)).toThrowError();
    });

    it('should throw error when commission is not between -10% and 10%', () => {
      const options = {
        cash: 10000,
        commission: 1.2,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      expect(() => new Broker(data, options)).toThrowError();
    });

    it('should throw error when margin is not between 0 and 1', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: -0.5,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      expect(() => new Broker(data, options)).toThrowError();
    });
  });

  describe('.index', () => {
    it('should return the data index (date column)', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      const broker = new Broker(data, options);
      expect(broker.index).toBe(data.date);
    });
  });

  describe('.lastPrice', () => {
    it('should return the last (current) close price', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      const broker = new Broker(data, options);
      expect(broker.lastPrice).toBe(data.close[0]);

      broker.next();
      expect(broker.lastPrice).toBe(data.close[1]);

      broker.last();
      expect(broker.lastPrice).toBe(data.close[broker.index.length - 1]);
    });
  });

  describe('.equity', () => {
    it('should return current account equity', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      const broker = new Broker(data, options);
      expect(broker.equity).toBe(options.cash);
    });

    it('should return current account equity with trades', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      const broker = new Broker(data, options);
      broker.trades = [new Trade(broker, { size: 10, entryPrice: 100, entryBar: 0 })];
      expect(broker.equity).toBe(options.cash + sumBy(broker.trades, t => t.pl));
    });
  });

  describe('.marginAvailable', () => {
    it('should return the margin available', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      const broker = new Broker(data, options);
      broker.trades = [new Trade(broker, { size: 10, entryPrice: 100, entryBar: 0 })];

      // @ts-ignore
      const marginUsed = sumBy(broker.trades, t => t.value / broker._leverage);
      expect(broker.marginAvailable).toBe(Math.max(0, broker.equity - marginUsed));
    });
  });

  describe('.newOrder()', () => {
    it('should throw error if long order do not meet range limits', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      const broker = new Broker(data, options);
      expect(() => broker.newOrder({
        size: 10,
        slPrice: 15,
        limitPrice: 10,
        tpPrice: 5,
      })).toThrowError();
    });

    it('should throw when long stop-only order has SL above stop', () => {
      const broker = new Broker(data, {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      });
      expect(() => broker.newOrder({
        size: 10,
        stopPrice: 100,
        slPrice: 110,
      })).toThrow(RangeError);
    });

    it('should throw when long market order has SL above adjusted price', () => {
      const broker = new Broker(data, {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      });
      // No limit, no stop, no slPrice: market price = data.close[0] (~448.5).
      // Force SL > price to trip the validation.
      expect(() => broker.newOrder({
        size: 10,
        slPrice: 1e6,
      })).toThrow(RangeError);
    });

    it('should throw when short stop-only order has TP above stop', () => {
      const broker = new Broker(data, {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      });
      // For short: tpPrice < entry < slPrice. Force tpPrice > stopPrice to violate.
      expect(() => broker.newOrder({
        size: -10,
        stopPrice: 100,
        tpPrice: 110,
      })).toThrow(RangeError);
    });

    it('should throw when short market order has TP above adjusted price', () => {
      const broker = new Broker(data, {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      });
      // No limit / stop. Force tpPrice above the market price (~448.5) to violate.
      expect(() => broker.newOrder({
        size: -10,
        tpPrice: 1e6,
      })).toThrow(RangeError);
    });

    it('should throw error if short order do not meet range limits', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      const broker = new Broker(data, options);
      expect(() => broker.newOrder({
        size: -10,
        slPrice: 5,
        limitPrice: 10,
        tpPrice: 15,
      })).toThrowError();
    });

    it('should add a contingent order through trade stop-loss assignment', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      const broker = new Broker(data, options);
      const trade = new Trade(broker, { size: 10, entryPrice: 100, entryBar: 1 });
      trade.sl = 90;
      expect(broker.orders.length).toBe(1);
      expect(broker.orders[0].isContingent).toBe(true);
    });

    it('should add a new order at the end of orders array if exclusive orders is false', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      const broker = new Broker(data, options);
      broker.newOrder({ size: -100 });
      expect(broker.orders.length).toBe(1);
      expect(broker.orders[0].isContingent).toBe(false);
    });

    it('should cancel all non-contingent orders and close all trades before adding a new order if exclusive orders is true', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: true,
      };
      const broker = new Broker(data, options);
      const trade = new Trade(broker, { size: 10, entryPrice: 100, entryBar: 0 });
      const order = new Order(broker, { size: -10, limitPrice: 110 });
      broker.trades = [trade];
      broker.orders = [order];
      broker.newOrder({ size: -10 });
      expect(broker.orders.length).toBe(2);
      expect(broker.orders[0].isContingent).toBe(true);
      expect(broker.orders[1].limit).toBeUndefined();
    });
  });

  describe('.next()', () => {
    it('should call processOrders()', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      const broker = new Broker(data, options);

      // @ts-ignore
      const spy = jest.spyOn(broker, 'processOrders');
      broker.next();
      expect(spy).toHaveBeenCalled();

      // @ts-ignore
      expect(broker._i).toBe(1);
    });

    it('should update equities correctly', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      const broker = new Broker(data, options);
      expect(broker.equities[0]).toBe(NaN);
      broker.next();
      expect(broker.equities[0]).toBe(broker.equity);
    });

    it('should close trades and update properties correctly when equity <= 0', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      const broker = new Broker(data, options);
      const trade = new Trade(broker, { size: -100, entryPrice: 100, entryBar: 0 });
      broker.trades = [trade];
      // @ts-ignore
      const spy = jest.spyOn(broker, 'closeTrade');
      broker.next();
      expect(spy).toHaveBeenCalled();
      expect(broker.equity).toBe(0);
      expect(broker.equities.every(equity => equity === 0)).toBe(true);
    });

    it('should execute a limit order', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      const broker = new Broker(data, options);
      broker.newOrder({ size: 10, limitPrice: 500 });
      expect(broker.trades.length).toBe(0);
      broker.next();
      expect(broker.trades.length).toBe(1);
    });

    it('should execute a market order with stop price hit', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      const broker = new Broker(data, options);
      broker.newOrder({ size: 10, stopPrice: 100 });
      expect(broker.trades.length).toBe(0);
      broker.next();
      expect(broker.trades.length).toBe(1);
    });

    it('should execute a stop-loss order', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      const broker = new Broker(data, options);
      const trade = new Trade(broker, { size: -10, entryPrice: 100, entryBar: 0 });
      trade.sl = 110;
      broker.trades = [trade];
      expect(broker.trades.length).toBe(1);
      expect(broker.closedTrades.length).toBe(0);
      broker.next();
      expect(broker.trades.length).toBe(0);
      expect(broker.closedTrades.length).toBe(1);
    });

    it('should execute a take-profit order', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      const broker = new Broker(data, options);
      const trade = new Trade(broker, { size: 10, entryPrice: 100, entryBar: 0 });
      trade.tp = 110;
      broker.trades = [trade];
      expect(broker.trades.length).toBe(1);
      expect(broker.closedTrades.length).toBe(0);
      broker.next();
      expect(broker.trades.length).toBe(0);
      expect(broker.closedTrades.length).toBe(1);
    });

    it('should ignore the order if the size is 0', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      const broker = new Broker(data, options);
      broker.newOrder({ size: 0.01 });
      expect(broker.trades.length).toBe(0);
      broker.next();
      expect(broker.trades.length).toBe(0);
    });

    it('should handle the order to close the trade', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      const broker = new Broker(data, options);
      const trade = new Trade(broker, { size: 10, entryPrice: 100, entryBar: 0 });
      broker.trades = [trade];
      trade.close();
      expect(broker.orders.length).toBe(1);
      broker.next();
      expect(broker.orders.length).toBe(0);
    });
  });

  describe('commission accounting', () => {
    it('should charge entry commission as cash without changing long entry price', () => {
      data = buildData([{ open: 100 }, { open: 110 }]);
      const broker = new Broker(data, baseOptions(0.002));

      broker.newOrder({ size: 1 - Number.EPSILON });
      broker.next();

      const trade = broker.trades[0];
      expect(trade.size).toBe(99);
      expect(trade.entryPrice).toBe(100);
      expect(broker.equities[0]).toBeCloseTo(10000 - (99 * 100 * 0.002), 10);
    });

    it('should include per-unit commission when sizing short relative orders', () => {
      data = buildData([{ open: 100 }, { open: 110 }]);
      const broker = new Broker(data, baseOptions(0.002));

      broker.newOrder({ size: -(1 - Number.EPSILON) });
      broker.next();

      const trade = broker.trades[0];
      expect(trade.size).toBe(-99);
      expect(trade.entryPrice).toBe(100);
      expect(broker.equities[0]).toBeCloseTo(10000 - (99 * 100 * 0.002), 10);
    });

    it('should charge exit commission and report net closed trade P/L', () => {
      data = buildData([{ open: 100 }, { open: 110 }]);
      const broker = new Broker(data, baseOptions(0.002));

      broker.newOrder({ size: 1 - Number.EPSILON });
      broker.next();
      broker.trades[0].close();
      broker.next();

      const closedTrade = broker.closedTrades[0];
      const entryCommission = 99 * 100 * 0.002;
      const exitCommission = 99 * 110 * 0.002;
      const grossPl = 99 * (110 - 100);
      const totalCommission = entryCommission + exitCommission;

      expect(closedTrade.size).toBe(99);
      expect(closedTrade.entryPrice).toBe(100);
      expect(closedTrade.exitPrice).toBe(110);
      expect(closedTrade.pl).toBeCloseTo(grossPl - totalCommission, 10);
      expect(closedTrade.plPct).toBeCloseTo(0.1 - (totalCommission / (99 * 100)), 10);
      expect(broker.equity).toBeCloseTo(10000 + grossPl - totalCommission, 10);
    });
  });

  describe('.last()', () => {
    it('should set i to the last index in the index array and call the next() function', () => {
      const options = {
        cash: 10000,
        commission: 0,
        margin: 1,
        tradeOnClose: false,
        hedging: false,
        exclusiveOrders: false,
      };
      const broker = new Broker(data, options);

      // @ts-ignore
      expect(broker._i).toBe(0);

      broker.last();

      // @ts-ignore
      expect(broker._i).toBe(broker.index.length);
    });
  });
});
