export interface Country {
  /** ISO-3166 alpha-2 key */
  code: string;
  name: string;
  /** international dialling code, e.g. "+254" */
  dial: string;
  /** flag emoji, derived from the code */
  flag: string;
}

/** Build a flag emoji from a 2-letter ISO code via regional-indicator symbols. */
const flagFromCode = (code: string): string =>
  code
    .toUpperCase()
    .replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));

type RawCountry = Omit<Country, "flag">;

/** Curated dialling-code list, East Africa first, then the rest of the world. */
const RAW: RawCountry[] = [
  { code: "KE", name: "Kenya", dial: "+254" },
  { code: "UG", name: "Uganda", dial: "+256" },
  { code: "TZ", name: "Tanzania", dial: "+255" },
  { code: "RW", name: "Rwanda", dial: "+250" },
  { code: "ET", name: "Ethiopia", dial: "+251" },
  { code: "SO", name: "Somalia", dial: "+252" },
  { code: "SS", name: "South Sudan", dial: "+211" },
  { code: "CD", name: "DR Congo", dial: "+243" },
  { code: "NG", name: "Nigeria", dial: "+234" },
  { code: "GH", name: "Ghana", dial: "+233" },
  { code: "ZA", name: "South Africa", dial: "+27" },
  { code: "EG", name: "Egypt", dial: "+20" },
  { code: "MA", name: "Morocco", dial: "+212" },
  { code: "DZ", name: "Algeria", dial: "+213" },
  { code: "CM", name: "Cameroon", dial: "+237" },
  { code: "CI", name: "Côte d'Ivoire", dial: "+225" },
  { code: "SN", name: "Senegal", dial: "+221" },
  { code: "ZM", name: "Zambia", dial: "+260" },
  { code: "ZW", name: "Zimbabwe", dial: "+263" },
  { code: "AO", name: "Angola", dial: "+244" },
  { code: "US", name: "United States", dial: "+1" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "IE", name: "Ireland", dial: "+353" },
  { code: "DE", name: "Germany", dial: "+49" },
  { code: "FR", name: "France", dial: "+33" },
  { code: "IT", name: "Italy", dial: "+39" },
  { code: "ES", name: "Spain", dial: "+34" },
  { code: "PT", name: "Portugal", dial: "+351" },
  { code: "NL", name: "Netherlands", dial: "+31" },
  { code: "CH", name: "Switzerland", dial: "+41" },
  { code: "SE", name: "Sweden", dial: "+46" },
  { code: "NO", name: "Norway", dial: "+47" },
  { code: "PL", name: "Poland", dial: "+48" },
  { code: "UA", name: "Ukraine", dial: "+380" },
  { code: "TR", name: "Turkey", dial: "+90" },
  { code: "AE", name: "United Arab Emirates", dial: "+971" },
  { code: "SA", name: "Saudi Arabia", dial: "+966" },
  { code: "QA", name: "Qatar", dial: "+974" },
  { code: "IN", name: "India", dial: "+91" },
  { code: "PK", name: "Pakistan", dial: "+92" },
  { code: "BD", name: "Bangladesh", dial: "+880" },
  { code: "CN", name: "China", dial: "+86" },
  { code: "JP", name: "Japan", dial: "+81" },
  { code: "KR", name: "South Korea", dial: "+82" },
  { code: "SG", name: "Singapore", dial: "+65" },
  { code: "MY", name: "Malaysia", dial: "+60" },
  { code: "ID", name: "Indonesia", dial: "+62" },
  { code: "PH", name: "Philippines", dial: "+63" },
  { code: "VN", name: "Vietnam", dial: "+84" },
  { code: "AU", name: "Australia", dial: "+61" },
  { code: "NZ", name: "New Zealand", dial: "+64" },
  { code: "BR", name: "Brazil", dial: "+55" },
  { code: "MX", name: "Mexico", dial: "+52" },
  { code: "AR", name: "Argentina", dial: "+54" },
];

export const COUNTRIES: Country[] = RAW.map((c) => ({ ...c, flag: flagFromCode(c.code) }));

export const DEFAULT_COUNTRY = COUNTRIES[0];

export const findCountry = (code: string): Country =>
  COUNTRIES.find((c) => c.code === code) ?? DEFAULT_COUNTRY;

/** Lookup that stays `undefined` (instead of defaulting) so callers can chain
 *  fallbacks when detecting a visitor's country. */
export const getCountry = (code?: string | null): Country | undefined =>
  code ? COUNTRIES.find((c) => c.code === code.toUpperCase()) : undefined;

/* ------------------------- visitor location detection ------------------------- */

export interface CountryGuess {
  country: Country;
  /** true when the guess came from a real signal (IP cache / timezone / locale)
   *  rather than the East-Africa default fallback. */
  detected: boolean;
}

/**
 * IANA timezone → ISO-3166 alpha-2. A device timezone is the most reliable
 * *offline* signal of where a visitor physically is, so it takes priority over
 * the browser locale (which is frequently the OS default, e.g. en-US).
 */
const TZ_COUNTRY: Record<string, string> = {
  "Africa/Nairobi": "KE", "Africa/Kampala": "UG", "Africa/Dar_es_Salaam": "TZ",
  "Africa/Kigali": "RW", "Africa/Addis_Ababa": "ET", "Africa/Mogadishu": "SO",
  "Africa/Juba": "SS", "Africa/Kinshasa": "CD", "Africa/Lubumbashi": "CD",
  "Africa/Lagos": "NG", "Africa/Accra": "GH", "Africa/Johannesburg": "ZA",
  "Africa/Cairo": "EG", "Africa/Casablanca": "MA", "Africa/Algiers": "DZ",
  "Africa/Douala": "CM", "Africa/Abidjan": "CI", "Africa/Dakar": "SN",
  "Africa/Lusaka": "ZM", "Africa/Harare": "ZW", "Africa/Luanda": "AO",
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US",
  "America/Los_Angeles": "US", "America/Phoenix": "US", "America/Anchorage": "US",
  "Pacific/Honolulu": "US", "America/Toronto": "CA", "America/Vancouver": "CA",
  "America/Edmonton": "CA", "America/Winnipeg": "CA", "America/Halifax": "CA",
  "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Berlin": "DE",
  "Europe/Paris": "FR", "Europe/Rome": "IT", "Europe/Madrid": "ES",
  "Europe/Lisbon": "PT", "Europe/Amsterdam": "NL", "Europe/Zurich": "CH",
  "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Warsaw": "PL",
  "Europe/Kyiv": "UA", "Europe/Kiev": "UA", "Europe/Istanbul": "TR",
  "Asia/Dubai": "AE", "Asia/Riyadh": "SA", "Asia/Qatar": "QA",
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Karachi": "PK",
  "Asia/Dhaka": "BD", "Asia/Shanghai": "CN", "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR", "Asia/Singapore": "SG", "Asia/Kuala_Lumpur": "MY",
  "Asia/Jakarta": "ID", "Asia/Manila": "PH", "Asia/Ho_Chi_Minh": "VN",
  "Asia/Saigon": "VN", "Australia/Sydney": "AU", "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU", "Australia/Perth": "AU", "Australia/Adelaide": "AU",
  "Pacific/Auckland": "NZ", "America/Sao_Paulo": "BR", "America/Mexico_City": "MX",
  "America/Argentina/Buenos_Aires": "AR",
};

const CACHE_KEY = "lx_geo_country_v1";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h — an IP-derived country rarely moves

const readCache = (): string | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: string; at?: number };
    if (!parsed.code || !parsed.at || Date.now() - parsed.at > CACHE_TTL) return null;
    return parsed.code;
  } catch {
    return null;
  }
};

const writeCache = (code: string) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    /* storage unavailable (private mode) — detection still works per-request */
  }
};

/** Pull the ISO region subtag out of a BCP-47 tag ("sw-KE" → KE, "en" → none). */
const regionOf = (tag?: string): string | undefined => {
  if (!tag) return undefined;
  try {
    const region = new Intl.Locale(tag).region;
    if (region) return region.toUpperCase();
  } catch {
    /* fall through to manual parsing on older engines */
  }
  const parts = tag.split(/[-_]/);
  for (let i = parts.length - 1; i >= 1; i--) {
    if (/^[A-Za-z]{2}$/.test(parts[i])) return parts[i].toUpperCase();
  }
  return undefined;
};

const timezoneCountry = (): Country | undefined => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return getCountry(tz ? TZ_COUNTRY[tz] : undefined);
  } catch {
    return undefined;
  }
};

/**
 * Instant, offline first guess — runs synchronously the moment the registration
 * form mounts so the detected country is on screen immediately.
 * Order: cached IP result → device timezone → browser locale → default.
 */
export function detectCountrySync(): CountryGuess {
  const cached = getCountry(readCache());
  if (cached) return { country: cached, detected: true };

  const byTz = timezoneCountry();
  if (byTz) return { country: byTz, detected: true };

  const lang =
    typeof navigator !== "undefined" ? navigator.language ?? navigator.languages?.[0] : undefined;
  const byLocale = getCountry(regionOf(lang));
  if (byLocale) return { country: byLocale, detected: true };

  return { country: DEFAULT_COUNTRY, detected: false };
}

/**
 * Best-effort IP geolocation through a keyless lookup. Never throws and resolves
 * to `null` when it can't tell; the result is cached so later visits resolve
 * instantly and offline.
 */
export async function detectCountryFromIp(timeoutMs = 3500): Promise<CountryGuess | null> {
  const cached = getCountry(readCache());
  if (cached) return { country: cached, detected: true };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch("https://ipapi.co/json/", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { country_code?: string };
    const country = getCountry(data.country_code);
    if (!country) return null;
    writeCache(country.code);
    return { country, detected: true };
  } catch {
    return null;
  }
}
