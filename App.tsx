
import React, { useState } from 'react';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Collaborators from './pages/Collaborators';
import Admin from './pages/Admin';
import Reports from './pages/Reports';
import Scheduling from './pages/Scheduling';
import Login from './pages/Login';
import VisitorRegistration from './pages/VisitorRegistration';
import { User } from './types';

export type Page = 'dashboard' | 'scheduling' | 'collaborators' | 'admin' | 'reports' | 'login' | 'visitor-registration';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    // Redirect to a default protected page after login, e.g., collaborators
    setCurrentPage('collaborators');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentPage('dashboard');
  };

  const protectedPages: Page[] = ['scheduling', 'collaborators', 'admin', 'reports'];
  const isProtectedPage = protectedPages.includes(currentPage);

  const renderContent = () => {
    // If not logged in, and trying to access a protected page OR the login page itself
    if (!currentUser && (isProtectedPage || currentPage === 'login')) {
      return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'visitor-registration':
        return <VisitorRegistration />;
      case 'scheduling':
        return <Scheduling />;
      case 'collaborators':
        return <Collaborators />;
      case 'admin':
        return <Admin />;
      case 'reports':
        return <Reports />;
      // If user is already logged in and tries to go to 'login', redirect to dashboard.
      case 'login':
        return <Dashboard />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      <main className="p-4 sm:p-6 lg:p-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
