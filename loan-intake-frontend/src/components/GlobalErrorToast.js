import React, { useEffect, useState } from 'react';
import errorBus from '../utils/errorBus';

function GlobalErrorToast() {
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = errorBus.subscribe((evt) => {
      setError({
        message: evt?.message || 'Unexpected error',
        status: evt?.status,
        url: evt?.url,
        requestId: evt?.requestId,
        when: new Date().toISOString(),
      });
      // auto-hide after 8s
      setTimeout(() => setError(null), 8000);
    });
    return unsub;
  }, []);

  if (!error) return null;

  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1000,
      background: '#fff3cd', color: '#856404', borderTop: '1px solid #ffeeba',
      padding: '10px 14px', display: 'flex', gap: '12px', alignItems: 'center'
    }}>
      <strong>API Error:</strong>
      <span style={{flex: 1}}>
        {error.message} {error.status ? `(status ${error.status})` : ''}
        {error.url ? ` at ${error.url}` : ''}
        {error.requestId ? ` · request ${error.requestId}` : ''}
      </span>
      <button onClick={() => setError(null)} style={{
        background: '#856404', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px'
      }}>Dismiss</button>
    </div>
  );
}

export default GlobalErrorToast;