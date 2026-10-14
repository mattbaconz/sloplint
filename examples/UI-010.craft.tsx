import { useState } from 'react';

export function WaitlistForm() {
  const [state, setState] = useState<'idle' | 'sending' | 'joined' | 'failed'>('idle');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('sending');
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      body: new FormData(event.currentTarget),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    setState(res?.ok ? 'joined' : 'failed');
  }

  if (state === 'joined') return <p role="status">You're on the list. We'll email you when your seat opens.</p>;
  return (
    <form onSubmit={handleSubmit} aria-busy={state === 'sending'}>
      <label htmlFor="email">Work email</label>
      <input id="email" name="email" type="email" required />
      <button type="submit">Join the waitlist</button>
      {state === 'failed' && <p role="alert">We could not reach the waitlist server. Your email is still in the field; try again in a minute.</p>}
    </form>
  );
}
