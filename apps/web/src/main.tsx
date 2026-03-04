import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// Service Worker kaydı — vite-plugin-pwa tarafından üretilir
// updateSW çağrısı ile yeni sürümler tetiklenebilir (ChatLayout'ta useElectronUpdate benzeri)
/*
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      onNeedRefresh() {
        window.dispatchEvent(new CustomEvent('sw:update-available'));
      },
      onOfflineReady() {
        console.info('[PWA] Uygulama çevrimdışı kullanıma hazır.');
      },
    });
  }).catch(console.error);
}
*/

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
