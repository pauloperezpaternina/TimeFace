import React, { useState, useEffect, useCallback } from 'react';
import { dbService } from '../../services/dbService';
import { Role } from '../../types';
import Modal from '../../components/Modal';
import Spinner from '../../components/Spinner';

const RoleForm: React.FC<{
  roleToEdit: Role | null;
  onSave: () => void;
  onCancel: () => void;
}> = ({ roleToEdit, onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (roleToEdit) {
      setName(roleToEdit.name);
    } else {
      setName('');
    }
  }, [roleToEdit]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (roleToEdit) {
        await dbService.updateRole({ ...roleToEdit, name });
      } else {
        await dbService.addRole({ name });
      }
      onSave();
    } catch (error) {
      console.error("Failed to save role:", error);
      alert('Error al guardar el rol.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Nombre del Rol</label>
            <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
        </div>
        <div className="flex justify-end space-x-2">
            <button type="button" onClick={onCancel} disabled={isSaving} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 flex items-center disabled:opacity-50">
              {isSaving && <Spinner size="4" />}
              {isSaving ? 'Guardando...' : 'Guardar Rol'}
            </button>
        </div>
    </form>
  );
};


const ManageRoles: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState<Role | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  const loadRoles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rolesData = await dbService.getRoles();
      setRoles(rolesData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ocurrió un error desconocido.";
      console.error("Failed to load roles:", err);
      setError(`No se pudieron cargar los roles. ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const handleSave = () => {
    setShowForm(false);
    setRoleToEdit(null);
    loadRoles();
  };

  const handleEdit = (role: Role) => {
    setRoleToEdit(role);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if(roleToDelete) {
      try {
        await dbService.deleteRole(roleToDelete.id);
        loadRoles();
      } catch (error) {
        console.error("Failed to delete role:", error);
        alert('Error al eliminar el rol.');
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Roles</h2>
        <button onClick={() => { setRoleToEdit(null); setShowForm(true); }} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">
          Agregar Rol
        </button>
      </div>

      {showForm && <div className="mb-6"><RoleForm roleToEdit={roleToEdit} onSave={handleSave} onCancel={() => {setShowForm(false); setRoleToEdit(null);}}/></div>}
      
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <Spinner size="10" />
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-500 font-medium">{error}</p>
              <button onClick={loadRoles} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Reintentar
              </button>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nombre del Rol</th>
                  <th scope="col" className="relative px-6 py-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {roles.map(role => (
                  <tr key={role.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white capitalize">{role.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button onClick={() => handleEdit(role)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">Editar</button>
                      <button onClick={() => setRoleToDelete(role)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
       <Modal 
        isOpen={!!roleToDelete} 
        onClose={() => setRoleToDelete(null)} 
        onConfirm={handleDelete}
        title="Eliminar Rol"
      >
        ¿Está seguro de que desea eliminar el rol "{roleToDelete?.name}"? Esta acción no se puede deshacer.
      </Modal>
    </div>
  );
};

export default ManageRoles;