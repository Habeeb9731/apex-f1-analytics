import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/theme';
import './index.css';


const cacheLifetime = 1000 * 60 * 60 * 24;
const largeQueryPaths = new Set(['/location', '/car_data']);
const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 30,
      gcTime: cacheLifetime,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'apex-f1-query-cache',
  throttleTime: 1000,
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: cacheLifetime,
        buster: 'apex-f1-v1',
        dehydrateOptions: {
          shouldDehydrateQuery: query =>
            query.state.status === 'success' &&
            !largeQueryPaths.has(String(query.queryKey[0])),
        },
      }}
    >
      <BrowserRouter>
        <ThemeProvider>
          <TooltipProvider>
            <App />
          </TooltipProvider>
        </ThemeProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
