import { describe, it, expect, vi } from "vitest";
import { validateAllowedTimezones, filterValidTimezones } from "./validateAllowedTimezones";

describe("validateAllowedTimezones", () => {
  describe("Valid Input Cases", () => {
    it("should accept null or undefined as valid (no restrictions)", () => {
      expect(validateAllowedTimezones(null)).toEqual({ isValid: true });
      expect(validateAllowedTimezones(undefined)).toEqual({ isValid: true });
    });

    it("should accept empty array as valid (no restrictions)", () => {
      expect(validateAllowedTimezones([])).toEqual({ isValid: true });
    });

    it("should accept valid IANA timezone identifiers", () => {
      const validTimezones = [
        "America/New_York",
        "Europe/London",
        "Asia/Tokyo",
        "Australia/Sydney"
      ];
      expect(validateAllowedTimezones(validTimezones)).toEqual({ isValid: true });
    });

    it("should accept all major US timezones", () => {
      const usTimezones = [
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "America/Phoenix",
        "America/Anchorage",
        "Pacific/Honolulu",
        "America/Detroit",
        "America/Indiana/Indianapolis",
        "America/Kentucky/Louisville"
      ];
      expect(validateAllowedTimezones(usTimezones)).toEqual({ isValid: true });
    });

    it("should accept all major European timezones", () => {
      const europeanTimezones = [
        "Europe/London",
        "Europe/Paris",
        "Europe/Berlin",
        "Europe/Madrid",
        "Europe/Rome",
        "Europe/Amsterdam",
        "Europe/Brussels",
        "Europe/Vienna",
        "Europe/Stockholm",
        "Europe/Copenhagen"
      ];
      expect(validateAllowedTimezones(europeanTimezones)).toEqual({ isValid: true });
    });

    it("should accept all major Asian timezones", () => {
      const asianTimezones = [
        "Asia/Tokyo",
        "Asia/Shanghai",
        "Asia/Hong_Kong",
        "Asia/Singapore",
        "Asia/Seoul",
        "Asia/Bangkok",
        "Asia/Dubai",
        "Asia/Kolkata",
        "Asia/Jakarta",
        "Asia/Manila"
      ];
      expect(validateAllowedTimezones(asianTimezones)).toEqual({ isValid: true });
    });

    it("should accept a mix of US and non-US timezones", () => {
      const mixedTimezones = [
        "America/New_York",
        "America/Chicago",
        "America/Los_Angeles",
        "Europe/London",
        "Europe/Paris",
        "Asia/Tokyo"
      ];
      expect(validateAllowedTimezones(mixedTimezones)).toEqual({ isValid: true });
    });

    it("should accept UTC and GMT timezones", () => {
      const utcTimezones = [
        "UTC",
        "GMT",
        "Etc/UTC",
        "Etc/GMT"
      ];
      expect(validateAllowedTimezones(utcTimezones)).toEqual({ isValid: true });
    });

    it("should accept timezones with special characters", () => {
      const specialTimezones = [
        "America/Port-au-Prince",
        "America/St_Johns",
        "Asia/Ho_Chi_Minh",
        "America/Argentina/Buenos_Aires"
      ];
      expect(validateAllowedTimezones(specialTimezones)).toEqual({ isValid: true });
    });
  });

  describe("Invalid Input Cases", () => {
    it("should reject invalid timezone identifiers", () => {
      const invalidTimezones = [
        "America/New_York",
        "Invalid/Timezone",
        "Not_A_Real_Zone"
      ];
      const result = validateAllowedTimezones(invalidTimezones);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid timezone(s):");
      expect(result.invalidTimezones).toEqual(["Invalid/Timezone", "Not_A_Real_Zone"]);
    });

    it("should reject all invalid timezones", () => {
      const allInvalidTimezones = [
        "Invalid/Timezone",
        "Not_A_Real_Zone",
        "Fake/Location"
      ];
      const result = validateAllowedTimezones(allInvalidTimezones);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid timezone(s):");
      expect(result.invalidTimezones).toEqual(allInvalidTimezones);
    });

    it("should reject timezone abbreviations that are not full IANA identifiers", () => {
      const abbreviations = [
        "EST",
        "PST",
        "CST",
        "MST"
      ];
      const result = validateAllowedTimezones(abbreviations);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid timezone(s):");
      expect(result.invalidTimezones).toEqual(abbreviations);
    });

    it("should reject typos in timezone names", () => {
      const typoTimezones = [
        "America/NewYork", // Missing underscore
        "Europe/Londan", // Typo
        "Asia/Tokio", // Wrong spelling
        "Australia/Sidney" // Wrong spelling
      ];
      const result = validateAllowedTimezones(typoTimezones);
      expect(result.isValid).toBe(false);
      expect(result.invalidTimezones).toEqual(typoTimezones);
    });

    it("should reject partial timezone paths", () => {
      const partialPaths = [
        "America",
        "Europe",
        "Asia",
        "Pacific"
      ];
      const result = validateAllowedTimezones(partialPaths);
      expect(result.isValid).toBe(false);
      expect(result.invalidTimezones).toEqual(partialPaths);
    });

    it("should reject numeric or special character only inputs", () => {
      const invalidInputs = [
        "123",
        "!@#",
        "...",
        "   "
      ];
      const result = validateAllowedTimezones(invalidInputs);
      expect(result.isValid).toBe(false);
      expect(result.invalidTimezones).toEqual(invalidInputs);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very large arrays of valid timezones", () => {
      const largeArray = Array(1000).fill("America/New_York");
      const result = validateAllowedTimezones(largeArray);
      expect(result.isValid).toBe(true);
    });

    it("should handle arrays with duplicate timezones", () => {
      const duplicates = [
        "America/New_York",
        "America/New_York",
        "Europe/London",
        "Europe/London"
      ];
      expect(validateAllowedTimezones(duplicates)).toEqual({ isValid: true });
    });

    it("should handle case-sensitive timezone identifiers correctly", () => {
      const wrongCase = [
        "america/new_york",
        "EUROPE/LONDON"
      ];
      const result = validateAllowedTimezones(wrongCase);
      expect(result.isValid).toBe(false);
      expect(result.invalidTimezones).toEqual(wrongCase);
    });

    it("should provide detailed error message for multiple invalid timezones", () => {
      const mixed = [
        "America/New_York",
        "Invalid1",
        "Europe/London",
        "Invalid2",
        "Invalid3"
      ];
      const result = validateAllowedTimezones(mixed);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Invalid timezone(s): Invalid1, Invalid2, Invalid3");
      expect(result.invalidTimezones).toEqual(["Invalid1", "Invalid2", "Invalid3"]);
    });
  });

  describe("Filtering US Timezones", () => {
    it("should handle filtering to exclude US timezones", () => {
      const allTimezones = [
        "America/New_York",
        "America/Chicago",
        "Europe/London",
        "Asia/Tokyo"
      ];
      // This test demonstrates that the validation accepts all valid timezones
      // The actual filtering of US timezones would be done at the application level
      expect(validateAllowedTimezones(allTimezones)).toEqual({ isValid: true });
    });

    it("should validate non-US timezones only", () => {
      const nonUSTimezones = [
        "Europe/London",
        "Europe/Paris",
        "Asia/Tokyo",
        "Australia/Sydney",
        "Africa/Cairo",
        "Antarctica/McMurdo"
      ];
      expect(validateAllowedTimezones(nonUSTimezones)).toEqual({ isValid: true });
    });

    it("should handle Canadian timezones separately from US", () => {
      const canadianTimezones = [
        "America/Toronto",
        "America/Vancouver",
        "America/Montreal",
        "America/Halifax",
        "America/Winnipeg"
      ];
      expect(validateAllowedTimezones(canadianTimezones)).toEqual({ isValid: true });
    });

    it("should handle Mexican timezones separately from US", () => {
      const mexicanTimezones = [
        "America/Mexico_City",
        "America/Cancun",
        "America/Tijuana",
        "America/Monterrey"
      ];
      expect(validateAllowedTimezones(mexicanTimezones)).toEqual({ isValid: true });
    });
  });
});

describe("filterValidTimezones", () => {
  describe("Valid Filtering Cases", () => {
    it("should return empty array for null or undefined input", () => {
      expect(filterValidTimezones(null)).toEqual([]);
      expect(filterValidTimezones(undefined)).toEqual([]);
    });

    it("should return empty array for empty input", () => {
      expect(filterValidTimezones([])).toEqual([]);
    });

    it("should filter out invalid timezones", () => {
      const mixedTimezones = [
        "America/New_York",
        "Invalid/Timezone",
        "Europe/London",
        "Not_A_Real_Zone",
        "Asia/Tokyo"
      ];
      const filtered = filterValidTimezones(mixedTimezones);
      expect(filtered).toEqual([
        "America/New_York",
        "Europe/London",
        "Asia/Tokyo"
      ]);
    });

    it("should return all timezones if all are valid", () => {
      const validTimezones = [
        "America/New_York",
        "Europe/London",
        "Asia/Tokyo"
      ];
      expect(filterValidTimezones(validTimezones)).toEqual(validTimezones);
    });

    it("should return empty array if all timezones are invalid", () => {
      const invalidTimezones = [
        "Invalid/Timezone",
        "Not_A_Real_Zone",
        "Fake/Location"
      ];
      expect(filterValidTimezones(invalidTimezones)).toEqual([]);
    });

    it("should preserve order of valid timezones", () => {
      const mixedTimezones = [
        "Asia/Tokyo",
        "Invalid1",
        "Europe/London",
        "Invalid2",
        "America/New_York"
      ];
      const filtered = filterValidTimezones(mixedTimezones);
      expect(filtered).toEqual([
        "Asia/Tokyo",
        "Europe/London",
        "America/New_York"
      ]);
    });

    it("should handle duplicates in filtering", () => {
      const duplicatesWithInvalid = [
        "America/New_York",
        "Invalid",
        "America/New_York",
        "Europe/London",
        "Invalid",
        "Europe/London"
      ];
      const filtered = filterValidTimezones(duplicatesWithInvalid);
      expect(filtered).toEqual([
        "America/New_York",
        "America/New_York",
        "Europe/London",
        "Europe/London"
      ]);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very large arrays efficiently", () => {
      const largeArray = [
        ...Array(500).fill("America/New_York"),
        ...Array(500).fill("Invalid/Timezone")
      ];
      const filtered = filterValidTimezones(largeArray);
      expect(filtered.length).toBe(500);
      expect(filtered.every(tz => tz === "America/New_York")).toBe(true);
    });

    it("should filter out case-incorrect timezone identifiers", () => {
      const mixedCase = [
        "America/New_York",
        "america/new_york",
        "EUROPE/LONDON",
        "Europe/London"
      ];
      const filtered = filterValidTimezones(mixedCase);
      expect(filtered).toEqual([
        "America/New_York",
        "Europe/London"
      ]);
    });

    it("should handle special characters in invalid timezones", () => {
      const specialChars = [
        "America/New_York",
        "America/New York", // Space instead of underscore
        "America\\New_York", // Backslash
        "America|New_York" // Pipe
      ];
      const filtered = filterValidTimezones(specialChars);
      expect(filtered).toEqual(["America/New_York"]);
    });

    it("should filter timezone abbreviations", () => {
      const abbrevs = [
        "America/New_York",
        "EST",
        "PST",
        "Europe/London",
        "GMT"
      ];
      const filtered = filterValidTimezones(abbrevs);
      expect(filtered).toEqual([
        "America/New_York",
        "Europe/London",
        "GMT" // GMT might be valid depending on the IntlSupportedTimeZones
      ]);
    });
  });

  describe("Performance Tests", () => {
    it("should handle filtering 10000 items efficiently", () => {
      const start = Date.now();
      const hugeArray = [
        ...Array(5000).fill("America/New_York"),
        ...Array(5000).fill("Invalid/Zone")
      ];
      const filtered = filterValidTimezones(hugeArray);
      const duration = Date.now() - start;
      
      expect(filtered.length).toBe(5000);
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });
});

describe("Integration with Both Functions", () => {
  it("should validate and then filter consistently", () => {
    const timezones = [
      "America/New_York",
      "Invalid/Zone",
      "Europe/London"
    ];
    
    const validation = validateAllowedTimezones(timezones);
    expect(validation.isValid).toBe(false);
    
    const filtered = filterValidTimezones(timezones);
    expect(filtered).toEqual(["America/New_York", "Europe/London"]);
    
    // Validating the filtered result should always be valid
    const revalidation = validateAllowedTimezones(filtered);
    expect(revalidation.isValid).toBe(true);
  });

  it("should handle empty results consistently", () => {
    const allInvalid = ["Invalid1", "Invalid2"];
    
    const validation = validateAllowedTimezones(allInvalid);
    expect(validation.isValid).toBe(false);
    
    const filtered = filterValidTimezones(allInvalid);
    expect(filtered).toEqual([]);
    
    // Empty array should be valid
    const emptyValidation = validateAllowedTimezones(filtered);
    expect(emptyValidation.isValid).toBe(true);
  });
});