import * as React from 'react';
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),black_15%)]',
        outline:
          'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground',
        secondary:
          'bg-transparent border border-border text-foreground hover:bg-muted aria-expanded:bg-muted aria-expanded:text-foreground',
        ghost:
          'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-[color-mix(in_oklch,var(--destructive),black_15%)]',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-12 gap-1.5 px-6 text-[15px] font-semibold',
        xs: 'h-6 gap-1 px-2 text-xs font-semibold',
        sm: 'h-8 gap-1 px-4 text-[13px] font-semibold',
        lg: 'h-14 gap-2 px-9 text-[17px] font-semibold',
        icon: 'h-12 w-12',
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

const Button = React.forwardRef<
  HTMLButtonElement,
  ButtonPrimitive.Props & VariantProps<typeof buttonVariants>
>(({ className, variant = 'default', size = 'default', ...props }, ref) => (
  <ButtonPrimitive
    ref={ref}
    data-slot="button"
    className={cn(buttonVariants({ variant, size, className }))}
    {...props}
  />
));
Button.displayName = 'Button';

export { Button, buttonVariants };
