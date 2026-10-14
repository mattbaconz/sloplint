// expect: UI-001
import { cn } from '@/lib/cn';

export function GlowCard({ active }: { active: boolean }) {
  return <div className={cn('rounded-lg p-4', active && 'shadow-lg shadow-purple-500/50')}>Plan details</div>;
}
