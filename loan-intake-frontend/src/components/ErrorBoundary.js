import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Optionally log to monitoring
    try {
      console.error('ErrorBoundary caught:', error, info);
      if (window.__errorBus) {
        window.__errorBus.emit({ message: error?.message || 'Render error', status: 0, url: 'ErrorBoundary' });
      }
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px' }}>
          <h2>Something went wrong.</h2>
          <p style={{ color: '#666' }}>{this.state.error?.message || 'Unexpected error'}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>Try to continue</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;