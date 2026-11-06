'use client';
import { contactDisplay, contactHref, type ContactMethod } from '@briefluence/shared';
import { Avatar, Icon, cn } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import { CONTACT_ICON } from '@/components/brand/ContactMethodFields';
import { useFormat } from '@/lib/hooks/format';
import css from './CollabPanel.module.css';

/* Confetti pieces around the seal: [left %, top %, rotation, color slot, shape]. Decorative. */
const CONFETTI: [number, number, number, 1 | 2 | 3, 'dot' | 'bar'][] = [
  [2, 8, 25, 1, 'bar'],
  [9, 4, 0, 2, 'dot'],
  [1, 30, 0, 3, 'dot'],
  [11, 34, -40, 2, 'bar'],
  [72, 8, 60, 3, 'bar'],
  [80, 18, 0, 1, 'dot'],
  [87, 6, -20, 2, 'bar'],
  [93, 22, 35, 1, 'bar'],
  [97, 10, 0, 3, 'dot'],
  [84, 32, 0, 2, 'dot'],
];

/**
 * Celebration for an accepted (or completed) application: a seal, a short note and the company's
 * contact as a "pass" with one big button to write to them.
 */
export function CollabPanel({
  done,
  contact,
  brandName,
  publishBy,
}: {
  done: boolean;
  contact: {
    name: string | null;
    position: string | null;
    method: ContactMethod | null;
    value: string | null;
  };
  brandName: string;
  publishBy: string | null;
}) {
  const t = useTranslations('applications');
  const tm = useTranslations('enums.contactMethod');
  const f = useFormat();
  const person = [contact.name, contact.position].filter(Boolean).join(' · ');
  const href = contact.method && contact.value ? contactHref(contact.method, contact.value) : null;

  return (
    <div role="status" className={cn(css.panel, 'rounded-card p-4 sm:p-6')}>
      <div aria-hidden className={css.confetti}>
        {CONFETTI.map(([left, top, rot, slot, shape], i) => (
          <span
            key={i}
            className={cn(
              css.piece,
              shape === 'bar' ? css.bar : css.dot,
              // Phones: only the pieces around the seal, the rest would sit on the text.
              left > 50 && 'hidden sm:block',
            )}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              rotate: `${rot}deg`,
              background: `var(--bf-chart-${slot})`,
              animationDelay: `${i * 60}ms`,
            }}
          />
        ))}
      </div>

      <div className="relative flex items-start gap-4">
        <span aria-hidden className={css.seal}>
          <Icon name={done ? 'star' : 'check'} size="md" />
        </span>
        <div className="min-w-0 pt-1">
          <p className="text-h2 font-extrabold text-ink">
            {done ? t('doneTitle') : t('collabTitle')}
          </p>
          <p className="mt-1 text-small text-ink-muted">{done ? t('doneBody') : t('collabBody')}</p>
        </div>
      </div>

      {(person || href) && (
        <div className={cn(css.pass, 'relative mt-4 rounded-card bg-surface-raised')}>
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar name={contact.name || brandName} />
              <div className="min-w-0">
                <p className="text-label uppercase text-ink-muted">{t('contactsTitle')}</p>
                <p className="break-words text-small font-bold text-ink">{person || brandName}</p>
              </div>
            </div>
            {contact.method && contact.value && (
              <a
                href={href ?? undefined}
                target={contact.method === 'PHONE' ? undefined : '_blank'}
                rel="noopener noreferrer"
                className={cn(
                  css.cta,
                  'inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-pill px-4 text-small font-bold',
                )}
              >
                <Icon name={CONTACT_ICON[contact.method]} size="xs" />
                <span className="min-w-0 break-words py-2 text-center">
                  {tm(contact.method)}: {contactDisplay(contact.method, contact.value)}
                </span>
              </a>
            )}
          </div>
          {publishBy && (
            <div className={cn(css.stub, 'flex items-center gap-2 px-4 py-3 text-small text-ink')}>
              <Icon name="calendar" size="xs" tone="success" />
              {t('publishBy', { date: f.date(publishBy) })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
