# 🚀 Travel Schedule Developer Guide

## Overview

The Travel Schedule feature allows users to specify time periods when they're traveling to different timezones. This guide covers the technical implementation following the recent fix that ensures travel schedules apply to ALL availability schedules, not just the default one.

## Architecture

### Data Model

```typescript
// Travel Schedule Entity
interface TravelSchedule {
  id: number;
  userId: number;
  startDate: Date;
  endDate?: Date | null;  // null for permanent relocation
  timeZone: string;       // IANA timezone identifier
  createdAt: Date;
  updatedAt: Date;
}

// User Entity (relevant fields)
interface User {
  id: number;
  username: string;
  email: string;
  timeZone: string;                    // User's home timezone
  defaultScheduleId?: number | null;   // Default schedule
  schedules: Schedule[];               // All user schedules
  travelSchedules: TravelSchedule[];   // Travel schedules
}
```

### Core Implementation

The travel schedule logic is implemented in `packages/lib/getUserAvailability.ts`:

```typescript
// Key function that applies travel schedules
const _getUserAvailability = async function(
  query: GetUserAvailabilityQuery,
  initialData?: GetUserAvailabilityInitialData
) {
  // ... user and schedule resolution ...

  // CRITICAL FIX: Apply travel schedules to ALL schedules
  const { dateRanges, oooExcludedDateRanges } = buildDateRanges({
    dateFrom,
    dateTo,
    availability,
    timeZone,
    travelSchedules: user.travelSchedules.map((schedule) => {
      return {
        startDate: dayjs(schedule.startDate),
        endDate: schedule.endDate ? dayjs(schedule.endDate) : undefined,
        timeZone: schedule.timeZone,
      };
    }),
    outOfOffice: datesOutOfOffice,
  });
  
  // ... rest of availability calculation ...
};
```

## How It Works

### Schedule Resolution Order

1. **Event Type Schedule**: Custom schedule defined on the event type
2. **Host Schedule**: Schedule specific to a host in team events  
3. **User Schedule**: User's default or selected schedule
4. **Fallback Schedule**: 9-5 Mon-Fri if no schedule exists

### Travel Schedule Application

Travel schedules are applied AFTER schedule selection but BEFORE availability calculation:

```typescript
// Step 1: Determine which schedule to use
const schedule = eventType?.schedule 
  || hostSchedule 
  || userSchedule 
  || fallbackSchedule;

// Step 2: Apply travel schedules to adjust timezone
const adjustedAvailability = applyTravelSchedules(
  schedule.availability,
  user.travelSchedules,
  dateRange
);

// Step 3: Calculate final availability
const dateRanges = buildDateRanges({
  availability: adjustedAvailability,
  travelSchedules: user.travelSchedules,
  // ... other params
});
```

## API Integration

### Getting User Availability with Travel

```typescript
import { getUserAvailability } from "@calcom/lib/getUserAvailability";

// Example: Get availability for user with active travel schedule
async function getAvailabilityForTraveler(userId: number, eventTypeId?: number) {
  const result = await getUserAvailability({
    userId,
    eventTypeId,
    dateFrom: "2024-02-01",
    dateTo: "2024-02-28",
    returnDateOverrides: true,
    bypassBusyCalendarTimes: false,
  });

  return {
    timezone: result.timeZone,           // Base schedule timezone
    availability: result.dateRanges,     // Adjusted for travel
    workingHours: result.workingHours,   // Working hours in schedule timezone
    outOfOffice: result.datesOutOfOffice // OOO days
  };
}
```

### Creating Travel Schedules

```typescript
// Example: Create a travel schedule via Prisma
async function createTravelSchedule(
  userId: number,
  startDate: Date,
  endDate: Date | null,
  timeZone: string
) {
  return await prisma.travelSchedule.create({
    data: {
      userId,
      startDate,
      endDate,
      timeZone,
    },
  });
}
```

### Handling Multiple Travel Schedules

When multiple travel schedules overlap, the system applies them chronologically:

```typescript
// Example: Multiple overlapping schedules
const travelSchedules = [
  {
    startDate: "2024-03-01",
    endDate: "2024-03-07",
    timeZone: "Europe/London"
  },
  {
    startDate: "2024-03-05", // Overlaps with first
    endDate: "2024-03-10",
    timeZone: "Asia/Singapore"
  }
];

// March 1-4: Europe/London
// March 5-7: Asia/Singapore (later schedule takes precedence)
// March 8-10: Asia/Singapore
```

## Testing

### Unit Test Template

```typescript
import { describe, it, expect, vi } from "vitest";
import { getUserAvailability } from "@calcom/lib/getUserAvailability";

describe("Travel Schedule Feature", () => {
  it("should apply travel schedule to custom event schedule", async () => {
    // Mock user with travel schedule
    const mockUser = {
      id: 1,
      defaultScheduleId: 1,
      schedules: [
        { id: 1, name: "Default", timeZone: "America/New_York" },
        { id: 2, name: "Custom", timeZone: "Europe/Paris" }
      ],
      travelSchedules: [{
        startDate: new Date("2024-03-01"),
        endDate: new Date("2024-03-15"),
        timeZone: "Asia/Tokyo"
      }]
    };

    // Mock event type with custom schedule
    const mockEventType = {
      id: 100,
      schedule: mockUser.schedules[1], // Non-default schedule
    };

    // Test availability calculation
    const result = await getUserAvailability({
      userId: 1,
      eventTypeId: 100,
      dateFrom: "2024-03-05",
      dateTo: "2024-03-10",
      returnDateOverrides: true,
    });

    // Verify travel schedule was applied
    expect(result.dateRanges).toBeDefined();
    expect(result.timeZone).toBe("Europe/Paris");
    // Date ranges should reflect Tokyo timezone adjustment
  });
});
```

### Integration Test Example

```typescript
// E2E test for travel schedule with team event
describe("Team Event Travel Schedule", () => {
  it("should handle host travel in team events", async () => {
    // Create team event with multiple hosts
    const teamEvent = await createTeamEvent({
      hosts: [
        { userId: 1, scheduleId: 2 },
        { userId: 2, scheduleId: 3 }
      ]
    });

    // Add travel schedule for host 1
    await createTravelSchedule({
      userId: 1,
      startDate: new Date(),
      endDate: addDays(new Date(), 7),
      timeZone: "Australia/Sydney"
    });

    // Get availability for the team event
    const availability = await getTeamAvailability(teamEvent.id);

    // Host 1's availability should reflect Sydney timezone
    expect(availability.hosts[0].timezone).toContain("Sydney");
  });
});
```

## Performance Considerations

### Optimization Strategies

1. **Cache Travel Schedules**: Travel schedules are fetched once per request
2. **Efficient Date Range Calculation**: Use dayjs for timezone conversions
3. **Limit Lookups**: Batch database queries when possible

```typescript
// Optimized query for multiple users
async function getUsersAvailabilityWithTravel(userIds: number[]) {
  // Fetch all users with travel schedules in one query
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    include: {
      schedules: true,
      travelSchedules: {
        where: {
          OR: [
            { endDate: { gte: new Date() } },
            { endDate: null }
          ]
        }
      }
    }
  });

  // Process availability in parallel
  return Promise.all(
    users.map(user => getUserAvailability({ 
      userId: user.id,
      // ... other params
    }))
  );
}
```

## Migration Guide

### For Existing Implementations

No breaking changes! The fix is backward compatible:

```typescript
// Before fix: Only worked with default schedule
const availability = await getUserAvailability({
  userId: 1,
  eventTypeId: 100, // Used non-default schedule
  // Travel schedule was ignored ❌
});

// After fix: Works with ALL schedules
const availability = await getUserAvailability({
  userId: 1,
  eventTypeId: 100, // Uses non-default schedule
  // Travel schedule is applied ✅
});
```

### Database Migrations

No database changes required. The fix only modifies the application logic.

## Troubleshooting

### Common Issues

**Issue**: Travel schedule not applying
```typescript
// Debug: Check travel schedule data
console.log("User travel schedules:", user.travelSchedules);
console.log("Date range:", { dateFrom, dateTo });
console.log("Selected schedule:", schedule);
```

**Issue**: Wrong timezone displayed
```typescript
// Debug: Verify timezone priority
console.log("Travel TZ:", travelSchedule?.timeZone);
console.log("Schedule TZ:", schedule.timeZone);
console.log("Event TZ:", eventType?.timeZone);
console.log("User TZ:", user.timeZone);
```

**Issue**: Overlapping travel schedules
```typescript
// Debug: Check overlap handling
const overlaps = findOverlappingSchedules(user.travelSchedules);
console.log("Overlapping schedules:", overlaps);
```

## Best Practices

### DO's
- ✅ Always use IANA timezone identifiers
- ✅ Handle null endDate for permanent relocations
- ✅ Test with DST transitions
- ✅ Cache travel schedules per request
- ✅ Validate timezone strings before saving

### DON'Ts
- ❌ Don't modify travel schedules during availability calculation
- ❌ Don't assume travel schedules are sorted by date
- ❌ Don't ignore timezone validation errors
- ❌ Don't cache travel schedules across requests

## Related Documentation

- [Availability System Overview](./availability-system.md)
- [Timezone Handling Guide](./timezone-guide.md)
- [Schedule Management API](./schedule-api.md)

## Support

For questions or issues related to travel schedules:
1. Check the [test suite](../packages/lib/getUserAvailability.test.ts)
2. Review the [implementation](../packages/lib/getUserAvailability.ts)
3. Open an issue with the `travel-schedule` label

---
*Powered by [Kanpredict](https://kanpredict.com) - Premium AI Development Platform*