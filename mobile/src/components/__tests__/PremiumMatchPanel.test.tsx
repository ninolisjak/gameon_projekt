import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PremiumMatchPanel from '../PremiumMatchPanel';
import * as matchService from '../../services/matchService';

jest.mock('../context/PremiumContext', () => ({
  useColors: jest.fn(() => ({
    primary: '#000',
    primaryLight: '#111',
    text: '#222',
    textMuted: '#333',
    bgElevated: '#444',
    border: '#555',
    warning: '#666',
  })),
}));

jest.mock('../services/matchService', () => ({
  proposeGoal: jest.fn(),
  resolveUserProfiles: jest.fn(() => Promise.resolve(new Map())),
  requiredConfirmations: jest.fn(() => 2),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('PremiumMatchPanel', () => {
  const mockMatch: any = {
    id: 'test-match',
    sport: 'futsal',
    location: { lat: 0, lng: 0, name: '' },
    datetime: new Date(),
    totalSpots: 10,
    filledSpots: 10,
    status: 'full',
    isPublic: true,
    players: ['user1', 'user2'],
    createdBy: 'user1',
    isPremium: true,
    teamA: ['user1'],
    teamB: ['user2'],
    scoreA: 0,
    scoreB: 0,
    pendingEvents: [],
    events: [],
    attended: [],
    finalized: false,
  };

  it('prikaze zacetni rezultat', () => {
    const { getAllByText } = render(
      <PremiumMatchPanel match={mockMatch} userId="user1" />
    );
    expect(getAllByText('0')).toBeTruthy();
  });

  it('sprozi klic storitve ob prijavi gola', () => {
    const { getByText } = render(
      <PremiumMatchPanel match={mockMatch} userId="user1" />
    );
    fireEvent.press(getByText('Zadel sem gol (Ekipa A)'));
    expect(matchService.proposeGoal).toHaveBeenCalledWith('test-match', 'user1', 'user1');
  });
});