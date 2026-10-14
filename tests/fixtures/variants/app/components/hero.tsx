// expect: UI-001 UI-007 UI-009
export function Hero() {
  return (
    <section className="bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-24">
      <h1 className="bg-gradient-to-r from-sky-400 to-blue-600 bg-clip-text text-6xl font-bold text-transparent">Ship faster</h1>
      <a href="/signup" className="rounded-md bg-white px-4 py-2 transition-all hover:px-6">Create an account</a>
    </section>
  );
}
