import { HistoricalData } from '../src/historical-data';
import { Broker } from '../src/broker';
import { Order } from '../src/order';
import { Trade } from '../src/trade';

describe('Trade', () => {
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
  });

  describe('constructor()', () => {
    it('should create a Trade instance', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const order = new Trade(broker, options);
      expect(order).toBeInstanceOf(Trade);
    });
  });

  describe('.size', () => {
    it('should get the size of the trade', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      expect(trade.size).toBe(options.size);
    });
  });

  describe('.entryPrice', () => {
    it('should get the entry price of the trade', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      expect(trade.entryPrice).toBe(options.entryPrice);
    });
  });

  describe('.entryBar', () => {
    it('should get the index of the entry bar', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      expect(trade.entryBar).toBe(options.entryBar);
    });
  });

  describe('.exitPrice', () => {
    it('should get the exit price of the trade if set', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0, exitPrice: 110, exitBar: 1 };
      const trade = new Trade(broker, options);
      expect(trade.exitPrice).toBe(options.exitPrice);
    });

    it('should get undefined if exit price is not set', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      expect(trade.exitPrice).toBeUndefined();
    });
  });

  describe('.exitBar', () => {
    it('should get the index of the exit bar if set', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0, exitPrice: 110, exitBar: 1 };
      const trade = new Trade(broker, options);
      expect(trade.exitBar).toBe(options.exitBar);
    });

    it('should get undefined if exit price is not set', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      expect(trade.exitBar).toBeUndefined();
    });
  });

  describe('.tag', () => {
    it('should get the tag of the trade if set', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0, tag: { key: 'value' } };
      const trade = new Trade(broker, options);
      expect(trade.tag).toEqual(options.tag);
    });

    it('should return undefined if tag is not set', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      expect(trade.tag).toBeUndefined();
    });
  });

  describe('.entryTime', () => {
    it('should get the entry time of the trade', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      expect(trade.entryTime).toBe(broker.index[options.entryBar]);
    });
  });

  describe('.exitTime', () => {
    it('should get the exit time of the trade if set', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0, exitPrice: 110, exitBar: 1 };
      const trade = new Trade(broker, options);
      expect(trade.exitTime).toBe(broker.index[options.exitBar]);
    });

    it('should return undefined if take-profit order is not set', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      expect(trade.exitTime).toBeUndefined();
    });
  });

  describe('.isLong', () => {
    it('should return true when the size is positive', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      expect(trade.isLong).toBe(true);
    });

    it('should return false when the size is negative', () => {
      const options = { size: -10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      expect(trade.isLong).toBe(false);
    });
  });

  describe('.isShort', () => {
    it('should return true when the size is negative', () => {
      const options = { size: -10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      expect(trade.isShort).toBe(true);
    });

    it('should return false when the size is positive', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      expect(trade.isShort).toBe(false);
    });
  });

  describe('.pl', () => {
    it('should get the trade profit or loss in cash units', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0, exitPrice: 110, exitBar: 1 };
      const trade = new Trade(broker, options);
      const pl = options.size * (options.exitPrice - options.entryPrice);
      expect(trade.pl).toBe(pl);
    });

    it('should subtract stored commissions from closed trade P/L', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0, exitPrice: 110, exitBar: 1, commission: 4 };
      const trade = new Trade(broker, options);
      const grossPl = options.size * (options.exitPrice - options.entryPrice);
      expect(trade.pl).toBe(grossPl - options.commission);
    });

    it('should use last price to calculate when the trade is still active', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      const pl = options.size * (broker.lastPrice - options.entryPrice);
      expect(trade.pl).toBe(pl);
    });
  });

  describe('.plPct', () => {
    it('should get the trade profit or loss in percent', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0, exitPrice: 110, exitBar: 1 };
      const trade = new Trade(broker, options);
      const plPct = Math.sign(options.size) * (options.exitPrice / options.entryPrice - 1);
      expect(trade.plPct).toBe(plPct);
    });

    it('should subtract stored commissions from closed trade return percent', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0, exitPrice: 110, exitBar: 1, commission: 4 };
      const trade = new Trade(broker, options);
      const grossPlPct = Math.sign(options.size) * (options.exitPrice / options.entryPrice - 1);
      const commissionPct = options.commission / (Math.abs(options.size) * options.entryPrice);
      expect(trade.plPct).toBeCloseTo(grossPlPct - commissionPct, 10);
    });

    it('should use last price to calculate when the trade is still active', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      const plPct = Math.sign(options.size) * (broker.lastPrice / options.entryPrice - 1);
      expect(trade.plPct).toBe(plPct);
    });
  });

  describe('.value', () => {
    it('should get the total value of the trade', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0, exitPrice: 110, exitBar: 1 };
      const trade = new Trade(broker, options);
      const value = Math.abs(options.size) * options.exitPrice;
      expect(trade.value).toBe(value);
    });

    it('should use last price to calculate when the trade is still active', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      const value = Math.abs(options.size) * broker.lastPrice;
      expect(trade.value).toBe(value);
    });
  });

  describe('.sl', () => {
    it('should get the stop-loss price of the trade if set', () => {
      const trade = new Trade(broker, { size: 10, entryPrice: 100, entryBar: 0 });
      const stopPrice = 90;
      trade.sl = stopPrice;
      expect(trade.sl).toBe(stopPrice);
      expect(broker.orders[0]).toBeInstanceOf(Order);
      expect(broker.orders[0].size).toBe(-10);
      expect(broker.orders[0].stop).toBe(stopPrice);
    });

    it('should return undefined if stop-loss price is not set', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      expect(trade.sl).toBeUndefined();
    });

    it('should cancel the stop-loss order when set to undefined', () => {
      const trade = new Trade(broker, { size: 10, entryPrice: 100, entryBar: 0 });
      trade.sl = 90;
      expect(trade.sl).toBe(90);
      trade.sl = undefined;
      expect(trade.sl).toBeUndefined();
      expect(broker.orders.length).toBe(0);
    });
  });

  describe('.tp', () => {
    it('should get the take-profit price of the trade if set', () => {
      const trade = new Trade(broker, { size: 10, entryPrice: 100, entryBar: 0 });
      const limitPrice = 110;
      trade.tp = limitPrice;
      expect(trade.tp).toBe(limitPrice);
      expect(broker.orders[0]).toBeInstanceOf(Order);
      expect(broker.orders[0].size).toBe(-10);
      expect(broker.orders[0].limit).toBe(limitPrice);
    });

    it('should return undefined if take-profit price is not set', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      expect(trade.tp).toBeUndefined();
    });

    it('should cancel the take-profit order when set to undefined', () => {
      const trade = new Trade(broker, { size: 10, entryPrice: 100, entryBar: 0 });
      trade.tp = 110;
      expect(trade.tp).toBe(110);
      trade.tp = undefined;
      expect(trade.tp).toBeUndefined();
      expect(broker.orders.length).toBe(0);
    });
  });

  describe('.close()', () => {
    it('should place order to close the trade', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      trade.close();
      expect(broker.orders[0]).toBeInstanceOf(Order);
      expect(broker.orders[0].size).toBe(-options.size);
      expect(broker.orders[0].isContingent).toBe(true);
    });

    it('should place order to close portion of the trade', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      const portion = 0.5;
      trade.close(portion);
      expect(broker.orders[0]).toBeInstanceOf(Order);
      expect(broker.orders[0].size).toBe(-options.size * portion);
      expect(broker.orders[0].isContingent).toBe(true);
    });
  });

  describe('.replace()', () => {
    it('should update the size of the trade', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      const newOptions = { size: 20 };
      expect(trade.size).toBe(options.size);
      trade.replace(newOptions);
      expect(trade.size).toBe(newOptions.size);
    });

    it('should update the entry price of the trade', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0, exitPrice: 110, exitBar: 1 };
      const trade = new Trade(broker, options);
      const newOptions = { entryPrice: 101 };
      expect(trade.entryPrice).toBe(options.entryPrice);
      trade.replace(newOptions);
      expect(trade.entryPrice).toBe(newOptions.entryPrice);
    });

    it('should update the exit price of the trade', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0, exitPrice: 110, exitBar: 1 };
      const trade = new Trade(broker, options);
      const newOptions = { exitPrice: 111 };
      expect(trade.exitPrice).toBe(options.exitPrice);
      trade.replace(newOptions);
      expect(trade.exitPrice).toBe(newOptions.exitPrice);
    });

    it('should update the entry bar of the trade', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0, exitPrice: 110, exitBar: 1 };
      const trade = new Trade(broker, options);
      const newOptions = { entryBar: 1 };
      expect(trade.entryBar).toBe(options.entryBar);
      trade.replace(newOptions);
      expect(trade.entryBar).toBe(newOptions.entryBar);
    });

    it('should update the exit bar of the trade', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0, exitPrice: 110, exitBar: 1 };
      const trade = new Trade(broker, options);
      const newOptions = { exitBar: 2 };
      expect(trade.exitBar).toBe(options.exitBar);
      trade.replace(newOptions);
      expect(trade.exitBar).toBe(newOptions.exitBar);
    });

    it('should update the tag bar of the trade', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0, exitPrice: 110, exitBar: 1, tag: undefined };
      const trade = new Trade(broker, options);
      const newOptions = { tag: { key: 'value' } };
      expect(trade.tag).toBe(options.tag);
      trade.replace(newOptions);
      expect(trade.tag).toBe(newOptions.tag);
    });

    it('should update the commission of the trade', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0, exitPrice: 110, exitBar: 1, commission: 0 };
      const trade = new Trade(broker, options);
      const newOptions = { commission: 4 };
      expect(trade.pl).toBe(100);
      trade.replace(newOptions);
      expect(trade.pl).toBe(96);
    });
  });

  describe('.copy()', () => {
    it('should copy the trade', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      const newTrade =  trade.copy({});
      expect(newTrade).toBeInstanceOf(Trade);
      expect(newTrade).toHaveProperty('size', 10 );
      expect(newTrade).toHaveProperty('entryPrice', 100 );
      expect(newTrade).toHaveProperty('entryBar', 0 );
    });

    it('should copy the trade with options', () => {
      const options = { size: 10, entryPrice: 100, entryBar: 0 };
      const trade = new Trade(broker, options);
      const newTrade =  trade.copy({ exitPrice: 110, exitBar: 1 });
      expect(newTrade).toBeInstanceOf(Trade);
      expect(newTrade).toHaveProperty('size', 10 );
      expect(newTrade).toHaveProperty('entryPrice', 100 );
      expect(newTrade).toHaveProperty('entryBar', 0 );
      expect(newTrade).toHaveProperty('exitPrice', 110 );
      expect(newTrade).toHaveProperty('exitBar', 1 );
    });
  });
});
