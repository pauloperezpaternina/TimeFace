import React, { useState } from 'react';
import { dbService } from '../services/dbService';
import { User } from '../types';
import Spinner from '../components/Spinner';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const { user } = await dbService.login(email, password);

      if (!user) {
        throw new Error("Usuario no encontrado o credenciales incorrectas.");
      }
      
      if (user.role !== 'admin') {
        throw new Error("Acceso denegado. Se requieren permisos de administrador.");
      }
      onLoginSuccess(user);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error de autenticación. Verifique sus credenciales.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md p-10 space-y-8 bg-white/60 dark:bg-gray-900/60 backdrop-blur-2xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-white/40 dark:border-gray-800">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-blue-500/30 mb-6">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h2 className="text-center text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
            Iniciar sesión
          </h2>
          <p className="mt-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
            Administración de NominAI
          </p>
        </div>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <input type="hidden" name="remember" defaultValue="true" />
          <div className="space-y-4">
            <div>
              <label htmlFor="email-address" className="sr-only">Usuario o Email</label>
              <input
                id="email-address"
                name="email"
                type="text"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none block w-full px-5 py-4 border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 rounded-2xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-transparent transition-all sm:text-base backdrop-blur-md"
                placeholder="Usuario o email"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Contraseña</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none block w-full px-5 py-4 border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 rounded-2xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-transparent transition-all sm:text-base backdrop-blur-md"
                placeholder="Contraseña"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50/80 dark:bg-red-900/20 backdrop-blur-md rounded-2xl p-4 text-sm text-red-600 dark:text-red-400 flex items-center justify-center gap-2 border border-red-100 dark:border-red-900/30" role="alert">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              <span className="font-medium">{error}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center items-center py-4 px-4 text-base font-semibold rounded-2xl text-white bg-[#007AFF] hover:bg-[#0066D6] focus:outline-none focus:ring-4 focus:ring-[#007AFF]/30 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-[#007AFF]/20"
            >
              {isLoading ? <Spinner size="5" /> : 'Continuar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;