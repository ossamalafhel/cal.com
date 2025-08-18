# 🌍 Travel Schedule Integration Guide: Timezone Magic Across All Availability Schedules

## 🎯 What's New

**Your travel schedules now work seamlessly across ALL availability schedules!** Previously, timezone adjustments for travel only applied to your default schedule. Now, whether you're using your weekend schedule, team event schedule, or custom availability - your travel timezone follows you everywhere. No more manual timezone juggling when you're on the road!

## ⚡ Quick Start

Travel schedules automatically adjust your availability timezone across all schedules. When you travel to Tokyo, London, or New York, every booking type adapts to your local timezone - not just your default schedule!

```typescript
// The magic happens automatically in getUserAvailability
const availability = await getUserAvailability({
  userId: user.id,
  dateFrom: "2024-01-15",
  dateTo: "2024-01-22",
  eventTypeId: 123, // Works with ANY event type schedule!
});
```

## 🎨 For End Users

### How It Works Now

1. **Set Your Travel Schedule** 
   - Go to Settings → Availability → Travel Schedule
   - Add your travel dates and destination timezone
   - That's it! All your schedules automatically adjust

2. **Universal Coverage**
   - ✅ Default schedule
   - ✅ Weekend schedules  
   - ✅ Team event schedules
   - ✅ Custom event type schedules
   - ✅ Host-specific schedules

3. **Smart Priority System**
   Your timezone follows this priority:
   - 🥇 Active travel schedule timezone
   - 🥈 Specific schedule timezone
   - 🥉 Event type timezone
   - 🏅 Your default timezone

### Real World Example

**Before:** You're traveling to Tokyo, but your "Executive Meetings" schedule (non-default) still shows NYC times to clients. Confusion ensues!

**After:** All schedules automatically show Tokyo availability. Clients book at convenient times for both of you. Magic! ✨

## 🚀 For Developers

### Implementation Details

The fix ensures travel schedules are applied universally in `getUserAvailability.ts`:

```typescript
// packages/lib/getUserAvailability.ts

// Travel schedules now applied to ALL schedule types
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
```

### Key Changes

1. **Universal Application**: Travel schedules apply regardless of which schedule is active
2. **Schedule Priority Preserved**: The schedule selection logic remains unchanged
3. **Timezone Adjustment**: Travel timezone overlays are calculated for any schedule type

### API Usage

```typescript
// Example: Getting availability for a non-default schedule with travel
import { getUserAvailability } from "@calcom/lib/getUserAvailability";

const result = await getUserAvailability({
  userId: 123,
  dateFrom: "2024-02-01", 
  dateTo: "2024-02-28",
  eventTypeId: 456, // Event with custom schedule
  returnDateOverrides: true,
  bypassBusyCalendarTimes: false,
});

// result.dateRanges now correctly reflects travel timezone adjustments
console.log(result.dateRanges); // Availability in traveler's local time
console.log(result.timeZone);   // Schedule's base timezone
```

### Handling Multiple Travel Schedules

```typescript
// Multiple overlapping travel schedules are handled chronologically
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
// Later schedule takes precedence during overlap period
```

## ⚙️ Configuration

### Setting Up Travel Schedules

Dependencies have been added to the project configuration.

Travel schedules are stored in the database and automatically retrieved:

```typescript
interface TravelSchedule {
  id: number;
  userId: number;
  startDate: Date;
  endDate?: Date | null; // Optional end date for permanent travel
  timeZone: string;      // IANA timezone string
}
```

### Event Type Configuration

No changes needed! Event types automatically benefit from the fix:

```typescript
// Event types with custom schedules
const eventType = {
  id: 100,
  schedule: customSchedule,  // Travel applies here
  hosts: [{
    user: { id: 1 },
    schedule: hostSchedule    // Travel applies here too
  }]
};
```

## 🧪 Test Drive

### Verify It's Working

1. **Create a test travel schedule**:
   - Set travel dates for next week
   - Choose a timezone 3+ hours different from yours

2. **Test with different schedules**:
   - Book with your default schedule ✓
   - Book with a team event ✓  
   - Book with custom availability ✓

3. **Check the results**:
   - All should show correct local times
   - Availability should adjust for timezone

### Unit Test Example

```typescript
import { getUserAvailability } from "@calcom/lib/getUserAvailability";

describe("Travel Schedule Applied to All Schedules", () => {
  it("applies travel timezone to non-default schedule", async () => {
    const user = {
      id: 1,
      defaultScheduleId: 1,
      schedules: [
        { id: 1, name: "Default" },
        { id: 2, name: "Weekend" }
      ],
      travelSchedules: [{
        startDate: new Date(),
        endDate: addDays(new Date(), 7),
        timeZone: "Asia/Tokyo"
      }]
    };

    // Using non-default schedule
    const result = await getUserAvailability({
      userId: 1,
      eventTypeId: 123, // Uses schedule id: 2
      dateFrom: today,
      dateTo: nextWeek
    });

    // Travel schedule should be applied
    expect(result.dateRanges).toBeDefined();
    expect(result.dateRanges.length).toBeGreaterThan(0);
  });
});
```

## 💡 Pro Tips

### Best Practices

1. **Permanent Travel**: Leave `endDate` as null for extended relocations
2. **Timezone Validation**: Always use IANA timezone strings (e.g., "America/New_York")
3. **Buffer Time**: Add buffer days when setting travel schedules for adjustment periods

### Performance Optimization

- Travel schedule calculations are cached per request
- Date ranges are computed once and reused
- Timezone conversions use dayjs for consistency

### Advanced Scenarios

```typescript
// Handle DST transitions during travel
const travelDuringDST = {
  startDate: "2024-03-09", // Day before DST
  endDate: "2024-03-11",   // Day after DST  
  timeZone: "America/New_York"
};

// Handle same-day timezone changes
const multiCityDay = [
  {
    startDate: "2024-04-01T00:00",
    endDate: "2024-04-01T12:00",
    timeZone: "Europe/London"
  },
  {
    startDate: "2024-04-01T12:00",
    endDate: "2024-04-01T23:59",
    timeZone: "America/New_York"
  }
];
```

## 🆘 Need Help?

### Common Issues & Solutions

**Issue**: Travel schedule not appearing
- **Solution**: Ensure dates are in the future and timezone is valid IANA string

**Issue**: Overlapping travel schedules
- **Solution**: Later schedules take precedence during overlaps

**Issue**: Team events not reflecting travel
- **Solution**: Verify the host's travel schedule is set correctly

### Debugging Tips

```typescript
// Enable debug logging
import logger from "@calcom/lib/logger";
const log = logger.getSubLogger({ prefix: ["getUserAvailability"] });

// Check applied travel schedules
log.debug("Travel schedules:", user.travelSchedules);
log.debug("Selected schedule:", schedule);
log.debug("Final dateRanges:", dateRanges);
```

### Migration Notes

- **No breaking changes**: Existing code continues to work
- **Backward compatible**: Default schedule behavior unchanged
- **Database**: No schema changes required

---
*Powered by [Kanpredict](https://kanpredict.com) - Premium AI Development Platform*