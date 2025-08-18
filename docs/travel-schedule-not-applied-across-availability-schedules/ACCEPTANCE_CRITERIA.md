# Fix Travel Schedule for All Availability Schedules

## Acceptance Criteria

### AC1: Travel Schedule Applied to Non-Default Schedules
**Given:** A user has multiple availability schedules and an active travel schedule
**When:** The system calculates availability for a non-default schedule
**Then:** The travel schedule timezone is applied to the availability calculation
**Affected Files:** 
- `/workspace/repo/cal.com/packages/lib/getUserAvailability.ts`
**Test Type:** CI TESTABLE
**Test Implementation:** Unit test in `/workspace/repo/cal.com/packages/lib/getUserAvailability.test.ts` mocking multiple schedules with travel data

### AC2: Default Schedule Behavior Preserved
**Given:** A user has a default schedule with travel schedule
**When:** The system calculates availability for the default schedule
**Then:** Travel schedule continues to work as before
**Affected Files:**
- `/workspace/repo/cal.com/packages/lib/getUserAvailability.ts`
**Test Type:** CI TESTABLE
**Test Implementation:** Regression test ensuring existing default schedule behavior unchanged

### AC3: Multiple Travel Schedules Handling
**Given:** A user has overlapping travel schedules
**When:** Calculating availability for any schedule
**Then:** All travel schedules are correctly applied in chronological order
**Affected Files:**
- `/workspace/repo/cal.com/packages/lib/getUserAvailability.ts`
**Test Type:** CI TESTABLE
**Test Implementation:** Unit test with multiple travel schedule entries

### AC4: API Response Consistency
**Given:** API endpoints using getUserAvailability
**When:** Requesting availability with travel schedules
**Then:** Response includes correct timezone-adjusted slots
**Affected Files:**
- `/api/trpc/viewer/slots/getSchedule`
- `/api/trpc/viewer/availability/schedule`
**Test Type:** CI TESTABLE
**Test Implementation:** Integration test verifying API responses match expected timezone adjustments

### AC5: Performance Maintained
**Given:** The fix is deployed
**When:** Calculating availability with multiple schedules
**Then:** Response time remains under 500ms for standard queries
**Affected Files:**
- `/workspace/repo/cal.com/packages/lib/getUserAvailability.ts`
**Test Type:** CI TESTABLE
**Test Implementation:** Performance test comparing before/after response times

## Error Scenarios

### ES1: Invalid Travel Schedule Data
**Scenario:** Travel schedule has invalid timezone
**Expected Behavior:** Gracefully fallback to user's default timezone
**Affected Files:**
- `/workspace/repo/cal.com/packages/lib/getUserAvailability.ts`
**Test Type:** CI TESTABLE