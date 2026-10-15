// expect: UI-014
export function Layout({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-12 gap-8">{children}</div>;
}
