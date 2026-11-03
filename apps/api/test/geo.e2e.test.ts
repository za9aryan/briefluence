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
