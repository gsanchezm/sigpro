import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../state/auth';

// Marcador temporal: se sustituye por el módulo Programas completo en la tarea T10.
export const ProgramsPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <main className="p-6">
      <h1 className="m-0 text-[20px] font-semibold">Programas</h1>
      <p>Sesión: {user?.name}</p>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          void signOut().then(() => navigate('/login', { state: { signedOut: true } }));
        }}
      >
        Cerrar sesión
      </button>
    </main>
  );
};
