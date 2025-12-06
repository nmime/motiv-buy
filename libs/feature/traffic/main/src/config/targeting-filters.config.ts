/**
 * Targeting Filters Configuration
 *
 * Centralized configuration for available targeting filters.
 * These filters are used by traffic sources to target specific audiences.
 *
 * NOTE: Move to database for dynamic management via admin panel
 */

interface AgeRange {
  label: string;
  min: number;
  max: number;
}

interface Country {
  code: string;
  name: string;
}

interface Language {
  code: string;
  name: string;
}

export const targetingFilters = {
  genders: ['male', 'female'] as const,

  ageRanges: [
    { label: '13-17', min: 13, max: 17 },
    { label: '18-24', min: 18, max: 24 },
    { label: '25-34', min: 25, max: 34 },
    { label: '35-44', min: 35, max: 44 },
    { label: '45-54', min: 45, max: 54 },
    { label: '55+', min: 55, max: 100 },
  ] as AgeRange[],

  countries: [
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'CA', name: 'Canada' },
    { code: 'AU', name: 'Australia' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'RU', name: 'Russia' },
    { code: 'UA', name: 'Ukraine' },
    { code: 'BR', name: 'Brazil' },
    { code: 'IN', name: 'India' },
    { code: 'CN', name: 'China' },
    { code: 'JP', name: 'Japan' },
    { code: 'KR', name: 'South Korea' },
    { code: 'MX', name: 'Mexico' },
    { code: 'AR', name: 'Argentina' },
    { code: 'ES', name: 'Spain' },
    { code: 'IT', name: 'Italy' },
    { code: 'PL', name: 'Poland' },
    { code: 'TR', name: 'Turkey' },
    { code: 'NL', name: 'Netherlands' },
  ] as Country[],

  languages: [
    { code: 'en', name: 'English' },
    { code: 'ru', name: 'Russian' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'es', name: 'Spanish' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'de', name: 'German' },
    { code: 'fr', name: 'French' },
    { code: 'it', name: 'Italian' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' },
    { code: 'tr', name: 'Turkish' },
    { code: 'nl', name: 'Dutch' },
    { code: 'pl', name: 'Polish' },
  ] as Language[],
} as const;
