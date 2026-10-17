import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge must know the brand's custom scales; otherwise it treats `text-h1` as a text
 * color and drops it when `text-ink` follows.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['display', 'h1', 'h2', 'body', 'small', 'label'],
      radius: ['card', 'pill'],
      shadow: ['card', 'pop'],
    },
  },
});

/** Joins class names and resolves Tailwind conflicts (later wins). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
