import React, { Suspense } from 'react';
import CheckoutClient from '../../components/client/checkout/CheckoutClient';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading checkout...</div>}>
      <CheckoutClient />
    </Suspense>
  );
}
