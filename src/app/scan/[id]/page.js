'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ScannerPage() {
  const { id } = useParams();
  const [status, setStatus] = useState("Point the camera at a guest's QR code");
  const [statusKind, setStatusKind] = useState('neutral'); // neutral | success | warning | error
  const [busy, setBusy] = useState(false);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (!isMounted) return;
      const scanner = new Html5Qrcode('reader');
      html5QrCodeRef.current = scanner;

      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 250 },
          async (decodedText) => {
            if (busy) return;
            await handleScan(decodedText);
          },
          () => {}
        )
        .catch(() => {
          setStatus('Could not access camera. Check permissions.');
          setStatusKind('error');
        });
    });

    return () => {
      isMounted = false;
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleScan(decodedText) {
    setBusy(true);
    try {
      const payload = JSON.parse(decodedText);
      if (payload.eventId !== id) {
        setStatus('This code is for a different event.');
        setStatusKind('error');
        setBusy(false);
        return;
      }

      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: id, qrToken: payload.token }),
      });
      const json = await res.json();

      if (json.success) {
        setStatus(`Checked in: ${json.name}`);
        setStatusKind('success');
      } else if (json.warning) {
        setStatus(`Already checked in: ${json.name}`);
        setStatusKind('warning');
      } else {
        setStatus(json.error || 'Code not recognized.');
        setStatusKind('error');
      }
    } catch {
      setStatus('Could not read that code.');
      setStatusKind('error');
    }

    setTimeout(() => setBusy(false), 1500);
  }

  const statusColor =
    statusKind === 'success' ? '#a9740f' : statusKind === 'error' ? 'var(--clay)' : 'var(--ink-soft)';

  return (
    <main className="flex-1 flex flex-col items-center px-6 py-10">
      <p className="eyebrow mb-1">Door scanner</p>
      <h1 className="font-display text-2xl mb-6">Scan to check in.</h1>
      <div id="reader" ref={scannerRef} className="w-full max-w-sm rounded-2xl overflow-hidden mb-6 panel" />
      <p className="text-sm font-medium text-center" style={{ color: statusColor }}>
        {status}
      </p>
    </main>
  );
}
