# Technical Architecture: Timezone Selector Enhancement for Booking Page

## Architecture Overview
Add timezone filtering to event types by storing allowed timezones in EventType metadata and filtering the TimezoneSelect component based on these settings. MVP focuses on manual timezone selection per event type.

## Components

### Component 1: EventType Settings UI
**Type:** UI Component  
**File Path:** `/workspace/repo/cal.com/apps/web/modules/event-types/components/TimezoneFilterSettings.tsx`  
**Purpose:** Allow event hosts to select which timezones appear in booking page dropdown  
**Implementation Details:**
- Multi-select dropdown using existing UI components
- Saves selected timezones to EventType metadata.allowedTimezones array
- Default: all timezones (no filter)

#### Interfaces
```typescript
interface TimezoneFilterProps {
  eventType: { metadata?: { allowedTimezones?: string[] } };
  onUpdate: (timezones: string[]) => void;
}
```

### Component 2: Enhanced TimezoneSelect
**Type:** UI Component  
**File Path:** `/workspace/repo/cal.com/packages/features/components/timezone-select/TimezoneSelect.tsx`  
**Purpose:** Filter displayed timezones based on event type configuration  
**Implementation Details:**
- Accept new `allowedTimezones` prop
- Filter timezone list if prop provided
- Maintain existing search functionality

#### Interfaces
```typescript
interface TimezoneSelectProps {
  allowedTimezones?: string[];
  // ... existing props
}
```

## API Endpoints

### Endpoint: /api/trpc/viewer.eventTypes.update
**Method:** PATCH  
**File Path:** `/workspace/repo/cal.com/packages/trpc/server/routers/viewer/eventTypes/update.handler.ts`  
**Purpose:** Save timezone filter settings to EventType metadata

#### Request Schema
**Content Type:** application/json  
**Parameters:**
- `metadata.allowedTimezones` (string[]): Array of timezone identifiers [optional]

**Example Request:**
```json
{
  "metadata": {
    "allowedTimezones": ["America/New_York", "America/Los_Angeles", "America/Chicago"]
  }
}
```

#### Response Schema
**Success (200 OK):**
```json
{
  "eventType": {
    "id": 123,
    "metadata": {
      "allowedTimezones": ["America/New_York", "America/Los_Angeles"]
    }
  }
}
```

## Data Models

### Model: EventType Metadata Extension
**File Path:** `/workspace/repo/cal.com/packages/prisma/zod-utils.ts`  
**Fields:**
- `allowedTimezones` (string[]): Array of IANA timezone identifiers [optional]

**Relationships:**
- Stored in existing EventType.metadata JSON field

## Implementation Files

| File Path | Change Type | Description |
|-----------|-------------|-------------|
| /packages/features/components/timezone-select/TimezoneSelect.tsx | Modify | Add allowedTimezones prop and filtering logic |
| /apps/web/modules/event-types/components/TimezoneFilterSettings.tsx | Create | Timezone selection UI component |
| /packages/features/bookings/Booker/components/EventMeta.tsx | Modify | Pass allowedTimezones to TimezoneSelect |
| /packages/prisma/zod-utils.ts | Modify | Add allowedTimezones to EventTypeMetaDataSchema |

## Technical Challenges & Solutions
1. **Timezone validation:** Validate IANA timezone identifiers against known list to prevent invalid entries

## Deployment Strategy
1. Deploy schema update (backward compatible)
2. Enable feature flag for gradual rollout

### Rollback Procedure
1. Disable feature flag
2. Revert UI components (metadata field remains harmless)