import { Container } from '@briefluence/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { PublicProfilePage, type PublicPage } from '@/components/influencer/PublicProfilePage';
import { serverGet, siteOrigin } from '@/lib/server';

/** One API call per request, shared by the metadata and the page. */
const load = cache((username: string) =>
  serverGet<PublicPage>(`/public/influencers/${encodeURIComponent(username)}`),
);

type Props = { params: Promise<{ username: string }> };

/** briefluence.com/@username (rewritten here): a blogger's public page, open without an account. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const p = await load(username);
  if (!p) return {};
  const t = await getTranslations('portfolio.public');
  const url = `${await siteOrigin()}/@${p.username}`;
  const description = p.bio?.slice(0, 160) || t('metaDescription', { name: p.displayName });
  return {
    title: `${p.displayName} (@${p.username})`,
    description,
    alternates: { canonical: url },
    // Pages that are not live yet (owner preview) stay out of search.
    robots: p.live ? undefined : { index: false, follow: false },
    openGraph: {
      type: 'profile',
      url,
      title: p.displayName,
      description,
      images: p.avatarUrl ? [{ url: p.avatarUrl }] : undefined,
    },
  };
}

export default async function PublicBloggerPage({ params }: Props) {
  const { username } = await params;
  const p = await load(username);
  if (!p) notFound();
  return (
    <Container size="lg" py={{ base: 6, md: 12 }}>
      <PublicProfilePage initial={p} />
    </Container>
  );
}
