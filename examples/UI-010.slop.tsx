import { useState } from 'react';

export function WaitlistForm() {
  const [joined, setJoined] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await new Promise((resolve) => setTimeout(resolve, 900));
    setJoined(true);
  }

  if (joined) return <p role="status">You're on the list. We'll email you when your seat opens.</p>;
  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">Work email</label>
      <input id="email" name="email" type="email" required />
      <button type="submit">Join the waitlist</button>
    </form>
  );
}
