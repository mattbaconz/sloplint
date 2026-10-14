// expect: BE-001
export function warmCache(load: () => Promise<void>) {
  load().catch((err) => console.error(err));
}
