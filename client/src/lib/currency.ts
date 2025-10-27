/**
 * Currency formatting utility using BigCommerce money object
 */

export interface MoneyFormat {
  currency_location?: 'left' | 'right';
  currency_token?: string;
  decimal_token?: string;
  decimal_places?: number;
  thousands_token?: string;
  // B2B Edition GraphQL format
  currency?: {
    code?: string;
  };
  value?: string | number;
}

/**
 * Format a number as currency using BigCommerce money format
 */
export function formatCurrency(amount: number | string, money?: MoneyFormat | any): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return '£0.00';
  }

  // Determine currency symbol from money object
  let currencySymbol = '£';
  let currencyLocation: 'left' | 'right' = 'left';
  
  if (money) {
    // B2B Edition GraphQL format: { currency: { code: "GBP" }, value: "10.00" }
    if (money.currency?.code) {
      const code = money.currency.code.toUpperCase();
      currencySymbol = code === 'USD' ? '$' : code === 'EUR' ? '€' : '£';
    }
    // Standard format: { currency_token: "£" }
    else if (money.currency_token) {
      currencySymbol = money.currency_token;
      currencyLocation = money.currency_location || 'left';
    }
  }

  // Format the number with thousands separator and decimal places
  const decimalPlaces = money?.decimal_places || 2;
  const parts = numAmount.toFixed(decimalPlaces).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formattedNumber = parts.join('.');

  // Add currency symbol based on location
  if (currencyLocation === 'right') {
    return `${formattedNumber}${currencySymbol}`;
  }
  return `${currencySymbol}${formattedNumber}`;
}

/**
 * Get currency symbol from money object
 */
export function getCurrencySymbol(money?: MoneyFormat): string {
  if (money?.currency?.code) {
    const code = money.currency.code.toUpperCase();
    return code === 'USD' ? '$' : code === 'EUR' ? '€' : '£';
  }
  return money?.currency_token || '£';
}
