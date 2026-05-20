/**
 * Egyptian Number, Currency, and Phone Formatters
 * Used across both server and client for consistent formatting
 */

// === Currency Formatting ===

export function formatEGP(amount: number | null | undefined, locale: 'en' | 'ar' = 'en'): string {
  if (amount == null || isNaN(amount)) return locale === 'ar' ? 'غير متاح' : 'N/A';
  
  if (locale === 'ar') {
    return new Intl.NumberFormat('ar-EG', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 0,
    }).format(amount);
  }
  
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPriceShort(price: number | null | undefined, locale: 'en' | 'ar' = 'en'): string {
  if (price == null || isNaN(price)) return locale === 'ar' ? 'غير متاح' : 'N/A';
  
  if (price >= 1_000_000) {
    const val = (price / 1_000_000).toFixed(1).replace(/\.0$/, '');
    return locale === 'ar' ? `${val} مليون ج.م` : `${val}M EGP`;
  }
  if (price >= 1_000) {
    const val = Math.round(price / 1_000);
    return locale === 'ar' ? `${val} ألف ج.م` : `${val}K EGP`;
  }
  return locale === 'ar' ? `${price} ج.م` : `${price} EGP`;
}

// === Phone Formatting ===

export function formatPhoneEG(phone: string | null | undefined): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  
  // Handle +20 prefix
  const match = cleaned.match(/^(?:0{0,2}20)?(\d{10})$/);
  if (match) {
    const number = match[1];
    return `+20 ${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(6)}`;
  }
  
  // Handle local 01x format
  const localMatch = cleaned.match(/^(0\d{10})$/);
  if (localMatch) {
    const number = localMatch[1];
    return `+20 ${number.slice(1, 4)} ${number.slice(4, 7)} ${number.slice(7)}`;
  }
  
  return phone; // Return original if no match
}

export function formatWhatsAppLink(phone: string | null | undefined): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  
  // Ensure it starts with country code
  if (cleaned.startsWith('0')) {
    return `https://wa.me/20${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith('20')) {
    return `https://wa.me/${cleaned}`;
  }
  return `https://wa.me/${cleaned}`;
}

// === Percentage Formatting ===

export function formatPercentage(value: number | null | undefined, decimals: number = 1): string {
  if (value == null || isNaN(value)) return 'N/A';
  return `${Math.min(100, Math.max(0, value)).toFixed(decimals)}%`;
}

export function formatMatchScore(score: number | null | undefined): string {
  if (score == null || isNaN(score)) return 'N/A';
  return `${Math.min(100, Math.max(0, score)).toFixed(1)}%`;
}

// === Number Formatting ===

export function formatNumber(value: number | null | undefined, locale: 'en' | 'ar' = 'en'): string {
  if (value == null || isNaN(value)) return locale === 'ar' ? '٠' : '0';
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US').format(value);
}

export function formatArea(sqm: number | null | undefined, locale: 'en' | 'ar' = 'en'): string {
  if (sqm == null || isNaN(sqm)) return locale === 'ar' ? 'غير متاح' : 'N/A';
  return locale === 'ar' ? `${sqm} م²` : `${sqm} m²`;
}

// === Date Formatting ===

export function formatDateEG(date: Date | string | number | null | undefined, locale: 'en' | 'ar' = 'en'): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatRelativeTime(date: Date | string | number | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const now = Date.now();
  const diff = now - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDateEG(date, 'en');
}

// === Market Temperature ===

export type MarketTemperature = 'hot' | 'warm' | 'cool' | 'cold';

export function calculateMarketTemperature(demandCount: number, supplyCount: number): MarketTemperature {
  if (supplyCount === 0) return demandCount > 0 ? 'hot' : 'cool';
  const ratio = demandCount / supplyCount;
  
  if (ratio > 2) return 'hot';
  if (ratio > 1.5) return 'warm';
  if (ratio < 0.5) return 'cold';
  return 'cool';
}

export function getTemperatureColor(temp: MarketTemperature): string {
  switch (temp) {
    case 'hot': return '#ef4444';
    case 'warm': return '#f59e0b';
    case 'cool': return '#3b82f6';
    case 'cold': return '#6b7280';
  }
}

export function getTemperatureLabel(temp: MarketTemperature, locale: 'en' | 'ar' = 'en'): string {
  const labels = {
    hot: { en: 'Hot Market', ar: 'سوق ساخن' },
    warm: { en: 'Warm Market', ar: 'سوق دافئ' },
    cool: { en: 'Balanced', ar: 'متوازن' },
    cold: { en: 'Cold Market', ar: 'سوق بارد' },
  };
  return labels[temp][locale];
}

export function getTemperatureEmoji(temp: MarketTemperature): string {
  switch (temp) {
    case 'hot': return '🔥';
    case 'warm': return '☀️';
    case 'cool': return '⚖️';
    case 'cold': return '❄️';
  }
}
