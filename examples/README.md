# Examples

Six runnable examples that exercise the package's main features against a
small TSMC (2330) OHLCV fixture. Each file wraps its main logic behind
`require.main === module`, so they can be `require()`d safely from tests
without triggering a real backtest.

## Running

Examples import from `../lib` (the built output) so a build is required first.
The `yarn example` script handles that automatically:

```sh
yarn install
yarn example examples/01-quickstart.ts
```

If you prefer to run files directly with `ts-node`, build once and skip the
`yarn example` wrapper afterwards:

```sh
yarn build
npx ts-node examples/04-optimization.ts
```

## What each example shows

| File | Focus |
| --- | --- |
| [`01-quickstart.ts`](./01-quickstart.ts) | Minimum viable backtest: load OHLCV, declare a `SmaCross` strategy, run, print stats, and write a standard plot. |
| [`02-order-management.ts`](./02-order-management.ts) | Market orders with initial SL / TP brackets, tag metadata, and active-trade `sl` / `tp` updates. |
| [`03-indicators-and-signals.ts`](./03-indicators-and-signals.ts) | `addIndicator()`, `addSignal()`, `crossover`, `crossunder`, `lookback`, `barsSince`, and `resampleApply`. |
| [`04-optimization.ts`](./04-optimization.ts) | `optimize()` with `constraint`, `maxTries`, function-form `maximize`, `returnHeatmap`, and a separate `plotHeatmap` HTML. |
| [`05-plotting.ts`](./05-plotting.ts) | Standard multi-panel plotting with overlay indicators, an oscillator subplot, return, drawdown, and volume panels. |
| [`06-trade-statistics.ts`](./06-trade-statistics.ts) | Reading `StatsIndex`, inspecting `Stats.tradeLog`, and comparing default open-trade handling with `finalizeTrades`. |

## Output

Some examples write HTML files into the project root:

- `01-quickstart.ts` — writes `quickstart.html`.
- `04-optimization.ts` — writes `optimization-heatmap.html`.
- `05-plotting.ts` — writes `plotting.html` with the standard Plotly chart plus a ROC subplot.

Open these in any modern browser. The plot's pan/zoom and hover-line are
synchronized across panels.
