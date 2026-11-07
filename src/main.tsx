import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/app.css';
import { applyTheme, watchSystemTheme } from './lib/theme';
applyTheme(); watchSystemTheme();
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
