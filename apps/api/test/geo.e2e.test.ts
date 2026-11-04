import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, createTestApp, signup, type TestCtx } from './helpers';

describe('city search (e2e)', () => {
  let ctx: TestCtx;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('signed-in users search cities by country; input is validated', async () => {
    await ctx.http().get(`${API}/geo/cities?country=AM&q=gy`).expect(401);
    const user = await signup(ctx, 'BRAND');
    const res = await user.agent.get(`${API}/geo/cities?country=AM&q=gy`).expect(200);
    expect(res.body[0]).toMatchObject({ name: 'Gyumri', country: 'AM' });
    const two = await user.agent.get(`${API}/geo/cities?country=AM,GE&q=`).expect(200);
    expect(two.body.some((c: { country: string }) => c.country === 'GE')).toBe(true);
    await user.agent.get(`${API}/geo/cities?country=armenia`).expect(400);
    await user.agent.get(`${API}/geo/cities`).expect(400);
  });
});

describe('GeoNames mapping', () => {
  it('stores the main name, labels with the matched name, drops duplicates', async () => {
    const { fromGeoNames } = await import('../src/modules/geo/geo.service');
    // Shape as returned by searchJSON?style=LONG&lang=ru for "Ерев" (checked 2026-11-04).
    expect(
      fromGeoNames(
        [
          { toponymName: 'Yerevan', name: 'Ереван', adminName1: 'Ереван', countryCode: 'AM' },
          { toponymName: 'Yerevan', name: 'Ереван', adminName1: 'Ереван', countryCode: 'AM' },
          { toponymName: 'Gyumri', name: 'Gyumri', adminName1: '', countryCode: 'AM' },
          { name: 'no main name', countryCode: 'AM' },
        ],
        'ru',
      ),
    ).toEqual([
      { name: 'Yerevan', label: 'Ереван', country: 'AM', region: 'Ереван' },
      { name: 'Gyumri', label: 'Gyumri', country: 'AM', region: null },
    ]);
    expect(
      fromGeoNames([{ toponymName: 'Munich', name: 'München', countryCode: 'DE' }], 'en'),
    ).toEqual([{ name: 'Munich', label: 'Munich', country: 'DE', region: null }]);
  });
});
