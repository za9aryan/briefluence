import { cn } from '../lib/cn';
import { Icon } from '../primitives/Icon';

export type PlatformKey = 'INSTAGRAM' | 'TIKTOK' | 'YOUTUBE';

const SIZE = {
  sm: { box: 'size-9 rounded-[11px]', icon: 'md' as const },
  md: { box: 'size-12 rounded-[14px]', icon: 'lg' as const },
  lg: { box: 'size-16 rounded-[18px]', icon: 'xl' as const },
};

/** Brand color behind each mark, and the glow a tile can use (tokens: --bf-instagram…). */
export const PLATFORM_GLOW: Record<PlatformKey, string> = {
  INSTAGRAM: 'var(--bf-instagram-glow)',
  TIKTOK: 'var(--bf-tiktok-red)',
  YOUTUBE: 'var(--bf-youtube)',
};

/**
 * A platform's mark as an app-icon tile in the platform's own colors: Instagram gradient, TikTok
 * black with its cyan/red offset, YouTube red. For connect screens and account lists, not for
 * inline text (use `Icon` there). Decorative unless `label` is given.
 */
export function PlatformLogo({
  platform,
  size = 'md',
  label,
  className,
}: {
  platform: PlatformKey;
  size?: keyof typeof SIZE;
  label?: string;
  className?: string;
}) {
  const s = SIZE[size];
  const name =
    platform === 'INSTAGRAM' ? 'instagram' : platform === 'TIKTOK' ? 'tiktok' : 'youtube';
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden text-on-scrim',
        s.box,
        className,
      )}
      style={{
        background:
          platform === 'INSTAGRAM'
            ? 'var(--bf-instagram)'
            : platform === 'TIKTOK'
              ? 'var(--bf-tiktok)'
              : 'var(--bf-youtube)',
        boxShadow: `0 10px 22px -12px ${PLATFORM_GLOW[platform]}, inset 0 1px 0 rgb(255 255 255 / 0.25)`,
      }}
    >
      {platform === 'TIKTOK' && (
        <>
          {/* TikTok's signature: the note echoed in cyan and red, slightly offset. */}
          <Icon
            name={name}
            size={s.icon}
            className="absolute -translate-x-[1.5px] -translate-y-[1.5px]"
            style={{ color: 'var(--bf-tiktok-cyan)' }}
          />
          <Icon
            name={name}
            size={s.icon}
            className="absolute translate-x-[1.5px] translate-y-[1.5px]"
            style={{ color: 'var(--bf-tiktok-red)' }}
          />
        </>
      )}
      <Icon name={name} size={s.icon} className="relative" />
    </span>
  );
}
