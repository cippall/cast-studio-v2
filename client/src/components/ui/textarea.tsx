import * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-24 w-full border border-[#D6D3D1] bg-[#FAFAF9] px-3 py-[12px] text-[15px] font-normal text-[#1C1917] transition-colors outline-none',
        'placeholder:text-[#A8A29E]',
        'focus-visible:border-[#78716C] focus-visible:ring-[0_0_0_2px_#FAFAF9,0_0_0_4px_#78716C]',
        'disabled:cursor-not-allowed disabled:bg-[#F5F5F4] disabled:opacity-50',
        'aria-invalid:border-[#DC2626]',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
