import { AppError } from '../../../common/app-error';
import type { PaymentProvider } from './types';

/**
 * Placeholder for PAYMENT_PROVIDER=paddle. Paddle runs checkout and renewals itself
 * (PaddleBillingService); the card-charging contract below is never used with it.
 */
export class PaddleProviderStub implements PaymentProvider {
  readonly name = 'paddle' as const;
  private unsupported(): never {
    throw new AppError('PROVIDER_ERROR', 'Not used with Paddle');
  }
  createCheckout(): never {
    return this.unsupported();
  }
  confirm(): never {
    return this.unsupported();
  }
  chargeBinding(): never {
    return this.unsupported();
  }
  refund(): never {
    return this.unsupported();
  }
  async removeBinding() {}
}
