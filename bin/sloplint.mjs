#!/usr/bin/env node
import { main } from '../src/cli.mjs';

// `sloplint check | head` closes the pipe early; stop quietly instead of throwing EPIPE.
process.stdout.on('error', (error) => {
  if (error.code !== 'EPIPE') throw error;
  process.exit(process.exitCode ?? 0);
});

process.exitCode = main(process.argv.slice(2));
