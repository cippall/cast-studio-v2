import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';

import { cn } from '@/lib/utils';
import { CheckIcon } from 'lucide-react';

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer relative flex size-[18px] shrink-0 items-center justify-center border-[1.5px] border-[#D6D3D1] bg-[#FAFAF9] transition-colors outline-none',
        'after:absolute after:-inset-x-3 after:-inset-y-2',
        'focus-visible:border-[#78716C] focus-visible:ring-[0_0_0_2px_#FAFAF9,0_0_0_4px_#78716C]',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'aria-invalid:border-[#DC2626]',
        'data-checked:border-[#78716C] data-checked:bg-[#78716C] data-checked:text-[#FAFAF9]',
        'group-has-disabled/field:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
