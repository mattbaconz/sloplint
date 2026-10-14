export async function getExchangeRate(base: string, quote: string) {
  const res = await fetch(`https://rates.example.com/v1/${base}/${quote}`);
  if (!res.ok) throw new Error(`Rate lookup for ${base}/${quote} returned HTTP ${res.status}`);
  return (await res.json()).rate as number;
}
