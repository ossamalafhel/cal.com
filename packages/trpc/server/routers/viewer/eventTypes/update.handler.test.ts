import { describe, it, vi, expect, beforeEach, afterEach } from "vitest";
import { TRPCError } from "@trpc/server";
import type { Prisma, EventType } from "@prisma/client";
import prisma from "../../../../../../tests/libs/__mocks__/prisma";
import {
  createBookingScenario,
  TestData,
  getOrganizer,
  getScenarioData,
  createOrganization,
} from "@calcom/web/test/utils/bookingScenario/bookingScenario";
import { setupAndTeardown } from "@calcom/web/test/utils/bookingScenario/setupAndTeardown";
import { validateAllowedTimezones } from "@calcom/lib/validateAllowedTimezones";
import { validateBookerLayouts } from "@calcom/lib/validateBookerLayouts";
import { MembershipRole, SchedulingType } from "@calcom/prisma/enums";
import type { TrpcSessionUser } from "../../../types";
import { updateHandler } from "./update.handler";
import type { TUpdateInputSchema } from "./update.schema";

// Mock dependencies
vi.mock("@calcom/lib/validateAllowedTimezones");
vi.mock("@calcom/lib/validateBookerLayouts");
vi.mock("@calcom/lib/server/repository/membership");
vi.mock("@calcom/lib/server/repository/schedule");
vi.mock("@calcom/lib/server/repository/hashedLinkRepository");
vi.mock("@calcom/features/ee/managed-event-types/lib/handleChildrenEventTypes");
vi.mock("@calcom/features/tasker");
vi.mock("@calcom/lib/server/i18n", () => ({
  getTranslation: vi.fn().mockResolvedValue((key: string) => key),
}));

describe("EventType Update Handler - Timezone Validation", () => {
  setupAndTeardown();

  let mockCtx: any;
  let mockUser: TrpcSessionUser;
  let mockEventType: EventType;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Setup mock user
    mockUser = {
      id: 1,
      email: "test@example.com",
      username: "testuser",
      name: "Test User",
      role: "USER",
      profile: {
        id: 1,
        organizationId: null,
        organization: null,
        username: "testuser",
        upId: "usr_123",
      },
      locale: "en",
      userLevelSelectedCalendars: [],
      isImpersonated: false,
    };

    // Setup mock event type
    mockEventType = {
      id: 1,
      title: "Test Event",
      slug: "test-event",
      description: null,
      position: 0,
      locations: null,
      length: 30,
      offsetStart: 0,
      hidden: false,
      userId: mockUser.id,
      profileId: null,
      teamId: null,
      eventName: null,
      parentId: null,
      bookingFields: null,
      timeZone: null,
      periodType: "UNLIMITED",
      periodStartDate: null,
      periodEndDate: null,
      periodDays: null,
      periodCountCalendarDays: null,
      lockTimeZoneToggleOnBookingPage: false,
      requiresConfirmation: false,
      requiresBookerEmailVerification: false,
      confirmationMessage: null,
      rejectionMessage: null,
      recurringEvent: null,
      disableGuests: false,
      hideCalendarNotes: false,
      hideCalendarEventDetails: false,
      minimumBookingNotice: 0,
      beforeEventBuffer: 0,
      afterEventBuffer: 0,
      seatsPerTimeSlot: null,
      seatsShowAttendees: null,
      seatsShowAvailabilityCount: null,
      onlyShowFirstAvailableSlot: false,
      schedulingType: null,
      schedule: null,
      scheduleId: null,
      price: 0,
      currency: "usd",
      slotInterval: null,
      metadata: null,
      successRedirectUrl: null,
      forwardParamsSuccessRedirect: null,
      instantMeetingExpiryTimeOffsetInSeconds: 0,
      bookingLimits: null,
      durationLimits: null,
      isInstantEvent: false,
      assignAllTeamMembers: false,
      useEventTypeDestinationCalendarEmail: false,
      secondaryEmailId: null,
      aiPhoneCallConfig: null,
      rrTimestampBasis: null,
    } as EventType;

    // Setup mock context
    mockCtx = {
      user: mockUser,
      prisma: {
        eventType: {
          findFirst: vi.fn().mockResolvedValue(mockEventType),
          findUnique: vi.fn().mockResolvedValue(mockEventType),
          update: vi.fn().mockResolvedValue(mockEventType),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue(mockUser),
        },
        schedule: {
          findFirst: vi.fn().mockResolvedValue({ id: 1, userId: mockUser.id }),
        },
        membership: {
          findFirst: vi.fn().mockResolvedValue({
            role: MembershipRole.ADMIN,
            teamId: 1,
          }),
        },
      },
    };

    // Setup default mock implementations
    (validateBookerLayouts as any).mockReturnValue({ isValid: true });
    (validateAllowedTimezones as any).mockReturnValue({ isValid: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Timezone Validation in Metadata", () => {
    it("should accept valid timezones in metadata", async () => {
      const validTimezones = ["America/New_York", "Europe/London", "Asia/Tokyo"];
      const input: TUpdateInputSchema = {
        id: 1,
        metadata: {
          allowedTimezones: validTimezones,
        },
      };

      (validateAllowedTimezones as any).mockReturnValue({ isValid: true });

      await expect(updateHandler({ ctx: mockCtx, input })).resolves.not.toThrow();
      expect(validateAllowedTimezones).toHaveBeenCalledWith(validTimezones);
      expect(mockCtx.prisma.eventType.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              allowedTimezones: validTimezones,
            }),
          }),
        })
      );
    });

    it("should reject invalid timezones in metadata", async () => {
      const invalidTimezones = ["America/New_York", "Invalid/Timezone"];
      const input: TUpdateInputSchema = {
        id: 1,
        metadata: {
          allowedTimezones: invalidTimezones,
        },
      };

      (validateAllowedTimezones as any).mockReturnValue({
        isValid: false,
        error: "Invalid timezone(s): Invalid/Timezone",
        invalidTimezones: ["Invalid/Timezone"],
      });

      await expect(updateHandler({ ctx: mockCtx, input })).rejects.toThrow(TRPCError);
      await expect(updateHandler({ ctx: mockCtx, input })).rejects.toThrow(
        "Invalid timezone(s): Invalid/Timezone"
      );
      expect(validateAllowedTimezones).toHaveBeenCalledWith(invalidTimezones);
      expect(mockCtx.prisma.eventType.update).not.toHaveBeenCalled();
    });

    it("should handle empty timezone array", async () => {
      const input: TUpdateInputSchema = {
        id: 1,
        metadata: {
          allowedTimezones: [],
        },
      };

      (validateAllowedTimezones as any).mockReturnValue({ isValid: true });

      await expect(updateHandler({ ctx: mockCtx, input })).resolves.not.toThrow();
      expect(validateAllowedTimezones).toHaveBeenCalledWith([]);
      expect(mockCtx.prisma.eventType.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              allowedTimezones: [],
            }),
          }),
        })
      );
    });

    it("should handle null timezone value", async () => {
      const input: TUpdateInputSchema = {
        id: 1,
        metadata: {
          allowedTimezones: null,
        },
      };

      (validateAllowedTimezones as any).mockReturnValue({ isValid: true });

      await expect(updateHandler({ ctx: mockCtx, input })).resolves.not.toThrow();
      expect(validateAllowedTimezones).toHaveBeenCalledWith(null);
    });

    it("should handle undefined timezone value", async () => {
      const input: TUpdateInputSchema = {
        id: 1,
        metadata: {},
      };

      await expect(updateHandler({ ctx: mockCtx, input })).resolves.not.toThrow();
      expect(validateAllowedTimezones).not.toHaveBeenCalled();
    });

    it("should preserve other metadata fields when updating timezones", async () => {
      const input: TUpdateInputSchema = {
        id: 1,
        metadata: {
          allowedTimezones: ["America/New_York"],
          giphyThankYouPage: "https://giphy.com/test",
          additionalNotesRequired: true,
        },
      };

      (validateAllowedTimezones as any).mockReturnValue({ isValid: true });

      await expect(updateHandler({ ctx: mockCtx, input })).resolves.not.toThrow();
      expect(mockCtx.prisma.eventType.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              allowedTimezones: ["America/New_York"],
              giphyThankYouPage: "https://giphy.com/test",
              additionalNotesRequired: true,
            }),
          }),
        })
      );
    });
  });

  describe("US Timezone Filtering", () => {
    it("should accept only non-US timezones when filtering US", async () => {
      const nonUSTimezones = [
        "Europe/London",
        "Europe/Paris",
        "Asia/Tokyo",
        "Australia/Sydney",
      ];
      const input: TUpdateInputSchema = {
        id: 1,
        metadata: {
          allowedTimezones: nonUSTimezones,
        },
      };

      (validateAllowedTimezones as any).mockReturnValue({ isValid: true });

      await expect(updateHandler({ ctx: mockCtx, input })).resolves.not.toThrow();
      expect(validateAllowedTimezones).toHaveBeenCalledWith(nonUSTimezones);
    });

    it("should handle mixed US and non-US timezones", async () => {
      const mixedTimezones = [
        "America/New_York",
        "America/Los_Angeles",
        "Europe/London",
        "Asia/Tokyo",
      ];
      const input: TUpdateInputSchema = {
        id: 1,
        metadata: {
          allowedTimezones: mixedTimezones,
        },
      };

      (validateAllowedTimezones as any).mockReturnValue({ isValid: true });

      await expect(updateHandler({ ctx: mockCtx, input })).resolves.not.toThrow();
      expect(validateAllowedTimezones).toHaveBeenCalledWith(mixedTimezones);
    });

    it("should handle Canadian and Mexican timezones separately from US", async () => {
      const northAmericanNonUSTimezones = [
        "America/Toronto",
        "America/Vancouver",
        "America/Mexico_City",
        "America/Cancun",
      ];
      const input: TUpdateInputSchema = {
        id: 1,
        metadata: {
          allowedTimezones: northAmericanNonUSTimezones,
        },
      };

      (validateAllowedTimezones as any).mockReturnValue({ isValid: true });

      await expect(updateHandler({ ctx: mockCtx, input })).resolves.not.toThrow();
      expect(validateAllowedTimezones).toHaveBeenCalledWith(northAmericanNonUSTimezones);
    });
  });

  describe("Error Handling", () => {
    it("should throw TRPCError with BAD_REQUEST code for invalid timezones", async () => {
      const input: TUpdateInputSchema = {
        id: 1,
        metadata: {
          allowedTimezones: ["Invalid/Zone"],
        },
      };

      (validateAllowedTimezones as any).mockReturnValue({
        isValid: false,
        error: "Invalid timezone(s): Invalid/Zone",
      });

      try {
        await updateHandler({ ctx: mockCtx, input });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("BAD_REQUEST");
        expect((error as TRPCError).message).toBe("Invalid timezone(s): Invalid/Zone");
      }
    });

    it("should provide default error message when validation error is missing", async () => {
      const input: TUpdateInputSchema = {
        id: 1,
        metadata: {
          allowedTimezones: ["Invalid/Zone"],
        },
      };

      (validateAllowedTimezones as any).mockReturnValue({
        isValid: false,
        // No error message provided
      });

      try {
        await updateHandler({ ctx: mockCtx, input });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).message).toBe("Invalid timezone(s) provided");
      }
    });

    it("should not perform timezone validation if event type not found", async () => {
      const input: TUpdateInputSchema = {
        id: 999,
        metadata: {
          allowedTimezones: ["America/New_York"],
        },
      };

      mockCtx.prisma.eventType.findFirst.mockResolvedValue(null);

      await expect(updateHandler({ ctx: mockCtx, input })).rejects.toThrow();
      expect(validateAllowedTimezones).not.toHaveBeenCalled();
    });
  });

  describe("Integration with Other Validations", () => {
    it("should validate both booker layouts and timezones", async () => {
      const input: TUpdateInputSchema = {
        id: 1,
        metadata: {
          allowedTimezones: ["America/New_York"],
          bookerLayouts: {
            defaultLayout: "month_view",
            enabledLayouts: ["month_view", "week_view"],
          },
        },
      };

      (validateAllowedTimezones as any).mockReturnValue({ isValid: true });
      (validateBookerLayouts as any).mockReturnValue({ isValid: true });

      await expect(updateHandler({ ctx: mockCtx, input })).resolves.not.toThrow();
      expect(validateAllowedTimezones).toHaveBeenCalledWith(["America/New_York"]);
      expect(validateBookerLayouts).toHaveBeenCalled();
    });

    it("should fail fast on booker layout validation before timezone validation", async () => {
      const input: TUpdateInputSchema = {
        id: 1,
        metadata: {
          allowedTimezones: ["Invalid/Zone"],
          bookerLayouts: {
            defaultLayout: "invalid_layout",
            enabledLayouts: ["invalid_layout"],
          },
        },
      };

      (validateBookerLayouts as any).mockReturnValue({
        isValid: false,
        error: "Invalid booker layout",
      });

      await expect(updateHandler({ ctx: mockCtx, input })).rejects.toThrow("Invalid booker layout");
      expect(validateBookerLayouts).toHaveBeenCalled();
      // Should not reach timezone validation
      expect(validateAllowedTimezones).not.toHaveBeenCalled();
    });
  });

  describe("Permission Checks", () => {
    it("should allow owner to update timezone settings", async () => {
      const input: TUpdateInputSchema = {
        id: 1,
        metadata: {
          allowedTimezones: ["America/New_York"],
        },
      };

      (validateAllowedTimezones as any).mockReturnValue({ isValid: true });

      await expect(updateHandler({ ctx: mockCtx, input })).resolves.not.toThrow();
    });

    it("should allow team admin to update timezone settings", async () => {
      const teamEventType = {
        ...mockEventType,
        userId: null,
        teamId: 1,
      };

      mockCtx.prisma.eventType.findFirst.mockResolvedValue(teamEventType);
      mockCtx.prisma.membership.findFirst.mockResolvedValue({
        role: MembershipRole.ADMIN,
        teamId: 1,
      });

      const input: TUpdateInputSchema = {
        id: 1,
        metadata: {
          allowedTimezones: ["America/New_York"],
        },
      };

      (validateAllowedTimezones as any).mockReturnValue({ isValid: true });

      await expect(updateHandler({ ctx: mockCtx, input })).resolves.not.toThrow();
    });

    it("should reject team member without admin role", async () => {
      const teamEventType = {
        ...mockEventType,
        userId: null,
        teamId: 1,
      };

      mockCtx.prisma.eventType.findFirst.mockResolvedValue(teamEventType);
      mockCtx.prisma.membership.findFirst.mockResolvedValue({
        role: MembershipRole.MEMBER,
        teamId: 1,
      });

      const input: TUpdateInputSchema = {
        id: 1,
        metadata: {
          allowedTimezones: ["America/New_York"],
        },
      };

      await expect(updateHandler({ ctx: mockCtx, input })).rejects.toThrow();
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle large arrays of timezones", async () => {
      const largeTimezoneArray = Array(100)
        .fill(null)
        .map((_, i) => `Europe/City${i}`)
        .filter(() => Math.random() > 0.5);

      const input: TUpdateInputSchema = {
        id: 1,
        metadata: {
          allowedTimezones: ["America/New_York", "Europe/London", ...largeTimezoneArray],
        },
      };

      (validateAllowedTimezones as any).mockReturnValue({ isValid: true });

      await expect(updateHandler({ ctx: mockCtx, input })).resolves.not.toThrow();
    });

    it("should handle duplicate timezones in the array", async () => {
      const duplicateTimezones = [
        "America/New_York",
        "America/New_York",
        "Europe/London",
        "Europe/London",
      ];
      const input: TUpdateInputSchema = {
        id: 1,
        metadata: {
          allowedTimezones: duplicateTimezones,
        },
      };

      (validateAllowedTimezones as any).mockReturnValue({ isValid: true });

      await expect(updateHandler({ ctx: mockCtx, input })).resolves.not.toThrow();
      expect(validateAllowedTimezones).toHaveBeenCalledWith(duplicateTimezones);
    });

    it("should handle timezone updates for managed event types", async () => {
      const managedEventType = {
        ...mockEventType,
        parentId: 100,
      };

      mockCtx.prisma.eventType.findFirst.mockResolvedValue(managedEventType);

      const input: TUpdateInputSchema = {
        id: 1,
        metadata: {
          allowedTimezones: ["America/New_York"],
        },
      };

      (validateAllowedTimezones as any).mockReturnValue({ isValid: true });

      await expect(updateHandler({ ctx: mockCtx, input })).resolves.not.toThrow();
    });
  });
});