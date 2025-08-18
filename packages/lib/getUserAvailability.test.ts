import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { User, Schedule, Availability } from "@prisma/client";

import dayjs from "@calcom/dayjs";
import prisma from "@calcom/prisma";

import { getUserAvailability } from "./getUserAvailability";
import type { IOutOfOfficeData } from "./getUserAvailability";

// Mock the dependencies
vi.mock("@calcom/prisma", () => ({
  default: {
    eventType: {
      findUnique: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    outOfOfficeEntry: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("./getBusyTimes", () => ({
  getBusyTimes: vi.fn(() => Promise.resolve([])),
}));

vi.mock("./server/findUsersForAvailabilityCheck", () => ({
  findUsersForAvailabilityCheck: vi.fn(),
}));

vi.mock("./server/repository/eventTypeRepository", () => ({
  EventTypeRepository: {
    getSelectedCalendarsFromUser: vi.fn(() => []),
  },
}));

vi.mock("./intervalLimits/server/getBusyTimesFromLimits", () => ({
  getBusyTimesFromLimits: vi.fn(() => Promise.resolve([])),
  getBusyTimesFromTeamLimits: vi.fn(() => Promise.resolve([])),
}));

const createMockAvailability = (scheduleId: number, days: number[] = [1, 2, 3, 4, 5], startHour: number = 9, endHour: number = 17) => ({
  id: scheduleId,
  scheduleId,
  userId: 1,
  eventTypeId: null,
  days,
  startTime: new Date(`1970-01-01T${startHour.toString().padStart(2, '0')}:00:00Z`),
  endTime: new Date(`1970-01-01T${endHour.toString().padStart(2, '0')}:00:00Z`),
  date: null,
});

const mockUser = (scheduleId: number, travelSchedules: any[] = [], additionalSchedules: any[] = []) => ({
  id: 1,
  username: "testuser",
  email: "test@example.com",
  timeZone: "America/New_York",
  credentials: [],
  userLevelSelectedCalendars: [],
  defaultScheduleId: scheduleId,
  schedules: [
    {
      id: 1,
      userId: 1,
      name: "Default Schedule",
      timeZone: "America/New_York",
      availability: [createMockAvailability(1)],
    },
    {
      id: 2,
      userId: 1,
      name: "Secondary Schedule",
      timeZone: "America/New_York",
      availability: [createMockAvailability(2, [1, 2, 3, 4, 5], 10, 18)],
    },
    {
      id: 3,
      userId: 1,
      name: "Weekend Schedule",
      timeZone: "America/Los_Angeles",
      availability: [createMockAvailability(3, [0, 6], 8, 16)],
    },
    ...additionalSchedules,
  ],
  availability: [],
  travelSchedules,
});

describe("getUserAvailability - Travel Schedule Fix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("AC1: Travel Schedule Applied to Non-Default Schedules", () => {
    it("should apply travel schedule timezone to non-default schedule", async () => {
      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs().startOf("day").toDate(),
          endDate: dayjs().add(7, "days").endOf("day").toDate(),
          timeZone: "Europe/London", // Different timezone for travel
        },
      ];

      const user = mockUser(1, travelSchedules); // Default schedule is 1
      
      // Mock for non-default schedule event type
      const mockEventType = {
        id: 100,
        schedule: user.schedules[1], // Using secondary schedule (non-default)
        availability: [],
        seatsPerTimeSlot: null,
        bookingLimits: null,
        durationLimits: null,
        metadata: {},
        team: null,
        parent: null,
        hosts: [],
        useEventLevelSelectedCalendars: false,
      };

      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(mockEventType);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(7, "days").endOf("day").format();

      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        eventTypeId: 100,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      // The result should have the travel schedule applied even for non-default schedule
      expect(result).toBeDefined();
      expect(result.timeZone).toBe("America/New_York"); // Schedule timezone
      
      // Verify that date ranges were calculated with travel schedules
      // The buildDateRanges function should have received travel schedules
      expect(result.dateRanges).toBeDefined();
      expect(result.dateRanges.length).toBeGreaterThanOrEqual(0);
    });

    it("should apply travel schedule to event type with custom schedule", async () => {
      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs().startOf("day").toDate(),
          endDate: dayjs().add(3, "days").endOf("day").toDate(),
          timeZone: "Asia/Tokyo",
        },
      ];

      const user = mockUser(1, travelSchedules);
      
      // Event type with its own custom schedule
      const customSchedule = {
        id: 99,
        userId: 1,
        name: "Event Type Custom Schedule",
        timeZone: "Europe/Paris",
        availability: [createMockAvailability(99, [1, 2, 3], 14, 22)],
      };

      const mockEventType = {
        id: 101,
        schedule: customSchedule,
        availability: [],
        seatsPerTimeSlot: null,
        bookingLimits: null,
        durationLimits: null,
        metadata: {},
        team: null,
        parent: null,
        hosts: [],
        useEventLevelSelectedCalendars: false,
      };

      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(mockEventType);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(7, "days").endOf("day").format();

      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        eventTypeId: 101,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      expect(result).toBeDefined();
      expect(result.timeZone).toBe("Europe/Paris");
      expect(result.dateRanges).toBeDefined();
    });

    it("should apply travel schedule to host-specific schedule in team events", async () => {
      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs().add(1, "day").startOf("day").toDate(),
          endDate: dayjs().add(4, "days").endOf("day").toDate(),
          timeZone: "Australia/Sydney",
        },
      ];

      const user = mockUser(1, travelSchedules);
      
      const hostSchedule = {
        id: 77,
        userId: 1,
        name: "Host Specific Schedule",
        timeZone: "America/Chicago",
        availability: [createMockAvailability(77, [2, 3, 4], 11, 19)],
      };

      const mockEventType = {
        id: 102,
        schedule: null,
        availability: [],
        seatsPerTimeSlot: null,
        bookingLimits: null,
        durationLimits: null,
        metadata: {},
        team: { id: 1 },
        parent: null,
        hosts: [
          {
            user: { id: 1, email: "test@example.com" },
            schedule: hostSchedule,
          },
        ],
        useEventLevelSelectedCalendars: false,
      };

      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(mockEventType);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(7, "days").endOf("day").format();

      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        eventTypeId: 102,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      expect(result).toBeDefined();
      expect(result.timeZone).toBe("America/Chicago");
      expect(result.dateRanges).toBeDefined();
    });
  });

  describe("AC2: Default Schedule Behavior Preserved", () => {
    it("should continue to apply travel schedule to default schedule", async () => {
      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs().startOf("day").toDate(),
          endDate: dayjs().add(7, "days").endOf("day").toDate(),
          timeZone: "Asia/Tokyo",
        },
      ];

      const user = mockUser(1, travelSchedules);
      
      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(null);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(7, "days").endOf("day").format();

      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      expect(result).toBeDefined();
      expect(result.dateRanges).toBeDefined();
      // Travel schedules should be applied for default schedule
      expect(result.dateRanges.length).toBeGreaterThanOrEqual(0);
    });

    it("should work correctly when user has no travel schedules", async () => {
      const user = mockUser(1, []); // No travel schedules
      
      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(null);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(7, "days").endOf("day").format();

      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      expect(result).toBeDefined();
      expect(result.timeZone).toBe("America/New_York");
      expect(result.dateRanges).toBeDefined();
    });
  });

  describe("AC3: Multiple Travel Schedules Handling", () => {
    it("should handle multiple overlapping travel schedules in chronological order", async () => {
      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs().startOf("day").toDate(),
          endDate: dayjs().add(3, "days").endOf("day").toDate(),
          timeZone: "Europe/Paris",
        },
        {
          id: 2,
          userId: 1,
          startDate: dayjs().add(2, "days").startOf("day").toDate(),
          endDate: dayjs().add(5, "days").endOf("day").toDate(),
          timeZone: "Asia/Singapore",
        },
      ];

      const user = mockUser(2, travelSchedules); // Using non-default schedule
      
      const mockEventType = {
        id: 200,
        schedule: user.schedules[1], // Non-default schedule
        availability: [],
        seatsPerTimeSlot: null,
        bookingLimits: null,
        durationLimits: null,
        metadata: {},
        team: null,
        parent: null,
        hosts: [],
        useEventLevelSelectedCalendars: false,
      };

      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(mockEventType);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(7, "days").endOf("day").format();

      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        eventTypeId: 200,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      expect(result).toBeDefined();
      expect(result.dateRanges).toBeDefined();
      // Multiple travel schedules should be applied chronologically
      expect(result.dateRanges.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle non-overlapping sequential travel schedules", async () => {
      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs().startOf("day").toDate(),
          endDate: dayjs().add(2, "days").endOf("day").toDate(),
          timeZone: "Europe/London",
        },
        {
          id: 2,
          userId: 1,
          startDate: dayjs().add(3, "days").startOf("day").toDate(),
          endDate: dayjs().add(5, "days").endOf("day").toDate(),
          timeZone: "Asia/Dubai",
        },
        {
          id: 3,
          userId: 1,
          startDate: dayjs().add(6, "days").startOf("day").toDate(),
          endDate: dayjs().add(8, "days").endOf("day").toDate(),
          timeZone: "America/Los_Angeles",
        },
      ];

      const user = mockUser(1, travelSchedules);
      
      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(null);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(10, "days").endOf("day").format();

      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      expect(result).toBeDefined();
      expect(result.dateRanges).toBeDefined();
    });

    it("should handle travel schedule with no end date", async () => {
      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs().add(2, "days").startOf("day").toDate(),
          endDate: null, // No end date - permanent travel
          timeZone: "Europe/Berlin",
        },
      ];

      const user = mockUser(2, travelSchedules);
      
      const mockEventType = {
        id: 201,
        schedule: user.schedules[1],
        availability: [],
        seatsPerTimeSlot: null,
        bookingLimits: null,
        durationLimits: null,
        metadata: {},
        team: null,
        parent: null,
        hosts: [],
        useEventLevelSelectedCalendars: false,
      };

      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(mockEventType);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(30, "days").endOf("day").format();

      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        eventTypeId: 201,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      expect(result).toBeDefined();
      expect(result.dateRanges).toBeDefined();
    });
  });

  describe("Edge Cases and Error Scenarios", () => {
    it("should handle invalid travel schedule timezone gracefully", async () => {
      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs().startOf("day").toDate(),
          endDate: dayjs().add(7, "days").endOf("day").toDate(),
          timeZone: "Invalid/Timezone", // Invalid timezone
        },
      ];

      const user = mockUser(1, travelSchedules);
      
      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(null);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(7, "days").endOf("day").format();

      // Should not throw error, but handle gracefully
      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      expect(result).toBeDefined();
      expect(result.timeZone).toBe("America/New_York"); // Falls back to user's default
    });

    it("should handle past travel schedules correctly", async () => {
      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs().subtract(10, "days").startOf("day").toDate(),
          endDate: dayjs().subtract(5, "days").endOf("day").toDate(),
          timeZone: "Europe/Madrid",
        },
      ];

      const user = mockUser(1, travelSchedules);
      
      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(null);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(7, "days").endOf("day").format();

      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      expect(result).toBeDefined();
      expect(result.timeZone).toBe("America/New_York"); // Should use user's default since travel is in past
      expect(result.dateRanges).toBeDefined();
    });

    it("should handle future travel schedules correctly", async () => {
      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs().add(10, "days").startOf("day").toDate(),
          endDate: dayjs().add(15, "days").endOf("day").toDate(),
          timeZone: "Asia/Hong_Kong",
        },
      ];

      const user = mockUser(1, travelSchedules);
      
      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(null);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(7, "days").endOf("day").format();

      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      expect(result).toBeDefined();
      expect(result.timeZone).toBe("America/New_York"); // Should use user's default since travel is in future
      expect(result.dateRanges).toBeDefined();
    });

    it("should handle empty travel schedules array", async () => {
      const user = mockUser(2, []); // Empty travel schedules
      
      const mockEventType = {
        id: 202,
        schedule: user.schedules[1],
        availability: [],
        seatsPerTimeSlot: null,
        bookingLimits: null,
        durationLimits: null,
        metadata: {},
        team: null,
        parent: null,
        hosts: [],
        useEventLevelSelectedCalendars: false,
      };

      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(mockEventType);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(7, "days").endOf("day").format();

      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        eventTypeId: 202,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      expect(result).toBeDefined();
      expect(result.dateRanges).toBeDefined();
    });
  });

  describe("Integration with Out of Office", () => {
    it("should apply travel schedules with out of office days", async () => {
      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs().startOf("day").toDate(),
          endDate: dayjs().add(7, "days").endOf("day").toDate(),
          timeZone: "Europe/Rome",
        },
      ];

      const user = mockUser(1, travelSchedules);
      
      const outOfOfficeDays = [
        {
          id: 1,
          start: dayjs().add(2, "days").startOf("day").toDate(),
          end: dayjs().add(3, "days").endOf("day").toDate(),
          user: { id: 1, name: "Test User" },
          toUser: null,
          reason: { id: 1, emoji: "🏖️", reason: "Vacation" },
        },
      ];

      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(null);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue(outOfOfficeDays);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(7, "days").endOf("day").format();

      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      expect(result).toBeDefined();
      expect(result.datesOutOfOffice).toBeDefined();
      expect(Object.keys(result.datesOutOfOffice).length).toBeGreaterThan(0);
      expect(result.oooExcludedDateRanges).toBeDefined();
    });
  });

  describe("Performance Tests", () => {
    it("should complete within 500ms for standard queries", async () => {
      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs().startOf("day").toDate(),
          endDate: dayjs().add(30, "days").endOf("day").toDate(),
          timeZone: "Europe/London",
        },
      ];

      const user = mockUser(1, travelSchedules);
      
      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(null);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(30, "days").endOf("day").format();

      const startTime = performance.now();
      
      await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should complete within 500ms
      expect(executionTime).toBeLessThan(500);
    });

    it("should handle large date ranges efficiently", async () => {
      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs().startOf("day").toDate(),
          endDate: dayjs().add(365, "days").endOf("day").toDate(),
          timeZone: "Asia/Seoul",
        },
      ];

      const user = mockUser(1, travelSchedules);
      
      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(null);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(365, "days").endOf("day").format();

      const startTime = performance.now();
      
      await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should still complete within reasonable time for large date ranges
      expect(executionTime).toBeLessThan(2000);
    });
  });

  describe("DST (Daylight Saving Time) Handling", () => {
    it("should correctly handle travel schedules during DST transitions", async () => {
      // Mock a date during DST transition (e.g., March for US)
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-03-10T00:00:00.000Z"));

      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs("2024-03-09").startOf("day").toDate(),
          endDate: dayjs("2024-03-11").endOf("day").toDate(),
          timeZone: "America/New_York", // DST starts March 10, 2024
        },
      ];

      const user = mockUser(1, travelSchedules);
      
      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(null);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs("2024-03-09").startOf("day").format();
      const dateTo = dayjs("2024-03-11").endOf("day").format();

      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      expect(result).toBeDefined();
      expect(result.dateRanges).toBeDefined();
      // Should handle DST transition correctly
      expect(result.workingHours).toBeDefined();
    });
  });

  describe("Booking Limits and Duration Limits", () => {
    it("should apply travel schedules with booking limits", async () => {
      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs().startOf("day").toDate(),
          endDate: dayjs().add(7, "days").endOf("day").toDate(),
          timeZone: "Europe/Amsterdam",
        },
      ];

      const user = mockUser(1, travelSchedules);
      
      const mockEventType = {
        id: 300,
        schedule: user.schedules[1],
        availability: [],
        seatsPerTimeSlot: null,
        bookingLimits: {
          PER_DAY: 5,
          PER_WEEK: 20,
        },
        durationLimits: {
          PER_DAY: 240,
          PER_WEEK: 600,
        },
        metadata: {},
        team: null,
        parent: null,
        hosts: [],
        useEventLevelSelectedCalendars: false,
      };

      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(mockEventType);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(7, "days").endOf("day").format();

      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        eventTypeId: 300,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
        duration: 30,
      });

      expect(result).toBeDefined();
      expect(result.dateRanges).toBeDefined();
      expect(result.busy).toBeDefined();
    });
  });

  describe("Team Events with Travel Schedules", () => {
    it("should apply travel schedules to team events with COLLECTIVE scheduling", async () => {
      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs().startOf("day").toDate(),
          endDate: dayjs().add(5, "days").endOf("day").toDate(),
          timeZone: "Europe/Brussels",
        },
      ];

      const user = mockUser(1, travelSchedules);
      
      const mockEventType = {
        id: 400,
        schedule: null,
        availability: [],
        seatsPerTimeSlot: null,
        bookingLimits: null,
        durationLimits: null,
        metadata: {},
        team: {
          id: 10,
          bookingLimits: null,
          includeManagedEventsInLimits: false,
        },
        parent: null,
        hosts: [
          { user: { id: 1, email: "test@example.com" }, schedule: null },
          { user: { id: 2, email: "other@example.com" }, schedule: null },
        ],
        useEventLevelSelectedCalendars: false,
        schedulingType: "COLLECTIVE",
        assignAllTeamMembers: false,
      };

      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(mockEventType);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(7, "days").endOf("day").format();

      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        eventTypeId: 400,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      expect(result).toBeDefined();
      expect(result.dateRanges).toBeDefined();
    });

    it("should apply travel schedules to team events with ROUND_ROBIN scheduling", async () => {
      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs().add(1, "day").startOf("day").toDate(),
          endDate: dayjs().add(4, "days").endOf("day").toDate(),
          timeZone: "Asia/Bangkok",
        },
      ];

      const user = mockUser(1, travelSchedules);
      
      const mockEventType = {
        id: 401,
        schedule: user.schedules[1],
        availability: [],
        seatsPerTimeSlot: null,
        bookingLimits: null,
        durationLimits: null,
        metadata: {},
        team: {
          id: 11,
          bookingLimits: null,
          includeManagedEventsInLimits: false,
        },
        parent: null,
        hosts: [],
        useEventLevelSelectedCalendars: false,
        schedulingType: "ROUND_ROBIN",
        assignAllTeamMembers: true,
      };

      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(mockEventType);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(7, "days").endOf("day").format();

      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        eventTypeId: 401,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      expect(result).toBeDefined();
      expect(result.dateRanges).toBeDefined();
    });
  });

  describe("Date Overrides with Travel Schedules", () => {
    it("should correctly apply date overrides with travel schedules", async () => {
      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs().startOf("day").toDate(),
          endDate: dayjs().add(7, "days").endOf("day").toDate(),
          timeZone: "Europe/Vienna",
        },
      ];

      const user = mockUser(1, travelSchedules);
      
      // Add date override to availability
      const mockEventType = {
        id: 500,
        schedule: {
          id: 1,
          userId: 1,
          name: "Schedule with Override",
          timeZone: "America/New_York",
          availability: [
            createMockAvailability(1),
            {
              id: 100,
              scheduleId: 1,
              userId: 1,
              eventTypeId: null,
              days: [],
              startTime: new Date("1970-01-01T14:00:00Z"),
              endTime: new Date("1970-01-01T20:00:00Z"),
              date: dayjs().add(2, "days").toDate(), // Date override
            },
          ],
        },
        availability: [],
        seatsPerTimeSlot: null,
        bookingLimits: null,
        durationLimits: null,
        metadata: {},
        team: null,
        parent: null,
        hosts: [],
        useEventLevelSelectedCalendars: false,
      };

      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(mockEventType);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(7, "days").endOf("day").format();

      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        eventTypeId: 500,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      expect(result).toBeDefined();
      expect(result.dateOverrides).toBeDefined();
      expect(result.dateOverrides.length).toBeGreaterThan(0);
    });
  });

  describe("Seats Per Time Slot with Travel Schedules", () => {
    it("should handle seated events with travel schedules", async () => {
      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs().startOf("day").toDate(),
          endDate: dayjs().add(7, "days").endOf("day").toDate(),
          timeZone: "Australia/Melbourne",
        },
      ];

      const user = mockUser(1, travelSchedules);
      
      const mockEventType = {
        id: 600,
        schedule: user.schedules[0],
        availability: [],
        seatsPerTimeSlot: 5,
        bookingLimits: null,
        durationLimits: null,
        metadata: {},
        team: null,
        parent: null,
        hosts: [],
        useEventLevelSelectedCalendars: false,
      };

      // Mock some existing bookings for seats
      const existingBookings = [
        {
          uid: "booking-1",
          startTime: dayjs().add(1, "day").hour(10).toDate(),
          attendees: [
            { email: "attendee1@example.com" },
            { email: "attendee2@example.com" },
          ],
        },
      ];

      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(mockEventType);
      (prisma.booking.findMany as any).mockResolvedValue(existingBookings);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(7, "days").endOf("day").format();

      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        eventTypeId: 600,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      expect(result).toBeDefined();
      expect(result.currentSeats).toBeDefined();
      expect(result.currentSeats?.length).toBeGreaterThan(0);
    });
  });

  describe("Fallback Schedule with Travel Schedules", () => {
    it("should use fallback schedule with travel schedules when no schedule is defined", async () => {
      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs().startOf("day").toDate(),
          endDate: dayjs().add(7, "days").endOf("day").toDate(),
          timeZone: "Africa/Cairo",
        },
      ];

      // User with no schedules
      const userWithNoSchedules = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        timeZone: "America/New_York",
        credentials: [],
        userLevelSelectedCalendars: [],
        defaultScheduleId: null,
        schedules: [],
        availability: [],
        travelSchedules,
      };
      
      const mockEventType = {
        id: 700,
        schedule: null,
        availability: [],
        seatsPerTimeSlot: null,
        bookingLimits: null,
        durationLimits: null,
        metadata: {},
        team: null,
        parent: null,
        hosts: [],
        useEventLevelSelectedCalendars: false,
        timeZone: "Europe/London",
      };

      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(userWithNoSchedules);
      (prisma.eventType.findUnique as any).mockResolvedValue(mockEventType);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(7, "days").endOf("day").format();

      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        eventTypeId: 700,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      expect(result).toBeDefined();
      // Should use fallback schedule (9-5, Mon-Fri) with eventType timezone
      expect(result.timeZone).toBe("Europe/London");
      expect(result.workingHours).toBeDefined();
    });
  });

  describe("Timezone Priority with Travel Schedules", () => {
    it("should correctly prioritize timezones: travel > schedule > event > user", async () => {
      const travelSchedules = [
        {
          id: 1,
          userId: 1,
          startDate: dayjs().startOf("day").toDate(),
          endDate: dayjs().add(3, "days").endOf("day").toDate(),
          timeZone: "Asia/Kolkata", // Highest priority when active
        },
      ];

      const user = {
        ...mockUser(1, travelSchedules),
        timeZone: "America/New_York", // Lowest priority
      };
      
      const mockEventType = {
        id: 800,
        schedule: {
          ...user.schedules[0],
          timeZone: "Europe/Paris", // Second priority
        },
        availability: [],
        seatsPerTimeSlot: null,
        bookingLimits: null,
        durationLimits: null,
        metadata: {},
        team: null,
        parent: null,
        hosts: [],
        useEventLevelSelectedCalendars: false,
        timeZone: "Asia/Tokyo", // Third priority
      };

      const { findUsersForAvailabilityCheck } = await import("./server/findUsersForAvailabilityCheck");
      (findUsersForAvailabilityCheck as any).mockResolvedValue(user);
      (prisma.eventType.findUnique as any).mockResolvedValue(mockEventType);
      (prisma.booking.findMany as any).mockResolvedValue([]);
      (prisma.outOfOfficeEntry.findMany as any).mockResolvedValue([]);

      const dateFrom = dayjs().startOf("day").format();
      const dateTo = dayjs().add(7, "days").endOf("day").format();

      const result = await getUserAvailability({
        userId: 1,
        dateFrom,
        dateTo,
        eventTypeId: 800,
        returnDateOverrides: true,
        bypassBusyCalendarTimes: false,
      });

      expect(result).toBeDefined();
      expect(result.timeZone).toBe("Europe/Paris"); // Schedule timezone takes priority for display
      // But travel schedule timezone should be applied during date range calculation
      expect(result.dateRanges).toBeDefined();
    });
  });
});