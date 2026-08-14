/**
 * Testi za PremiumMatchPanel — vnos rezultata prek kapetanov.
 *
 * Komponenta je bila prenovljena: prejšnji način (prijava posameznega gola
 * in potrjevanje s strani N igralcev) je zamenjal vnos končnega rezultata,
 * ki ga oddata kapetana. Ob neujemanju odloča večina vseh igralcev.
 *
 * Testirano vedenje:
 *   - prikaz prijave prisotnosti in klic checkIn
 *   - skrivanje panela za rezultat, dokler se tekma ne začne
 *   - faze vnosa rezultata (none / awaiting_captains / awaiting_all)
 *   - pravica do vnosa (kapetan proti navadnemu igralcu)
 *   - oddaja rezultata prek potrditvenega pogovornega okna
 *   - prikaz zaključene tekme
 *   - izravnava ekip (dostopna le ustvarjalcu)
 */

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import PremiumMatchPanel from '../PremiumMatchPanel';
import * as matchService from '../../services/matchService';

// Nadomestki 

jest.mock('../../services/matchService', () => ({
  checkIn: jest.fn(() => Promise.resolve()),
  swapTeam: jest.fn(() => Promise.resolve()),
  submitMatchScore: jest.fn(() => Promise.resolve({ status: 'waiting_other_captain' })),
  fetchInvitablePlayers: jest.fn(() => Promise.resolve([])),
  invitePlayerToMatch: jest.fn(() => Promise.resolve()),
  regenerateTeams: jest.fn(() => Promise.resolve()),
  resolveUserProfiles: jest.fn(() => Promise.resolve(new Map())),
  suggestMissingPosition: jest.fn(() => undefined),
}));

jest.mock('../../services/badgeService', () => ({
  syncBadges: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../context/PremiumContext', () => ({
  useColors: jest.fn(() => ({
    bg: '#000',
    bgCard: '#111',
    bgElevated: '#151515',
    border: '#222',
    borderSubtle: '#1a1a1a',
    text: '#fff',
    textMuted: '#999',
    textFaint: '#666',
    primary: '#f5c518',
    primaryLight: '#ffd94d',
    primaryTint: '#f5c51820',
    success: '#22c55e',
    successBg: '#22c55e20',
    warning: '#eab308',
    danger: '#ef4444',
  })),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

// Pomožne funkcije 

function makeMatch(overrides: Record<string, any> = {}): any {
  return {
    id: 'test-match',
    sport: 'futsal',
    location: { lat: 0, lng: 0, name: '' },
    datetime: new Date(),
    totalSpots: 10,
    filledSpots: 2,
    status: 'full',
    isPublic: true,
    players: ['user1', 'user2'],
    createdBy: 'user1',
    isPremium: true,
    teamA: ['user1'],
    teamB: ['user2'],
    scoreA: 0,
    scoreB: 0,
    attended: [],
    finalized: false,
    ...overrides,
  };
}

// Izriše komponento in počaka na resolveUserProfiles, ki se sproži v useEffect. Brez tega React opozori, da posodobitev stanja ni zavita v act(...).
async function renderPanel(match: any, userId = 'user1') {
  const utils = render(<PremiumMatchPanel match={match} userId={userId} />);
  await act(async () => {});
  return utils;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// Prijava prisotnosti 
describe('PremiumMatchPanel — prijava prisotnosti', () => {
  it('pred začetkom tekme prisotnosti ne prikaže', async () => {
    const { queryByText } = await renderPanel(makeMatch({ matchStarted: false }));
    expect(queryByText('Prijava prisotnosti')).toBeNull();
    expect(queryByText('SEM TUKAJ')).toBeNull();
  });

  it('po začetku tekme prijavljenemu igralcu prikaže poziv k prijavi prisotnosti', async () => {
    const { getByText } = await renderPanel(makeMatch({ matchStarted: true }));
    expect(getByText('Prijava prisotnosti')).toBeTruthy();
  });

  it('po zaključku tekme prisotnosti ne prikaže več', async () => {
    const { queryByText } = await renderPanel(
      makeMatch({ matchStarted: true, finalized: true })
    );
    expect(queryByText('Prijava prisotnosti')).toBeNull();
  });

  it('pritisk na gumb pokliče checkIn z ID tekme in uporabnika', async () => {
    const { getByText } = await renderPanel(makeMatch({ matchStarted: true }));

    await act(async () => {
      fireEvent.press(getByText('SEM TUKAJ'));
    });

    expect(matchService.checkIn).toHaveBeenCalledWith('test-match', 'user1');
  });

  it('že prijavljenemu igralcu gumba ne prikaže več', async () => {
    const { queryByText, getByText } = await renderPanel(
      makeMatch({ matchStarted: true, attended: ['user1'] })
    );

    expect(getByText('Prisoten')).toBeTruthy();
    expect(queryByText('SEM TUKAJ')).toBeNull();
  });

  it('neprijavljenemu igralcu prisotnosti ne ponuja', async () => {
    const { queryByText } = await renderPanel(
      makeMatch({ matchStarted: true, players: ['user2', 'user3'] }),
      'outsider'
    );

    expect(queryByText('Prijava prisotnosti')).toBeNull();
  });
});

// Panel za vnos rezultata 
describe('PremiumMatchPanel — panel za vnos rezultata', () => {
  it('pred začetkom tekme panela ne prikaže', async () => {
    const { queryByText } = await renderPanel(makeMatch());

    expect(queryByText('Kapetana vneseta rezultat')).toBeNull();
    expect(queryByText('Določanje kapetanov …')).toBeNull();
  });

  it('ob začetku tekme brez kapetanov prikaže obvestilo o določanju', async () => {
    const { getByText } = await renderPanel(
      makeMatch({ matchStarted: true, scorePhase: 'none' })
    );

    expect(getByText('Določanje kapetanov …')).toBeTruthy();
  });

  it('v fazi kapetanov prikaže ustrezen naslov', async () => {
    const { getByText } = await renderPanel(
      makeMatch({
        matchStarted: true,
        scorePhase: 'awaiting_captains',
        captainA: 'user1',
        captainB: 'user2',
      })
    );

    expect(getByText('Kapetana vneseta rezultat')).toBeTruthy();
  });

  it('ob neujemanju preide v fazo, kjer odločajo vsi igralci', async () => {
    const { getByText } = await renderPanel(
      makeMatch({
        matchStarted: true,
        scorePhase: 'awaiting_all',
        captainA: 'user1',
        captainB: 'user2',
      })
    );

    expect(getByText('Rezultat določajo vsi igralci')).toBeTruthy();
  });

  it('prikaže število oddanih rezultatov glede na število kapetanov', async () => {
    const { getByText } = await renderPanel(
      makeMatch({
        matchStarted: true,
        scorePhase: 'awaiting_captains',
        captainA: 'user1',
        captainB: 'user2',
      })
    );

    expect(getByText('Oddanih rezultatov: 0 / 2')).toBeTruthy();
  });
});

// Pravica do vnosa rezultata 
describe('PremiumMatchPanel — kdo sme vnesti rezultat', () => {
  const captainMatch = makeMatch({
    matchStarted: true,
    scorePhase: 'awaiting_captains',
    captainA: 'user1',
    captainB: 'user2',
  });

  it('kapetanu ponudi gumb za oddajo rezultata', async () => {
    const { getByText } = await renderPanel(captainMatch, 'user1');
    expect(getByText('Končaj tekmo in oddaj rezultat')).toBeTruthy();
  });

  it('navadnemu igralcu vnos zavrne in razloži, zakaj', async () => {
    const notCaptain = makeMatch({
      matchStarted: true,
      scorePhase: 'awaiting_captains',
      captainA: 'user2',
      captainB: 'user3',
      players: ['user1', 'user2', 'user3'],
    });

    const { getByText, queryByText } = await renderPanel(notCaptain, 'user1');

    expect(getByText('Rezultat lahko vneseta samo kapetana.')).toBeTruthy();
    expect(queryByText('Končaj tekmo in oddaj rezultat')).toBeNull();
  });

  it('v fazi vseh igralcev sme vnesti tudi nekapetan', async () => {
    const allPhase = makeMatch({
      matchStarted: true,
      scorePhase: 'awaiting_all',
      captainA: 'user2',
      captainB: 'user3',
      players: ['user1', 'user2', 'user3'],
    });

    const { getByText } = await renderPanel(allPhase, 'user1');
    expect(getByText('Oddaj rezultat')).toBeTruthy();
  });

  it('že oddan rezultat prikaže in ponudi popravek v sporni fazi', async () => {
    const withSubmission = makeMatch({
      matchStarted: true,
      scorePhase: 'awaiting_all',
      captainA: 'user1',
      captainB: 'user2',
      scoreSubmissions: { user1: { scoreA: 3, scoreB: 2 } },
    });

    const { getByText } = await renderPanel(withSubmission, 'user1');

    expect(getByText('Tvoj rezultat: 3 - 2')).toBeTruthy();
    expect(getByText('Popravi rezultat')).toBeTruthy();
  });
});

// Oddaja rezultata 
describe('PremiumMatchPanel — oddaja rezultata', () => {
  const captainMatch = makeMatch({
    matchStarted: true,
    scorePhase: 'awaiting_captains',
    captainA: 'user1',
    captainB: 'user2',
  });

  it('pred oddajo zahteva potrditev v pogovornem oknu', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = await renderPanel(captainMatch, 'user1');

    fireEvent.press(getByText('Končaj tekmo in oddaj rezultat'));

    expect(alertSpy).toHaveBeenCalled();
    expect(alertSpy.mock.calls[0][0]).toBe('Končaj tekmo');
    alertSpy.mockRestore();
  });

  it('brez potrditve rezultata ne odda', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = await renderPanel(captainMatch, 'user1');

    fireEvent.press(getByText('Končaj tekmo in oddaj rezultat'));

    expect(matchService.submitMatchScore).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('po potrditvi odda rezultat s privzetima vrednostma 0 in 0', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = await renderPanel(captainMatch, 'user1');

    fireEvent.press(getByText('Končaj tekmo in oddaj rezultat'));

    // Drugi gumb v oknu je potrditev ("Oddaj"), prvi je preklic.
    const buttons = alertSpy.mock.calls[0][2] as any[];
    await act(async () => {
      buttons[1].onPress();
    });

    expect(matchService.submitMatchScore).toHaveBeenCalledWith('test-match', 0, 0);
    alertSpy.mockRestore();
  });

  it('že oddan rezultat prednastavi vrednosti za popravek', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const withSubmission = makeMatch({
      matchStarted: true,
      scorePhase: 'awaiting_all',
      captainA: 'user1',
      captainB: 'user2',
      scoreSubmissions: { user1: { scoreA: 3, scoreB: 2 } },
    });

    const { getByText } = await renderPanel(withSubmission, 'user1');

    fireEvent.press(getByText('Popravi rezultat'));
    const buttons = alertSpy.mock.calls[0][2] as any[];
    await act(async () => {
      buttons[1].onPress();
    });

    expect(matchService.submitMatchScore).toHaveBeenCalledWith('test-match', 3, 2);
    alertSpy.mockRestore();
  });
});

// Zaključena tekma 

describe('PremiumMatchPanel — zaključena tekma', () => {
  it('prikaže končni rezultat in zmagovalca', async () => {
    const { getByText } = await renderPanel(
      makeMatch({ finalized: true, scoreA: 2, scoreB: 1, result: 'team_a_won' })
    );

    expect(getByText('Končni rezultat')).toBeTruthy();
    expect(getByText('2 - 1')).toBeTruthy();
    expect(getByText('Zmaga Ekipe A')).toBeTruthy();
  });

  it('neodločen izid označi kot tak', async () => {
    const { getByText } = await renderPanel(
      makeMatch({ finalized: true, scoreA: 1, scoreB: 1, result: 'draw' })
    );

    expect(getByText('Neodločeno')).toBeTruthy();
  });

  it('pri spornem rezultatu pojasni, da je odločala večina', async () => {
    const { getByText } = await renderPanel(
      makeMatch({
        finalized: true,
        scoreA: 2,
        scoreB: 1,
        result: 'team_a_won',
        scoreDisputed: true,
      })
    );

    expect(
      getByText('Kapetana se nista strinjala — veljal je rezultat večine igralcev.')
    ).toBeTruthy();
  });

  it('po zaključku ne ponuja več prijave prisotnosti', async () => {
    const { queryByText } = await renderPanel(
      makeMatch({ finalized: true, result: 'draw' })
    );

    expect(queryByText('SEM TUKAJ')).toBeNull();
  });
});

// Ekipi in izravnava 

describe('PremiumMatchPanel — ekipi', () => {
  it('prikaže obe ekipi s številom igralcev', async () => {
    const { getByText } = await renderPanel(makeMatch());

    expect(getByText('Ekipa A · 1')).toBeTruthy();
    expect(getByText('Ekipa B · 1')).toBeTruthy();
  });

  it('prazno ekipo označi z besedilom', async () => {
    const { getByText } = await renderPanel(
      makeMatch({ teamA: ['user1'], teamB: [] })
    );

    expect(getByText('Ni igralcev')).toBeTruthy();
  });

  it('ustvarjalcu ponudi samodejno izravnavo ekip', async () => {
    const { getByText } = await renderPanel(makeMatch(), 'user1');
    expect(getByText('Avtomatsko izravnaj ekipi')).toBeTruthy();
  });

  it('navadnemu igralcu izravnave ne ponuja', async () => {
    const { queryByText } = await renderPanel(makeMatch(), 'user2');
    expect(queryByText('Avtomatsko izravnaj ekipi')).toBeNull();
  });

  it('po potrditvi pokliče regenerateTeams', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = await renderPanel(makeMatch(), 'user1');

    fireEvent.press(getByText('Avtomatsko izravnaj ekipi'));

    const buttons = alertSpy.mock.calls[0][2] as any[];
    await act(async () => {
      buttons[1].onPress();
    });

    expect(matchService.regenerateTeams).toHaveBeenCalledWith('test-match', 'user1');
    alertSpy.mockRestore();
  });

  it('po začetku tekme izravnava ni več mogoča', async () => {
    const { queryByText } = await renderPanel(
      makeMatch({ matchStarted: true, scorePhase: 'none' }),
      'user1'
    );

    expect(queryByText('Avtomatsko izravnaj ekipi')).toBeNull();
  });
});
