export type WeatherData = {
  temperature: number;
  weatherCode: number;
  windSpeed: number;
  precipitation: number;
};

export function weatherDescription(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: 'Jasno', emoji: '☀️' };
  if (code <= 2) return { label: 'Delno oblačno', emoji: '⛅' };
  if (code === 3) return { label: 'Oblačno', emoji: '☁️' };
  if (code <= 49) return { label: 'Megla', emoji: '🌫️' };
  if (code <= 59) return { label: 'Rosenje', emoji: '🌦️' };
  if (code <= 69) return { label: 'Dež', emoji: '🌧️' };
  if (code <= 79) return { label: 'Sneg', emoji: '❄️' };
  if (code <= 82) return { label: 'Plohe', emoji: '🌧️' };
  if (code <= 86) return { label: 'Snežne plohe', emoji: '🌨️' };
  if (code <= 99) return { label: 'Nevihta', emoji: '⛈️' };
  return { label: 'Neznano', emoji: '🌡️' };
}

export async function fetchWeatherForDateTime(
  lat: number,
  lng: number,
  date: Date,
  hourHH: number,
): Promise<WeatherData | null> {
  try {
    const dateStr = date.toISOString().split('T')[0];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,weathercode,windspeed_10m,precipitation&start_date=${dateStr}&end_date=${dateStr}&timezone=Europe%2FBerlin`;

    const res = await fetch(url);
    const json = await res.json();

    const hours: number[] = json.hourly.time.map((t: string) => new Date(t).getHours());
    const idx = hours.indexOf(hourHH);
    if (idx === -1) return null;

    return {
      temperature: Math.round(json.hourly.temperature_2m[idx]),
      weatherCode: json.hourly.weathercode[idx],
      windSpeed: Math.round(json.hourly.windspeed_10m[idx]),
      precipitation: json.hourly.precipitation[idx],
    };
  } catch {
    return null;
  }
}
