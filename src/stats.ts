import * as assert from 'assert';
import { DateTime } from 'luxon';
import { HistoricalData } from './historical-data';
import { PlottingOptions, StatsOptions } from './interfaces';
import { StatsIndex, EquityCurveColumn, TradeLogColumn } from './enums';
import { Strategy } from './strategy';
import { Trade } from './trade';
import { Plotting } from './plotting';
import {
  cumMax,
  geometricMean,
  max,
  mean,
  min,
  stddev,
  sum,
  variance,
} from './utils/series';

export type StatsResults = Record<StatsIndex, number | string>;

export interface EquityCurveRow {
  date: string;
  [EquityCurveColumn.Equity]: number;
  [EquityCurveColumn.DrawdownPct]: number;
  [EquityCurveColumn.DrawdownDuration]: number;
}

export interface TradeLogRow {
  [TradeLogColumn.Size]: number;
  [TradeLogColumn.EntryBar]: number;
  [TradeLogColumn.ExitBar]: number | undefined;
  [TradeLogColumn.EntryPrice]: number;
  [TradeLogColumn.ExitPrice]: number | undefined;
  [TradeLogColumn.PnL]: number;
  [TradeLogColumn.ReturnPct]: number;
  [TradeLogColumn.EntryTime]: string;
  [TradeLogColumn.ExitTime]: string;
  [TradeLogColumn.Tag]: Record<string, string> | undefined;
  [TradeLogColumn.Duration]: number;
}

export class Stats {
  private _equityCurve?: EquityCurveRow[];
  private _tradeLog?: TradeLogRow[];
  private _results?: StatsResults;

  constructor(
    private readonly data: HistoricalData,
    private readonly strategy: Strategy,
    private readonly equity: number[],
    private readonly trades: Trade[],
    private readonly options: StatsOptions,
  ) {}

  get equityCurve() {
    return this._equityCurve;
  }

  get tradeLog() {
    return this._tradeLog;
  }

  get results() {
    return this._results;
  }

  public compute() {
    /* istanbul ignore next */
    const { riskFreeRate = 0 } = this.options;

    assert(riskFreeRate > -1 && riskFreeRate < 1);

    const dateIndex = this.data.date;
    const equityCumMax = cumMax(this.equity);
    const dd = this.equity.map((v, i) => 1 - v / equityCumMax[i]);
    const [ddDur, ddPeaks] = this.computeDrawdownDurationPeaks(dd, dateIndex);

    const equityCurve: EquityCurveRow[] = dateIndex.map((d, i) => ({
      date: d,
      [EquityCurveColumn.Equity]: this.equity[i],
      [EquityCurveColumn.DrawdownPct]: dd[i],
      [EquityCurveColumn.DrawdownDuration]: ddDur[i],
    }));

    const tradeLog: TradeLogRow[] = this.trades.map(trade => ({
      [TradeLogColumn.Size]: trade.size,
      [TradeLogColumn.EntryBar]: trade.entryBar,
      [TradeLogColumn.ExitBar]: trade.exitBar,
      [TradeLogColumn.EntryPrice]: trade.entryPrice,
      [TradeLogColumn.ExitPrice]: trade.exitPrice,
      [TradeLogColumn.PnL]: this.format(trade.pl),
      [TradeLogColumn.ReturnPct]: this.format(trade.plPct),
      [TradeLogColumn.EntryTime]: trade.entryTime,
      [TradeLogColumn.ExitTime]: trade.exitTime,
      [TradeLogColumn.Tag]: trade.tag,
      [TradeLogColumn.Duration]: DateTime.fromISO(trade.exitTime)
        .diff(DateTime.fromISO(trade.entryTime), 'days')
        .get('days'),
    }));

    const pl = tradeLog.map(t => t[TradeLogColumn.PnL]);
    const returns = tradeLog.map(t => t[TradeLogColumn.ReturnPct]);
    const durations = tradeLog.map(t => t[TradeLogColumn.Duration]);

    const start = DateTime.fromISO(dateIndex[0]);
    const end = DateTime.fromISO(dateIndex[dateIndex.length - 1]);

    const results = {} as StatsResults;
    results[StatsIndex.Strategy] = this.strategy.toString();
    results[StatsIndex.Start] = start.toISODate();
    results[StatsIndex.End] = end.toISODate();
    results[StatsIndex.Duration] = end.diff(start, 'days').get('days');

    const exposureTime = this.computeExposureTime(dateIndex.length, tradeLog);
    const equityFinal = this.equity[this.equity.length - 1];
    const equityPeak = max(this.equity);
    const returnPct = this.computeReturnPct(this.equity);
    const buyAndHoldReturn = this.computeReturnPct(this.data.close);

    results[StatsIndex.ExposureTime] = exposureTime;
    results[StatsIndex.EquityFinal] = equityFinal;
    results[StatsIndex.EquityPeak] = equityPeak;
    results[StatsIndex.Return] = returnPct;
    results[StatsIndex.BuyAndHoldReturn] = buyAndHoldReturn;

    let gmeanDayReturn = 0;
    let dayReturns: number[] = new Array(this.equity.length).fill(NaN);
    let annualTradingDays = NaN;

    if (dateIndex.length) {
      dayReturns = this.computeDayReturns(this.equity, dateIndex);
      gmeanDayReturn = geometricMean(dayReturns);
      const weekdays = dateIndex.map(d => DateTime.fromISO(d).get('weekday'));
      /* istanbul ignore next */
      const weekendShare = mean(weekdays.map(w => (w === 0 || w === 6 ? 1 : 0)));
      /* istanbul ignore next */
      annualTradingDays = weekendShare > (2 / 7) * 0.6 ? 365 : 252;
    }

    const annualizedReturn = (1 + gmeanDayReturn) ** annualTradingDays - 1;
    const volatility =
      Math.sqrt(
        (variance(dayReturns) + (1 + gmeanDayReturn) ** 2) ** annualTradingDays -
          (1 + gmeanDayReturn) ** (2 * annualTradingDays),
      ) * 100;
    const sharpeRatio = (annualizedReturn * 100 - riskFreeRate) / (volatility || NaN);
    const sortinoRatio =
      (annualizedReturn - riskFreeRate) /
      (Math.sqrt(
        mean(dayReturns.map(v => (v > Number.NEGATIVE_INFINITY && v < 0 ? v ** 2 : 0))),
      ) *
        Math.sqrt(annualTradingDays));
    const calmarRatio = annualizedReturn / (max(dd) || NaN);

    results[StatsIndex.ReturnAnn] = annualizedReturn * 100;
    results[StatsIndex.VolatilityAnn] = volatility;
    results[StatsIndex.SharpeRatio] = sharpeRatio;
    results[StatsIndex.SortinoRatio] = sortinoRatio;
    results[StatsIndex.CalmarRatio] = calmarRatio;

    const ddDurNonNaN = ddDur.filter(v => !Number.isNaN(v));
    const ddPeaksNonNaN = ddPeaks.filter(v => !Number.isNaN(v));

    const maxDrawdown = -max(dd) * 100;
    const avgDrawdown = ddPeaksNonNaN.length ? -mean(ddPeaks) * 100 : NaN;
    const maxDrawdownDuration = ddDurNonNaN.length ? Math.ceil(max(ddDur)) : NaN;
    const avgDrawdownDuration = ddDurNonNaN.length ? Math.ceil(mean(ddDur)) : NaN;

    results[StatsIndex.MaxDrawdown] = maxDrawdown;
    results[StatsIndex.AvgDrawdown] = avgDrawdown;
    results[StatsIndex.MaxDrawdownDuration] = maxDrawdownDuration;
    results[StatsIndex.AvgDrawdownDuration] = avgDrawdownDuration;

    const nTrades = this.trades.length;
    const winRate = nTrades ? mean(pl.map(v => (v > 0 ? 1 : 0))) * 100 : NaN;
    const bestTrade = nTrades ? max(returns) * 100 : NaN;
    const worstTrade = nTrades ? min(returns) * 100 : NaN;
    const meanReturn = nTrades ? geometricMean(returns) : NaN;
    const avgTrade = nTrades ? meanReturn * 100 : NaN;
    const maxTradeDuration = nTrades ? Math.ceil(max(durations)) : NaN;
    const avgTradeDuration = nTrades ? Math.ceil(mean(durations)) : NaN;

    results[StatsIndex.Trades] = nTrades;
    results[StatsIndex.WinRate] = winRate;
    results[StatsIndex.BestTrade] = bestTrade;
    results[StatsIndex.WorstTrade] = worstTrade;
    results[StatsIndex.AvgTrade] = avgTrade;
    results[StatsIndex.MaxTradeDuration] = maxTradeDuration;
    results[StatsIndex.AvgTradeDuration] = avgTradeDuration;

    const positiveSum = sum(returns.map(r => (r > 0 ? r : 0)));
    const negativeSum = sum(returns.map(r => (r < 0 ? r : 0)));
    const profitFactor = nTrades ? positiveSum / Math.abs(negativeSum) : NaN;
    const expectancy = nTrades ? mean(returns) * 100 : NaN;
    const sqn = nTrades ? (Math.sqrt(nTrades) * mean(pl)) / stddev(pl) : NaN;

    results[StatsIndex.ProfitFactor] = profitFactor;
    results[StatsIndex.Expectancy] = expectancy;
    results[StatsIndex.SQN] = sqn;

    const winners = tradeLog.filter(t => t[TradeLogColumn.PnL] > 0);
    const losers = tradeLog.filter(t => t[TradeLogColumn.PnL] <= 0);
    const avgWinPct = nTrades && winners.length
      ? mean(winners.map(t => t[TradeLogColumn.ReturnPct])) * 100
      : nTrades ? 0 : NaN;
    const avgLossPct = nTrades && losers.length
      ? mean(losers.map(t => t[TradeLogColumn.ReturnPct])) * 100
      : nTrades ? 0 : NaN;
    const winLossRatio = !nTrades
      ? NaN
      : !winners.length
        ? 0
        : !losers.length
          ? Infinity
          : Math.abs(avgWinPct) / Math.abs(avgLossPct);
    const kellyCriterion = !nTrades
      ? NaN
      : !winners.length
        ? 0
        : !losers.length
          ? winRate / 100
          : winRate / 100 - (1 - winRate / 100) / (Math.abs(avgWinPct) / Math.abs(avgLossPct));

    results[StatsIndex.AvgWinPct] = avgWinPct;
    results[StatsIndex.AvgLossPct] = avgLossPct;
    results[StatsIndex.WinLossRatio] = winLossRatio;
    results[StatsIndex.KellyCriterion] = kellyCriterion;

    for (const key of Object.keys(results) as StatsIndex[]) {
      const v = results[key];
      if (typeof v === 'number') results[key] = this.format(v);
    }

    this._equityCurve = equityCurve;
    this._tradeLog = tradeLog;
    this._results = results;

    return this;
  }

  public print() {
    if (!this._results) {
      throw new Error('No stats results');
    }
    console.table(this._results);
  }

  public plot(options?: PlottingOptions): void {
    if (!this._results) {
      throw new Error('No stats results');
    }
    new Plotting(this, options).plot();
  }

  private computeExposureTime(barCount: number, tradeLog: TradeLogRow[]): number {
    /* istanbul ignore if */
    if (barCount === 0) return 0;
    const havePosition = new Array<number>(barCount).fill(0);
    for (const t of tradeLog) {
      const entryBar = t[TradeLogColumn.EntryBar];
      /* istanbul ignore next */
      const exitBar = t[TradeLogColumn.ExitBar] ?? barCount - 1;
      for (let i = entryBar; i <= exitBar; i++) {
        havePosition[i] = 1;
      }
    }
    return mean(havePosition) * 100;
  }

  private computeReturnPct(values: number[]): number {
    const finalValue = values[values.length - 1];
    const initialValue = values[0];
    return ((finalValue - initialValue) / initialValue) * 100;
  }

  private computeDrawdownDurationPeaks(
    drawdown: number[],
    dateIndex: string[],
  ): [number[], number[]] {
    const zeros: number[] = [];
    for (let i = 0; i < drawdown.length; i++) {
      if (drawdown[i] === 0) zeros.push(i);
    }
    if (drawdown.length > 0 && zeros[zeros.length - 1] !== drawdown.length - 1) {
      zeros.push(drawdown.length - 1);
    }

    type Interval = { iloc: number; prev: number };
    const intervals: Interval[] = [];
    for (let k = 1; k < zeros.length; k++) {
      const iloc = zeros[k];
      const prev = zeros[k - 1];
      if (iloc > prev + 1) intervals.push({ iloc, prev });
    }

    const ddDur = new Array<number>(drawdown.length).fill(NaN);
    const ddPeaks = new Array<number>(drawdown.length).fill(NaN);

    if (intervals.length === 0) {
      return [ddDur, ddPeaks];
    }

    for (const { iloc, prev } of intervals) {
      const start = DateTime.fromISO(dateIndex[prev]);
      const end = DateTime.fromISO(dateIndex[iloc]);
      const duration = end.diff(start, 'days').get('days');
      let peak = Number.NEGATIVE_INFINITY;
      for (let j = prev; j <= iloc; j++) {
        if (drawdown[j] > peak) peak = drawdown[j];
      }
      ddDur[iloc] = duration;
      ddPeaks[iloc] = peak;
    }

    return [ddDur, ddPeaks];
  }

  private computeDayReturns(equity: number[], dateIndex: string[]): number[] {
    const filteredIndices: number[] = [];
    for (let i = 0; i < dateIndex.length; i++) {
      if (i > 0) {
        const prevDate = DateTime.fromISO(dateIndex[i - 1]).toISODate();
        const curDate = DateTime.fromISO(dateIndex[i]).toISODate();
        /* istanbul ignore if */
        if (curDate === prevDate) filteredIndices.pop();
      }
      filteredIndices.push(i);
    }
    const filteredValues = filteredIndices.map(i => equity[i]);
    return filteredValues.map((v, i) =>
      i === 0 ? 0 : (v - filteredValues[i - 1]) / filteredValues[i - 1],
    );
  }

  private format(value: number): number {
    const { precision = 12, digits = 6 } = this.options;
    return (
      Math.round(parseFloat(value.toPrecision(precision)) * Math.pow(10, digits)) /
      Math.pow(10, digits)
    );
  }
}
