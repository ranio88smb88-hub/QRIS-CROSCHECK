// Ensure window.fetch is writable and doesn't throw read-only/getter error
try {
  let origFetch = window.fetch;
  Object.defineProperty(window, 'fetch', {
    configurable: true,
    enumerable: true,
    get() {
      return origFetch;
    },
    set(val) {
      origFetch = val;
    }
  });
} catch (e) {
  // ignore
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
