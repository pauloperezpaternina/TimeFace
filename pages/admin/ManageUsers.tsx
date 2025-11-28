import React, { useState, useEffect, useCallback } from 'react';
import { dbService } from '../../services/dbService';
import { User } from '../../types';
import Modal from '../../components/Modal';
import Spinner from '../../components/Spinner';

const UserForm: React.FC<{
  userToEdit: User | null;
  onSave: () => void;
  onCancel: () => void;
}> = ({ userToEdit, onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (userToEdit) {
      setName(userToEdit.name);
      setEmail(userToEdit.email);
      setRole(userToEdit.role);
    } else {
      setName('');
      setEmail('');
      setRole('user');
    }
  }, [userToEdit]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const userData = { name, email, role };
      if (userToEdit) {
        await dbService.updateUser({ ...userToEdit, ...userData });
      } else {
        await dbService.addUser(userData);
      }
      onSave();
    } catch (error) {
      console.error("Failed to save user:", error);
      alert('Error al guardar el usuario.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Nombre</label>
            <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
        </div>
        <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Email</label>
            <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
        </div>
        <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Rol</label>
            <select id="role" value={role} onChange={e => setRole(e.target.value as 'admin' | 'user')} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                <option value="user">Usuario</option>
                <option value="admin">Administrador</option>
            </select>
        </div>
        <div className="flex justify-end space-x-2">
            <button type="button" onClick={onCancel} disabled={isSaving} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 flex items-center disabled:opacity-50">
              {isSaving && <Spinner size="4" />}
              {isSaving ? 'Guardando...' : 'Guardar Usuario'}
            </button>
        </div>
    </form>
  );
};

const ManageUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const usersData = await dbService.getUsers();
      setUsers(usersData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ocurrió un error desconocido.";
      console.error("Failed to load users:", err);
      setError(`No se pudieron cargar los usuarios. ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSave = () => {
    setShowForm(false);
    setUserToEdit(null);
    loadUsers();
  };

  const handleEdit = (user: User) => {
    setUserToEdit(user);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if(userToDelete) {
      try {
        await dbService.deleteUser(userToDelete.id);
        loadUsers();
      } catch (error) {
        console.error("Failed to delete user:", error);
        alert('Error al eliminar el usuario.');
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Usuarios</h2>
        <button onClick={() => { setUserToEdit(null); setShowForm(true); }} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">
          Agregar Usuario
        </button>
      </div>

      {showForm && <div className="mb-6"><UserForm userToEdit={userToEdit} onSave={handleSave} onCancel={() => {setShowForm(false); setUserToEdit(null);}}/></div>}
      
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <Spinner size="10" />
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-500 font-medium">{error}</p>
              <button onClick={loadUsers} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Reintentar
              </button>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nombre</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rol</th>
                  <th scope="col" className="relative px-6 py-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {users.map(user => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        <span className={`capitalize px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                            {user.role}
                        </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button onClick={() => handleEdit(user)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">Editar</button>
                      <button onClick={() => setUserToDelete(user)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
       <Modal 
        isOpen={!!userToDelete} 
        onClose={() => setUserToDelete(null)} 
        onConfirm={handleDelete}
        title="Eliminar Usuario"
      >
        ¿Está seguro de que desea eliminar a {userToDelete?.name}? Esta acción no se puede deshacer.
      </Modal>
    </div>
  );
};

export default ManageUsers;