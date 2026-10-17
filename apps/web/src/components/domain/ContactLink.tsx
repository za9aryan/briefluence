'use client';
import { contactDisplay, contactHref, type ContactMethod } from '@briefluence/shared';
import { Icon } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import { CONTACT_ICON } from '@/components/brand/ContactMethodFields';

/** "Telegram: @user" as a link that opens the chat / profile / dialer. */
export function ContactLink({ method, value }: { method: ContactMethod | null; value: string | null }) {
  const tm = useTranslations('enums.contactMethod');
  if (!method || !value) return null;
  return (
    <a
      href={contactHref(method, value) ?? undefined}
      target={method === 'PHONE' ? undefined : '_blank'}
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-bold underline"
    >
      <Icon name={CONTACT_ICON[method]} />
      {tm(method)}: {contactDisplay(method, value)}
    </a>
  );
}
