import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AudiencePage } from '@/components/common/AudiencePage';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('nav'))('forBrands') };
}

export default function ForBrandsPage() {
  return (
    <AudiencePage
      ns="brands"
      cta="/signup?role=BRAND"
      features={[
        ['targeting', 'target'],
        ['reach', 'users'],
        ['applicants', 'chart'],
        ['contacts', 'message'],
      ]}
    />
  );
}
