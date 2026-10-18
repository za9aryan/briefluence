/** One JSON file per namespace per locale: messages/{locale}/{namespace}.json */
export const NAMESPACES = [
  'common',
  'enums',
  'nav',
  'auth',
  'landing',
  'legal',
  'onboarding',
  'verification',
  'dashboard',
  'deals',
  'dealForm',
  'applications',
  'billing',
  'account',
  'notifications',
  'admin',
  'insights',
  'offers',
  'errors',
] as const;
export type Namespace = (typeof NAMESPACES)[number];
