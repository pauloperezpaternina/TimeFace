
import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Collaborators from './pages/Collaborators';
import Admin from './pages/Admin';
import Reports from './pages/Reports';

type Page = 'dashboard' | 'collaborators' | 'admin' | 'reports';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  const renderPage = useCallback(() => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'collaborators':
        return <Collaborators />;
      case 'admin':
        return <Admin />;
      case 'reports':
        return <Reports />;
      default:
        return <Dashboard />;
    }
  }, [currentPage]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className="p-4 sm:p-6 lg:p-8">
        {renderPage()}
      </main>
    </div>
  );
};

export default App;
