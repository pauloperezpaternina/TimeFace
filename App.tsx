import React, { useState } from 'react';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Collaborators from './pages/Collaborators';
import Admin from './pages/Admin';
import Reports from './pages/Reports';
import Scheduling from './pages/Scheduling';
import Login from './pages/Login';
import VisitorRegistration from './pages/VisitorRegistration';
import Locations from './pages/Locations';
import UpdatePhoto from './pages/UpdatePhoto';
import { User } from './types';

export type Page = 'dashboard' | 'scheduling' | 'collaborators' | 'admin' | 'reports' | 'login' | 'visitor-registration' | 'locations' | 'update-photo';

const App: React.FC = () => {
  const urlPage = new URLSearchParams(window.location.search).get('page') as Page;
  const [currentPage, setCurrentPage] = useState<Page>(urlPage || 'dashboard');
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

  const protectedPages: Page[] = ['scheduling', 'collaborators', 'admin', 'reports', 'locations'];
  const isProtectedPage = protectedPages.includes(currentPage);

  const renderContent = () => {
    // If not logged in, and trying to access a protected page OR the login page itself
    // Note: update-photo is public
    if (!currentUser && (isProtectedPage || currentPage === 'login')) {
      return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'visitor-registration':
        return <VisitorRegistration setCurrentPage={setCurrentPage} />;
      case 'update-photo':
        return <UpdatePhoto />;
      case 'scheduling':
        return <Scheduling />;
      case 'collaborators':
        return <Collaborators />;
      case 'admin':
        return <Admin />;
      case 'locations':
        return <Locations />;
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
    <div className="min-h-screen bg-[var(--apple-bg)] dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Header 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      <main className="pt-20 md:pt-16 pb-8 px-4 sm:px-6 lg:px-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;