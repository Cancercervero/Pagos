// ═══════════════════════════════════════════════════════════════
// MICHINGON - SISTEMA DE LOCALIZACIÓN
// Países, monedas, idiomas y configuración fiscal
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// MONEDAS
// ─────────────────────────────────────────────────────────────────

export interface Currency {
    code: string;               // 'MXN', 'USD', 'EUR'
    name: string;               // 'Peso Mexicano'
    symbol: string;             // '$', '€'
    symbolPosition: 'before' | 'after';
    decimals: number;
    thousandsSeparator: string; // ',' o '.'
    decimalSeparator: string;   // '.' o ','
}

export const CURRENCIES: Record<string, Currency> = {
    MXN: {
        code: 'MXN',
        name: 'Peso Mexicano',
        symbol: '$',
        symbolPosition: 'before',
        decimals: 2,
        thousandsSeparator: ',',
        decimalSeparator: '.'
    },
    USD: {
        code: 'USD',
        name: 'Dólar Estadounidense',
        symbol: '$',
        symbolPosition: 'before',
        decimals: 2,
        thousandsSeparator: ',',
        decimalSeparator: '.'
    },
    EUR: {
        code: 'EUR',
        name: 'Euro',
        symbol: '€',
        symbolPosition: 'after',
        decimals: 2,
        thousandsSeparator: '.',
        decimalSeparator: ','
    },
    COP: {
        code: 'COP',
        name: 'Peso Colombiano',
        symbol: '$',
        symbolPosition: 'before',
        decimals: 0,
        thousandsSeparator: '.',
        decimalSeparator: ','
    },
    ARS: {
        code: 'ARS',
        name: 'Peso Argentino',
        symbol: '$',
        symbolPosition: 'before',
        decimals: 2,
        thousandsSeparator: '.',
        decimalSeparator: ','
    }
};

// ─────────────────────────────────────────────────────────────────
// IDIOMAS
// ─────────────────────────────────────────────────────────────────

export type SupportedLanguage = 'es' | 'en';

export interface Language {
    code: SupportedLanguage;
    name: string;
    nativeName: string;
}

export const LANGUAGES: Record<SupportedLanguage, Language> = {
    es: {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español'
    },
    en: {
        code: 'en',
        name: 'English',
        nativeName: 'English'
    }
};

// ─────────────────────────────────────────────────────────────────
// PAÍSES
// ─────────────────────────────────────────────────────────────────

export type CountryCode = 'MX' | 'US' | 'ES' | 'CO' | 'AR';

export interface Country {
    code: CountryCode;
    name: string;
    flag: string;                   // Emoji de bandera
    currencyCode: string;           // Código de moneda por defecto
    defaultLanguage: SupportedLanguage;
    hasTaxConfig: boolean;          // Si requiere configuración fiscal especial
    taxConfigType?: 'SAT';          // Tipo de configuración fiscal
    timezone: string;               // Zona horaria por defecto
    phoneCode: string;              // Código telefónico
}

export const COUNTRIES: Record<CountryCode, Country> = {
    MX: {
        code: 'MX',
        name: 'México',
        flag: '🇲🇽',
        currencyCode: 'MXN',
        defaultLanguage: 'es',
        hasTaxConfig: true,
        taxConfigType: 'SAT',
        timezone: 'America/Mexico_City',
        phoneCode: '+52'
    },
    US: {
        code: 'US',
        name: 'Estados Unidos',
        flag: '🇺🇸',
        currencyCode: 'USD',
        defaultLanguage: 'en',
        hasTaxConfig: false,
        timezone: 'America/New_York',
        phoneCode: '+1'
    },
    ES: {
        code: 'ES',
        name: 'España',
        flag: '🇪🇸',
        currencyCode: 'EUR',
        defaultLanguage: 'es',
        hasTaxConfig: false,
        timezone: 'Europe/Madrid',
        phoneCode: '+34'
    },
    CO: {
        code: 'CO',
        name: 'Colombia',
        flag: '🇨🇴',
        currencyCode: 'COP',
        defaultLanguage: 'es',
        hasTaxConfig: false,
        timezone: 'America/Bogota',
        phoneCode: '+57'
    },
    AR: {
        code: 'AR',
        name: 'Argentina',
        flag: '🇦🇷',
        currencyCode: 'ARS',
        defaultLanguage: 'es',
        hasTaxConfig: false,
        timezone: 'America/Argentina/Buenos_Aires',
        phoneCode: '+54'
    }
};

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Formatea un número como moneda según la configuración
 */
export function formatCurrency(amount: number, currencyCode: string): string {
    const currency = CURRENCIES[currencyCode] || CURRENCIES.MXN;

    const formattedNumber = amount
        .toFixed(currency.decimals)
        .replace(/\B(?=(\d{3})+(?!\d))/g, currency.thousandsSeparator)
        .replace('.', currency.decimalSeparator);

    return currency.symbolPosition === 'before'
        ? `${currency.symbol}${formattedNumber}`
        : `${formattedNumber}${currency.symbol}`;
}

/**
 * Obtiene la configuración de país por código
 */
export function getCountry(code: CountryCode): Country | undefined {
    return COUNTRIES[code];
}

/**
 * Obtiene la moneda por código
 */
export function getCurrency(code: string): Currency | undefined {
    return CURRENCIES[code];
}

/**
 * Verifica si un país requiere configuración del SAT
 */
export function requiresSATConfig(countryCode: CountryCode): boolean {
    const country = COUNTRIES[countryCode];
    return country?.hasTaxConfig && country?.taxConfigType === 'SAT';
}

/**
 * Obtiene todos los países como array para selectores
 */
export function getCountriesArray(): Country[] {
    return Object.values(COUNTRIES);
}

/**
 * Obtiene todas las monedas como array para selectores
 */
export function getCurrenciesArray(): Currency[] {
    return Object.values(CURRENCIES);
}

/**
 * Obtiene todos los idiomas como array para selectores
 */
export function getLanguagesArray(): Language[] {
    return Object.values(LANGUAGES);
}
