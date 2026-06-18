import * as React from 'react';
import { Input as InputPrimitive } from '@base-ui/react/input';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'h-12 w-full min-w-0 border border-[#D6D3D1] bg-[#FAFAF9] px-3 py-[12px] text-[15px] font-normal text-[#1C1917] transition-colors outline-none',
        'placeholder:text-[#A8A29E]',
        'focus-visible:border-[#78716C] focus-visible:ring-[0_0_0_2px_#FAFAF9,0_0_0_4px_#78716C]',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#F5F5F4] disabled:opacity-50',
        'aria-invalid:border-[#DC2626]',
        'file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#1C1917]',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
