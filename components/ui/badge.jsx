import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  outline: 'border border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300',
};

export function Badge({ variant = 'default', className, ...props }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', variants[variant], className)}
      {...props}
    />
  );
}
