import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { bootstrapTheme } from '../lib/theme';
import '../styles/global.css';

bootstrapTheme();

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing from index.html');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
