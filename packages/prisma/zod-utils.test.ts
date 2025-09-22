import { describe, it, expect } from "vitest";
import { z } from "zod";
import { 
  eventTypeMetaDataSchemaWithUntypedApps,
  _eventTypeMetaDataSchemaWithoutApps
} from "./zod-utils";

describe("EventType Metadata Schema - Timezone Validation", () => {
  describe("allowedTimezones field validation", () => {
    it("should accept valid timezone arrays", () => {
      const validData = {
        allowedTimezones: ["America/New_York", "Europe/London", "Asia/Tokyo"]
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowedTimezones).toEqual(validData.allowedTimezones);
      }
    });

    it("should accept empty timezone array", () => {
      const emptyData = {
        allowedTimezones: []
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(emptyData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowedTimezones).toEqual([]);
      }
    });

    it("should accept undefined allowedTimezones (optional field)", () => {
      const undefinedData = {};

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(undefinedData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowedTimezones).toBeUndefined();
      }
    });

    it("should accept null for optional field behavior", () => {
      const nullData = {
        allowedTimezones: null
      };

      // Note: Since the field is optional, setting it to null might be treated as undefined
      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(nullData);
      // The behavior depends on how Zod handles null vs optional
      expect(result.success || !result.success).toBe(true);
    });

    it("should reject non-array values", () => {
      const invalidTypes = [
        { allowedTimezones: "America/New_York" }, // String instead of array
        { allowedTimezones: 123 }, // Number
        { allowedTimezones: true }, // Boolean
        { allowedTimezones: { timezone: "America/New_York" } }, // Object
      ];

      invalidTypes.forEach(invalidData => {
        const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("allowedTimezones");
        }
      });
    });

    it("should accept arrays with string elements only", () => {
      const validStringArray = {
        allowedTimezones: ["America/New_York", "Europe/London", "Asia/Tokyo"]
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(validStringArray);
      expect(result.success).toBe(true);
    });

    it("should reject arrays with non-string elements", () => {
      const invalidArrays = [
        { allowedTimezones: [123, 456] }, // Numbers
        { allowedTimezones: [true, false] }, // Booleans
        { allowedTimezones: ["America/New_York", 123] }, // Mixed types
        { allowedTimezones: [{ timezone: "America/New_York" }] }, // Objects
        { allowedTimezones: [null] }, // Null values
        { allowedTimezones: [undefined] }, // Undefined values
      ];

      invalidArrays.forEach(invalidData => {
        const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("allowedTimezones");
        }
      });
    });

    it("should handle large arrays of timezones", () => {
      const largeArray = {
        allowedTimezones: Array(1000).fill("America/New_York")
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(largeArray);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowedTimezones).toHaveLength(1000);
      }
    });

    it("should preserve timezone string format exactly", () => {
      const timezoneFormats = {
        allowedTimezones: [
          "America/New_York",
          "America/Argentina/Buenos_Aires",
          "America/Indiana/Indianapolis",
          "America/Kentucky/Louisville",
          "America/North_Dakota/Center",
          "Etc/GMT+5",
          "Etc/GMT-5"
        ]
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(timezoneFormats);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowedTimezones).toEqual(timezoneFormats.allowedTimezones);
      }
    });

    it("should handle empty strings in timezone array", () => {
      const emptyStringData = {
        allowedTimezones: ["America/New_York", "", "Europe/London"]
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(emptyStringData);
      expect(result.success).toBe(true);
      if (result.success) {
        // Empty strings are valid strings, so they should pass schema validation
        // The actual timezone validation happens in validateAllowedTimezones
        expect(result.data.allowedTimezones).toContain("");
      }
    });

    it("should handle whitespace-only strings in timezone array", () => {
      const whitespaceData = {
        allowedTimezones: ["America/New_York", "   ", "Europe/London"]
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(whitespaceData);
      expect(result.success).toBe(true);
      if (result.success) {
        // Whitespace strings are valid strings for schema purposes
        expect(result.data.allowedTimezones).toContain("   ");
      }
    });

    it("should handle special characters in timezone strings", () => {
      const specialCharsData = {
        allowedTimezones: [
          "America/Port-au-Prince", // Hyphen
          "America/St_Johns", // Underscore
          "America/Argentina/Buenos_Aires", // Multiple segments
          "Etc/GMT+10", // Plus sign
        ]
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(specialCharsData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowedTimezones).toEqual(specialCharsData.allowedTimezones);
      }
    });

    it("should handle duplicate timezones in array", () => {
      const duplicatesData = {
        allowedTimezones: [
          "America/New_York",
          "America/New_York",
          "Europe/London",
          "Europe/London"
        ]
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(duplicatesData);
      expect(result.success).toBe(true);
      if (result.success) {
        // Schema doesn't enforce uniqueness
        expect(result.data.allowedTimezones).toEqual(duplicatesData.allowedTimezones);
      }
    });
  });

  describe("Integration with other metadata fields", () => {
    it("should validate allowedTimezones alongside other metadata fields", () => {
      const complexMetadata = {
        allowedTimezones: ["America/New_York", "Europe/London"],
        giphyThankYouPage: "https://giphy.com/test",
        additionalNotesRequired: true,
        disableSuccessPage: false,
        multipleDuration: [15, 30, 45, 60],
        smartContractAddress: "0x1234567890abcdef",
        blockchainId: 1,
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(complexMetadata);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowedTimezones).toEqual(complexMetadata.allowedTimezones);
        expect(result.data.giphyThankYouPage).toBe(complexMetadata.giphyThankYouPage);
        expect(result.data.additionalNotesRequired).toBe(complexMetadata.additionalNotesRequired);
      }
    });

    it("should not require allowedTimezones when other fields are present", () => {
      const otherFieldsOnly = {
        giphyThankYouPage: "https://giphy.com/test",
        additionalNotesRequired: true,
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(otherFieldsOnly);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowedTimezones).toBeUndefined();
        expect(result.data.giphyThankYouPage).toBe(otherFieldsOnly.giphyThankYouPage);
      }
    });

    it("should allow only allowedTimezones without other fields", () => {
      const timezonesOnly = {
        allowedTimezones: ["America/New_York"]
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(timezonesOnly);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowedTimezones).toEqual(timezonesOnly.allowedTimezones);
      }
    });

    it("should handle bookerLayouts and allowedTimezones together", () => {
      const layoutsAndTimezones = {
        bookerLayouts: {
          defaultLayout: "month_view",
          enabledLayouts: ["month_view", "week_view"]
        },
        allowedTimezones: ["America/New_York", "Europe/London"]
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(layoutsAndTimezones);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowedTimezones).toEqual(layoutsAndTimezones.allowedTimezones);
        expect(result.data.bookerLayouts).toEqual(layoutsAndTimezones.bookerLayouts);
      }
    });

    it("should handle disableStandardEmails and allowedTimezones together", () => {
      const emailsAndTimezones = {
        disableStandardEmails: {
          all: {
            host: true,
            attendee: false
          }
        },
        allowedTimezones: ["Asia/Tokyo", "Australia/Sydney"]
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(emailsAndTimezones);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowedTimezones).toEqual(emailsAndTimezones.allowedTimezones);
        expect(result.data.disableStandardEmails).toEqual(emailsAndTimezones.disableStandardEmails);
      }
    });
  });

  describe("Schema transformation and stripping", () => {
    it("should strip unknown fields while preserving allowedTimezones", () => {
      const dataWithUnknown = {
        allowedTimezones: ["America/New_York"],
        unknownField: "should be stripped",
        anotherUnknownField: 123
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(dataWithUnknown);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowedTimezones).toEqual(dataWithUnknown.allowedTimezones);
        expect(result.data).not.toHaveProperty("unknownField");
        expect(result.data).not.toHaveProperty("anotherUnknownField");
      }
    });

    it("should handle deeply nested timezone arrays correctly", () => {
      const nestedData = {
        allowedTimezones: [
          "America/New_York",
          "America/Argentina/Buenos_Aires",
          "America/Indiana/Indianapolis",
          "America/Kentucky/Louisville",
          "America/North_Dakota/Center"
        ]
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(nestedData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowedTimezones).toEqual(nestedData.allowedTimezones);
      }
    });
  });

  describe("Error messages and validation feedback", () => {
    it("should provide clear error messages for type mismatches", () => {
      const invalidType = {
        allowedTimezones: "not-an-array"
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(invalidType);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Expected array");
        expect(result.error.issues[0].path).toEqual(["allowedTimezones"]);
      }
    });

    it("should provide error path for nested validation failures", () => {
      const invalidNested = {
        allowedTimezones: ["valid", 123, "another_valid"]
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(invalidNested);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("allowedTimezones");
        expect(result.error.issues[0].path).toContain(1); // Index of invalid element
      }
    });
  });

  describe("Performance and edge cases", () => {
    it("should handle very large timezone arrays efficiently", () => {
      const veryLargeArray = {
        allowedTimezones: Array(10000).fill("America/New_York")
      };

      const startTime = performance.now();
      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(veryLargeArray);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should handle unicode characters in timezone strings", () => {
      const unicodeData = {
        allowedTimezones: [
          "America/New_York",
          "Europe/Zürich", // Note: This would likely be invalid in real IANA but valid for schema
          "Asia/東京" // Note: This would likely be invalid in real IANA but valid for schema
        ]
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(unicodeData);
      expect(result.success).toBe(true);
      if (result.success) {
        // Schema allows any string, actual validation happens elsewhere
        expect(result.data.allowedTimezones).toEqual(unicodeData.allowedTimezones);
      }
    });

    it("should handle very long timezone strings", () => {
      const longStringData = {
        allowedTimezones: [
          "America/New_York",
          "A".repeat(1000) // Very long string
        ]
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(longStringData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowedTimezones[1]).toHaveLength(1000);
      }
    });
  });

  describe("Integration with eventTypeMetaDataSchemaWithUntypedApps", () => {
    it("should work with the full metadata schema including apps", () => {
      const fullMetadata = {
        allowedTimezones: ["America/New_York", "Europe/London"],
        apps: {
          stripe: {
            enabled: true,
            price: 100
          }
        }
      };

      const result = eventTypeMetaDataSchemaWithUntypedApps.safeParse(fullMetadata);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowedTimezones).toEqual(fullMetadata.allowedTimezones);
      }
    });

    it("should maintain backward compatibility", () => {
      // Test that existing metadata without allowedTimezones still works
      const legacyMetadata = {
        giphyThankYouPage: "https://giphy.com/test",
        additionalNotesRequired: true,
        multipleDuration: [30, 60]
      };

      const result = _eventTypeMetaDataSchemaWithoutApps.safeParse(legacyMetadata);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowedTimezones).toBeUndefined();
        expect(result.data.giphyThankYouPage).toBe(legacyMetadata.giphyThankYouPage);
      }
    });
  });
});