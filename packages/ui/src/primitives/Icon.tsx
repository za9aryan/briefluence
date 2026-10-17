import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  Filter,
  Gift,
  Globe,
  Heart,
  Image as ImageIcon,
  Inbox,
  Info,
  LayoutDashboard,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Pause,
  Pencil,
  Phone,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  User,
  Users,
  Wallet,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { SVGProps } from 'react';
import { cn } from '../lib/cn';
import { TONE_TEXT, type Tone } from './Typography';

type SvgIcon = (props: SVGProps<SVGSVGElement>) => React.ReactElement;

// Platform marks drawn locally (lucide no longer ships brand logos); 2px stroke, round caps per brand book.
const Instagram: SvgIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
  </svg>
);
const TikTok: SvgIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" />
    <path d="M14 3c.5 2.8 2.4 4.6 5 5" />
  </svg>
);
const YouTube: SvgIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
    <path d="m10 9.5 5 2.5-5 2.5z" fill="currentColor" />
  </svg>
);
const Telegram: SvgIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="m21 4-18 7.5 6 2 2 6.5 3.5-4.5 5 3.5z" />
    <path d="m9 13.5 8-6" />
  </svg>
);

/** Every icon used in the product, by semantic name. Add new ones here, not ad hoc. */
export const ICONS = {
  alert: AlertCircle,
  warning: AlertTriangle,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  external: ArrowUpRight,
  verified: BadgeCheck,
  bell: Bell,
  chart: BarChart3,
  briefcase: Briefcase,
  building: Building2,
  calendar: Calendar,
  check: Check,
  'check-circle': CheckCircle2,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  circle: Circle,
  clock: Clock,
  copy: Copy,
  card: CreditCard,
  eye: Eye,
  'eye-off': EyeOff,
  filter: Filter,
  gift: Gift,
  globe: Globe,
  heart: Heart,
  image: ImageIcon,
  inbox: Inbox,
  info: Info,
  dashboard: LayoutDashboard,
  link: Link2,
  spinner: Loader2,
  lock: Lock,
  logout: LogOut,
  mail: Mail,
  pin: MapPin,
  menu: Menu,
  message: MessageCircle,
  pause: Pause,
  edit: Pencil,
  phone: Phone,
  play: Play,
  plus: Plus,
  refresh: RefreshCw,
  repeat: Repeat,
  search: Search,
  send: Send,
  settings: Settings,
  shield: ShieldCheck,
  sparkles: Sparkles,
  star: Star,
  target: Target,
  trash: Trash2,
  trend: TrendingUp,
  upload: Upload,
  user: User,
  users: Users,
  wallet: Wallet,
  close: X,
  'x-circle': XCircle,
  instagram: Instagram,
  tiktok: TikTok,
  youtube: YouTube,
  telegram: Telegram,
} satisfies Record<string, LucideIcon | SvgIcon>;

export type IconName = keyof typeof ICONS;

const SIZE = { xs: 'size-3', sm: 'size-4', md: 'size-5', lg: 'size-6', xl: 'size-8' } as const;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  name: IconName;
  size?: keyof typeof SIZE;
  tone?: Tone;
  /** Accessible label; when omitted the icon is decorative (aria-hidden). */
  label?: string;
  spin?: boolean;
}

export function Icon({ name, size = 'sm', tone = 'default', label, spin, className, ...rest }: IconProps) {
  const Cmp = ICONS[name] as SvgIcon;
  return (
    <Cmp
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      className={cn('shrink-0', SIZE[size], tone === 'default' ? 'text-current' : TONE_TEXT[tone], spin && 'animate-spin', className)}
      {...rest}
    />
  );
}
