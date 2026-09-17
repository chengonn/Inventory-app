/* eslint-disable @typescript-eslint/no-require-imports */
// One preload avoids Next dev combining repeated --require arguments.
require('./auth-transport.cjs');
require('./db-transport.cjs');
// Invoke Next's own shutdown handler over the private parent/child IPC channel.
// Windows taskkill is not available in the sandbox.
process.on('message', (message) => { if (message?.inventoryTestShutdown === true) process.emit('SIGTERM'); });
