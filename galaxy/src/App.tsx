import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RetrospectivePage } from './pages/RetrospectivePage';
import { RetrospectiveListPage } from './pages/RetrospectiveListPage';
import { CreateRetrospectivePage } from './pages/CreateRetrospectivePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/retros" replace />} />
          <Route path="/retros" element={<RetrospectiveListPage />} />
          <Route path="/retros/new" element={<CreateRetrospectivePage />} />
          <Route path="/retros/:id" element={<RetrospectivePageWrapper />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

// Wrapper to extract route params
function RetrospectivePageWrapper() {
  // In a real app, use useParams from react-router-dom
  const id = window.location.pathname.split('/').pop() || '';
  return <RetrospectivePage retrospectiveId={id} />;
}

export default App;
