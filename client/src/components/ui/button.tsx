import { forwardRef } from 'react';
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding font-semibold whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-[#78716C] text-[#FAFAF9] border-[#78716C] hover:bg-[#57534E] active:bg-[#44403C]',
        outline:
          'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
        secondary:
          'bg-transparent text-[#78716C] border border-[#D6D3D1] hover:bg-[#F5F5F4] active:bg-[#E7E5E4]',
        ghost:
          'bg-transparent text-[#78716C] border-transparent hover:bg-[#F5F5F4] active:bg-[#E7E5E4]',
        destructive:
          'bg-[#DC2626] text-[#FAFAF9] border border-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B]',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default:
          'h-auto gap-1.5 px-6 py-3 text-[15px] has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5',
        xs: "h-auto gap-1 px-4 py-2 text-xs has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-auto gap-1 px-4 py-2 text-[13px] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-auto gap-1.5 px-9 py-4 text-[17px] has-data-[icon=inline-end]:pr-8 has-data-[icon=inline-start]:pl-8',
        icon: 'size-8',
        'icon-xs':
          "size-6 has-data-[slot=button-group]:rounded-none [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-7 has-data-[slot=button-group]:rounded-none',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

const Button = forwardRef<
  HTMLButtonElement,
  ButtonPrimitive.Props & VariantProps<typeof buttonVariants>
>(function Button({ className, variant = 'default', size = 'default', ...props }, ref) {
  return (
    <ButtonPrimitive
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});

export { Button, buttonVariants };
