import React, { useCallback, useEffect, useState } from 'react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Compass,
  Droplets,
  Gauge,
  MapPin,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Sun,
  Sunrise,
  Sunset,
  Thermometer,
  Trash2,
  Wind,
} from 'lucide-react';
import { AuthUser } from '../types/warehouse';

interface SavedCity {
  id: string;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

interface WeatherForecastData {
  timezone: string;
  current: {
    temperature: number;
    apparentTemperature: number;
    humidity: number;
    windSpeed: number;
    windDirection: number;
    pressure: number;
    weatherCode: number;
    isDay: boolean;
    precipitation: number;
  };
  hourly: Array<{
    time: string;
    temperature: number;
    weatherCode: number;
    precipProb: number;
    isDay: boolean;
  }>;
  daily: Array<{
    date: string;
    weatherCode: number;
    tempMax: number;
    tempMin: number;
    precipProbMax: number;
    uvMax: number;
    sunrise: string;
    sunset: string;
  }>;
  fetchedAt: string;
}

const DEFAULT_CITIES: SavedCity[] = [
  { id: 'milano', name: 'Milano', admin1: 'Lombardia', country: 'Italia', latitude: 45.4642, longitude: 9.19 },
  { id: 'roma', name: 'Roma', admin1: 'Lazio', country: 'Italia', latitude: 41.9028, longitude: 12.4964 },
  { id: 'torino', name: 'Torino', admin1: 'Piemonte', country: 'Italia', latitude: 45.0703, longitude: 7.6869 },
  { id: 'bologna', name: 'Bologna', admin1: 'Emilia-Romagna', country: 'Italia', latitude: 44.4949, longitude: 11.3426 },
];

function getWmoMeta(code: number, isDay: boolean): {
  label: string;
  gradient: string;
  icon: React.ComponentType<{ className?: string }>;
} {
  if (code === 0) {
    return {
      label: isDay ? 'Sereno' : 'Notte serena',
      gradient: isDay
        ? 'from-sky-500 via-blue-600 to-indigo-700'
        : 'from-slate-900 via-indigo-950 to-slate-950',
      icon: isDay ? Sun : Moon,
    };
  }
  if (code === 1 || code === 2) {
    return {
      label: code === 1 ? 'Prevalentemente sereno' : 'Parzialmente nuvoloso',
      gradient: isDay
        ? 'from-sky-600 via-blue-700 to-slate-800'
        : 'from-slate-800 via-indigo-950 to-slate-950',
      icon: isDay ? CloudSun : Cloud,
    };
  }
  if (code === 3) {
    return {
      label: 'Coperto',
      gradient: 'from-slate-600 via-slate-700 to-slate-900',
      icon: Cloud,
    };
  }
  if (code === 45 || code === 48) {
    return {
      label: 'Nebbia',
      gradient: 'from-slate-500 via-slate-600 to-slate-800',
      icon: CloudFog,
    };
  }
  if (code >= 51 && code <= 57) {
    return {
      label: 'Pioviggine',
      gradient: 'from-slate-700 via-blue-800 to-slate-900',
      icon: CloudDrizzle,
    };
  }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return {
      label: code >= 65 || code === 82 ? 'Pioggia forte' : 'Pioggia',
      gradient: 'from-blue-800 via-indigo-900 to-slate-950',
      icon: CloudRain,
    };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return {
      label: 'Neve',
      gradient: 'from-cyan-700 via-sky-800 to-slate-900',
      icon: CloudSnow,
    };
  }
  if (code >= 95) {
    return {
      label: 'Temporale',
      gradient: 'from-slate-800 via-violet-950 to-slate-950',
      icon: CloudLightning,
    };
  }
  return {
    label: 'Variabile',
    gradient: 'from-sky-600 via-indigo-700 to-slate-900',
    icon: Cloud,
  };
}

function windCardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

function formatDayName(isoDate: string, idx: number): string {
  if (idx === 0) return 'Oggi';
  if (idx === 1) return 'Domani';
  try {
    const d = new Date(`${isoDate}T12:00:00`);
    const s = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return isoDate;
  }
}

interface WeatherAppProps {
  currentUser: AuthUser;
}

export const WeatherApp: React.FC<WeatherAppProps> = ({ currentUser }) => {
  const storageKey = `caricostudio_weather_cities_${currentUser.id}`;

  const [savedCities, setSavedCities] = useState<SavedCity[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_CITIES;
  });

  const [activeCity, setActiveCity] = useState<SavedCity>(
    () => savedCities[0] || DEFAULT_CITIES[0]
  );
  const [unit, setUnit] = useState<'C' | 'F'>('C');
  const [forecast, setForecast] = useState<WeatherForecastData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // City search
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<SavedCity[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const persistCities = useCallback(
    (next: SavedCity[]) => {
      setSavedCities(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
    },
    [storageKey]
  );

  const formatTemp = (c: number) => {
    const val = unit === 'C' ? c : (c * 9) / 5 + 32;
    return `${Math.round(val)}°`;
  };

  const fetchForecastForCity = useCallback(async (city: SavedCity) => {
    setIsLoading(true);
    setError(null);
    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', String(city.latitude));
      url.searchParams.set('longitude', String(city.longitude));
      url.searchParams.set(
        'current',
        'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m'
      );
      url.searchParams.set(
        'hourly',
        'temperature_2m,precipitation_probability,weather_code,is_day'
      );
      url.searchParams.set(
        'daily',
        'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max'
      );
      url.searchParams.set('timezone', 'auto');
      url.searchParams.set('forecast_days', '7');

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Servizio meteo temporaneamente non raggiungibile');
      const data = await res.json();

      const cur = data.current || {};
      const hourlyTimes: string[] = data.hourly?.time || [];
      const currentIsoPrefix = String(cur.time || '').slice(0, 13);
      let startIdx = hourlyTimes.findIndex((t) => t.startsWith(currentIsoPrefix));
      if (startIdx < 0) startIdx = 0;

      const hourly = hourlyTimes.slice(startIdx, startIdx + 24).map((t, i) => {
        const idx = startIdx + i;
        return {
          time: t,
          temperature: Number(data.hourly?.temperature_2m?.[idx] ?? 0),
          weatherCode: Number(data.hourly?.weather_code?.[idx] ?? 0),
          precipProb: Number(data.hourly?.precipitation_probability?.[idx] ?? 0),
          isDay: Number(data.hourly?.is_day?.[idx] ?? 1) === 1,
        };
      });

      const dailyDates: string[] = data.daily?.time || [];
      const daily = dailyDates.map((d, i) => ({
        date: d,
        weatherCode: Number(data.daily?.weather_code?.[i] ?? 0),
        tempMax: Number(data.daily?.temperature_2m_max?.[i] ?? 0),
        tempMin: Number(data.daily?.temperature_2m_min?.[i] ?? 0),
        precipProbMax: Number(data.daily?.precipitation_probability_max?.[i] ?? 0),
        uvMax: Number(data.daily?.uv_index_max?.[i] ?? 0),
        sunrise: String(data.daily?.sunrise?.[i] || ''),
        sunset: String(data.daily?.sunset?.[i] || ''),
      }));

      setForecast({
        timezone: String(data.timezone || 'Europe/Rome'),
        current: {
          temperature: Number(cur.temperature_2m ?? 0),
          apparentTemperature: Number(cur.apparent_temperature ?? cur.temperature_2m ?? 0),
          humidity: Number(cur.relative_humidity_2m ?? 0),
          windSpeed: Number(cur.wind_speed_10m ?? 0),
          windDirection: Number(cur.wind_direction_10m ?? 0),
          pressure: Number(cur.pressure_msl ?? 1013),
          weatherCode: Number(cur.weather_code ?? 0),
          isDay: Number(cur.is_day ?? 1) === 1,
          precipitation: Number(cur.precipitation ?? 0),
        },
        hourly,
        daily,
        fetchedAt: new Date().toLocaleTimeString('it-IT', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
    } catch (err: any) {
      setError(
        err?.message || 'Impossibile recuperare i dati meteo. Verifica la connessione internet.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForecastForCity(activeCity);
  }, [activeCity, fetchForecastForCity]);

  const handleSearchCity = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchText.trim();
    if (q.length < 2) return;
    setIsSearching(true);
    setError(null);
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        q
      )}&count=6&language=it&format=json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Ricerca città non riuscita');
      const data = await res.json();
      const hits: SavedCity[] = (data.results || []).map((r: any) => ({
        id: `${r.id || `${r.latitude}_${r.longitude}`}`,
        name: String(r.name || q),
        admin1: r.admin1 ? String(r.admin1) : undefined,
        country: r.country ? String(r.country) : undefined,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
      }));
      setSearchResults(hits);
      if (hits.length === 0) {
        setError(`Nessuna località trovata per "${q}".`);
      }
    } catch {
      setError('Errore durante la ricerca della località.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (city: SavedCity) => {
    setActiveCity(city);
    setSearchResults([]);
    setSearchText('');
    if (!savedCities.some((c) => c.id === city.id || (c.name === city.name && c.country === city.country))) {
      persistCities([city, ...savedCities].slice(0, 10));
    }
  };

  const handleRemoveCity = (cityId: string) => {
    if (savedCities.length <= 1) return;
    const next = savedCities.filter((c) => c.id !== cityId);
    persistCities(next);
    if (activeCity.id === cityId) {
      setActiveCity(next[0]);
    }
  };

  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      setError('Geolocalizzazione non supportata da questo browser.');
      return;
    }
    setGpsLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const gpsCity: SavedCity = {
          id: `gps_${pos.coords.latitude.toFixed(2)}_${pos.coords.longitude.toFixed(2)}`,
          name: 'La mia posizione',
          admin1: `${pos.coords.latitude.toFixed(2)}°N, ${pos.coords.longitude.toFixed(2)}°E`,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setActiveCity(gpsCity);
        setGpsLoading(false);
      },
      () => {
        setError('Permesso posizione negato o non disponibile. Cerca una città manualmente.');
        setGpsLoading(false);
      },
      { timeout: 8000 }
    );
  };

  const curMeta = forecast
    ? getWmoMeta(forecast.current.weatherCode, forecast.current.isDay)
    : getWmoMeta(0, true);
  const CurIcon = curMeta.icon;

  const weekMin = forecast
    ? Math.min(...forecast.daily.map((d) => d.tempMin))
    : 0;
  const weekMax = forecast
    ? Math.max(...forecast.daily.map((d) => d.tempMax))
    : 30;
  const weekSpan = Math.max(1, weekMax - weekMin);

  return (
    <div className="h-full flex flex-col bg-slate-950 text-white overflow-hidden">
      {/* Top Search & Saved Cities Bar */}
      <div className="bg-[#0d101c] border-b border-white/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <form onSubmit={handleSearchCity} className="relative flex items-center gap-2 flex-1 min-w-[230px] max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-white/45 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Cerca città (es. Verona, Napoli, Berlino)..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white/[0.07] border border-white/15 rounded-xl text-white placeholder:text-white/45 focus:outline-none focus:border-sky-400"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold cursor-pointer transition-colors shrink-0"
          >
            {isSearching ? '...' : 'Cerca'}
          </button>

          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-xl bg-[#111526] border border-white/15 shadow-2xl overflow-hidden">
              {searchResults.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  onClick={() => handleSelectSearchResult(hit)}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-white/[0.08] flex items-center justify-between gap-2 text-xs border-b border-white/5 last:border-b-0 cursor-pointer"
                >
                  <span className="font-semibold text-white">
                    {hit.name}
                    {hit.admin1 ? `, ${hit.admin1}` : ''}
                    {hit.country ? ` (${hit.country})` : ''}
                  </span>
                  <Plus className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </form>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDetectGps}
            disabled={gpsLoading}
            className="px-3 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] border border-white/10 text-xs font-semibold text-white/90 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <MapPin className="w-3.5 h-3.5 text-sky-400" />
            <span>{gpsLoading ? 'Rilevo...' : 'Posizione GPS'}</span>
          </button>

          <div className="flex rounded-xl bg-white/[0.07] border border-white/10 p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setUnit('C')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                unit === 'C' ? 'bg-sky-500 text-slate-950' : 'text-white/65 hover:text-white'
              }`}
            >
              °C
            </button>
            <button
              type="button"
              onClick={() => setUnit('F')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                unit === 'F' ? 'bg-sky-500 text-slate-950' : 'text-white/65 hover:text-white'
              }`}
            >
              °F
            </button>
          </div>

          <button
            type="button"
            onClick={() => fetchForecastForCity(activeCity)}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] border border-white/10 text-white/80 hover:text-white cursor-pointer"
            title="Aggiorna meteo"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Saved Cities Strip */}
      <div className="bg-[#0a0d17] border-b border-white/[0.07] px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
        {savedCities.map((c) => {
          const selected = c.id === activeCity.id;
          return (
            <div
              key={c.id}
              className={`flex items-center gap-1 rounded-xl border text-xs transition-colors shrink-0 ${
                selected
                  ? 'bg-sky-500/20 border-sky-400/50 text-white font-bold'
                  : 'bg-white/[0.04] border-white/10 text-white/70 hover:bg-white/[0.09]'
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveCity(c)}
                className="px-3 py-1.5 cursor-pointer flex items-center gap-1.5"
              >
                <MapPin className="w-3 h-3 text-sky-400" />
                <span>{c.name}</span>
              </button>
              {savedCities.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveCity(c.id)}
                  className="pr-2 pl-0.5 py-1.5 text-white/40 hover:text-rose-400 cursor-pointer"
                  title="Rimuovi città"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-5xl mx-auto space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/35 text-amber-200 text-xs flex items-center justify-between gap-3">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => fetchForecastForCity(activeCity)}
                className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-bold cursor-pointer shrink-0"
              >
                Riprova
              </button>
            </div>
          )}

          {/* Hero Current Conditions */}
          <div
            className={`rounded-3xl bg-gradient-to-br ${curMeta.gradient} p-6 sm:p-7 border border-white/15 shadow-2xl relative overflow-hidden`}
          >
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>
                    {activeCity.name}
                    {activeCity.admin1 ? ` · ${activeCity.admin1}` : ''}
                    {activeCity.country ? `, ${activeCity.country}` : ''}
                  </span>
                </div>
                <div className="mt-3 flex items-end gap-4">
                  <div className="text-6xl sm:text-7xl font-black tracking-tight tabular-nums leading-none">
                    {forecast ? formatTemp(forecast.current.temperature) : '—°'}
                  </div>
                  <div className="pb-1.5">
                    <div className="text-lg font-bold">{curMeta.label}</div>
                    {forecast?.daily[0] && (
                      <div className="text-xs text-white/80 font-mono tabular-nums mt-0.5">
                        Max {formatTemp(forecast.daily[0].tempMax)} · Min{' '}
                        {formatTemp(forecast.daily[0].tempMin)} · Percepita{' '}
                        {formatTemp(forecast.current.apparentTemperature)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="w-20 h-20 rounded-3xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
                  <CurIcon className="w-11 h-11 text-white" />
                </div>
                {forecast && (
                  <span className="text-[11px] font-mono text-white/75">
                    Aggiornato alle {forecast.fetchedAt}
                  </span>
                )}
              </div>
            </div>

            {/* Key Live Metrics Grid */}
            {forecast && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-6 pt-5 border-t border-white/15">
                <div className="rounded-2xl bg-black/20 backdrop-blur-xs p-3 border border-white/10">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70 flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-sky-300" /> Umidità
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums mt-1">
                    {forecast.current.humidity}%
                  </div>
                </div>
                <div className="rounded-2xl bg-black/20 backdrop-blur-xs p-3 border border-white/10">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70 flex items-center gap-1">
                    <Wind className="w-3 h-3 text-cyan-300" /> Vento
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums mt-1">
                    {Math.round(forecast.current.windSpeed)} <span className="text-xs">km/h</span>
                  </div>
                  <div className="text-[10px] text-white/65 flex items-center gap-1">
                    <Compass className="w-2.5 h-2.5" /> {windCardinal(forecast.current.windDirection)}
                  </div>
                </div>
                <div className="rounded-2xl bg-black/20 backdrop-blur-xs p-3 border border-white/10">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70 flex items-center gap-1">
                    <CloudRain className="w-3 h-3 text-blue-300" /> Pioggia
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums mt-1">
                    {forecast.daily[0]?.precipProbMax ?? 0}%
                  </div>
                  <div className="text-[10px] text-white/65">
                    {forecast.current.precipitation.toFixed(1)} mm ora
                  </div>
                </div>
                <div className="rounded-2xl bg-black/20 backdrop-blur-xs p-3 border border-white/10">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70 flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-indigo-300" /> Pressione
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums mt-1">
                    {Math.round(forecast.current.pressure)}
                  </div>
                  <div className="text-[10px] text-white/65">hPa</div>
                </div>
                <div className="rounded-2xl bg-black/20 backdrop-blur-xs p-3 border border-white/10">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70 flex items-center gap-1">
                    <Thermometer className="w-3 h-3 text-amber-300" /> Indice UV
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums mt-1">
                    {forecast.daily[0]?.uvMax?.toFixed(1) ?? '0.0'}
                  </div>
                  <div className="text-[10px] text-white/65">
                    {(forecast.daily[0]?.uvMax ?? 0) >= 6
                      ? 'Alto'
                      : (forecast.daily[0]?.uvMax ?? 0) >= 3
                      ? 'Moderato'
                      : 'Basso'}
                  </div>
                </div>
                <div className="rounded-2xl bg-black/20 backdrop-blur-xs p-3 border border-white/10">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70 flex items-center gap-1">
                    <Sunrise className="w-3 h-3 text-amber-300" /> Alba / Tram.
                  </div>
                  <div className="text-xs font-bold font-mono tabular-nums mt-1.5 flex items-center gap-1">
                    <Sunrise className="w-3 h-3 text-amber-300" />
                    {forecast.daily[0]?.sunrise?.slice(11, 16) || '—'}
                  </div>
                  <div className="text-xs font-bold font-mono tabular-nums mt-0.5 flex items-center gap-1 text-white/80">
                    <Sunset className="w-3 h-3 text-orange-300" />
                    {forecast.daily[0]?.sunset?.slice(11, 16) || '—'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 24h Hourly Forecast */}
          {forecast && forecast.hourly.length > 0 && (
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-white/60 mb-3">
                Previsioni Orarie (Prossime 24 ore)
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                {forecast.hourly.map((h, i) => {
                  const meta = getWmoMeta(h.weatherCode, h.isDay);
                  const HIcon = meta.icon;
                  return (
                    <div
                      key={h.time}
                      className={`min-w-[74px] rounded-xl p-3 flex flex-col items-center gap-1.5 border shrink-0 ${
                        i === 0
                          ? 'bg-sky-500/20 border-sky-400/40'
                          : 'bg-white/[0.03] border-white/[0.07]'
                      }`}
                    >
                      <span className="text-[11px] font-mono text-white/70">
                        {i === 0 ? 'Ora' : h.time.slice(11, 16)}
                      </span>
                      <HIcon className="w-5 h-5 text-sky-300" />
                      <span className="text-sm font-bold font-mono tabular-nums">
                        {formatTemp(h.temperature)}
                      </span>
                      <span className="text-[10px] font-mono text-sky-300/80">
                        {h.precipProb > 0 ? `${h.precipProb}%` : '·'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 7-Day Forecast */}
          {forecast && forecast.daily.length > 0 && (
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-white/60 mb-3">
                Previsioni 7 Giorni
              </div>
              <div className="divide-y divide-white/[0.07]">
                {forecast.daily.map((d, idx) => {
                  const meta = getWmoMeta(d.weatherCode, true);
                  const DIcon = meta.icon;
                  const leftPct = ((d.tempMin - weekMin) / weekSpan) * 100;
                  const widthPct = Math.max(8, ((d.tempMax - d.tempMin) / weekSpan) * 100);
                  return (
                    <div
                      key={d.date}
                      className="py-3 grid grid-cols-12 items-center gap-2 text-xs"
                    >
                      <div className="col-span-3 sm:col-span-3 font-semibold text-white/95">
                        {formatDayName(d.date, idx)}
                      </div>
                      <div className="col-span-3 sm:col-span-3 flex items-center gap-2 text-white/75">
                        <DIcon className="w-4 h-4 text-sky-300 shrink-0" />
                        <span className="truncate hidden sm:inline">{meta.label}</span>
                        {d.precipProbMax >= 20 && (
                          <span className="text-[10px] font-mono text-sky-300">
                            {d.precipProbMax}%
                          </span>
                        )}
                      </div>
                      <div className="col-span-6 sm:col-span-6 flex items-center gap-2.5">
                        <span className="w-9 text-right font-mono text-white/60 tabular-nums">
                          {formatTemp(d.tempMin)}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-white/10 relative overflow-hidden">
                          <div
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                            }}
                            className="absolute inset-y-0 rounded-full bg-gradient-to-r from-sky-400 via-amber-300 to-orange-500"
                          />
                        </div>
                        <span className="w-9 font-mono font-bold text-white tabular-nums">
                          {formatTemp(d.tempMax)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
