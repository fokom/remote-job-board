import { cn } from '@/lib/utils';

export function Input({ className, type = 'text', ...props }) {
  return (
    <input
      type={type}
      className={cn(
        'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 ' +
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ' +
          'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
        className
      )}
      {...props}
    />
  );
}
