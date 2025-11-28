
import React, { useState } from 'react';
import { Page } from '../App';
import { User } from '../types';

interface HeaderProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  currentUser: User | null;
  onLogout: () => void;
}

const NavLink: React.FC<{
  page: Page;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  children: React.ReactNode;
  isMobile?: boolean;
}> = ({ page, currentPage, setCurrentPage, children, isMobile = false }) => {
  const isActive = currentPage === page;
  const baseClasses = "font-medium transition-colors duration-200";
  const mobileClasses = `block px-3 py-2 rounded-md text-base ${baseClasses}`;
  const desktopClasses = `px-3 py-2 rounded-md text-sm ${baseClasses}`;

  return (
    <button
      onClick={() => setCurrentPage(page)}
      className={`${isMobile ? mobileClasses : desktopClasses} ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
};

const Header: React.FC<HeaderProps> = ({ currentPage, setCurrentPage, currentUser, onLogout }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleNavClick = (page: Page) => {
      setCurrentPage(page);
      setIsMenuOpen(false);
    }
    
    const NavLinksContent: React.FC<{isMobile?: boolean}> = ({ isMobile }) => (
      <>
        <NavLink page="dashboard" currentPage={currentPage} setCurrentPage={handleNavClick} isMobile={isMobile}>Asistencia</NavLink>
        <NavLink page="visitor-registration" currentPage={currentPage} setCurrentPage={handleNavClick} isMobile={isMobile}>Registro Visitas</NavLink>
        {currentUser && (
          <>
            <NavLink page="scheduling" currentPage={currentPage} setCurrentPage={handleNavClick} isMobile={isMobile}>Planificación</NavLink>
            <NavLink page="collaborators" currentPage={currentPage} setCurrentPage={handleNavClick} isMobile={isMobile}>Colaboradores</NavLink>
            <NavLink page="reports" currentPage={currentPage} setCurrentPage={handleNavClick} isMobile={isMobile}>Reportes</NavLink>
            <NavLink page="admin" currentPage={currentPage} setCurrentPage={handleNavClick} isMobile={isMobile}>Administración</NavLink>
          </>
        )}
      </>
    );

    return (
    <nav className="bg-gray-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span onClick={() => handleNavClick('dashboard')} className="text-white font-bold text-xl cursor-pointer">TimeFace</span>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <NavLinksContent />
              </div>
            </div>
          </div>
           <div className="hidden md:block">
              {currentUser ? (
                <button
                  onClick={() => { onLogout(); setIsMenuOpen(false); }}
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  Cerrar Sesión
                </button>
              ) : (
                <button
                  onClick={() => handleNavClick('login')}
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  Iniciar Sesión
                </button>
              )}
            </div>
          <div className="-mr-2 flex md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              type="button"
              className="bg-gray-800 inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
              aria-controls="mobile-menu"
              aria-expanded={isMenuOpen}
            >
              <span className="sr-only">Open main menu</span>
              <svg className={`${isMenuOpen ? 'hidden' : 'block'} h-6 w-6`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <svg className={`${isMenuOpen ? 'block' : 'hidden'} h-6 w-6`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className={`${isMenuOpen ? 'block' : 'hidden'} md:hidden`} id="mobile-menu">
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          <NavLinksContent isMobile={true} />
           {currentUser ? (
              <button
                onClick={() => { onLogout(); setIsMenuOpen(false); }}
                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
              >
                Cerrar Sesión
              </button>
            ) : (
                <button
                  onClick={() => handleNavClick('login')}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  Iniciar Sesión
                </button>
            )}
        </div>
      </div>
    </nav>
  );
};

export default Header;
