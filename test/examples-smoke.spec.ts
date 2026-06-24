/**
 * Smoke import test for examples.
 *
 * Each example wraps its main() behind `require.main === module`, so
 * `require()`ing the file from Jest does NOT execute a backtest — it only
 * verifies that imports resolve and types compile against the built `lib/`.
 *
 * Adding a new example without a matching entry here will leave it untested;
 * the spec under openspec/specs/examples-coverage/ documents this contract.
 */

import * as path from 'path';

const EXAMPLES = [
  '01-quickstart',
  '02-order-management',
  '03-indicators-and-signals',
  '04-optimization',
  '05-plotting',
  '06-trade-statistics',
] as const;

describe('examples smoke import', () => {
  it.each(EXAMPLES)('loads %s without error', name => {
    const modulePath = path.join(__dirname, '..', 'examples', `${name}.ts`);
    expect(() => {
      jest.isolateModules(() => {
        require(modulePath);
      });
    }).not.toThrow();
  });
});
