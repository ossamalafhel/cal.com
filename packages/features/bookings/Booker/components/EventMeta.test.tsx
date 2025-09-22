import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { useBookerStore } from "../store";
import { EventMeta } from "./EventMeta";

// Mock dependencies
vi.mock("framer-motion", () => ({
  m: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock("@calcom/embed-core/embed-iframe", () => ({
  useEmbedUiConfig: () => ({ hideEventTypeDetails: false }),
  useIsEmbed: () => false,
}));

vi.mock("@calcom/features/bookings", () => ({
  EventDetails: ({ event }: any) => <div data-testid="event-details">Event Details</div>,
  EventMembers: ({ schedulingType, users, profile, entity }: any) => (
    <div data-testid="event-members">Event Members</div>
  ),
  EventMetaSkeleton: () => <div data-testid="event-meta-skeleton">Loading...</div>,
  EventTitle: ({ children, className }: any) => (
    <h2 data-testid="event-title" className={className}>
      {children}
    </h2>
  ),
}));

vi.mock("@calcom/features/bookings/components/event-meta/Details", () => ({
  EventMetaBlock: ({ children, icon, className, contentClassName }: any) => (
    <div data-testid={`event-meta-block-${icon}`} className={className}>
      <div className={contentClassName}>{children}</div>
    </div>
  ),
}));

vi.mock("@calcom/features/bookings/lib", () => ({
  useTimePreferences: () => [vi.fn()],
}));

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

vi.mock("@calcom/lib/markdownToSafeHTMLClient", () => ({
  markdownToSafeHTMLClient: (text: string) => text,
}));

vi.mock("./hooks/useBookerTime", () => ({
  useBookerTime: () => ({
    timeFormat: 12,
    timezone: "America/New_York",
  }),
}));

vi.mock("@calcom/atoms/timezone", () => ({
  Timezone: ({ value, onChange, allowedTimezones, ...props }: any) => (
    <div 
      data-testid="platform-timezone-select" 
      data-value={value}
      data-allowed-timezones={JSON.stringify(allowedTimezones)}
      {...props}
    >
      Platform Timezone Select
    </div>
  ),
}));

// Mock WebTimezoneSelect
const MockWebTimezoneSelect = ({ value, onChange, allowedTimezones, ...props }: any) => (
  <div 
    data-testid="web-timezone-select" 
    data-value={value}
    data-allowed-timezones={JSON.stringify(allowedTimezones)}
    {...props}
  >
    Web Timezone Select
  </div>
);

vi.mock("@calcom/features/components/timezone-select", () => ({
  TimezoneSelect: MockWebTimezoneSelect,
}));

describe("EventMeta - allowedTimezones integration", () => {
  const mockEvent = {
    title: "Test Event",
    description: "Test description",
    length: 60,
    schedulingType: "ROUND_ROBIN",
    subsetOfUsers: [],
    profile: { name: "Test User" },
    entity: { name: "Test Entity" },
    locations: [],
    currency: "USD",
    requiresConfirmation: false,
    recurringEvent: null,
    price: 0,
    isDynamic: false,
    fieldTranslations: [],
    autoTranslateDescriptionEnabled: false,
    lockTimeZoneToggleOnBookingPage: false,
    lockedTimeZone: null,
    schedule: { timeZone: "America/New_York" },
    seatsPerTimeSlot: null,
    metadata: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useBookerStore.setState({
      state: "selecting_time",
      selectedTimeslot: null,
      selectedDuration: null,
      bookingData: null,
      rescheduleUid: null,
      seatedEventData: {},
      setSeatedEventData: vi.fn(),
      setTimezone: vi.fn(),
    });
  });

  describe("Platform mode", () => {
    it("should pass allowedTimezones to platform timezone select when metadata contains allowedTimezones", () => {
      const allowedTimezones = ["America/New_York", "America/Los_Angeles", "Europe/London"];
      const eventWithAllowedTimezones = {
        ...mockEvent,
        metadata: {
          allowedTimezones,
        },
      };

      render(
        <EventMeta
          event={eventWithAllowedTimezones}
          isPending={false}
          isPrivateLink={false}
          isPlatform={true}
        />
      );

      const timezoneSelect = screen.getByTestId("platform-timezone-select");
      expect(timezoneSelect).toBeInTheDocument();
      expect(timezoneSelect.getAttribute("data-allowed-timezones")).toBe(JSON.stringify(allowedTimezones));
    });

    it("should not pass allowedTimezones when metadata is null", () => {
      render(
        <EventMeta
          event={mockEvent}
          isPending={false}
          isPrivateLink={false}
          isPlatform={true}
        />
      );

      const timezoneSelect = screen.getByTestId("platform-timezone-select");
      expect(timezoneSelect).toBeInTheDocument();
      expect(timezoneSelect.getAttribute("data-allowed-timezones")).toBe("null");
    });

    it("should not pass allowedTimezones when metadata exists but without allowedTimezones", () => {
      const eventWithEmptyMetadata = {
        ...mockEvent,
        metadata: {
          someOtherField: "value",
        },
      };

      render(
        <EventMeta
          event={eventWithEmptyMetadata}
          isPending={false}
          isPrivateLink={false}
          isPlatform={true}
        />
      );

      const timezoneSelect = screen.getByTestId("platform-timezone-select");
      expect(timezoneSelect).toBeInTheDocument();
      expect(timezoneSelect.getAttribute("data-allowed-timezones")).toBe("null");
    });

    it("should handle empty allowedTimezones array", () => {
      const eventWithEmptyAllowedTimezones = {
        ...mockEvent,
        metadata: {
          allowedTimezones: [],
        },
      };

      render(
        <EventMeta
          event={eventWithEmptyAllowedTimezones}
          isPending={false}
          isPrivateLink={false}
          isPlatform={true}
        />
      );

      const timezoneSelect = screen.getByTestId("platform-timezone-select");
      expect(timezoneSelect).toBeInTheDocument();
      expect(timezoneSelect.getAttribute("data-allowed-timezones")).toBe("[]");
    });
  });

  describe("Web mode", () => {
    it("should pass allowedTimezones to web timezone select when metadata contains allowedTimezones", () => {
      const allowedTimezones = ["America/New_York", "America/Los_Angeles", "Europe/London"];
      const eventWithAllowedTimezones = {
        ...mockEvent,
        metadata: {
          allowedTimezones,
        },
      };

      render(
        <EventMeta
          event={eventWithAllowedTimezones}
          isPending={false}
          isPrivateLink={false}
          isPlatform={false}
        />
      );

      const timezoneSelect = screen.getByTestId("web-timezone-select");
      expect(timezoneSelect).toBeInTheDocument();
      expect(timezoneSelect.getAttribute("data-allowed-timezones")).toBe(JSON.stringify(allowedTimezones));
    });

    it("should not pass allowedTimezones when metadata is null", () => {
      render(
        <EventMeta
          event={mockEvent}
          isPending={false}
          isPrivateLink={false}
          isPlatform={false}
        />
      );

      const timezoneSelect = screen.getByTestId("web-timezone-select");
      expect(timezoneSelect).toBeInTheDocument();
      expect(timezoneSelect.getAttribute("data-allowed-timezones")).toBe("null");
    });

    it("should not pass allowedTimezones when metadata exists but without allowedTimezones", () => {
      const eventWithEmptyMetadata = {
        ...mockEvent,
        metadata: {
          someOtherField: "value",
        },
      };

      render(
        <EventMeta
          event={eventWithEmptyMetadata}
          isPending={false}
          isPrivateLink={false}
          isPlatform={false}
        />
      );

      const timezoneSelect = screen.getByTestId("web-timezone-select");
      expect(timezoneSelect).toBeInTheDocument();
      expect(timezoneSelect.getAttribute("data-allowed-timezones")).toBe("null");
    });

    it("should handle empty allowedTimezones array", () => {
      const eventWithEmptyAllowedTimezones = {
        ...mockEvent,
        metadata: {
          allowedTimezones: [],
        },
      };

      render(
        <EventMeta
          event={eventWithEmptyAllowedTimezones}
          isPending={false}
          isPrivateLink={false}
          isPlatform={false}
        />
      );

      const timezoneSelect = screen.getByTestId("web-timezone-select");
      expect(timezoneSelect).toBeInTheDocument();
      expect(timezoneSelect.getAttribute("data-allowed-timezones")).toBe("[]");
    });
  });

  describe("Timezone locking behavior", () => {
    it("should still pass allowedTimezones when timezone is locked", () => {
      const allowedTimezones = ["America/New_York", "America/Los_Angeles"];
      const eventWithLockedTimezone = {
        ...mockEvent,
        lockTimeZoneToggleOnBookingPage: true,
        lockedTimeZone: "America/New_York",
        metadata: {
          allowedTimezones,
        },
      };

      render(
        <EventMeta
          event={eventWithLockedTimezone}
          isPending={false}
          isPrivateLink={false}
          isPlatform={false}
        />
      );

      const timezoneSelect = screen.getByTestId("web-timezone-select");
      expect(timezoneSelect).toBeInTheDocument();
      expect(timezoneSelect.getAttribute("data-allowed-timezones")).toBe(JSON.stringify(allowedTimezones));
      // Note: The actual disabling logic would be tested in the TimezoneSelect component itself
    });
  });

  describe("Edge cases", () => {
    it("should handle metadata with various data types", () => {
      const eventWithComplexMetadata = {
        ...mockEvent,
        metadata: {
          allowedTimezones: ["America/New_York"],
          otherField: "value",
          nestedObject: { key: "value" },
          numberField: 123,
          booleanField: true,
        },
      };

      render(
        <EventMeta
          event={eventWithComplexMetadata}
          isPending={false}
          isPrivateLink={false}
          isPlatform={false}
        />
      );

      const timezoneSelect = screen.getByTestId("web-timezone-select");
      expect(timezoneSelect).toBeInTheDocument();
      expect(timezoneSelect.getAttribute("data-allowed-timezones")).toBe(
        JSON.stringify(["America/New_York"])
      );
    });

    it("should handle undefined event", () => {
      render(
        <EventMeta
          event={undefined}
          isPending={false}
          isPrivateLink={false}
          isPlatform={false}
        />
      );

      // Should render without crashing
      expect(screen.getByTestId("event-meta")).toBeInTheDocument();
    });

    it("should handle null event", () => {
      render(
        <EventMeta
          event={null}
          isPending={false}
          isPrivateLink={false}
          isPlatform={false}
        />
      );

      // Should render without crashing
      expect(screen.getByTestId("event-meta")).toBeInTheDocument();
    });

    it("should show loading skeleton when isPending is true", () => {
      const eventWithAllowedTimezones = {
        ...mockEvent,
        metadata: {
          allowedTimezones: ["America/New_York"],
        },
      };

      render(
        <EventMeta
          event={eventWithAllowedTimezones}
          isPending={true}
          isPrivateLink={false}
          isPlatform={false}
        />
      );

      expect(screen.getByTestId("event-meta-skeleton")).toBeInTheDocument();
      // Should not render timezone select when loading
      expect(screen.queryByTestId("web-timezone-select")).not.toBeInTheDocument();
    });
  });

  describe("Timezone extraction from metadata", () => {
    it("should correctly extract allowedTimezones from EventTypeMetadata type", () => {
      const eventWithTypedMetadata = {
        ...mockEvent,
        metadata: {
          allowedTimezones: ["America/Chicago", "America/Denver"],
          apps: {},
          additionalNotes: "test",
        } as any, // Simulating EventTypeMetadata type
      };

      render(
        <EventMeta
          event={eventWithTypedMetadata}
          isPending={false}
          isPrivateLink={false}
          isPlatform={false}
        />
      );

      const timezoneSelect = screen.getByTestId("web-timezone-select");
      expect(timezoneSelect.getAttribute("data-allowed-timezones")).toBe(
        JSON.stringify(["America/Chicago", "America/Denver"])
      );
    });

    it("should handle malformed metadata gracefully", () => {
      const eventWithMalformedMetadata = {
        ...mockEvent,
        metadata: "invalid_metadata_string" as any,
      };

      render(
        <EventMeta
          event={eventWithMalformedMetadata}
          isPending={false}
          isPrivateLink={false}
          isPlatform={false}
        />
      );

      // Should render without crashing
      const timezoneSelect = screen.getByTestId("web-timezone-select");
      expect(timezoneSelect).toBeInTheDocument();
      expect(timezoneSelect.getAttribute("data-allowed-timezones")).toBe("null");
    });
  });

  describe("Dynamic timezone switching", () => {
    it("should update allowedTimezones when event prop changes", () => {
      const initialEvent = {
        ...mockEvent,
        metadata: {
          allowedTimezones: ["America/New_York"],
        },
      };

      const updatedEvent = {
        ...mockEvent,
        metadata: {
          allowedTimezones: ["Europe/London", "Europe/Paris"],
        },
      };

      const { rerender } = render(
        <EventMeta
          event={initialEvent}
          isPending={false}
          isPrivateLink={false}
          isPlatform={false}
        />
      );

      let timezoneSelect = screen.getByTestId("web-timezone-select");
      expect(timezoneSelect.getAttribute("data-allowed-timezones")).toBe(
        JSON.stringify(["America/New_York"])
      );

      rerender(
        <EventMeta
          event={updatedEvent}
          isPending={false}
          isPrivateLink={false}
          isPlatform={false}
        />
      );

      timezoneSelect = screen.getByTestId("web-timezone-select");
      expect(timezoneSelect.getAttribute("data-allowed-timezones")).toBe(
        JSON.stringify(["Europe/London", "Europe/Paris"])
      );
    });
  });
});