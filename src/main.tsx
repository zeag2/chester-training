import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/app.css';
import { applyTheme, watchSystemTheme } from './lib/theme';
applyTheme(); watchSystemTheme();
import { startUpdates } from './lib/updates';
startUpdates();
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
