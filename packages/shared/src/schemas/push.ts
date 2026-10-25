import { z } from 'zod';

/**
 * A browser's Web Push subscription (PushSubscription.toJSON()): the push service endpoint and
 * the keys used to encrypt messages for this device.
 */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({
    p256dh: z.string().min(10).max(200),
    auth: z.string().min(8).max(100),
  }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const pushUnsubscribeSchema = z.object({ endpoint: z.url().max(1000) });
