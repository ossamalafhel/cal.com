# Technical Architecture: Fix Travel Schedule for All Availability Schedules

## Architecture Overview
Simple bug fix to ensure travel schedule timezone changes apply to ALL availability schedules, not just the default schedule. The fix modifies the condition check in `getUserAvailability.ts` to always include travel schedules regardless of which schedule is being evaluated.

## Components

### Component 1: Availability Calculation Service
**Type:** Service/Library
**File Path:** `/workspace/repo/cal.com/packages/lib/getUserAvailability.ts`
**Purpose:** Calculate user availability considering travel schedules for all schedules
**Implementation Details:**
- Remove the `isDefaultSchedule` condition check for travel schedules
- Apply travel schedules to all availability schedules universally
- Maintain backward compatibility with existing functionality

#### Interfaces
```typescript
// No new interfaces needed - using existing structures
interface TravelSchedule {
  startDate: Dayjs;
  endDate?: Dayjs;
  timeZone: string;
}
```

## API Endpoints

No new API endpoints required. Existing endpoints that call `getUserAvailability` will automatically benefit from the fix:
- `/api/trpc/viewer/slots/getSchedule`
- `/api/trpc/viewer/availability/schedule`

## Data Models

No changes to data models. Using existing models:
- `TravelSchedule` (Prisma model)
- `Schedule` (Prisma model)
- `Availability` (Prisma model)

## Implementation Files

| File Path | Change Type | Description |
|-----------|-------------|-------------|
| `/workspace/repo/cal.com/packages/lib/getUserAvailability.ts` | Modify | Remove isDefaultSchedule condition for travel schedules (lines 588-596) |
| `/workspace/repo/cal.com/packages/lib/getUserAvailability.test.ts` | Create/Modify | Add test cases for travel schedules with multiple availability schedules |

## Technical Challenges & Solutions

1. **Challenge:** Travel schedules only apply to default schedule
   **Solution:** Remove the conditional check and apply travel schedules to all schedule evaluations

2. **Challenge:** Performance impact of applying to all schedules
   **Solution:** Minimal impact as we're already fetching travel schedules; just using them consistently

## Deployment Strategy

1. Deploy fix to staging environment
2. Test with users having multiple schedules and travel schedules
3. Verify no performance regression
4. Deploy to production with feature flag if needed

### Rollback Procedure
1. Revert the code change in getUserAvailability.ts
2. Deploy previous version