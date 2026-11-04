import { cn } from '../lib/cn';

/**
 * A country flag (ISO 3166-1 alpha-2). SVGs are self-hosted by the app under `/flags`
 * (from flag-icons, MIT: https://github.com/lipis/flag-icons), loaded lazily. Decorative:
 * always show the country name next to it.
 */
export function Flag({
  code,
  className,
  base = '/flags',
}: {
  code: string;
  className?: string;
  base?: string;
}) {
  return (
    <img
      src={`${base}/${code.toLowerCase()}.svg`}
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
      width={20}
      height={15}
      className={cn(
        'inline-block h-[15px] w-5 shrink-0 rounded-[3px] object-cover ring-1 ring-line',
        className,
      )}
    />
  );
}
