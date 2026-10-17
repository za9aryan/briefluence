import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('keeps brand font sizes next to text colors', () => {
    expect(cn('text-h1', 'text-ink')).toBe('text-h1 text-ink');
    expect(cn('text-small text-ink-muted', 'text-body')).toBe('text-ink-muted text-body');
  });
  it('resolves brand radius conflicts', () => {
    expect(cn('rounded-sm', 'rounded-pill')).toBe('rounded-pill');
  });
});
