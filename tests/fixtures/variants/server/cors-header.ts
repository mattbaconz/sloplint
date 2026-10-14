// expect: SEC-002
import type { ServerResponse } from 'node:http';

export function allowAll(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
}
