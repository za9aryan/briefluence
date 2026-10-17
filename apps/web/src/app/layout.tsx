import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { Manrope, Noto_Sans_Armenian, Syne } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

// Brand book: Syne 700–800 (Latin display), Manrope 400–800 (UI + Cyrillic), Noto Sans Armenian.
const syne = Syne({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-syne', display: 'swap' });
const manrope = Manrope({ subsets: ['latin', 'cyrillic'], weight: ['400', '500', '700', '800'], variable: '--font-manrope', display: 'swap' });
const armenian = Noto_Sans_Armenian({ subsets: ['armenian'], weight: ['400', '500', '700', '800'], variable: '--font-armenian', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common');
  return { title: { default: t('meta.title'), template: '%s · briefluence' }, description: t('meta.description') };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FFFFFF',
  // Always light: the app pins data-theme="light" on <html> regardless of the OS setting.
  colorScheme: 'light',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} data-theme="light" className={`${syne.variable} ${manrope.variable} ${armenian.variable}`}>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
