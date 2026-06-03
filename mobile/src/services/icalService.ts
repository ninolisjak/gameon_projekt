import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function toICalDate(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

export async function exportToIcal(event: {
  title: string;
  description: string;
  location: string;
  startDate: Date;
  endDate: Date;
}): Promise<void> {
  const uid = `gameon-${Date.now()}@gameon.app`;
  const now = toICalDate(new Date());

  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GameOn//GameOn App//SL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toICalDate(event.startDate)}`,
    `DTEND:${toICalDate(event.endDate)}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
    `LOCATION:${event.location}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const fileUri = `${FileSystem.cacheDirectory}gameon-rezervacija.ics`;
  await FileSystem.writeAsStringAsync(fileUri, ical, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Deljenje ni na voljo na tej napravi.');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/calendar',
    dialogTitle: 'Dodaj v koledar',
    UTI: 'public.calendar-event',
  });
}
