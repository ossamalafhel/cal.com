# 🌍 Timezone Dropdown Filter - Multi-Select with US Priority

## 🎯 What's New

Transform your booking experience with intelligent timezone filtering! This powerful feature gives event organizers complete control over which timezones their attendees can select from, while prioritizing US timezones for a seamless North American booking experience. 

Say goodbye to overwhelming timezone lists and hello to a curated, user-friendly selection that puts your preferred regions front and center!

## ⚡ Quick Start

Get your timezone filtering up and running in seconds:

1. Navigate to your Event Type settings
2. Open the "Advanced" tab
3. Toggle "Timezone Selection" to ON
4. Select your allowed timezones from the dropdown
5. Save your changes - that's it! 🎉

## 🎨 For End Users

### Setting Up Timezone Filtering

#### Step 1: Access Event Type Settings
Navigate to your event type and click on the settings gear icon. Scroll to find the "Advanced" tab where all the magic happens.

#### Step 2: Enable Timezone Filtering
Look for the **"Timezone Selection"** toggle. When you flip this switch, you'll unlock the power to control exactly which timezones your bookers can choose from.

#### Step 3: Select Your Timezones
Once enabled, you'll see a beautiful multi-select dropdown featuring:
- **🇺🇸 Priority US Timezones** at the top for quick access:
  - Eastern Time - New York
  - Central Time - Chicago  
  - Mountain Time - Denver & Phoenix
  - Pacific Time - Los Angeles
  - Alaska Time - Anchorage
  - Hawaii Time - Honolulu
- **🌐 Global Timezones** alphabetically sorted below

Simply click to add timezones to your allowed list. Each selection shows with a globe icon and can be removed with a single click.

#### Step 4: Visual Feedback
The interface provides real-time feedback:
- **Selected count** displays how many timezones you've chosen
- **Warning message** appears if filtering is enabled but no timezones selected
- **Clear visual indicators** with icons for each timezone

### The Booking Experience

When your attendees book:
1. They'll only see the timezones you've approved
2. US timezones appear first for easy selection
3. Search functionality helps find specific cities quickly
4. The clean, organized list prevents confusion

## 🚀 For Developers

### Implementation Overview

The timezone filtering system consists of three main components working in harmony:

#### 1. TimezoneFilterSettings Component

```tsx
import { TimezoneFilterSettings } from "@calcom/features/eventtypes/components/TimezoneFilterSettings";

// In your event type form
<TimezoneFilterSettings 
  eventType={eventType}
  customClassNames={{
    container: "my-custom-container",
    toggle: {
      container: "toggle-wrapper",
      title: "toggle-title",
      description: "toggle-desc"
    },
    select: {
      container: "select-wrapper",
      label: "select-label"
    }
  }}
/>
```

#### 2. TimezoneSelect with Filtering

```tsx
import { TimezoneSelect } from "@calcom/features/components/timezone-select/TimezoneSelect";

// Use with allowed timezones
<TimezoneSelect
  value={selectedTimezone}
  onChange={({ value }) => setSelectedTimezone(value)}
  allowedTimezones={["America/New_York", "America/Los_Angeles", "Europe/London"]}
  menuPosition="absolute"
/>
```

#### 3. Validation Helper

```tsx
import { validateAllowedTimezones, filterValidTimezones } from "@calcom/lib/validateAllowedTimezones";

// Validate timezone array
const validation = validateAllowedTimezones(timezones);
if (!validation.isValid) {
  console.error(validation.error);
  // Handle invalid timezones: validation.invalidTimezones
}

// Filter out invalid entries
const validTimezones = filterValidTimezones(userSubmittedTimezones);
```

### Data Structure

The allowed timezones are stored in the event type's metadata:

```typescript
interface EventTypeMetadata {
  allowedTimezones?: string[];
  // ... other metadata fields
}

// Example metadata
{
  "allowedTimezones": [
    "America/New_York",
    "America/Chicago",
    "America/Los_Angeles",
    "Europe/London"
  ]
}
```

### API Integration

When updating an event type via TRPC:

```typescript
// Client-side
const updateEventType = trpc.viewer.eventTypes.update.useMutation();

updateEventType.mutate({
  id: eventTypeId,
  metadata: {
    allowedTimezones: ["America/New_York", "America/Los_Angeles"]
  }
});

// The handler automatically validates timezones
// Invalid timezones are filtered out before saving
```

## ⚙️ Configuration

### Event Type Metadata Structure

```json
{
  "metadata": {
    "allowedTimezones": [
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Phoenix",
      "America/Los_Angeles",
      "America/Anchorage",
      "Pacific/Honolulu"
    ]
  }
}
```

### Priority US Timezones

The system automatically prioritizes these US timezones at the top of the selection list:

| Timezone | Display Name |
|----------|-------------|
| America/New_York | Eastern Time - New York |
| America/Chicago | Central Time - Chicago |
| America/Denver | Mountain Time - Denver |
| America/Phoenix | Mountain Time - Phoenix |
| America/Los_Angeles | Pacific Time - Los Angeles |
| America/Anchorage | Alaska Time - Anchorage |
| Pacific/Honolulu | Hawaii Time - Honolulu |

Dependencies have been added to the project configuration.

## 🧪 Test Drive

### Manual Testing

1. **Create a test event** with timezone filtering enabled
2. **Select only US timezones** to test the priority feature
3. **Book as an attendee** to see the filtered list in action
4. **Try the search** functionality with city names

### Automated Testing

```typescript
// Example test case
describe("TimezoneFilterSettings", () => {
  it("should filter timezones based on allowedTimezones", () => {
    const allowedTimezones = ["America/New_York", "Europe/London"];
    const component = render(
      <TimezoneSelect 
        allowedTimezones={allowedTimezones}
      />
    );
    
    // Verify only allowed timezones appear
    expect(component.getByText("Eastern Time - New York")).toBeInTheDocument();
    expect(component.getByText("London")).toBeInTheDocument();
    expect(component.queryByText("Tokyo")).not.toBeInTheDocument();
  });
});
```

### Validation Testing

```typescript
// Test timezone validation
const testCases = [
  { 
    input: ["America/New_York", "Invalid/Timezone"],
    expected: { isValid: false, invalidTimezones: ["Invalid/Timezone"] }
  },
  {
    input: ["America/Los_Angeles", "Europe/London"],
    expected: { isValid: true }
  }
];

testCases.forEach(test => {
  const result = validateAllowedTimezones(test.input);
  expect(result).toEqual(test.expected);
});
```

## 💡 Pro Tips

### 1. Regional Event Strategy
Create different event types for different regions:
- **US Events**: Include only US timezones
- **European Events**: Focus on EU timezones
- **Global Events**: Include major hubs worldwide

### 2. Daylight Saving Awareness
The system automatically handles DST transitions. Cities like Phoenix (no DST) and Denver (DST) are listed separately for accuracy.

### 3. Search Optimization
Users can search by:
- City name (e.g., "New York")
- Timezone code (e.g., "EST")
- Country (e.g., "America")

### 4. Performance Considerations
- Timezones are lazy-loaded for optimal performance
- Search results are debounced to prevent excessive API calls
- Validation happens server-side to ensure data integrity

### 5. Accessibility Features
- Full keyboard navigation support
- Screen reader friendly labels
- High contrast mode compatible
- Mobile-responsive design

## 🆘 Need Help?

### Common Issues & Solutions

#### Timezones Not Appearing
**Problem**: Selected timezones don't show in the booking page
**Solution**: Ensure you've saved the event type after making changes

#### Invalid Timezone Error
**Problem**: Getting validation errors when saving
**Solution**: The system only accepts IANA timezone identifiers. Check the timezone format.

#### Search Not Working
**Problem**: Can't find a specific city
**Solution**: Try searching with the timezone code or country name instead

#### US Timezones Not Prioritized
**Problem**: US timezones appear mixed with others
**Solution**: This feature works automatically. Clear your cache if issues persist.

### Troubleshooting Checklist

- [ ] Timezone filtering toggle is enabled
- [ ] At least one timezone is selected
- [ ] Event type has been saved after changes
- [ ] Browser cache has been cleared
- [ ] Using valid IANA timezone identifiers

### Getting Support

If you encounter issues not covered here:
1. Check the browser console for error messages
2. Verify your timezone selections in the event type settings
3. Test with a different browser or incognito mode
4. Contact support with your event type ID and selected timezones

---
*Powered by [Kanpredict](https://kanpredict.com) - Premium AI Development Platform*