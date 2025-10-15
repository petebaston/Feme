/**
 * Currency formatting utility using BigCommerce money object
 */

export interface MoneyFormat {
  currency_location: 'left' | 'right';
  currency_token: string;
  decimal_token: string;
  decimal_places: number;
  thousands_token: string;
}

/**
 * Format a number as currency using BigCommerce money format
 */
export function formatCurrency(amount: number | string, money?: MoneyFormat): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return '0.00';
  }

  // Default to GBP if no money object provided
  const format: MoneyFormat = money || {
    currency_location: 'left',
    currency_token: '£',
    decimal_token: '.',
    decimal_places: 2,
    thousands_token: ',',
  };

  // Format the number with thousands separator and decimal places
  const parts = numAmount.toFixed(format.decimal_places).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, format.thousands_token);
  const formattedNumber = parts.join(format.decimal_token);

  // Add currency symbol based on location
  if (format.currency_location === 'right') {
    return `${formattedNumber}${format.currency_token}`;
  }
  return `${format.currency_token}${formattedNumber}`;
}

/**
 * Get currency symbol from money object
 */
export function getCurrencySymbol(money?: MoneyFormat): string {
  return money?.currency_token || '£';
}
