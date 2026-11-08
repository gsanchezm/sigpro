import { describe, expect, it } from 'vitest';
import { socketOrigin } from './socket-origin';

describe('socketOrigin', () => {
  it('con la API relativa de desarrollo usa el origen de la página (Vite reenvía /socket.io)', () => {
    expect(socketOrigin('/api', 'http://localhost:5173/mission')).toBe('http://localhost:5173');
  });

  it('con la URL absoluta de Render usa el origen de la API, no el de la web estática', () => {
    expect(socketOrigin('https://sigpro-api.onrender.com/api', 'https://sigpro-web.onrender.com/mission')).toBe('https://sigpro-api.onrender.com');
  });

  it('conserva el puerto y descarta la ruta', () => {
    expect(socketOrigin('http://localhost:3001/api', 'http://localhost:5174/')).toBe('http://localhost:3001');
  });
});
