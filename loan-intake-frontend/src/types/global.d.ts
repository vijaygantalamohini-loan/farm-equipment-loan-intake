declare global {
  interface Window {
    __API_BASE?: string;
    __errorBus?: { subscribe: Function; emit: Function };
    __offersPollInterval?: any;
  }
}
export {};
