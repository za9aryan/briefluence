import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AudiencePage } from '@/components/common/AudiencePage';
import { BloggerFaq, EarnWays, NoCatch } from '@/components/landing/BloggerSections';
import { ProcessFunnel } from '@/components/landing/ProcessFunnel';

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
        ['direct', 'message'],
      ]}
      afterHero={
        <ProcessFunnel
          ns="influencers.funnel"
          cta="/signup?role=INFLUENCER"
          points={['feed', 'budget', 'offers']}
          chores={[
            ['find', 'search'],
            ['dm', 'send'],
            ['kit', 'briefcase'],
            ['wait', 'clock'],
            ['prove', 'chart'],
            ['budget', 'wallet'],
          ]}
        />
      }
    >
      <EarnWays />
      <NoCatch />
      <BloggerFaq />
    </AudiencePage>
  );
}
