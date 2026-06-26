import React from 'react';
import ReactDOM from 'react-dom/client';
import './app/theme/theme.css';
import { App } from './app/App.tsx';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
