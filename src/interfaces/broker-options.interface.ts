import { BacktestOptions } from './backtest-options.interface';

export type BrokerOptions = Required<Omit<BacktestOptions, 'finalizeTrades'>>
