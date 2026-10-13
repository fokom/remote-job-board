import { cn } from '@/lib/utils';

// shadcn-style button: use <Button> for real buttons, or buttonClasses() on a link.
const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ' +
  'disabled:pointer-events-none disabled:opacity-50';

const variants = {
  default: 'bg-indigo-600 text-white hover:bg-indigo-700',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  outline:
    'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
  ghost: 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
};

const sizes = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-6 text-base',
};

export function buttonClasses({ variant = 'default', size = 'md', className } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({ variant, size, className, type = 'button', ...props }) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}
