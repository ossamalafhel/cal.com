import { IntlSupportedTimeZones } from "./timeZones";

/**
 * Validates that all provided timezones are valid IANA timezone identifiers
 * that are supported by the Intl API
 * @param timezones - Array of timezone strings to validate
 * @returns Object with validation result and error message if invalid
 */
export function validateAllowedTimezones(timezones: string[] | null | undefined): {
  isValid: boolean;
  error?: string;
  invalidTimezones?: string[];
} {
  if (!timezones || timezones.length === 0) {
    // Empty or null array is valid (no restrictions)
    return { isValid: true };
  }

  const supportedTimezoneSet = new Set(IntlSupportedTimeZones);
  const invalidTimezones = timezones.filter(tz => !supportedTimezoneSet.has(tz as any));

  if (invalidTimezones.length > 0) {
    return {
      isValid: false,
      error: `Invalid timezone(s): ${invalidTimezones.join(", ")}`,
      invalidTimezones
    };
  }

  return { isValid: true };
}

/**
 * Filters out invalid timezones from the provided array
 * @param timezones - Array of timezone strings to filter
 * @returns Array of valid timezone strings
 */
export function filterValidTimezones(timezones: string[] | null | undefined): string[] {
  if (!timezones || timezones.length === 0) {
    return [];
  }

  const supportedTimezoneSet = new Set(IntlSupportedTimeZones);
  return timezones.filter(tz => supportedTimezoneSet.has(tz as any));
}