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
npx ts-node examples/04-optimize-grid.ts
```

## What each example shows

| File | Focus |
| --- | --- |
| [`01-quickstart.ts`](./01-quickstart.ts) | Minimum viable backtest: load OHLCV, declare a `SmaCross` strategy, run, and print stats. |
| [`02-strategy-helpers.ts`](./02-strategy-helpers.ts) | Internal `crossover` / `crossunder` / `lookback` / `barsSince` / `resampleApply` helpers. |
| [`03-trailing-stop.ts`](./03-trailing-stop.ts) | Long entry with `trailPercent` and the resulting trade log. |
| [`04-optimize-grid.ts`](./04-optimize-grid.ts) | `optimize()` with `constraint` / `maxTries` / function-form `maximize` / `returnHeatmap` and a separate `plotHeatmap` HTML. |
| [`05-multi-panel-plot.ts`](./05-multi-panel-plot.ts) | `addIndicator(..., { overlay: false })` to add an oscillator (ROC) subplot to the standard 5-panel plot. |
| [`06-kelly-criterion.ts`](./06-kelly-criterion.ts) | Reading `Kelly Criterion` / `Win/Loss Ratio` / `Avg. Win [%]` / `Avg. Loss [%]` from the stats output. |

## Output

Some examples write HTML files into the project root:

- `01-quickstart.ts` — would write `output.html` if you uncomment `stats.plot()`.
- `04-optimize-grid.ts` — writes `optimize-heatmap.html`.
- `05-multi-panel-plot.ts` — writes `output.html` with the standard Plotly chart plus a ROC subplot after volume.

Open these in any modern browser. The plot's pan/zoom and hover-line are
synchronized across panels.
