import { redirect } from 'next/navigation';

/** Prices are shown to bloggers inside the app, before they choose a plan; old links land on the home page. */
export default function PricingPage() {
  redirect('/');
}
