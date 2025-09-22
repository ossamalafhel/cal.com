# Timezone Selector Enhancement for Booking Page

## Acceptance Criteria

### AC1: Store Timezone Filter in EventType
**Given:** An event type with no timezone restrictions  
**When:** Host saves timezone filter settings via API  
**Then:** Selected timezones are stored in EventType metadata  
**Affected Files:**
- `/packages/prisma/zod-utils.ts`
- `/packages/trpc/server/routers/viewer/eventTypes/update.handler.ts`
**Test Type:** CI TESTABLE  
**Test Implementation:** Unit test in `update.handler.test.ts` - POST request with `metadata.allowedTimezones` array, verify database storage

### AC2: Filter Timezones in Booking Page
**Given:** EventType has allowedTimezones configured  
**When:** Booker opens timezone dropdown  
**Then:** Only configured timezones appear in list  
**Affected Files:**
- `/packages/features/components/timezone-select/TimezoneSelect.tsx`
- `/packages/features/bookings/Booker/components/EventMeta.tsx`
**Test Type:** CI TESTABLE  
**Test Implementation:** Component test in `TimezoneSelect.test.tsx` - render with `allowedTimezones` prop, verify filtered options

### AC3: Settings UI for Timezone Selection
**Given:** Host editing event type settings  
**When:** Host selects specific timezones from multi-select  
**Then:** Selection saved to EventType metadata on form submit  
**Affected Files:**
- `/apps/web/modules/event-types/components/TimezoneFilterSettings.tsx`
**Test Type:** MANUAL  
**Test Implementation:** Manual verification of UI component rendering and form submission

### AC4: Default to All Timezones
**Given:** EventType has no timezone filter configured  
**When:** Booker opens timezone dropdown  
**Then:** All available timezones display (existing behavior)  
**Affected Files:**
- `/packages/features/components/timezone-select/TimezoneSelect.tsx`
**Test Type:** CI TESTABLE  
**Test Implementation:** Component test verifying default behavior when `allowedTimezones` prop is undefined

### AC5: Validate Timezone Identifiers
**Given:** Host submits timezone filter settings  
**When:** API receives timezone array  
**Then:** Only valid IANA timezone identifiers are saved  
**Affected Files:**
- `/packages/prisma/zod-utils.ts`
**Test Type:** CI TESTABLE  
**Test Implementation:** Schema validation test ensuring invalid timezones are rejected

## UI Requirements

### UI1: Timezone Multi-Select Component
**Description:** Multi-select dropdown for timezone selection  
**File Path:** `/apps/web/modules/event-types/components/TimezoneFilterSettings.tsx`  
**Behavior:** Search-enabled dropdown with checkbox selection  
**Layout:** Below other event settings, labeled "Allowed Timezones"  
**Test Type:** MANUAL