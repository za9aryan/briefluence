import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AudiencePage } from '@/components/common/AudiencePage';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('nav'))('forInfluencers') };
}

export default function ForInfluencersPage() {
  return (
    <AudiencePage
      ns="influencers"
      cta="/signup?role=INFLUENCER"
      features={[
        ['feed', 'sparkles'],
        ['verified', 'verified'],
        ['track', 'send'],
        ['fair', 'wallet'],
      ]}
    />
  );
}
