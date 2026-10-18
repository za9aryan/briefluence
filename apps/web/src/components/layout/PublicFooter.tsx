import { Container, Grid, Stack, Text } from '@briefluence/ui';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Logo } from '@/components/common/Logo';

export async function PublicFooter() {
  const t = await getTranslations('nav');
  const tc = await getTranslations('common');
  const cols = [
    {
      title: t('product'),
      links: [
        ['/for-brands', t('forBrands')],
        ['/for-influencers', t('forInfluencers')],
      ],
    },
    {
      title: t('account'),
      links: [
        ['/login', t('login')],
        ['/signup', t('signup')],
      ],
    },
    {
      title: t('legal'),
      links: [
        ['/terms', t('terms')],
        ['/privacy', t('privacy')],
      ],
    },
  ];
  return (
    <footer className="border-t border-line bg-surface-raised">
      <Container py={{ base: 8, md: 12 }}>
        <Grid cols={{ base: 2, md: 4 }} gap={{ base: 8, md: 6 }}>
          <Stack gap={4} className="col-span-2 md:col-span-1">
            <Logo />
            <Text size="small" tone="muted" className="max-w-xs">
              {tc('tagline')}
            </Text>
          </Stack>
          {cols.map((c) => (
            <Stack key={c.title} gap={2}>
              <Text size="label" tone="muted">
                {c.title}
              </Text>
              {c.links.map(([href, label]) => (
                <Link
                  key={href}
                  href={href!}
                  className="py-1 text-small font-medium text-ink hover:text-primary-text"
                >
                  {label}
                </Link>
              ))}
            </Stack>
          ))}
        </Grid>
        <Text size="small" tone="muted" className="mt-8">
          © {new Date().getFullYear()} briefluence · {tc('madeIn')}
        </Text>
      </Container>
    </footer>
  );
}
