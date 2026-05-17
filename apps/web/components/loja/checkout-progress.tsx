'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = ['Dados Pessoais', 'Entrega', 'Pagamento', 'Revisão'];

interface CheckoutProgressProps {
  currentStep: number;
}

export function CheckoutProgress({ currentStep }: CheckoutProgressProps) {
  return (
    <nav aria-label="Progresso do checkout">
      <ol className="flex items-center justify-between">
        {STEPS.map((label, index) => {
          const stepNum = index + 1;
          const done = currentStep > stepNum;
          const active = currentStep === stepNum;

          return (
            <li
              key={label}
              className={cn(
                'flex flex-1 flex-col items-center gap-1',
                index < STEPS.length - 1 && 'relative',
              )}
            >
              {/* Linha conectora */}
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'absolute left-1/2 top-4 h-0.5 w-full',
                    done ? 'bg-amber-500' : 'bg-gray-200',
                  )}
                />
              )}

              {/* Círculo do passo */}
              <span
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                  done && 'bg-amber-500 text-white',
                  active && 'border-2 border-amber-500 bg-white text-amber-600',
                  !done && !active && 'border-2 border-gray-200 bg-white text-gray-400',
                )}
              >
                {done ? <Check className="h-4 w-4" /> : stepNum}
              </span>

              <span
                className={cn(
                  'hidden text-xs font-medium sm:block',
                  active ? 'text-amber-600' : done ? 'text-gray-700' : 'text-gray-400',
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
