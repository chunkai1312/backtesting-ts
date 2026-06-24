# node-backtesting

## 目錄

- [Class: Backtest](#class-backtest)
  - [Constructor: new Backtest(data, Strategy[, options])](#constructor-new-backtestdata-strategy-options)
  - [backtest.run()](#backtestrun)
  - [backtest.print()](#backtestprint)
  - [backtest.plot()](#backtestplot)
- [Class: Strategy](#class-strategy)
  - [strategy.init()](#strategyinit)
  - [strategy.next(context)](#strategynextcontext)
  - [strategy.buy(options)](#strategybuyoptions)
  - [strategy.sell(options)](#strategyselloptions)
  - [strategy.addIndicator(name, values)](#strategyaddindicatorname-values)
  - [strategy.getIndicator(name)](#strategygetindicatorname)
  - [strategy.getSignal(name, values)](#strategyaddsignalname-values)
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
  - [position.plPct](#positionplPct)
  - [position.isLong](#positionislong)
  - [position.isShort](#positionisshort)
  - [position.close()](#positioncloseportion)
- [Class: Order](#class-order)
  - [order.size](#ordersize)
  - [order.limit](#orderlimit)
  - [order.stop](#orderstop)
  - [order.sl](#ordersl)
  - [order.tp](#ordertp)
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
  - [trade.slOrder](#tradeslorder)
  - [trade.tpOrder](#tradetporder)
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

此類別代表一個回測任務，它可以在輸入數據上回測自定義的策略。

### Constructor: `new Backtest(data, Strategy[, options])`

- `data` {Object | Array} 歷史Ｋ線資料。
- `Strategy` {Strategy} 一個自訂的交易策略類別，繼承自 `Strategy`。
- `options` {Object}
  - `cash` {number} 初始資金。**預設值：**`10000`。
  - `commission` {number} 手續費率。**預設值：**`0`.
  - `margin` {number} 槓桿帳戶所需的保證金比率。**預設值：**`1`.
  - `tradeOnClose` {boolean} `true` 表示市場訂單會以當前Ｋ棒的收盤價為基準成交，而非下一根Ｋ棒的開盤價。**預設值：**`false`.
  - `hedging` {boolean} `true` 表示允許同時在兩個方向上交易。如果設為 `false`，則相反方向的訂單首先以先進先出（FIFO）的方式關閉現有交易。**預設值：**`false`.
  - `exclusiveOrders` {boolean} `true` 表示每個新訂單都會自動關閉之前的交易/持倉，以確保每次只會存在一個（多頭或空頭）交易。**預設值：**`false`.

建立一個新的 `Backtest` 實體。

### `backtest.run(options)`

- `options` {Object}
  - `params` {Record<string, number>} 交易策略的參數。
- 回傳：{Promise} 成功時將使用 `Stats` 履行。

運行交易策略的回測。

### `backtest.optimize(options)`

- `options` {Object}
  - `params` {Record<string, number[]>} 參數網格；每個 key 對應候選值陣列。
  - `constraint` {(params) => boolean} _選填。_ 過濾組合；僅執行 `constraint(p) === true` 的組合。
  - `maxTries` {number} _選填。_ 限制執行的組合數；若展開後超過此值會從有效組合中均勻無放回抽樣。`method === 'random'` 時為必填。
  - `maximize` {StatsIndex | (results) => number} _選填。_ 用於排序的指標 key 或評分函式，預設 `'Equity Final [$]'`。
  - `max` {StatsIndex} _選填，已棄用。_ `maximize` 的舊別名，與 `maximize` 同時提供會拋 `TypeError`。
  - `method` {'grid' | 'random'} _選填。_ `'grid'`（預設）跑遍所有組合（除非 `maxTries` 限制）；`'random'` 一律抽樣，需要 `maxTries`。
  - `seed` {number} _選填。_ 隨機抽樣的 PRNG seed。預設為 `Date.now()`。
  - `returnHeatmap` {boolean} _選填。_ 為 `true` 時回傳結果附帶 `heatmap`（前兩個 `params` key 的 2D 熱力圖）；`params` 不足 2 個 key 時拋錯。
  - `returnAll` {boolean} _選填。_ 為 `true` 時回傳結果附帶 `all`，包含每個執行組合的 params / score / stats。
- 回傳：{Promise<OptimizeResult>}
  - `best` {Stats} 最高分組合的統計。
  - `bestParams` {Record<string, number>} 勝出的參數組合。
  - `bestScore` {number} 對應 `maximize` 的分數。
  - `heatmap` {ParamHeatmap} _選填。_ 僅當 `returnHeatmap === true` 時出現。
  - `all` {Array<{ params, score, stats }>} _選填。_ 僅當 `returnAll === true` 時出現。

最佳化策略參數。`Backtest.stats` 會被設為 `result.best`，因此 `print()` / `plot()` 在 `optimize()` 後仍可使用。

### `backtest.print()`

- 回傳：{this}

印出回測運行的結果。

### `backtest.plot()`

- `options` {PlottingOptions} _選填。_ 會轉交給 `Stats.plot()` 的繪圖選項。
- 回傳：{this}

輸出一個自含的 Plotly HTML 回測圖表。預設 layout 採接近 `backtesting.py` 的 panel
順序：equity、profit / loss、OHLC、volume。支援的繪圖選項包含 `filename`、
`openBrowser`、`plotWidth`、`plotEquity`、`plotReturn`、`plotPL`、`plotVolume`、
`plotDrawdown`、`plotTrades`、`smoothEquity`、`relativeEquity`、`superimpose`、
`resample`、`reverseIndicators`、`showLegend`。

## Class: Strategy

用於實作交易策略的抽象類別。

### `strategy.init()`

初始化策略以聲明技術指標和信號。

### `strategy.next(context)`

- `context` {Object} 目前Ｋ棒的狀態。
  - `index` {number} 目前Ｋ棒的索引。
  - `data` {Object} 目前Ｋ棒的OHLCV資料。
    - `date` {string} ISO 8601 格式的日期字串。
    - `open` {number} Ｋ棒週期的開盤價。
    - `high` {number} Ｋ棒週期的最高價。
    - `low` {number} Ｋ棒週期的最低價。
    - `close` {number} Ｋ棒週期的收盤價。
    - `volume` {number} Ｋ棒週期的成交價。
  - `indicators` {Map} 存取目前Ｋ棒的自訂指標數值。
  - `signals` {Map} 存取目前Ｋ棒的自訂交易訊號。
  - `prev` {Object} 前一根Ｋ棒的狀態。

### `strategy.buy(options)`

- `options` {Object}
  - `size` {number} 訂單的數量。
  - `limitPrice` {number} 限價單的訂單限價。若為 `undefined` 則為市價單，將以下一個可用價格來成交。
  - `stopPrice` {number} 停損單的訂單價格。若為 `undefined` 表示未設置停損單，或者停損單已經被觸發。
  - `slPrice` {number} 設定止損價格，若設置該價格，則在該訂單執行後，會建立一個新的條件市價單。
  - `tpPrice` {number} 設定止盈價格，若設置該價格，則在該訂單執行後，會建立一個新的條件限價單。
  - `price` {number} 執行交易的價格。

下單買進。

### `strategy.sell(options)`

- `options` {Object}
  - `size` {number} 訂單的數量。
  - `limitPrice` {number} 限價單的訂單限價，`undefined` 則為市價單，將以下一個可用價格來成交。
  - `stopPrice` {number} 停損單的訂單價格。`undefined` 表示未設置停損單，或者停損單已經被觸發。
  - `slPrice` {number} 設定止損價格。若設置該價格，則在該訂單執行後，會建立一個新的條件市價單。
  - `tpPrice` {number} 設定止盈價格。若設置該價格，則在該訂單執行後，會建立一個新的條件限價單。
  - `price` {number} 執行交易的價格。

下單賣出。

### `strategy.addIndicator(name, values[, options])`

- `name` {string} 指標名稱。
- `values` {number[] | Record<string, number>[]} 指標值；短於 `data.length` 時左側以 `null` 補齊。
- `options` {Object} _選填。_ 提供給 `Plotting` 的繪製提示。
  - `overlay` {boolean} — `true`（預設）將指標畫在 OHLC panel；`false` 則放在 volume 之後的獨立副圖。
  - `color` {string | string[]} — Plotly 線條 / marker 顏色；多線指標可提供每條線的顏色。
  - `scatter` {boolean} — `true` 時以 marker 而非線條呈現。
  - `plot` {boolean} — `false` 時隱藏非 overlay 指標，overlay 指標則以 legend-only trace 呈現。

新增一個指標。繪圖選項與指標值分開儲存，`getIndicator()` 仍只回傳值。

### `strategy.getIndicator(name)`

- `name` {string} 指標名稱。

按名稱取得指標值。

### `strategy.getIndicatorOptions(name)`

- `name` {string} 指標名稱。
- 回傳：`{ overlay: boolean; color: string | string[]; scatter: boolean; plot: boolean } | undefined`

取得 `addIndicator()` 提供的繪圖選項；若名稱不存在回 `undefined`。

### `strategy.addSignal(name, values)`

- `name` {string} 信號名稱。
- `values` {boolean[]} 信號值。

新增一個信號。

### `strategy.getSignal(name)`

- `name` {string} 信號名稱。

按名稱取得信號。

### `strategy.data`

- {HistoricalData}

取得欄式歷史 OHLCV 數據。每個欄位（如 `date / open / high / low / close / volume`）皆可透過屬性與字串索引存取，且 `strategy.data.close === strategy.data['close']`，型別為 `number[]`（`date` 為 `string[]`）。

### `strategy.equity`

- {number}

取得目前帳戶權益。

### `strategy.position`

- {Position}

取得目前持倉。

### `strategy.orders`

- {Order[]}

取得待執行訂單清單。

### `strategy.trades`

- {Trade[]}

取得進行中交易清單。

### `strategy.closedTrades`

- {Trade[]}

取得已結算交易清單。

## Class: Position

此類別表示目前持有的資產持倉。

### position.size

- {number}

資產單位的持倉大小。若為空單持倉，數值為負。

### position.pl

- {number}

目前持倉的現金單位盈虧。盈利數值為正，虧損數值為負。

### position.plPct

- {number}

目前持倉的百分比盈虧。盈利數值為正，虧損數值為負。

### position.isLong

- {boolean}

`true` 表示持倉為多單。

### position.isShort

- {boolean}

`true` 表示持倉為空單。

### position.close(portion)

- `portion` {number} 持倉的比例部分。

透過關閉每筆進行中交易的一部分，關閉持倉的一部分比例。

## Class: Order

此類別表示訂單。

### order.size

- {number}

訂單的大小（空單訂單為負）。

### order.limit

- {number}

限價單的訂單限價。若為 `undefined` 則為市價單，將以下一個可用價格來成交。

### order.stop

- {number}

停損單的訂單價格。若為 `undefined` 表示未設置停損單，或者停損單已經被觸發。

### order.sl

- {number}

設定止損價格，若設置該價格，則在該訂單執行後，會建立一個新的條件市價單。

### order.tp

- {number}

設定止盈價格，若設置該價格，則在該訂單執行後，會建立一個新的條件限價單。

### order.isLong

- {boolean}

`true` 表示訂單為多單。

### order.isShort

- {boolean}

`true` 表示訂單為空單。

### order.isContingent

- {boolean}

`true` 表示條件單，即在進行中交易上建立的 OCO 停損單和止盈單掛單。當它們的父級 `Trade` 被關閉時，剩餘的條件單將被取消。

### order.cancel()

取消該訂單。

## Class: Trade

此類別表示成交紀錄。

### trade.size

- {number}

該交易的成交數量（賣空交易則為負數）。

### trade.entryPrice

- {number}

該交易進場價格。

### trade.exitPrice

- {number}

該交易出場價格（如果交易仍在進行中則為 `undefined`）。

### trade.entryBar

- {number}

該交易進場的Ｋ棒索引。

### trade.exitBar

- {number}

該交易出場的Ｋ棒索引（如果交易仍在進行中則為 `undefined`）。

### trade.slOrder

- {Order}

取得止損訂單。

### trade.tpOrder

- {Order}

取得止盈訂單。

### trade.entryTime

- {string}

該交易進場的日期時間。

### trade.exitTime

- {string}

該交易出場的日期時間。

### trade.isLong

- {boolean}

`true` 表示該交易為多單。

### trade.isShort

- {boolean}

`true` 表示該交易為空單。

### trade.pl

- {number}

該交易盈利（正）或虧損（負）的現金金額。

### trade.plPct

- {number}

該交易盈利（profit）或虧損（loss）的百分比。

### trade.value

- {number}

該交易的成交金額（成交數量*成交價）。

### trade.sl

- {number}

該交易關閉的止損價格。

### trade.tp

- {number}

該交易關閉的止盈價格。

### trade.close()

下達新的委託單（`Order`）並按照下一個市場價格關閉部分（`portion`）交易。

### trade.isTrailing

- {boolean}

若該交易以 `trailPercent` 或 `trailAmount` 開倉且 trailing 尚未被停用（例如被指派固定 `trade.sl = price`），回 `true`。

### trade.trailPercent

- {number | undefined}

以百分比表示的移動停損距離；非 trailing 模式時為 `undefined`。

### trade.trailAmount

- {number | undefined}

以絕對價差表示的移動停損距離；非 trailing 模式時為 `undefined`。

### trade.trailingDistance

- {number | undefined}

當前 trailing 峰值（多 = `peakHigh`、空 = `peakLow`）與目前 SL 價格的絕對距離。非 trailing 或尚未建立 SL 時為 `undefined`。

## 委託單 trailing 選項

`OrderOptions` 在既有的 `slPrice / tpPrice / limitPrice / stopPrice` 之外，另接受：

- `trailPercent` {number} — 以百分比表示的 trailing 距離（如 `0.05` 表示 5%），需符合 `0 < trailPercent < 1`。
- `trailAmount` {number} — 以絕對價格表示的 trailing 距離，需 `> 0`。

兩者同時提供會拋 `TypeError`。對應的 `Trade` 會在每根 bar 朝有利方向更新 SL（多 = `peakHigh * (1 - trailPercent)`、空 = `peakLow * (1 + trailPercent)`），絕不反向。

## 策略輔助函式

從套件根目錄匯出的純函式，可在 `Strategy.init()` / `next()` 中使用。

### crossover(a, b)

- `a` {number[]}
- `b` {number[]}
- 回傳：{boolean[]} — 長度與輸入相同。

當 `a[i] > b[i]` 且 `a[i-1] <= b[i-1]` 時於該索引回 `true`。索引 `0` 永遠為 `false`。當前或前一根 bar 的值若為 non-finite（`NaN`、`null`、`undefined`、`±Infinity`）會將結果 gate 為 `false`。長度不一致時拋 `TypeError`。

### crossunder(a, b)

`crossover` 的對應下穿版本：當 `a[i] < b[i]` 且 `a[i-1] >= b[i-1]` 時回 `true`。

### lookback(series, i, n)

- `series` {T[]}
- `i` {number} — 當前 bar 索引
- `n` {number} — 回看的 bar 數，需 ≥ 0
- 回傳：{T | undefined}

回傳 `series[i - n]`，索引越界時回 `undefined`。`n` 為負時拋 `RangeError`。

### barsSince(condition, i)

- `condition` {boolean[]}
- `i` {number}
- 回傳：{number}

`i` 與 `condition[0..i]` 中最近一個 `true` 之間的 bar 數。若 `condition[i]` 為 `true` 回 `0`；若 `[0..i]` 範圍內均為 `false` 回 `Infinity`。

### resampleApply(dates, values, rule, fn)

- `dates` {string[]} — 與 `values` 對齊的 ISO 8601 日期
- `values` {number[]}
- `rule` {'W' | 'M' | 'Q' | 'Y'}
- `fn` {(bucket: number[]) => number}
- 回傳：{number[]}

依 ISO 週 / 月 / 季 / 年將 `(dates, values)` 分桶，對每桶套用 `fn` 取得單一聚合值，再 forward-fill 回每個落在該桶的原始索引。輸入長度不一致時拋 `TypeError`。
