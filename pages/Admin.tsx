import React, { useState } from 'react';
import ManageUsers from './admin/ManageUsers';
import ManageRoles from './admin/ManageRoles';
import ManageShifts from './admin/ManageShifts';
import ManageShiftPatterns from './admin/ManageShiftPatterns';
import AttendanceCorrections from './admin/AttendanceCorrections';

type AdminTab = 'users' | 'roles' | 'shifts' | 'patterns' | 'corrections';

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  const renderContent = () => {
    switch (activeTab) {
      case 'users':
        return <ManageUsers />;
      case 'roles':
        return <ManageRoles />;
      case 'shifts':
        return <ManageShifts />;
      case 'patterns':
        return <ManageShiftPatterns />;
      case 'corrections':
        return <AttendanceCorrections />;
      default:
        return <ManageUsers />;
    }
  };

  const TabButton: React.FC<{ tabName: AdminTab; label: string }> = ({ tabName, label }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${activeTab === tabName
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
    >
      {label}
    </button>
  );

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Panel de Administración</h1>
      </div>

      <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto pb-2">
        <TabButton tabName="users" label="Gestionar Usuarios" />
        <TabButton tabName="roles" label="Gestionar Roles" />
        <TabButton tabName="shifts" label="Gestionar Turnos" />
        <TabButton tabName="patterns" label="Gestionar Patrones" />
        <TabButton tabName="corrections" label="Correcciones" />
      </div>
      <div>{renderContent()}</div>
    </div>
  );
};

export default Admin;