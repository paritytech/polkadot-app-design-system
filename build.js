// Entry point for the design-token build.
// Register platform formatters, then run each platform's pipeline.
//
// Adding a new platform (e.g. iOS Swift):
//   1. Create platforms/swift/ with the same shape as platforms/compose/.
//   2. Import and register it below, then call its run().

import * as compose from './platforms/compose/index.js';
import * as swift from './platforms/swift/index.js';

compose.register();
swift.register();

await compose.run();
await swift.run();
