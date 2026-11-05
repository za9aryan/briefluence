import { describe, expect, it } from 'vitest';
import { normalizePublicUsername, publicUsernameProblem } from './username';

describe('usernames', () => {
  it('normalizes what people type', () => {
    expect(normalizePublicUsername('  @Anna.Art ')).toBe('anna.art');
    expect(normalizePublicUsername('@@ani_99')).toBe('ani_99');
  });

  it('accepts Instagram-style handles', () => {
    for (const n of ['ani', 'anna.art', 'ani_99', 'a1b', '1980s', 'a'.repeat(30)])
      expect(publicUsernameProblem(n)).toBeNull();
  });

  it('rejects bad length, characters and shapes', () => {
    expect(publicUsernameProblem('ab')).toBe('length');
    expect(publicUsernameProblem('a'.repeat(31))).toBe('length');
    for (const n of [
      '.anna',
      'anna.',
      '_anna',
      'anna_',
      'an..na',
      'an na',
      'anna-art',
      'Anna',
      'աննա',
    ])
      expect(publicUsernameProblem(n)).toBe('format');
  });

  it('keeps official-looking and route names', () => {
    for (const n of ['admin', 'support', 'briefluence', 'briefluence_team', 'login'])
      expect(publicUsernameProblem(n)).toBe('reserved');
  });
});

describe('setUsernameSchema', () => {
  it('normalizes and explains problems with translation keys', async () => {
    const { setUsernameSchema } = await import('../schemas/profiles');
    expect(setUsernameSchema.parse({ username: '@Anna.Art' })).toEqual({ username: 'anna.art' });
    expect(setUsernameSchema.parse({ username: null })).toEqual({ username: null });
    const bad = setUsernameSchema.safeParse({ username: 'admin' });
    expect(bad.success ? null : bad.error.issues[0]!.message).toBe('usernameReserved');
  });
});
