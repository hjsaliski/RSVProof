'use client';

import { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const cardElementStyle = {
  style: {
    base: {
      fontSize: '16px',
      color: '#1c1b17',
      '::placeholder': { color: '#9b9686' },
    },
  },
};

export default function CardForm({ clientSecret, depositDisplay, onSaved }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError('');

    const { error: confirmError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement),
      },
    });

    setLoading(false);

    if (confirmError) {
      setError(confirmError.message);
      return;
    }

    onSaved(setupIntent.id);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="field px-3 py-3">
        <CardElement options={cardElementStyle} />
      </div>
      {error && <p className="text-clay text-sm">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="btn-marigold w-full py-2.5"
      >
        {loading ? 'Saving card...' : `Hold my spot for ${depositDisplay}`}
      </button>
    </form>
  );
}
