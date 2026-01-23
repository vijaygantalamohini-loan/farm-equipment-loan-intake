// Lightweight pub/sub for global error notifications
const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emit(event) {
  for (const l of Array.from(listeners)) {
    try { l(event); } catch {}
  }
}

// Expose on window for quick manual triggering in dev
try { if (typeof window !== 'undefined') { window.__errorBus = { subscribe, emit }; } } catch {}

const errorBus = { subscribe, emit };
export default errorBus;