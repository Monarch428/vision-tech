import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Errors outside React rendering (event handlers, timers, un-awaited promises)
// don't unmount the UI, but log them in one place so they aren't silently lost.
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});
window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error ?? event.message);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary variant="app">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
