import * as fs from 'fs';
import * as open from 'open';
import { minify } from 'html-minifier';
import { Stats, TradeLogRow, EquityCurveRow } from './stats';
import { Strategy, IndicatorOptions } from './strategy';
import { PlottingOptions, ParamHeatmap } from './interfaces';
import { EquityCurveColumn, TradeLogColumn, StatsIndex } from './enums';
import { bucketKey, ResampleRule } from './utils/resample';

const PLOTLY_CDN = 'https://cdn.plot.ly/plotly-2.35.2.min.js';

const COLOR_WIN = '#2ca02c';
const COLOR_LOSS = '#d62728';
const COLOR_BULL = 'lime';
const COLOR_BEAR = 'tomato';
const COLOR_PEAK = '#17becf';   // cyan
const COLOR_FINAL = '#1f77b4';  // blue
const COLOR_MAX_DD = '#d62728'; // red
const COLOR_GRID_LINE = 'rgba(160,160,160,0.5)';
const COLOR_VOLUME_GREY = '#9aa0a6';
// High-watermark drawdown fill (matches backtesting.py's `#ffffea` fill / `#ffcb66` outline).
const COLOR_HW_FILL = 'rgba(255,255,234,0.6)';
const COLOR_HW_OUTLINE = '#ffcb66';

interface PanelSpec {
  id: string;
  title: string;
  weight: number;            // relative height weight
  axisIndex: number;         // 1, 2, 3, ...
  domain: [number, number];  // [bottom, top] in 0..1
}

interface PlotlyTrace {
  type: string;
  name?: string;
  xaxis?: string;
  yaxis?: string;
  showlegend?: boolean;
  [key: string]: unknown;
}

interface PriceData {
  date: string[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
}

interface IndicatorEntry {
  name: string;
  values: Array<number | null>;
  meta: Required<IndicatorOptions>;
  color?: string;
}

interface BucketGroup {
  key: string;
  indices: number[];
  date: string;
}

interface PlotModel {
  priceData: PriceData;
  equityCurve: EquityCurveRow[];
  tradeLog: TradeLogRow[];
  overlayIndicators: IndicatorEntry[];
  subplotIndicators: IndicatorEntry[];
}

type CountedTradeLogRow = TradeLogRow & { __count?: number };

export class Plotting {
  private readonly openBrowser: boolean;
  private readonly filename: string;
  private readonly options: PlottingOptions;

  constructor(private readonly stats: Stats, options?: PlottingOptions) {
    this.options = options ?? {};
    this.openBrowser = this.options.openBrowser ?? true;
    this.filename = this.options.filename ?? 'output.html';
  }

  public plot(): void {
    const html = minify(this.createHTML(), {
      collapseWhitespace: true,
      removeComments: true,
      collapseBooleanAttributes: true,
      useShortDoctype: true,
      removeEmptyAttributes: true,
      removeOptionalTags: true,
      minifyJS: true,
    });
    const outputFile = `./${this.filename}`;
    fs.writeFileSync(outputFile, html);
    if (this.openBrowser) open(outputFile);
  }

  /**
   * Render a standalone heatmap of two optimization parameters against an objective metric.
   */
  public plotHeatmap(grid: ParamHeatmap, options?: { filename?: string; openBrowser?: boolean }): void {
    const filename = options?.filename ?? 'optimize-heatmap.html';
    const openInBrowser = options?.openBrowser ?? this.openBrowser;
    const html = minify(this.createHeatmapHTML(grid), {
      collapseWhitespace: true,
      removeComments: true,
      collapseBooleanAttributes: true,
      useShortDoctype: true,
      removeEmptyAttributes: true,
      removeOptionalTags: true,
      minifyJS: true,
    });
    const outputFile = `./${filename}`;
    fs.writeFileSync(outputFile, html);
    if (openInBrowser) open(outputFile);
  }

  private createHTML(): string {
    const rawEquityCurve = this.stats.equityCurve;
    const rawTradeLog = this.stats.tradeLog;
    const results = this.stats.results;
    /* istanbul ignore if */
    if (!results || !rawEquityCurve || !rawTradeLog) {
      throw new Error('Stats not computed');
    }

    const rawPriceData = this.collectPriceData();

    const rawOverlayIndicators: IndicatorEntry[] = [];
    const rawSubplotIndicators: IndicatorEntry[] = [];
    this.collectIndicators(rawOverlayIndicators, rawSubplotIndicators);
    const {
      priceData,
      equityCurve,
      tradeLog,
      overlayIndicators,
      subplotIndicators,
    } = this.preparePlotModel(
      rawPriceData,
      rawEquityCurve,
      rawTradeLog,
      rawOverlayIndicators,
      rawSubplotIndicators,
    );

    const showEquity = this.options.plotEquity !== false;
    const showReturn = this.options.plotReturn === true;
    const showDrawdown = this.options.plotDrawdown === true;
    const showPL = this.options.plotPL !== false;
    const showTrades = this.options.plotTrades !== false;
    const showPrice = true;
    const showVolume = this.options.plotVolume !== false;
    const relativeEquity = this.options.relativeEquity !== false;

    const orderedSubplotIndicators = this.options.reverseIndicators !== false
      ? [...subplotIndicators].reverse()
      : subplotIndicators;

    // Top-to-bottom panel order follows backtesting.py:
    // Equity → Return → Drawdown → P/L → OHLC → Volume → reversed indicator subplots.
    const panels: PanelSpec[] = [];
    if (showEquity) panels.push({ id: 'equity', title: relativeEquity ? 'Equity [%]' : 'Equity', weight: 2.2, axisIndex: 0, domain: [0, 0] });
    if (showReturn) panels.push({ id: 'return', title: 'Return [%]', weight: 2.0, axisIndex: 0, domain: [0, 0] });
    if (showDrawdown) panels.push({ id: 'drawdown', title: 'Drawdown [%]', weight: 1.8, axisIndex: 0, domain: [0, 0] });
    if (showPL) panels.push({ id: 'pnl', title: 'Profit / Loss', weight: 2.0, axisIndex: 0, domain: [0, 0] });
    if (showPrice) panels.push({ id: 'price', title: 'OHLC', weight: 3.8, axisIndex: 0, domain: [0, 0] });
    if (showVolume) panels.push({ id: 'volume', title: 'Volume', weight: 1.2, axisIndex: 0, domain: [0, 0] });
    if (showPrice) {
      for (const ind of orderedSubplotIndicators) {
        panels.push({ id: `ind_${ind.name}`, title: ind.name, weight: 1.0, axisIndex: 0, domain: [0, 0] });
      }
    }

    this.assignPanelDomains(panels);

    const traces: PlotlyTrace[] = [];
    const layout = this.buildLayout(panels, {
      relativeEquity,
      showLegend: this.options.showLegend !== false,
      plotWidth: this.options.plotWidth,
      strategyName: String(results[StatsIndex.Strategy]),
      startDate: String(results[StatsIndex.Start]),
      endDate: String(results[StatsIndex.End]),
    });

    if (showEquity) {
      const axes = this.axesFor(panels, 'equity');
      traces.push(...this.equityTraces(equityCurve, axes, relativeEquity, !showDrawdown));
    }

    if (showReturn) {
      const axes = this.axesFor(panels, 'return');
      traces.push(...this.returnTraces(equityCurve, axes));
    }

    if (showDrawdown) {
      const axes = this.axesFor(panels, 'drawdown');
      traces.push(...this.drawdownTraces(equityCurve, axes));
    }

    if (showPL) {
      const axes = this.axesFor(panels, 'pnl');
      traces.push(this.pnlZeroTrace(priceData.date, axes));
      traces.push(...this.pnlBubbleTraces(tradeLog, axes));
    }

    if (showPrice) {
      const priceAxes = this.axesFor(panels, 'price');
      // Superimposed coarser-resolution OHLC (weekly/monthly) drawn FIRST so the daily
      // candles render on top. Acts as a subtle background to highlight longer-term swings.
      if (this.options.superimpose !== false) {
        const rule = this.pickSuperimposedRule(priceData.date.length, this.options.superimpose);
        const aggregated = this.aggregateOHLC(priceData, rule);
        if (aggregated.date.length > 1 && aggregated.date.length < priceData.date.length) {
          traces.push(this.superimposedCandlestickTrace(aggregated, priceAxes));
        }
      }
      traces.push(this.candlestickTrace(priceData, priceAxes));
      for (const ind of overlayIndicators) {
        traces.push(this.indicatorTrace(priceData.date, ind, priceAxes));
      }
      if (showTrades) {
        traces.push(...this.tradeSegmentTraces(priceData, tradeLog, priceAxes));
      }
    }

    if (showVolume) {
      const axes = this.axesFor(panels, 'volume');
      traces.push(this.volumeTrace(priceData, axes));
    }

    if (showPrice) {
      for (const ind of orderedSubplotIndicators) {
        const axes = this.axesFor(panels, `ind_${ind.name}`);
        traces.push(this.indicatorTrace(priceData.date, ind, axes));
      }
    }

    this.assignPanelLegends(traces, panels);

    return this.renderHTML('Backtest Result', traces, layout);
  }

  private createHeatmapHTML(grid: ParamHeatmap): string {
    const trace = {
      type: 'heatmap',
      x: grid.xValues,
      y: grid.yValues,
      z: grid.z,
      colorbar: { title: grid.metric },
      colorscale: 'Viridis',
    };
    const layout = {
      title: `Optimization heatmap (${grid.metric})`,
      xaxis: { title: { text: grid.xLabel } },
      yaxis: { title: { text: grid.yLabel } },
    };
    return this.renderHTML('Optimization Heatmap', [trace as unknown as PlotlyTrace], layout, 'plot_heatmap');
  }

  private renderHTML(title: string, traces: PlotlyTrace[], layout: Record<string, unknown>, divId = 'plot'): string {
    const tracesJson = JSON.stringify(traces);
    const layoutJson = JSON.stringify(layout);
    const configJson = JSON.stringify(this.plotlyConfig(divId));
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <script src="${PLOTLY_CDN}"></script>
          <title>${title}</title>
          <style>
            body { margin: 0; padding: 16px; font-family: -apple-system, sans-serif; }
            #${divId} { width: ${this.widthFor(divId)} height: ${this.heightFor(divId)}px; }
          </style>
        </head>
        <body>
          <div id="${divId}"></div>
          <script>
            Plotly.newPlot('${divId}', JSON.parse('${tracesJson}'), JSON.parse('${layoutJson}'), JSON.parse('${configJson}'));
          </script>
        </body>
      </html>
    `;
  }

  private heightFor(divId: string): number {
    if (divId === 'plot_heatmap') return 600;
    return 900;
  }

  private widthFor(divId: string): string {
    if (divId === 'plot' && this.options.plotWidth !== undefined) {
      return `${this.options.plotWidth}px; max-width: 100%;`;
    }
    return '100%;';
  }

  private plotlyConfig(divId: string): Record<string, unknown> {
    const fixedWidth = divId === 'plot' && this.options.plotWidth !== undefined;
    return {
      responsive: !fixedWidth,
      displayModeBar: true,
      displaylogo: false,
      scrollZoom: true,
      toImageButtonOptions: {
        format: 'png',
        filename: divId === 'plot_heatmap' ? 'optimization-heatmap' : 'backtest-result',
      },
    };
  }

  private collectPriceData(): PriceData {
    const strategy = (this.stats as unknown as { strategy: Strategy }).strategy;
    const data = strategy.data;
    return {
      date: data.date,
      open: data.open,
      high: data.high,
      low: data.low,
      close: data.close,
      volume: data.volume,
    };
  }

  private collectIndicators(overlay: IndicatorEntry[], subplot: IndicatorEntry[]): void {
    const strategy = (this.stats as unknown as { strategy: Strategy }).strategy;
    for (const name of Object.keys(strategy.indicators)) {
      const raw = strategy.indicators[name];
      const sample = (raw as Array<number | null | Record<string, number>>).find(v => v != null);
      const meta = strategy.getIndicatorOptions(name);
      /* istanbul ignore next */
      if (!meta) continue;
      if (!meta.overlay && !meta.plot) continue;

      const target = meta.overlay ? overlay : subplot;
      if (sample === undefined || typeof sample === 'number') {
        target.push({
          name,
          values: raw as Array<number | null>,
          meta,
          color: this.indicatorColor(meta.color, 0),
        });
        continue;
      }

      const recordSample = sample as Record<string, number>;
      const keys = Object.keys(recordSample);
      keys.forEach((key, i) => {
        const values = (raw as Array<Record<string, number> | null>).map(v => (v == null ? null : v[key]));
        target.push({
          name: `${name}.${key}`,
          values,
          meta,
          color: this.indicatorColor(meta.color, i),
        });
      });
    }
  }

  private preparePlotModel(
    priceData: PriceData,
    equityCurve: EquityCurveRow[],
    tradeLog: TradeLogRow[],
    overlayIndicators: IndicatorEntry[],
    subplotIndicators: IndicatorEntry[],
  ): PlotModel {
    const rule = this.pickResampleRule(priceData.date.length, this.options.resample);
    if (!rule) {
      return { priceData, equityCurve, tradeLog, overlayIndicators, subplotIndicators };
    }

    const buckets = this.bucketGroups(priceData.date, rule);
    const bucketIndexByKey = new Map<string, number>();
    const bucketIndexByRawIndex = new Map<number, number>();
    buckets.forEach((bucket, bucketIndex) => {
      bucketIndexByKey.set(bucket.key, bucketIndex);
      bucket.indices.forEach(rawIndex => bucketIndexByRawIndex.set(rawIndex, bucketIndex));
    });

    return {
      priceData: this.resamplePriceData(priceData, buckets),
      equityCurve: this.resampleEquityCurve(equityCurve, buckets),
      tradeLog: this.resampleTradeLog(
        tradeLog,
        priceData,
        buckets,
        bucketIndexByKey,
        bucketIndexByRawIndex,
        rule,
      ),
      overlayIndicators: overlayIndicators.map(ind => this.resampleIndicator(ind, buckets)),
      subplotIndicators: subplotIndicators.map(ind => this.resampleIndicator(ind, buckets)),
    };
  }

  private pickResampleRule(barCount: number, resample?: boolean | string): ResampleRule | undefined {
    if (resample === false) return undefined;
    if (typeof resample === 'string') return resample as ResampleRule;
    if (barCount <= 10000) return undefined;
    if (barCount <= 70000) return 'W';
    if (barCount <= 300000) return 'M';
    if (barCount <= 1000000) return 'Q';
    return 'Y';
  }

  private bucketGroups(dates: string[], rule: ResampleRule): BucketGroup[] {
    const groups: BucketGroup[] = [];
    const groupByKey = new Map<string, BucketGroup>();
    for (let i = 0; i < dates.length; i++) {
      const key = bucketKey(dates[i], rule);
      const existing = groupByKey.get(key);
      if (existing) {
        existing.indices.push(i);
        existing.date = dates[i];
      } else {
        const group = { key, indices: [i], date: dates[i] };
        groupByKey.set(key, group);
        groups.push(group);
      }
    }
    return groups;
  }

  private resamplePriceData(price: PriceData, buckets: BucketGroup[]): PriceData {
    const out: PriceData = { date: [], open: [], high: [], low: [], close: [], volume: [] };
    for (const bucket of buckets) {
      const first = bucket.indices[0];
      const last = bucket.indices[bucket.indices.length - 1];
      let highMax = Number.NEGATIVE_INFINITY;
      let lowMin = Number.POSITIVE_INFINITY;
      let volumeSum = 0;
      let finiteVolumeCount = 0;
      for (const i of bucket.indices) {
        if (price.high[i] > highMax) highMax = price.high[i];
        if (price.low[i] < lowMin) lowMin = price.low[i];
        if (Number.isFinite(price.volume[i])) {
          volumeSum += price.volume[i];
          finiteVolumeCount += 1;
        }
      }
      out.date.push(bucket.date);
      out.open.push(price.open[first]);
      out.high.push(highMax);
      out.low.push(lowMin);
      out.close.push(price.close[last]);
      out.volume.push(finiteVolumeCount ? volumeSum : NaN);
    }
    return out;
  }

  private resampleEquityCurve(curve: EquityCurveRow[], buckets: BucketGroup[]): EquityCurveRow[] {
    return buckets.map(bucket => {
      const last = bucket.indices[bucket.indices.length - 1];
      return {
        date: bucket.date,
        [EquityCurveColumn.Equity]: curve[last][EquityCurveColumn.Equity],
        [EquityCurveColumn.DrawdownPct]: this.maxFinite(bucket.indices.map(i => curve[i][EquityCurveColumn.DrawdownPct])),
        [EquityCurveColumn.DrawdownDuration]: this.maxFinite(
          bucket.indices.map(i => curve[i][EquityCurveColumn.DrawdownDuration]),
        ),
      };
    });
  }

  private resampleIndicator(indicator: IndicatorEntry, buckets: BucketGroup[]): IndicatorEntry {
    return {
      ...indicator,
      values: buckets.map(bucket => this.meanFiniteOrNull(bucket.indices.map(i => indicator.values[i]))),
    };
  }

  private resampleTradeLog(
    tradeLog: TradeLogRow[],
    rawPrice: PriceData,
    buckets: BucketGroup[],
    bucketIndexByKey: Map<string, number>,
    bucketIndexByRawIndex: Map<number, number>,
    rule: ResampleRule,
  ): TradeLogRow[] {
    const tradesByExitBucket = new Map<number, TradeLogRow[]>();
    for (const trade of tradeLog) {
      const exitBucket = bucketIndexByKey.get(bucketKey(trade[TradeLogColumn.ExitTime], rule));
      if (exitBucket === undefined) continue;
      const list = tradesByExitBucket.get(exitBucket);
      if (list) list.push(trade);
      else tradesByExitBucket.set(exitBucket, [trade]);
    }

    const rows: TradeLogRow[] = [];
    const sortedBuckets = Array.from(tradesByExitBucket.entries()).sort((a, b) => a[0] - b[0]);
    for (const [exitBucket, trades] of sortedBuckets) {
      const weighted = this.tradeWeightSum(trades);
      const weightedAverage = (value: (trade: TradeLogRow) => number): number => {
        if (weighted === 0) return this.meanFinite(trades.map(value));
        return trades.reduce((sum, trade) => sum + value(trade) * Math.abs(trade[TradeLogColumn.Size]), 0) / weighted;
      };
      const entryBucket = Math.min(...trades.map(trade =>
        bucketIndexByRawIndex.get(trade[TradeLogColumn.EntryBar]) ?? exitBucket,
      ));
      const sizeSum = trades.reduce((sum, trade) => sum + trade[TradeLogColumn.Size], 0);
      const row: CountedTradeLogRow = {
        [TradeLogColumn.Size]: sizeSum === 0 ? trades[0][TradeLogColumn.Size] : sizeSum,
        [TradeLogColumn.EntryBar]: entryBucket,
        [TradeLogColumn.ExitBar]: exitBucket,
        [TradeLogColumn.EntryPrice]: weightedAverage(trade => trade[TradeLogColumn.EntryPrice]),
        [TradeLogColumn.ExitPrice]: weightedAverage(trade =>
          trade[TradeLogColumn.ExitPrice] ?? trade[TradeLogColumn.EntryPrice],
        ),
        [TradeLogColumn.PnL]: trades.reduce((sum, trade) => sum + trade[TradeLogColumn.PnL], 0),
        [TradeLogColumn.ReturnPct]: weightedAverage(trade => trade[TradeLogColumn.ReturnPct]),
        [TradeLogColumn.EntryTime]: buckets[entryBucket]?.date ?? rawPrice.date[trades[0][TradeLogColumn.EntryBar]],
        [TradeLogColumn.ExitTime]: buckets[exitBucket].date,
        [TradeLogColumn.Tag]: undefined,
        [TradeLogColumn.Duration]: this.maxFinite(trades.map(trade => trade[TradeLogColumn.Duration])),
        __count: trades.reduce((sum, trade) => sum + this.tradeRowCount(trade), 0),
      };
      rows.push(row);
    }
    return rows;
  }

  private indicatorColor(color: string | string[], index: number): string | undefined {
    if (Array.isArray(color)) return color[index % color.length];
    return color || undefined;
  }

  private tradeWeightSum(trades: TradeLogRow[]): number {
    return trades.reduce((sum, trade) => sum + Math.abs(trade[TradeLogColumn.Size]), 0);
  }

  private tradeRowCount(trade: TradeLogRow): number {
    return (trade as CountedTradeLogRow).__count ?? 1;
  }

  private maxFinite(values: number[]): number {
    const finite = values.filter(Number.isFinite);
    if (!finite.length) return NaN;
    return Math.max(...finite);
  }

  private meanFinite(values: number[]): number {
    const finite = values.filter(Number.isFinite);
    if (!finite.length) return NaN;
    return finite.reduce((sum, value) => sum + value, 0) / finite.length;
  }

  private meanFiniteOrNull(values: Array<number | null | undefined>): number | null {
    const finite = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (!finite.length) return null;
    return finite.reduce((sum, value) => sum + value, 0) / finite.length;
  }


  private assignPanelDomains(panels: PanelSpec[]): void {
    /* istanbul ignore if */
    if (panels.length === 0) return;
    const gap = 0.02;
    const totalGap = gap * (panels.length - 1);
    const totalWeight = panels.reduce((s, p) => s + p.weight, 0);
    const usable = 1 - totalGap;
    let cursor = 1;
    for (let i = 0; i < panels.length; i++) {
      const slice = (panels[i].weight / totalWeight) * usable;
      const top = cursor;
      const bottom = top - slice;
      panels[i].domain = [Math.max(0, bottom), top];
      panels[i].axisIndex = i + 1;
      cursor = bottom - gap;
    }
  }

  private axesFor(panels: PanelSpec[], id: string): { x: string; y: string } {
    const panel = panels.find(p => p.id === id);
    /* istanbul ignore if */
    if (!panel) throw new Error(`Plotting: panel "${id}" not in active set`);
    const idx = panel.axisIndex;
    return {
      x: idx === 1 ? 'x' : `x${idx}`,
      y: idx === 1 ? 'y' : `y${idx}`,
    };
  }

  private legendKeyForPanel(panel: PanelSpec): string {
    return panel.axisIndex === 1 ? 'legend' : `legend${panel.axisIndex}`;
  }

  private panelLegendLayout(panel: PanelSpec): Record<string, unknown> {
    return {
      x: 0,
      y: panel.domain[1],
      xanchor: 'left',
      yanchor: 'top',
      bgcolor: 'rgba(255,255,255,0.85)',
      bordercolor: '#333',
      borderwidth: 1,
      font: { size: 10 },
      itemsizing: 'constant',
      traceorder: 'normal',
    };
  }

  private assignPanelLegends(traces: PlotlyTrace[], panels: PanelSpec[]): void {
    const legendByYAxis = new Map<string, string>();
    for (const panel of panels) {
      const yAxis = panel.axisIndex === 1 ? 'y' : `y${panel.axisIndex}`;
      legendByYAxis.set(yAxis, this.legendKeyForPanel(panel));
    }
    for (const trace of traces) {
      if (trace.showlegend === false) continue;
      const legend = legendByYAxis.get(trace.yaxis ?? 'y');
      if (legend) trace.legend = legend;
    }
  }

  private buildLayout(
    panels: PanelSpec[],
    opts: {
      relativeEquity: boolean;
      showLegend: boolean;
      plotWidth?: number;
      strategyName: string;
      startDate: string;
      endDate: string;
    },
  ): Record<string, unknown> {
    const layout: Record<string, unknown> = {
      title: {
        text: `${opts.strategyName} — ${opts.startDate} to ${opts.endDate}`,
        font: { size: 13, color: '#444' },
        x: 0.5,
        xanchor: 'center',
        y: 0.985,
        yanchor: 'top',
      },
      hovermode: 'x unified',
      showlegend: opts.showLegend,
      margin: { l: 60, r: 30, t: 50, b: 40 },
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
    };
    if (opts.plotWidth !== undefined) {
      layout.width = opts.plotWidth;
    }
    for (const panel of panels) {
      const idx = panel.axisIndex;
      const xKey = idx === 1 ? 'xaxis' : `xaxis${idx}`;
      const yKey = idx === 1 ? 'yaxis' : `yaxis${idx}`;
      const xAxis: Record<string, unknown> = {
        anchor: idx === 1 ? 'y' : `y${idx}`,
        showspikes: true,
        spikemode: 'across',
        spikecolor: '#888',
        spikethickness: 1,
        spikedash: 'dot',
        gridcolor: 'rgba(0,0,0,0.06)',
        gridwidth: 0.5,
        tickformat: '%b %Y',
        // Frame each panel with a subtle outline (matches backtesting.py's outline_line_color).
        showline: true,
        linecolor: '#666666',
        linewidth: 1,
        mirror: true,
      };
      if (idx > 1) xAxis.matches = 'x';
      if (idx !== panels.length) xAxis.showticklabels = false;
      if (panel.id === 'price') xAxis.rangeslider = { visible: false };
      layout[xKey] = xAxis;

      const yAxis: Record<string, unknown> = {
        anchor: idx === 1 ? 'x' : `x${idx}`,
        domain: panel.domain,
        title: { text: panel.title, standoff: 8 },
        gridcolor: 'rgba(0,0,0,0.06)',
        gridwidth: 0.5,
        zerolinecolor: 'rgba(0,0,0,0.2)',
        showline: true,
        linecolor: '#666666',
        linewidth: 1,
        mirror: true,
      };
      // PnL panel always shows percent; Equity panel shows percent only when relative.
      if (['pnl', 'return', 'drawdown'].includes(panel.id) || (panel.id === 'equity' && opts.relativeEquity)) {
        yAxis.ticksuffix = '%';
      }
      layout[yKey] = yAxis;
      layout[this.legendKeyForPanel(panel)] = this.panelLegendLayout(panel);
    }
    return layout;
  }

  // ─── Equity panel: line + 4 annotation markers ─────────────────────────────

  private equityTraces(
    curve: EquityCurveRow[],
    axes: { x: string; y: string },
    relativeEquity: boolean,
    showMaxDrawdownMarker: boolean,
  ): PlotlyTrace[] {
    const dates = curve.map(r => r.date);
    const rawEquity = curve.map(r => r[EquityCurveColumn.Equity]);
    const drawdownPct = curve.map(r => r[EquityCurveColumn.DrawdownPct]);
    const ddDuration = curve.map(r => r[EquityCurveColumn.DrawdownDuration]);
    const startEquity = rawEquity[0];

    // Backtesting.py plots relative equity as an equity ratio percent, not as
    // gain-from-start. The separate return panel owns the gain-from-start view.
    const toDisplay = (v: number): number =>
      relativeEquity ? (v / startEquity) * 100 : v;
    const equity = rawEquity.map(toDisplay);

    // Running max (high-watermark) for the drawdown fill.
    const cumMax = new Array<number>(equity.length);
    let runningMax = equity[0];
    for (let i = 0; i < equity.length; i++) {
      if (equity[i] > runningMax) runningMax = equity[i];
      cumMax[i] = runningMax;
    }

    const traces: PlotlyTrace[] = [];

    // High-watermark drawdown fill: render two stacked traces — the running max
    // line first, then equity with `fill: 'tonexty'`. This shades the region
    // between equity and the prior peak whenever the strategy is below water.
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: cumMax,
      line: { color: COLOR_HW_OUTLINE, width: 0.5 },
      name: 'high-watermark',
      showlegend: false,
      hoverinfo: 'skip',
      xaxis: axes.x,
      yaxis: axes.y,
    });
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: equity,
      name: 'Equity',
      line: { color: COLOR_FINAL, width: 1.5 },
      fill: 'tonexty',
      fillcolor: COLOR_HW_FILL,
      xaxis: axes.x,
      yaxis: axes.y,
    });

    // Peak: argmax of raw equity.
    let peakIdx = 0;
    for (let i = 1; i < rawEquity.length; i++) {
      if (rawEquity[i] > rawEquity[peakIdx]) peakIdx = i;
    }
    const peakLabelPct = relativeEquity
      ? equity[peakIdx]
      : ((rawEquity[peakIdx] - startEquity) / startEquity) * 100;
    traces.push({
      type: 'scatter',
      mode: 'markers',
      x: [dates[peakIdx]],
      y: [equity[peakIdx]],
      marker: { size: 8, color: COLOR_PEAK, line: { color: '#000', width: 1 } },
      name: `Peak (${peakLabelPct.toFixed(1)}%)`,
      hovertemplate: 'Peak<br>%{x}<br>%{y}<extra></extra>',
      xaxis: axes.x,
      yaxis: axes.y,
    });

    // Final: last bar.
    const finalIdx = rawEquity.length - 1;
    const finalLabelPct = relativeEquity
      ? equity[finalIdx]
      : ((rawEquity[finalIdx] - startEquity) / startEquity) * 100;
    traces.push({
      type: 'scatter',
      mode: 'markers',
      x: [dates[finalIdx]],
      y: [equity[finalIdx]],
      marker: { size: 8, color: COLOR_FINAL, line: { color: '#000', width: 1 } },
      name: `Final (${finalLabelPct.toFixed(1)}%)`,
      hovertemplate: 'Final<br>%{x}<br>%{y}<extra></extra>',
      xaxis: axes.x,
      yaxis: axes.y,
    });

    // Max Drawdown: argmax of drawdownPct.
    let maxDdIdx = 0;
    for (let i = 1; i < drawdownPct.length; i++) {
      if (drawdownPct[i] > drawdownPct[maxDdIdx]) maxDdIdx = i;
    }
    const maxDdPctValue = drawdownPct[maxDdIdx] * 100;
    if (showMaxDrawdownMarker && maxDdPctValue > 0) {
      traces.push({
        type: 'scatter',
        mode: 'markers',
        x: [dates[maxDdIdx]],
        y: [equity[maxDdIdx]],
        marker: { size: 8, color: COLOR_MAX_DD, line: { color: '#000', width: 1 } },
        name: `Max Drawdown (-${maxDdPctValue.toFixed(1)}%)`,
        hovertemplate: 'Max Drawdown<br>%{x}<br>%{y}<extra></extra>',
        xaxis: axes.x,
        yaxis: axes.y,
      });
    }

    // Max Dd Duration: longest drawdown stretch — find recovery index with max ddDuration,
    // then walk backwards to the prior peak (index where DrawdownPct === 0).
    let maxDurIdx = -1;
    let maxDur = 0;
    for (let i = 0; i < ddDuration.length; i++) {
      const d = ddDuration[i];
      if (!Number.isNaN(d) && d > maxDur) {
        maxDur = d;
        maxDurIdx = i;
      }
    }
    if (maxDurIdx >= 0) {
      let priorPeakIdx = maxDurIdx;
      for (let j = maxDurIdx - 1; j >= 0; j--) {
        if (drawdownPct[j] === 0) {
          priorPeakIdx = j;
          break;
        }
      }
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: [dates[priorPeakIdx], dates[maxDurIdx]],
        y: [equity[priorPeakIdx], equity[priorPeakIdx]],
        line: { color: COLOR_MAX_DD, width: 2 },
        name: `Max Dd Dur. (${Math.ceil(maxDur)} days)`,
        hovertemplate: 'Max Dd Duration<br>%{x}<extra></extra>',
        xaxis: axes.x,
        yaxis: axes.y,
      });
    }

    return traces;
  }

  private returnTraces(curve: EquityCurveRow[], axes: { x: string; y: string }): PlotlyTrace[] {
    const dates = curve.map(r => r.date);
    const rawEquity = curve.map(r => r[EquityCurveColumn.Equity]);
    const startEquity = rawEquity[0];
    const returns = rawEquity.map(v => ((v - startEquity) / startEquity) * 100);
    return [{
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: returns,
      name: 'Return',
      line: { color: COLOR_FINAL, width: 1.5 },
      xaxis: axes.x,
      yaxis: axes.y,
    }];
  }

  private drawdownTraces(curve: EquityCurveRow[], axes: { x: string; y: string }): PlotlyTrace[] {
    const dates = curve.map(r => r.date);
    const drawdown = curve.map(r => -r[EquityCurveColumn.DrawdownPct] * 100);
    let peakIdx = 0;
    for (let i = 1; i < drawdown.length; i++) {
      if (drawdown[i] < drawdown[peakIdx]) peakIdx = i;
    }
    const traces: PlotlyTrace[] = [{
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: drawdown,
      name: 'Drawdown',
      line: { color: COLOR_FINAL, width: 1.3 },
      fill: 'tozeroy',
      fillcolor: 'rgba(31,119,180,0.12)',
      xaxis: axes.x,
      yaxis: axes.y,
    }];
    if (drawdown[peakIdx] < 0) {
      traces.push({
        type: 'scatter',
        mode: 'markers',
        x: [dates[peakIdx]],
        y: [drawdown[peakIdx]],
        marker: { size: 8, color: COLOR_MAX_DD, line: { color: '#000', width: 1 } },
        name: `Peak (${drawdown[peakIdx].toFixed(1)}%)`,
        xaxis: axes.x,
        yaxis: axes.y,
      });
    }
    return traces;
  }

  // ─── PnL panel: bubble plot + connecting line ──────────────────────────────

  private pnlZeroTrace(dates: string[], axes: { x: string; y: string }): PlotlyTrace {
    return {
      type: 'scatter',
      mode: 'lines',
      x: [dates[0], dates[dates.length - 1]],
      y: [0, 0],
      line: { color: COLOR_GRID_LINE, width: 1, dash: 'dash' },
      name: 'pnl-zero',
      showlegend: false,
      hoverinfo: 'skip',
      xaxis: axes.x,
      yaxis: axes.y,
    };
  }

  private pnlBubbleTraces(trades: TradeLogRow[], axes: { x: string; y: string }): PlotlyTrace[] {
    if (trades.length === 0) return [];
    const xs = trades.map(t => t[TradeLogColumn.ExitTime]);
    const ys = trades.map(t => t[TradeLogColumn.ReturnPct] * 100);
    const sizes = trades.map(t => Math.abs(t[TradeLogColumn.Size]));
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    // Linear interp size to [8, 20] px (matches backtesting.py).
    const scaleSize = (s: number): number => {
      if (maxSize === minSize) return 14;
      return 8 + ((s - minSize) / (maxSize - minSize)) * 12;
    };
    const colors = trades.map(t => (t[TradeLogColumn.PnL] > 0 ? COLOR_WIN : COLOR_LOSS));

    // Per-trade diagonal segments from (EntryTime, 0%) to (ExitTime, return%).
    // The line slope encodes the holding period and per-bar pace of return,
    // anchoring every trade to the y = 0 baseline (matches backtesting.py exactly:
    // `multi_line` with xs = [entryBar, exitBar] and ys = [0, return]).
    const segX: Array<string | null> = [];
    const segY: Array<number | null> = [];
    for (const t of trades) {
      segX.push(t[TradeLogColumn.EntryTime], t[TradeLogColumn.ExitTime], null);
      segY.push(0, t[TradeLogColumn.ReturnPct] * 100, null);
    }

    return [
      {
        type: 'scatter',
        mode: 'lines',
        x: segX,
        y: segY,
        line: { color: COLOR_GRID_LINE, width: 1 },
        name: 'pnl-segments',
        showlegend: false,
        hoverinfo: 'skip',
        xaxis: axes.x,
        yaxis: axes.y,
      },
      {
        type: 'scatter',
        mode: 'markers',
        x: xs,
        y: ys,
        marker: {
          size: sizes.map(scaleSize),
          color: colors,
          symbol: trades.map(t => (t[TradeLogColumn.Size] > 0 ? 'triangle-up' : 'triangle-down')),
          line: { color: 'rgba(0,0,0,0.3)', width: 1 },
        },
        customdata: trades.map(t => [t[TradeLogColumn.Size], t[TradeLogColumn.PnL]]),
        hovertemplate:
          '%{x}<br>Return: %{y:.2f}%<br>Size: %{customdata[0]}<br>PnL: %{customdata[1]:.2f}<extra></extra>',
        // Hidden from legend — matches backtesting.py, where the bubble scatter
        // has no `legend_label`. The single `Trades (N)` legend entry lives on
        // the price-panel segments instead.
        name: 'Trade PnL',
        showlegend: false,
        xaxis: axes.x,
        yaxis: axes.y,
      },
    ];
  }

  // ─── Price panel: candlestick + indicator overlays + trade segments ────────

  private candlestickTrace(price: PriceData, axes: { x: string; y: string }): PlotlyTrace {
    return {
      type: 'candlestick',
      x: price.date,
      open: price.open,
      high: price.high,
      low: price.low,
      close: price.close,
      name: 'OHLC',
      // Western convention: green when close > open, red when close < open.
      // Explicit fillcolor + line.color so Plotly doesn't fall back to a default
      // palette when only `line` is specified.
      increasing: {
        line: { color: '#000000', width: 1 },
        fillcolor: COLOR_BULL,
      },
      decreasing: {
        line: { color: '#000000', width: 1 },
        fillcolor: COLOR_BEAR,
      },
      xaxis: axes.x,
      yaxis: axes.y,
    };
  }

  /**
   * Coarser-resolution candlestick rendered behind the daily candles. Light alpha
   * fill / outline so it acts as a subtle background highlighting longer-term swings
   * (matches backtesting.py's superimposed downsampled overlay).
   */
  private superimposedCandlestickTrace(
    price: PriceData,
    axes: { x: string; y: string },
  ): PlotlyTrace {
    return {
      type: 'candlestick',
      x: price.date,
      open: price.open,
      high: price.high,
      low: price.low,
      close: price.close,
      name: 'OHLC (coarser)',
      // Tinted enough to read as "this aggregated period was up/down" on white
      // backgrounds — backtesting.py uses HSL lightness 0.92 (~RGB-mixed alpha 0.3).
      increasing: {
        line: { color: 'rgba(38,166,154,0.55)', width: 1 },
        fillcolor: 'rgba(38,166,154,0.30)',
      },
      decreasing: {
        line: { color: 'rgba(239,83,80,0.55)', width: 1 },
        fillcolor: 'rgba(239,83,80,0.30)',
      },
      showlegend: false,
      hoverinfo: 'skip',
      xaxis: axes.x,
      yaxis: axes.y,
    };
  }

  private pickSuperimposedRule(barCount: number, superimpose?: boolean | string): ResampleRule {
    if (typeof superimpose === 'string') return superimpose as ResampleRule;
    // Auto thresholds chosen so the overlay has roughly 30–60 buckets — dense enough
    // that the coarser candles fit naturally next to the daily ones (vs being giant
    // background rectangles that overpower the foreground).
    //   < ~1 year (250 bars)     → weekly
    //   ~1–6 years (1500 bars)   → monthly
    //   ≥ ~6 years               → quarterly
    if (barCount < 250) return 'W';
    if (barCount < 1500) return 'M';
    return 'Q';
  }

  private aggregateOHLC(price: PriceData, rule: ResampleRule): PriceData {
    const indicesByBucket = new Map<string, number[]>();
    for (let i = 0; i < price.date.length; i++) {
      const key = bucketKey(price.date[i], rule);
      const list = indicesByBucket.get(key);
      if (list) list.push(i);
      else indicesByBucket.set(key, [i]);
    }
    const out: PriceData = { date: [], open: [], high: [], low: [], close: [], volume: [] };
    for (const indices of indicesByBucket.values()) {
      const first = indices[0];
      const last = indices[indices.length - 1];
      const mid = indices[Math.floor(indices.length / 2)];
      let highMax = Number.NEGATIVE_INFINITY;
      let lowMin = Number.POSITIVE_INFINITY;
      let volSum = 0;
      for (const i of indices) {
        if (price.high[i] > highMax) highMax = price.high[i];
        if (price.low[i] < lowMin) lowMin = price.low[i];
        if (Number.isFinite(price.volume[i])) volSum += price.volume[i];
      }
      out.date.push(price.date[mid]);
      out.open.push(price.open[first]);
      out.high.push(highMax);
      out.low.push(lowMin);
      out.close.push(price.close[last]);
      out.volume.push(volSum);
    }
    return out;
  }

  private indicatorTrace(dates: string[], ind: IndicatorEntry, axes: { x: string; y: string }): PlotlyTrace {
    const trace: PlotlyTrace = {
      type: 'scatter',
      mode: ind.meta.scatter ? 'markers' : 'lines',
      x: dates,
      y: ind.values,
      name: ind.name,
      xaxis: axes.x,
      yaxis: axes.y,
    };
    if (ind.meta.scatter) {
      trace.marker = ind.color ? { color: ind.color, size: 5 } : { size: 5 };
    } else {
      trace.line = ind.color ? { color: ind.color, width: 1.5 } : { width: 1.5 };
    }
    if (!ind.meta.plot) {
      trace.visible = 'legendonly';
    }
    return trace;
  }

  /**
   * Two traces (one per win/loss color) sharing a single `Trades (N)` legend entry
   * via Plotly's `legendgroup`. Plotly does not support per-segment line color
   * within a single trace, so this is the cleanest way to mirror backtesting.py's
   * single `multi_line` + `factor_cmap` layout.
   */
  private tradeSegmentTraces(
    price: PriceData,
    trades: TradeLogRow[],
    axes: { x: string; y: string },
  ): PlotlyTrace[] {
    if (trades.length === 0) return [];
    const wins = trades.filter(t => t[TradeLogColumn.PnL] > 0);
    const losses = trades.filter(t => t[TradeLogColumn.PnL] <= 0);
    const result: PlotlyTrace[] = [];
    const legendName = `Trades (${trades.reduce((sum, trade) => sum + this.tradeRowCount(trade), 0)})`;
    // Both traces share legendgroup 'trades' so a single legend entry toggles both.
    // The first emitted trace owns the visible legend label.
    if (wins.length) {
      result.push(this.tradeSegmentTrace(price, wins, legendName, COLOR_WIN, axes, true));
    }
    if (losses.length) {
      result.push(this.tradeSegmentTrace(
        price,
        losses,
        legendName,
        COLOR_LOSS,
        axes,
        // Hide the loss trace from the legend if wins already represented the group.
        wins.length === 0,
      ));
    }
    return result;
  }

  private tradeSegmentTrace(
    price: PriceData,
    trades: TradeLogRow[],
    name: string,
    color: string,
    axes: { x: string; y: string },
    showInLegend: boolean,
  ): PlotlyTrace {
    const x: Array<string | null> = [];
    const y: Array<number | null> = [];
    for (const t of trades) {
      const entryDate = price.date[t[TradeLogColumn.EntryBar]];
      const exitBar = t[TradeLogColumn.ExitBar];
      /* istanbul ignore if */
      if (exitBar === undefined) continue;
      const exitDate = price.date[exitBar];
      const exitPrice = t[TradeLogColumn.ExitPrice];
      /* istanbul ignore if */
      if (exitPrice === undefined) continue;
      x.push(entryDate, exitDate, null);
      y.push(t[TradeLogColumn.EntryPrice], exitPrice, null);
    }
    return {
      type: 'scatter',
      mode: 'lines',
      x,
      y,
      line: { color, width: 8, dash: 'dot' },
      name,
      legendgroup: 'trades',
      showlegend: showInLegend,
      hoverinfo: 'skip',
      xaxis: axes.x,
      yaxis: axes.y,
    };
  }

  // ─── Volume panel ──────────────────────────────────────────────────────────

  private volumeTrace(price: PriceData, axes: { x: string; y: string }): PlotlyTrace {
    const colors: string[] = price.date.map((_, i) => {
      if (i === 0) return COLOR_VOLUME_GREY;
      const close = price.close[i];
      const open = price.open[i];
      if (close > open) return COLOR_BULL;
      if (close < open) return COLOR_BEAR;
      return COLOR_VOLUME_GREY;
    });
    return {
      type: 'bar',
      x: price.date,
      y: price.volume,
      name: 'Volume',
      marker: { color: colors },
      xaxis: axes.x,
      yaxis: axes.y,
      showlegend: false,
    };
  }
}
