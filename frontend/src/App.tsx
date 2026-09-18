import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createQueryClient } from './lib/queryClient';
import { RunsPage } from './pages/RunsPage';

export function App({ queryClient }: { queryClient?: QueryClient }) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <QueryClientProvider client={client}>
      <RunsPage />
    </QueryClientProvider>
  );
}
