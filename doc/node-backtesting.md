# node-backtesting

## Table of Contents

- [Class: Backtest](#class-backtest)
  - [Constructor: new Backtest(data, Strategy[, options])](#constructor-new-backtestdata-strategy-options)
  - [backtest.run()](#backtestrun)
  - [backtest.optimize()](#backtestoptimizeoptions)
  - [backtest.print()](#backtestprint)
  - [backtest.plot()](#backtestplot)
- [Class: Strategy](#class-strategy)
  - [strategy.init()](#strategyinit)
  - [strategy.next(context)](#strategynextcontext)
  - [strategy.buy(options)](#strategybuyoptions)
  - [strategy.sell(options)](#strategyselloptions)
  - [strategy.addIndicator(name, values[, options])](#strategyaddindicatorname-values-options)
  - [strategy.getIndicator(name)](#strategygetindicatorname)
  - [strategy.addSignal(name, values)](#strategyaddsignalname-values)
  - [strategy.getSignal(name)](#strategygetsignalname)
  - [strategy.data](#strategydata)
  - [strategy.equity](#strategyequity)
  - [strategy.position](#strategyposition)
  - [strategy.orders](#strategyorders)
  - [strategy.trades](#strategytrades)
  - [strategy.closedTrades](#strategyclosedtrades)
- [Class: Position](#class-position)
  - [position.size](#positionsize)
  - [position.pl](#positionpl)
  - [position.plPct](#positionplpct)
  - [position.isLong](#positionislong)
  - [position.isShort](#positionisshort)
  - [position.close()](#positioncloseportion)
- [Class: Order](#class-order)
  - [order.size](#ordersize)
  - [order.limit](#orderlimit)
  - [order.stop](#orderstop)
  - [order.sl](#ordersl)
  - [order.tp](#ordertp)
  - [order.tag](#ordertag)
  - [order.isLong](#orderislong)
  - [order.isShort](#orderisshort)
  - [order.isContingent](#orderiscontingent)
  - [order.cancel()](#ordercancel)
- [Class: Trade](#class-trade)
  - [trade.size](#tradesize)
  - [trade.entryPrice](#tradeentryprice)
  - [trade.exitPrice](#tradeexitprice)
  - [trade.entryBar](#tradeentrybar)
  - [trade.exitBar](#tradeexitbar)
  - [trade.tag](#tradetag)
  - [trade.entryTime](#tradeentrytime)
  - [trade.exitTime](#tradeexittime)
  - [trade.isLong](#tradeislong)
  - [trade.isShort](#tradeisshort)
  - [trade.pl](#tradepl)
  - [trade.plPct](#tradeplpct)
  - [trade.value](#tradevalue)
  - [trade.sl](#tradesl)
  - [trade.tp](#tradetp)
  - [trade.close()](#tradeclose)

## Class: Backtest

This class represents a backtesting task that backtest a custom strategy on input data.

### Constructor: `new Backtest(data, Strategy[, options])`

- `data` {Object | Array} The historical candles data.
- `Strategy` {Strategy} A custom trading strategy class, which inherits from `Strategy`.
- `options` {Object}
  - `cash` {number} The initial cash. **Default:** `10000`.
  - `commission` {number} Relative commission rate charged as a cash fee on entry and exit. Entry/exit prices stay unadjusted; closed trade P/L and return are net of both fees. **Default:** `0`.
  - `margin` {number} The margin ratio required for a leveraged account. **Default:** `1`.
  - `tradeOnClose` {boolean} `true` if market orders will be filled based on the current bar's closing price instead of the next bar's open. **Default:** `false`.
  - `hedging` {boolean} Whether or not to allow trading in both long and short positions concurrently. `false` if the opposite-facing orders first close existing trades in a FIFO manner. **Default:** `false`.
  - `exclusiveOrders` {boolean} `true` if each new order automatically closes the previous trade or position, making at most a single trade (long or short) in effect at each time. **Default:** `false`.
  - `finalizeTrades` {boolean} `true` closes final open trades on the last bar and includes them in closed trades, the trade log, trade statistics, and plotted trade counts. When `false`, final equity remains mark-to-market but final open trades are excluded from trade statistics. **Default:** `false`.

Create a new `Backtest` instance.

### `backtest.run(options)`

- `options` {Object}
  - `params` {Record<string, number>} The parameters for the trading strategy.
- Returns: {Promise} Fulfills with `Stats` results upon success.

Run the backtest for the strategy.

### `backtest.optimize(options)`

- `options` {Object}
  - `params` {Record<string, number[]>} The parameter grid; each key maps to the candidate values for that parameter.
  - `constraint` {(params) => boolean} _optional._ Filter combinations; only those returning `true` are executed.
  - `maxTries` {number} _optional._ Cap on combinations executed; if the cartesian expansion exceeds this, a uniform-random sample (without replacement) is drawn. Required when `method === 'random'`.
  - `maximize` {StatsIndex | (results) => number} _optional._ Stats key (string) or scoring function used to rank combinations. Default `'Equity Final [$]'`.
  - `max` {StatsIndex} _optional, deprecated._ Alias for `maximize`. Supplying both throws `TypeError`.
  - `method` {'grid' | 'random'} _optional._ `'grid'` (default) runs every combination unless capped by `maxTries`; `'random'` always samples and requires `maxTries`.
  - `seed` {number} _optional._ PRNG seed for deterministic random sampling. Defaults to `Date.now()`.
  - `returnHeatmap` {boolean} _optional._ When `true`, the result includes a 2D `heatmap` of the first two `params` keys. Throws if `params` has fewer than 2 keys.
  - `returnAll` {boolean} _optional._ When `true`, the result includes `all` — every executed combination's params, score, and stats.
- Returns: {Promise<OptimizeResult>}
  - `best` {Stats} The highest-scoring `Stats` instance.
  - `bestParams` {Record<string, number>} The parameter combination that produced `best`.
  - `bestScore` {number} The score (per `maximize`) of `best`.
  - `heatmap` {ParamHeatmap} _optional._ Present only when `returnHeatmap === true`.
  - `all` {Array<{ params, score, stats }>} _optional._ Present only when `returnAll === true`.

Optimize strategy parameters across a parameter grid. `Backtest.stats` is set to `result.best` so `print()` / `plot()` continue to work after `optimize()`.

### `backtest.print()`

- Returns: {this}

Print the results of the backtest run.

### `backtest.plot()`

- `options` {PlottingOptions} _optional._ Plotting options forwarded to `Stats.plot()`.
- Returns: {this}

Write a self-contained Plotly HTML chart for the backtest run. The default layout
matches the `backtesting.py`-like panel order: equity, profit/loss, OHLC, and
volume. Supported plotting options include `filename`, `openBrowser`,
`plotWidth`, `plotEquity`, `plotReturn`, `plotPL`, `plotVolume`, `plotDrawdown`,
`plotTrades`, `smoothEquity`, `relativeEquity`, `superimpose`, `resample`,
`reverseIndicators`, and `showLegend`. `smoothEquity` is accepted for API parity;
the current Plotly renderer does not smooth the equity curve yet.

## Class: Strategy

Abstract class for implementing a trading strategy.

### `strategy.init()`

Initialize the strategy to declare indicators and signals.

### `strategy.next(context)`

- `context` {Object} The context of the current bar.
  - `index` {number} The index of the current bar.
  - `data` {Object} The OHLCV data of the current bar.
    - `date` {string} The ISO 8601 date string.
    - `open` {number} The open price of the bar period.
    - `high` {number} The highest price of the bar period.
    - `low` {number} The lowest price of the bar period.
    - `close` {number} The close price of the bar period.
    - `volume` {number} The volume of the bar period.
  - `indicators` {Map} To access the values of the custom indicators for the current bar.
  - `signals` {Map} To access the custom trading signals for the current bar.
  - `prev` {Object} The context of the previous bar.

### `strategy.buy(options)`

- `options` {Object}
  - `size` {number} The size of the order. Fractional values between `0` and `1` are interpreted as a fraction of available liquidity; values greater than or equal to `1` are absolute units.
  - `limitPrice` {number} _optional._ The limit price of the order.
  - `stopPrice` {number} _optional._ The stop trigger price of the order.
  - `slPrice` {number} _optional._ Stop-loss price for the trade opened by this order.
  - `tpPrice` {number} _optional._ Take-profit price for the trade opened by this order.
  - `tag` {Record<string, string>} Metadata copied to the order and resulting trade.

Place a new long order. The broker determines execution price from bar data,
order type, and `tradeOnClose`.

### `strategy.sell(options)`

- `options` {Object}
  - `size` {number} The positive size of the order. Fractional values between `0` and `1` are interpreted as a fraction of available liquidity; values greater than or equal to `1` are absolute units.
  - `limitPrice` {number} _optional._ The limit price of the order.
  - `stopPrice` {number} _optional._ The stop trigger price of the order.
  - `slPrice` {number} _optional._ Stop-loss price for the trade opened by this order.
  - `tpPrice` {number} _optional._ Take-profit price for the trade opened by this order.
  - `tag` {Record<string, string>} Metadata copied to the order and resulting trade.

Place a new short order. The broker stores short orders and trades with negative
size internally.

### `strategy.addIndicator(name, values[, options])`

- `name` {string} The indicator name.
- `values` {number[] | Record<string, number>[]} The values of the indicator. Shorter-than-data arrays are left-padded with `null`.
- `options` {Object} _optional._ Plotting hints consumed by `Plotting`.
  - `overlay` {boolean} — `true` (default) draws the indicator on the OHLC panel; `false` puts it in its own subplot after volume.
  - `color` {string | string[]} — Plotly line / marker color, or one color per line for multi-line indicators.
  - `scatter` {boolean} — `true` renders markers instead of lines.
  - `plot` {boolean} — `false` hides non-overlay indicators and renders overlay indicators as legend-only traces.

Add an indicator. Plotting options are stored separately from the values; `getIndicator()` continues to return only the values.

### `strategy.getIndicator(name)`

- `name` {string} The indicator name.

Get indicator values by name.

### `strategy.addSignal(name, values)`

- `name` {string} The signal name.
- `values` {boolean[]} The values of the signal.

Add a signal.

### `strategy.getSignal(name)`

- `name` {string} The signal name.

Get signal by name.

### `strategy.data`

- {HistoricalData}

Get the columnar historical OHLCV data. Columns are accessible as both properties and bracket-keys (e.g. `strategy.data.close === strategy.data['close']`); each column is a `number[]` (or `string[]` for `date`).

### `strategy.equity`

- {number}

Get current account equity.

### `strategy.position`

- {Position}

Get current position.

### `strategy.orders`

- {Order[]}

Get a list of orders waiting to be executed.

### `strategy.trades`

- {Trade[]}

Get a list of active trades.

### `strategy.closedTrades`

- {Trade[]}

Get a list of settled trades.

## Class: Position

Currently held asset position.

### position.size

- {number}

Position size in units of asset. Negative if position is short.

### position.pl

- {number}

Profit (positive) or loss (negative) of the current position in cash units.

### position.plPct

- {number}

Profit (positive) or loss (negative) of the current position in percent.

### position.isLong

- {boolean}

`true` if the position is long (position size is positive).

### position.isShort

- {boolean}

`true` if the position is short (position size is negative).

### position.close(portion)

- `portion` {number} The portion of the position.

Close portion of position by closing `portion` of each active trade.

## Class: Order

### order.size

- {number}

Order size (negative for short orders).

### order.limit

- {number | undefined}

Order limit price for limit orders, or `undefined` for market orders, which are filled at next available price.

### order.stop

- {number | undefined}

Order stop price for stop-limit/stop-market order, otherwise `undefined` if no stop was set, or the stop price has already been hit.

### order.sl

- {number | undefined}

A stop-loss price at which, if set, a new contingent stop-market order will be placed upon the `Trade` following this order's execution.

### order.tp

- {number | undefined}

A take-profit price at which, if set, a new contingent limit order will be placed upon the `Trade` following this order's execution.

### order.tag

- {Record<string, string> | undefined}

Metadata passed with the order and copied to the resulting trade.

### order.isLong

- {boolean}

`true` if the order is long (order size is positive).

### order.isShort

- {boolean}

`true` if the order is short (order size is negative).

### order.isContingent

- {boolean}

`true` for contingent orders, i.e. OCO stop-loss and take-profit bracket orders placed upon an active trade. Remaining contingent orders are canceled when their parent `Trade` is closed.

### order.cancel()

Cancel the order.

## Class: Trade

### trade.size

- {number}

Trade size (volume; negative for short trades).

### trade.entryPrice

- {number}

Trade entry price.

### trade.exitPrice

- {number}

Trade exit price (or undefined if the trade is still active).

### trade.entryBar

- {number}

Candlestick bar index of when the trade was entered.

### trade.exitBar

- {number}

Candlestick bar index of when the trade was exited (or undefined if the trade is still active).

### trade.tag

- {Record<string, string> | undefined}

Metadata inherited from the order that opened this trade.

### trade.entryTime

- {string}

Datetime of when the trade was entered.

### trade.exitTime

- {string}

Datetime of when the trade was exited.

### trade.isLong

- {boolean}

`true` if the trade is long (trade size is positive).

### trade.isShort

- {boolean}

`true` if the trade is short (trade size is negative).

### trade.pl

- {number}

Trade profit (positive) or loss (negative) in cash units. Closed trades are net of entry and exit commissions.

### trade.plPct

- {number}

Trade profit (positive) or loss (negative) as a ratio. Closed trades are net of entry and exit commissions.

### trade.value

- {number}

Trade total value in cash (volume * price).

### trade.sl

- {number | undefined}

Stop-loss price at which to close the trade. Assigning a number creates or
updates the internal contingent stop-loss order; assigning `undefined` or `0`
cancels it.

### trade.tp

- {number | undefined}

Take-profit price at which to close the trade. Assigning a number creates or
updates the internal contingent take-profit order; assigning `undefined` or `0`
cancels it.

### trade.close()

Place new `Order` to close `portion` of the trade at next market price.

## Strategy helpers

Pure functions exported from the package root for use inside `Strategy.init()` / `next()`.

### crossover(a, b)

- `a` {number[]}
- `b` {number[]}
- Returns: {boolean[]} — same length as inputs.

`true` at index `i` when `a[i] > b[i]` and `a[i-1] <= b[i-1]`. Index `0` is always `false`. Non-finite values (`NaN`, `null`, `undefined`, `±Infinity`) at the current or previous bar gate the result to `false`. Throws `TypeError` on length mismatch.

### crossunder(a, b)

Mirror of `crossover` for the down side: `true` when `a[i] < b[i]` and `a[i-1] >= b[i-1]`.

### lookback(series, i, n)

- `series` {T[]}
- `i` {number} — current bar index
- `n` {number} — bars to look back; must be non-negative
- Returns: {T | undefined}

Returns `series[i - n]`, or `undefined` if the target index is out of bounds. Throws `RangeError` for negative `n`.

### barsSince(condition, i)

- `condition` {boolean[]}
- `i` {number}
- Returns: {number}

Number of bars between `i` and the most recent `true` in `condition[0..i]`. `0` if `condition[i]` is `true`; `Infinity` if no `true` exists in that range.

### resampleApply(dates, values, rule, fn)

- `dates` {string[]} — ISO 8601 dates aligned to `values`
- `values` {number[]}
- `rule` {'W' | 'M' | 'Q' | 'Y'}
- `fn` {(bucket: number[]) => number}
- Returns: {number[]}

Buckets `(dates, values)` by the calendar period (ISO week / month / quarter / year), applies `fn` per bucket to produce one aggregated value, and forward-fills the result back onto every original index whose date falls in that bucket. Throws `TypeError` when input lengths differ.
