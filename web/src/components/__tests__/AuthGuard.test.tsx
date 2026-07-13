import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AuthGuard from '../AuthGuard';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

describe('AuthGuard', () => {
  it('prikaže indikator nalaganja', () => {
    (useAuth as jest.Mock).mockReturnValue({ loading: true });
    const { getByText } = render(<AuthGuard><div>Vsebina</div></AuthGuard>);
    expect(getByText('Nalaganje...')).toBeTruthy();
  });

  it('preusmeri neavtenticiranega uporabnika na prijavo', () => {
    (useAuth as jest.Mock).mockReturnValue({ loading: false, user: null });
    const { getByText } = render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<AuthGuard><div>Vsebina</div></AuthGuard>} />
          <Route path="/login" element={<div>Prijava</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(getByText('Prijava')).toBeTruthy();
  });

  it('prikaže vsebino za avtoriziranega lastnika', () => {
    (useAuth as jest.Mock).mockReturnValue({ 
      loading: false, 
      user: { uid: '123' }, 
      ownerProfile: { role: 'owner' } 
    });
    const { getByText } = render(
      <MemoryRouter>
        <AuthGuard><div>Zaščitena vsebina</div></AuthGuard>
      </MemoryRouter>
    );
    expect(getByText('Zaščitena vsebina')).toBeTruthy();
  });
});