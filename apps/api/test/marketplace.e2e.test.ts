import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  API,
  brandProfile,
  connectMock,
  createAdmin,
  createTestApp,
  dealInput,
  influencerProfile,
  lastEmailTo,
  resetDb,
  signup,
  type TestCtx,
} from './helpers';

describe('marketplace core loop (e2e)', () => {
  let ctx: TestCtx;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    ctx.clock.reset();
  });

  async function approvedInfluencer() {
    const inf = await signup(ctx, 'INFLUENCER');
    await inf.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);
    await inf.agent.post(`${API}/billing/trial`).expect(200);
    const back = await connectMock(ctx, inf.agent, 'instagram');
    expect(back.searchParams.get('connected')).toBe('instagram');
    await inf.agent.post(`${API}/influencers/me/submit`).expect(200);
    const admin = await createAdmin(ctx);
    const queue = await admin.agent.get(`${API}/admin/verifications`).expect(200);
    const row = queue.body.find((r: { email: string }) => r.email === inf.email);
    await admin.agent.post(`${API}/admin/verifications/${row.id}/approve`).expect(204);
    return { ...inf, admin, profileId: row.id as string };
  }

  async function brandWithDeal(over: Record<string, unknown> = {}) {
    const brand = await signup(ctx, 'BRAND');
    await brand.agent.put(`${API}/brands/me`).send(brandProfile).expect(200);
    const deal = await brand.agent.post(`${API}/deals`).send(dealInput(over)).expect(201);
    const sent = await brand.agent.post(`${API}/deals/${deal.body.id}/publish`).expect(200);
    expect(sent.body.status).toBe('IN_REVIEW');
    const admin = await createAdmin(ctx);
    await admin.agent.post(`${API}/admin/deals/${deal.body.id}/approve`).expect(204);
    return { ...brand, dealId: deal.body.id as string };
  }

  it('free month starts only when the blogger confirms it; verification needs a connected account and admin approval', async () => {
    const inf = await signup(ctx, 'INFLUENCER');
    await inf.agent.get(`${API}/deals/feed`).expect(403);
    await inf.agent.post(`${API}/billing/trial`).expect(403); // profile first
    await inf.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);
    expect((await inf.agent.get(`${API}/auth/me`)).body.subscription).toBeNull();
    const locked = await inf.agent.get(`${API}/deals/feed`).expect(403);
    expect(locked.body.error.code).toBe('TRIAL_NOT_STARTED');
    await inf.agent.post(`${API}/billing/trial`).expect(200);
    await inf.agent.post(`${API}/billing/trial`).expect(200); // idempotent
    const me = await inf.agent.get(`${API}/auth/me`).expect(200);
    expect(me.body.subscription).toMatchObject({
      status: 'TRIALING',
      trialDaysLeft: 30,
      hasAccess: true,
    });
    const notVerified = await inf.agent.get(`${API}/deals/feed`).expect(403);
    expect(notVerified.body.error.code).toBe('NOT_VERIFIED_INFLUENCER');

    const noAccounts = await inf.agent.post(`${API}/influencers/me/submit`).expect(403);
    expect(noAccounts.body.error.code).toBe('PROFILE_INCOMPLETE');

    await connectMock(ctx, inf.agent, 'tiktok');
    const profile = await inf.agent.get(`${API}/influencers/me`).expect(200);
    expect(profile.body.socialAccounts[0]).toMatchObject({
      platform: 'TIKTOK',
      audienceGender: null,
    });
    expect(JSON.stringify(profile.body)).not.toMatch(/accessToken/);
    const stored = await ctx.prisma.socialAccount.findFirstOrThrow();
    expect(stored.accessTokenEnc).not.toContain('TIKTOK:'); // encrypted at rest

    const admin = await createAdmin(ctx);
    await inf.agent.post(`${API}/influencers/me/submit`).expect(200);
    const adminNotes = await admin.agent.get(`${API}/notifications`).expect(200);
    expect(adminNotes.body.items[0].type).toBe('VERIFICATION_PENDING');

    const queue = await admin.agent.get(`${API}/admin/verifications`).expect(200);
    await admin.agent
      .post(`${API}/admin/verifications/${queue.body[0].id}/reject`)
      .send({ reason: 'Account is private' })
      .expect(204);
    const rejected = await inf.agent.get(`${API}/notifications`).expect(200);
    expect(rejected.body.items[0]).toMatchObject({ type: 'VERIFICATION_REJECTED' });
    expect((await lastEmailTo(ctx, inf.email))?.subject).toBe('Your profile needs changes');

    await inf.agent.post(`${API}/influencers/me/submit`).expect(200);
    await admin.agent.post(`${API}/admin/verifications/${queue.body[0].id}/approve`).expect(204);
    expect((await lastEmailTo(ctx, inf.email))?.subject).toBe('You are verified');
    await inf.agent.get(`${API}/deals/feed`).expect(200);
  });

  it('brand posts a deal, sees reach; influencer applies; brand accepts; contacts revealed; completed', async () => {
    const inf = await approvedInfluencer();
    const brand = await brandWithDeal({ slots: 1 });

    const reach = await brand.agent
      .post(`${API}/deals/preview-reach`)
      .send({
        platforms: ['INSTAGRAM'],
        countries: ['AM'],
        cities: ['Yerevan'],
        influencerGender: 'FEMALE',
      })
      .expect(200);
    expect(reach.body.count).toBe(1);
    const none = await brand.agent
      .post(`${API}/deals/preview-reach`)
      .send({ platforms: ['INSTAGRAM'], countries: ['GE'] })
      .expect(200);
    expect(none.body.count).toBe(0);

    const feed = await inf.agent.get(`${API}/deals/feed`).expect(200);
    expect(feed.body.total).toBe(1);
    const card = feed.body.items[0];
    expect(card.id).toBe(brand.dealId);
    expect(card.matchScore).toBeGreaterThan(0);
    expect(card.brand.companyName).toBe('Ararat Cosmetics');

    const filtered = await inf.agent.get(`${API}/deals/feed?paymentType=BARTER`).expect(200);
    expect(filtered.body.total).toBe(0);

    const detail = await inf.agent.get(`${API}/deals/${brand.dealId}`).expect(200);
    const accountId = detail.body.eligibleAccounts[0].id;
    const applied = await inf.agent
      .post(`${API}/deals/${brand.dealId}/applications`)
      .send({
        socialAccountId: accountId,
        pitch: 'I love skincare and my audience trusts me.',
        proposedPrice: 7_000_000,
      })
      .expect(201);
    expect(applied.body).toMatchObject({ status: 'APPLIED', matchScore: card.matchScore });
    const again = await inf.agent
      .post(`${API}/deals/${brand.dealId}/applications`)
      .send({ socialAccountId: accountId, pitch: 'Applying twice should fail.' })
      .expect(409);
    expect(again.body.error.code).toBe('ALREADY_APPLIED');

    const brandNotes = await brand.agent.get(`${API}/notifications/unread-count`).expect(200);
    expect(brandNotes.body.count).toBe(2); // "brief is live" + new applicant

    const list = await brand.agent
      .get(`${API}/deals/${brand.dealId}/applications?sort=followers`)
      .expect(200);
    expect(list.body.items[0]).toMatchObject({ status: 'VIEWED', contacts: null });
    const appId = list.body.items[0].id;

    // Contacts hidden from the brand's influencer view until accepted.
    const before = await brand.agent.get(`${API}/influencers/${inf.profileId}`).expect(200);
    expect(before.body.contacts).toBeNull();
    expect(before.body.verified).toBe(true);

    await brand.agent
      .patch(`${API}/applications/${appId}/status`)
      .send({ status: 'SHORTLISTED' })
      .expect(200);
    await brand.agent
      .patch(`${API}/applications/${appId}/status`)
      .send({ status: 'ACCEPTED' })
      .expect(200);

    const after = await brand.agent.get(`${API}/deals/${brand.dealId}/applications`).expect(200);
    expect(after.body.items[0].contacts).toEqual({ method: 'TELEGRAM', value: 'anna' });
    expect(after.body.items[0].accounts).toHaveLength(1);
    expect(after.body.items[0].matchedAccountId).toBe(after.body.items[0].accounts[0].id);
    expect(after.body.deal).toMatchObject({ status: 'CLOSED', filled: 1 }); // slot reached → auto-closed
    const mine = await inf.agent.get(`${API}/applications/mine`).expect(200);
    expect(mine.body[0].brandContact).toEqual({
      name: 'Karen',
      position: 'PR manager',
      method: 'TELEGRAM',
      value: 'ararat_pr',
    });
    expect((await lastEmailTo(ctx, inf.email))?.subject).toBe('Your application is approved');

    await inf.agent.post(`${API}/applications/${appId}/withdraw`).expect(409);
    await brand.agent
      .patch(`${API}/applications/${appId}/status`)
      .send({ status: 'COMPLETED' })
      .expect(200);
    const notes = await inf.agent.get(`${API}/notifications`).expect(200);
    expect(notes.body.items.map((n: { type: string }) => n.type)).toEqual(
      expect.arrayContaining([
        'APPLICATION_VIEWED',
        'APPLICATION_SHORTLISTED',
        'APPLICATION_ACCEPTED',
        'APPLICATION_COMPLETED',
      ]),
    );
    await inf.agent.post(`${API}/notifications/read-all`).expect(204);
    expect((await inf.agent.get(`${API}/notifications/unread-count`)).body.count).toBe(0);
  });

  it('asks for confirmation before accepting beyond the slot count', async () => {
    const a = await approvedInfluencer();
    const b = await approvedInfluencer();
    const brand = await brandWithDeal({ slots: 1 });
    for (const inf of [a, b]) {
      const d = await inf.agent.get(`${API}/deals/${brand.dealId}`).expect(200);
      await inf.agent
        .post(`${API}/deals/${brand.dealId}/applications`)
        .send({
          socialAccountId: d.body.eligibleAccounts[0].id,
          pitch: 'Pick me, I am a great fit.',
        })
        .expect(201);
    }
    const list = await brand.agent.get(`${API}/deals/${brand.dealId}/applications`).expect(200);
    const [first, second] = list.body.items;
    await brand.agent
      .patch(`${API}/applications/${first.id}/status`)
      .send({ status: 'ACCEPTED' })
      .expect(200);
    const over = await brand.agent
      .patch(`${API}/applications/${second.id}/status`)
      .send({ status: 'ACCEPTED' })
      .expect(409);
    expect(over.body.error).toMatchObject({
      code: 'SLOTS_EXCEEDED',
      details: { slots: 1, filled: 1 },
    });
    await brand.agent
      .patch(`${API}/applications/${second.id}/status`)
      .send({ status: 'ACCEPTED', confirmOverSlots: true })
      .expect(200);
    const rej = await brand.agent
      .patch(`${API}/applications/${first.id}/status`)
      .send({ status: 'REJECTED' })
      .expect(400);
    expect(rej.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('hides ineligible deals and enforces brand ownership', async () => {
    const inf = await approvedInfluencer();
    const brand = await brandWithDeal({ countries: ['GE'] });
    const other = await signup(ctx, 'BRAND');
    await other.agent
      .put(`${API}/brands/me`)
      .send({ ...brandProfile, companyName: 'Other' })
      .expect(200);

    expect((await inf.agent.get(`${API}/deals/feed`)).body.total).toBe(0);
    await inf.agent.get(`${API}/deals/${brand.dealId}`).expect(404);
    const apply = await inf.agent
      .post(`${API}/deals/${brand.dealId}/applications`)
      .send({ socialAccountId: 'x', pitch: 'Trying to apply anyway.' })
      .expect(403);
    expect(apply.body.error.code).toBe('NOT_ELIGIBLE');

    await other.agent.get(`${API}/deals/${brand.dealId}`).expect(404);
    await other.agent.patch(`${API}/deals/${brand.dealId}`).send(dealInput()).expect(403);
    await other.agent.post(`${API}/deals/${brand.dealId}/pause`).expect(403);
    await other.agent.get(`${API}/deals/${brand.dealId}/applications`).expect(403);
    await inf.agent.post(`${API}/deals`).send(dealInput()).expect(403);

    // Active deals must be paused before editing.
    const edit = await brand.agent
      .patch(`${API}/deals/${brand.dealId}`)
      .send(dealInput())
      .expect(409);
    expect(edit.body.error.code).toBe('DEAL_NOT_EDITABLE');
    await brand.agent.post(`${API}/deals/${brand.dealId}/pause`).expect(200);
    await brand.agent
      .patch(`${API}/deals/${brand.dealId}`)
      .send(dealInput({ countries: ['AM'] }))
      .expect(200);
    // Targeting is not reviewed content, so the approved brief goes straight back live.
    expect(
      (await brand.agent.post(`${API}/deals/${brand.dealId}/publish`).expect(200)).body.status,
    ).toBe('ACTIVE');
    expect((await inf.agent.get(`${API}/deals/feed`)).body.total).toBe(1);
  });

  it('expires deals after the deadline via the cron job', async () => {
    await approvedInfluencer();
    const brand = await brandWithDeal();
    const admin = await createAdmin(ctx);
    ctx.clock.advance(11 * 86_400_000);
    await admin.agent.post(`${API}/admin/jobs/expire-deals/run`).expect(200);
    const deal = await brand.agent.get(`${API}/deals/${brand.dealId}`).expect(200);
    expect(deal.body.status).toBe('EXPIRED');
    const notes = await brand.agent.get(`${API}/notifications`).expect(200);
    expect(notes.body.items[0].type).toBe('DEAL_EXPIRED');
  });

  it('flags revoked social tokens on sync and notifies the influencer', async () => {
    const inf = await approvedInfluencer();
    const acc = await ctx.prisma.socialAccount.findFirstOrThrow();
    const { CryptoService } = await import('../src/common/crypto.service');
    const crypto = ctx.app.get(CryptoService);
    await ctx.prisma.socialAccount.update({
      where: { id: acc.id },
      data: { accessTokenEnc: crypto.encrypt('INSTAGRAM:revoked') },
    });
    await inf.admin.agent.post(`${API}/admin/jobs/social-sync/run`).expect(200);
    await ctx.queue.drain();
    const updated = await ctx.prisma.socialAccount.findUniqueOrThrow({ where: { id: acc.id } });
    expect(updated.tokenRevokedAt).not.toBeNull();
    expect((await lastEmailTo(ctx, inf.email))?.subject).toBe('Reconnect your account');
  });

  it('sends daily digests for new matching deals and new applicants', async () => {
    const inf = await approvedInfluencer();
    const brand = await brandWithDeal();
    const d = await inf.agent.get(`${API}/deals/${brand.dealId}`).expect(200);
    await inf.agent
      .post(`${API}/deals/${brand.dealId}/applications`)
      .send({
        socialAccountId: d.body.eligibleAccounts[0].id,
        pitch: 'Happy to collaborate on this!',
      })
      .expect(201);
    ctx.email.outbox.length = 0;
    const res = await inf.admin.agent.post(`${API}/admin/jobs/digests/run`).expect(200);
    expect(res.body).toEqual({ influencers: 1, brands: 1 });
    expect((await lastEmailTo(ctx, inf.email))?.subject).toBe('1 new brief for you');
    expect((await lastEmailTo(ctx, brand.email))?.subject).toBe('1 new applicant yesterday');
  });

  it('records feed filters and shows brands aggregated insights', async () => {
    const inf = await approvedInfluencer();
    const brand = await brandWithDeal();
    await inf.agent
      .get(
        `${API}/deals/feed?platform=INSTAGRAM&niche=beauty,food&paymentType=BARTER&budgetMin=5000000`,
      )
      .expect(200);
    await inf.agent
      .get(
        `${API}/deals/feed?platform=INSTAGRAM&niche=beauty,food&paymentType=BARTER&budgetMin=5000000`,
      )
      .expect(200); // refresh: deduped
    await inf.agent.get(`${API}/deals/feed?platform=TIKTOK&city=Yerevan&page=2`).expect(200); // page 2: not recorded
    await inf.agent.get(`${API}/deals/feed?platform=TIKTOK&city=Yerevan`).expect(200);
    await new Promise((r) => setTimeout(r, 200)); // recording is fire-and-forget

    await inf.agent.get(`${API}/brands/me/insights`).expect(403);
    const res = await brand.agent.get(`${API}/brands/me/insights?days=7`).expect(200);
    expect(res.body).toMatchObject({
      days: 7,
      totalSearches: 2,
      searchingBloggers: 1,
      filteredShare: 1,
      verifiedBloggers: 1,
    });
    expect(res.body.platforms).toEqual(
      expect.arrayContaining([
        { key: 'INSTAGRAM', count: 1 },
        { key: 'TIKTOK', count: 1 },
      ]),
    );
    expect(res.body.niches).toEqual(
      expect.arrayContaining([
        { key: 'beauty', count: 1 },
        { key: 'food', count: 1 },
      ]),
    );
    expect(res.body.cities).toEqual([{ key: 'Yerevan', count: 1 }]);
    expect(res.body.paymentTypes).toEqual([{ key: 'BARTER', count: 1 }]);
    expect(res.body.budgetBuckets.find((b: { min: number }) => b.min === 50_000).count).toBe(1);
    expect(res.body.perDay).toHaveLength(7);
    expect(res.body.perDay.reduce((a: number, d: { count: number }) => a + d.count, 0)).toBe(2);
    expect(JSON.stringify(res.body)).not.toContain(inf.email);
  });

  it('converts the budget filter across currencies and stores the display currency', async () => {
    const rates = await ctx.http().get(`${API}/currency/rates`).expect(200);
    expect(rates.body).toMatchObject({
      base: 'AMD',
      rates: { AMD: 1, USD: 390, RUB: 4.5 },
      source: 'static',
    });

    const inf = await approvedInfluencer();
    await inf.agent.patch(`${API}/auth/settings`).send({ currency: 'RUB' }).expect(204);
    expect((await inf.agent.get(`${API}/auth/me`)).body.currency).toBe('RUB');
    await inf.agent.patch(`${API}/auth/settings`).send({ currency: 'EUR' }).expect(400);

    // $200–$300 deal. At 390 AMD/USD: ֏100,000 ≈ $256 → matches; ֏150,000 ≈ $385 → too high.
    await brandWithDeal({ currency: 'USD', budgetMin: 200_00, budgetMax: 300_00 });
    const hit = await inf.agent
      .get(`${API}/deals/feed?budgetMin=${100_000_00}&budgetCurrency=AMD`)
      .expect(200);
    expect(hit.body.total).toBe(1);
    const miss = await inf.agent
      .get(`${API}/deals/feed?budgetMin=${150_000_00}&budgetCurrency=AMD`)
      .expect(200);
    expect(miss.body.total).toBe(0);
    // ₽20,000 = ֏90,000 ≈ $231 → matches.
    const rub = await inf.agent
      .get(`${API}/deals/feed?budgetMin=${20_000_00}&budgetCurrency=RUB`)
      .expect(200);
    expect(rub.body.total).toBe(1);
  });

  it('validates the brand contact method value', async () => {
    const brand = await signup(ctx, 'BRAND');
    const bad = await brand.agent
      .put(`${API}/brands/me`)
      .send({ ...brandProfile, contactMethod: 'WHATSAPP', contactValue: '@not_a_phone' })
      .expect(400);
    expect(bad.body.error.details.fieldErrors.contactValue).toEqual(['contactInvalid']);
    await brand.agent
      .put(`${API}/brands/me`)
      .send({ ...brandProfile, contactMethod: 'VIBER', contactValue: '' })
      .expect(400);
    const ok = await brand.agent
      .put(`${API}/brands/me`)
      .send({ ...brandProfile, contactMethod: 'WHATSAPP', contactValue: '+374 (91) 12-34-56' })
      .expect(200);
    expect(ok.body).toMatchObject({ contactMethod: 'WHATSAPP', contactValue: '+37491123456' });
  });

  it('applies without choosing an account and shows the brand all connected accounts', async () => {
    const inf = await approvedInfluencer();
    await connectMock(ctx, inf.agent, 'tiktok');
    // Accounts added after approval are reviewed one by one.
    const pending = await inf.admin.agent.get(`${API}/admin/accounts`).expect(200);
    await inf.admin.agent.post(`${API}/admin/accounts/${pending.body[0].id}/approve`).expect(204);
    const brand = await brandWithDeal({ platforms: ['INSTAGRAM', 'TIKTOK'] });
    await inf.agent
      .post(`${API}/deals/${brand.dealId}/applications`)
      .send({ pitch: 'Happy to do this collab!' })
      .expect(201);
    const list = await brand.agent.get(`${API}/deals/${brand.dealId}/applications`).expect(200);
    const row = list.body.items[0];
    expect(row.accounts.map((a: { platform: string }) => a.platform).sort()).toEqual([
      'INSTAGRAM',
      'TIKTOK',
    ]);
    expect(row.accounts.some((a: { id: string }) => a.id === row.matchedAccountId)).toBe(true);
    expect(JSON.stringify(row.accounts)).not.toContain('accessToken');
  });

  it('stores notification params and renders text and emails in the user language', async () => {
    const inf = await approvedInfluencer();
    await inf.agent.patch(`${API}/auth/settings`).send({ locale: 'ru' }).expect(204);
    const brand = await brandWithDeal({ title: 'Ужин на двоих за Reels' });
    await inf.agent
      .post(`${API}/deals/${brand.dealId}/applications`)
      .send({ pitch: 'Хочу снять этот Reels!' })
      .expect(201);
    const list = await brand.agent.get(`${API}/deals/${brand.dealId}/applications`).expect(200);
    ctx.email.outbox.length = 0;
    await brand.agent
      .patch(`${API}/applications/${list.body.items[0].id}/status`)
      .send({ status: 'ACCEPTED' })
      .expect(200);
    const notes = await inf.agent.get(`${API}/notifications`).expect(200);
    const accepted = notes.body.items.find(
      (n: { type: string }) => n.type === 'APPLICATION_ACCEPTED',
    );
    expect(accepted.params).toMatchObject({ deal: 'Ужин на двоих за Reels' });
    expect(accepted.title).toBe('Твоя заявка одобрена');
    expect((await lastEmailTo(ctx, inf.email))?.subject).toBe('Твоя заявка одобрена');
  });

  it('hides a confidential brand from bloggers until it accepts them', async () => {
    const inf = await approvedInfluencer();
    const brand = await brandWithDeal({ isConfidential: true });
    const feed = await inf.agent.get(`${API}/deals/feed`).expect(200);
    const card = feed.body.items.find((d: { id: string }) => d.id === brand.dealId);
    expect(card.isConfidential).toBe(true);
    expect(card.brand.companyName).toBeNull();
    expect(card.brandId).toBeNull();
    expect(JSON.stringify(feed.body)).not.toContain('Ararat Cosmetics');

    const detail = await inf.agent.get(`${API}/deals/${brand.dealId}`).expect(200);
    expect(detail.body.brand.companyName).toBeNull();
    expect(JSON.stringify(detail.body)).not.toContain('Ararat');

    await inf.agent
      .post(`${API}/deals/${brand.dealId}/applications`)
      .send({ pitch: 'I would love this collab!' })
      .expect(201);
    let mine = await inf.agent.get(`${API}/applications/mine`).expect(200);
    expect(mine.body[0].deal.brand.companyName).toBeNull();

    const list = await brand.agent.get(`${API}/deals/${brand.dealId}/applications`).expect(200);
    await brand.agent
      .patch(`${API}/applications/${list.body.items[0].id}/status`)
      .send({ status: 'ACCEPTED' })
      .expect(200);
    mine = await inf.agent.get(`${API}/applications/mine`).expect(200);
    expect(mine.body[0].deal.brand.companyName).toBe('Ararat Cosmetics');
    expect(mine.body[0].brandContact).toMatchObject({ name: 'Karen' });
    const after = await inf.agent.get(`${API}/deals/${brand.dealId}`).expect(200);
    expect(after.body.brand.companyName).toBe('Ararat Cosmetics');
  });

  it('counts one view per blogger per day and filters by collaboration type', async () => {
    const a = await approvedInfluencer();
    const b = await approvedInfluencer();
    const brand = await brandWithDeal({ collaborationType: 'LONG_TERM' });
    await a.agent.get(`${API}/deals/${brand.dealId}`).expect(200);
    await a.agent.get(`${API}/deals/${brand.dealId}`).expect(200); // same day: not counted again
    await b.agent.get(`${API}/deals/${brand.dealId}`).expect(200);
    await brand.agent.get(`${API}/deals/${brand.dealId}`).expect(200); // the brand itself: not counted
    const own = await brand.agent.get(`${API}/deals/mine`).expect(200);
    expect(own.body[0].viewCount).toBe(2);
    ctx.clock.advance(86_400_000);
    await a.agent.get(`${API}/deals/${brand.dealId}`).expect(200); // next day: counted
    const feed = await a.agent.get(`${API}/deals/feed?collaboration=LONG_TERM`).expect(200);
    expect(feed.body.items[0]).toMatchObject({ viewCount: 3, collaborationType: 'LONG_TERM' });
    expect((await a.agent.get(`${API}/deals/feed?collaboration=ONE_TIME`)).body.total).toBe(0);
    await new Promise((r) => setTimeout(r, 200));
    const ins = await brand.agent.get(`${API}/brands/me/insights?days=7`).expect(200);
    expect(ins.body.collaborationTypes).toEqual(
      expect.arrayContaining([
        { key: 'LONG_TERM', count: 1 },
        { key: 'ONE_TIME', count: 1 },
      ]),
    );
  });
});
