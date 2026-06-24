# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [2.0.1](https://github.com/chunkai1312/node-backtesting/compare/v2.0.0...v2.0.1) (2026-06-24)


### Bug Fixes

* refine plotting labels and hover text ([a95a149](https://github.com/chunkai1312/node-backtesting/commit/a95a14983c264a728e18cd225bd10a3d77cbb436))

## [2.0.0](https://github.com/chunkai1312/node-backtesting/compare/v1.0.1...v2.0.0) (2026-06-24)


### ⚠ BREAKING CHANGES

* final open trades are no longer force-closed by default. Numeric commission is now charged as entry and exit cash fees instead of being folded into execution prices.
* remove legacy plotting options plotPrice, plotSuperimposedOhlc, and superimposedOhlcRule in favor of the new plotting option surface.

### Features

* default strategy order size ([18c68ea](https://github.com/chunkai1312/node-backtesting/commit/18c68ea3f937536e4f5f04bb066409dcbb681db8))
* enhance multi-panel plotting ([6d43bea](https://github.com/chunkai1312/node-backtesting/commit/6d43bea9e2ee2901afa05f8e309c63bff886e54a))
* simplify strategy and order APIs ([2f1d9d4](https://github.com/chunkai1312/node-backtesting/commit/2f1d9d431039c604235fa9fbf89e868ee91922d1))
* update final trade and commission handling ([73a8269](https://github.com/chunkai1312/node-backtesting/commit/73a82690a21995bf47124decadaf58fb3ba881a1))


### Bug Fixes

* update benchmark metric calculations ([6c550bb](https://github.com/chunkai1312/node-backtesting/commit/6c550bbd597399e44d1122a7c39af56c8c917549))

### [1.0.1](https://github.com/chunkai1312/node-backtesting/compare/v1.0.0...v1.0.1) (2026-06-22)


### Bug Fixes

* prevent broker skipping queued orders ([cb93d93](https://github.com/chunkai1312/node-backtesting/commit/cb93d93c7153e02a9345a661be0929da1f9fe109))

## [1.0.0](https://github.com/chunkai1312/node-backtesting/compare/v0.2.0...v1.0.0) (2026-05-03)


### Features

* add trailing stop support ([68cad7f](https://github.com/chunkai1312/node-backtesting/commit/68cad7f38cdb3d2483557ad7e1b71eb3bddff6f0))
* enhance optimize with random sampling, heatmap, and return runs ([e203ce7](https://github.com/chunkai1312/node-backtesting/commit/e203ce7b87affd0f5f82a248aa1cd015136c4010))
* replace danfojs-node with custom HistoricalData class and utility functions ([9893d3b](https://github.com/chunkai1312/node-backtesting/commit/9893d3b13aa1846e5d274744d5adbcb08d09d4ce))
* rewrite plotting with Plotly multi-panel and indicator overlay support ([9e39643](https://github.com/chunkai1312/node-backtesting/commit/9e396435a2890b500543f2055463524bc343ef69))

## [0.2.0](https://github.com/fugle-dev/fugle-backtest-node/compare/v0.1.1...v0.2.0) (2025-01-17)


### Features

* allow user-defined trade execution price ([#5](https://github.com/fugle-dev/fugle-backtest-node/issues/5)) ([912b873](https://github.com/fugle-dev/fugle-backtest-node/commit/912b873f5626d1403cbfe1549e54759a34e39cd6))

### [0.1.1](https://github.com/fugle-dev/fugle-backtest-node/compare/v0.1.0...v0.1.1) (2025-01-15)


### Bug Fixes

* hanging backtest when using take profit or stop loss orders ([#4](https://github.com/fugle-dev/fugle-backtest-node/issues/4)) ([f144b37](https://github.com/fugle-dev/fugle-backtest-node/commit/f144b3787d218defcccd616b089a70bc4f7ed6e0))

## [0.1.0](https://github.com/fugle-dev/fugle-backtest-node/compare/v0.1.0-beta.2...v0.1.0) (2024-05-12)


### Bug Fixes

* copy the trade instance correctly ([f052e20](https://github.com/fugle-dev/fugle-backtest-node/commit/f052e203a2edc16d4ade4e9b6a21538aa2839e98))

## [0.1.0-beta.2](https://github.com/fugle-dev/fugle-backtest-node/compare/v0.1.0-beta.1...v0.1.0-beta.2) (2023-04-04)

## [0.1.0-beta.1](https://github.com/fugle-dev/fugle-backtest-node/compare/v0.1.0-beta.0...v0.1.0-beta.1) (2023-03-26)

## [0.1.0-beta.0](https://github.com/fugle-dev/fugle-backtest-node/compare/v0.1.0-alpha.1...v0.1.0-beta.0) (2023-03-05)


### Features

* add optimization method for strategy parameters ([9bb0e65](https://github.com/fugle-dev/fugle-backtest-node/commit/9bb0e65d69e1ceed8d5335779a7d68ccf811fd1f))
* make running backtests asynchronous ([f2d032d](https://github.com/fugle-dev/fugle-backtest-node/commit/f2d032d513181f36aea5133cc83fe5b8edfa1b8b))


### Bug Fixes

* get the last price of the data correctly ([798403d](https://github.com/fugle-dev/fugle-backtest-node/commit/798403dc0fa01fc66b28c89a3cd893f10ad7f5a7))

## [0.1.0-alpha.1](https://github.com/fugle-dev/fugle-backtest-node/compare/v0.1.0-alpha.0...v0.1.0-alpha.1) (2023-03-03)

## 0.1.0-alpha.0 (2023-03-01)


### Features

* backtest trading strategies ([d24aa1b](https://github.com/fugle-dev/fugle-backtest-node/commit/d24aa1b18b28fb6bba0fc080dcc08456e27390e5))
* plot the equity curve of the backtest run ([f82225a](https://github.com/fugle-dev/fugle-backtest-node/commit/f82225a4fca9f1eb0b8e848b78d043fe0f112dae))
* print the results of the backtest run ([d8eb8bd](https://github.com/fugle-dev/fugle-backtest-node/commit/d8eb8bd3c5030c7ac34654ebd7e15cacdcd39957))
