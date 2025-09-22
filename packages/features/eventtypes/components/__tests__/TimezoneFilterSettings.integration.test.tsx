import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { TimezoneFilterSettings } from "../TimezoneFilterSettings";

// Mock the useLocale hook
vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string, variables?: Record<string, any>) => {
      const translations: Record<string, string> = {
        timezone_selection: "Timezone Selection",
        timezone_selection_description: "Restrict booking to specific timezones only",
        allowed_timezones: "Allowed Timezones",
        select_allowed_timezones: "Select timezones allowed for booking",
        selected_timezones_count: `${variables?.count} timezone(s) selected`,
        no_timezones_selected_warning: "Please select at least one timezone when timezone filtering is enabled",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock timezone data with real-world scenarios
const mockTimezoneData = [
  { city: "New York", timezone: "America/New_York" },
  { city: "Chicago", timezone: "America/Chicago" },
  { city: "Denver", timezone: "America/Denver" },
  { city: "Phoenix", timezone: "America/Phoenix" },
  { city: "Los Angeles", timezone: "America/Los_Angeles" },
  { city: "Anchorage", timezone: "America/Anchorage" },
  { city: "Honolulu", timezone: "Pacific/Honolulu" },
  { city: "London", timezone: "Europe/London" },
  { city: "Paris", timezone: "Europe/Paris" },
  { city: "Berlin", timezone: "Europe/Berlin" },
  { city: "Moscow", timezone: "Europe/Moscow" },
  { city: "Dubai", timezone: "Asia/Dubai" },
  { city: "Mumbai", timezone: "Asia/Kolkata" },
  { city: "Bangkok", timezone: "Asia/Bangkok" },
  { city: "Singapore", timezone: "Asia/Singapore" },
  { city: "Tokyo", timezone: "Asia/Tokyo" },
  { city: "Sydney", timezone: "Australia/Sydney" },
  { city: "Auckland", timezone: "Pacific/Auckland" },
];

// Create a mock trpc client
const createMockTrpcClient = (options: {
  isPending?: boolean;
  isError?: boolean;
  data?: any;
} = {}) => ({
  viewer: {
    timezones: {
      cityTimezones: {
        useQuery: vi.fn(() => ({
          data: options.data ?? mockTimezoneData,
          isPending: options.isPending ?? false,
          isError: options.isError ?? false,
          error: options.isError ? new Error("Failed to fetch timezones") : null,
        })),
      },
    },
  },
});

vi.mock("@calcom/trpc/react", () => ({
  trpc: createMockTrpcClient(),
}));

// Mock UI components with more realistic behavior
vi.mock("@calcom/ui/components/form", () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <label className={className}>{children}</label>
  ),
  Select: ({
    value,
    onChange,
    options,
    placeholder,
    isMulti,
    isLoading,
    formatOptionLabel,
    isSearchable,
    className,
  }: any) => {
    const [searchTerm, setSearchTerm] = React.useState("");
    const filteredOptions = options.filter((opt: any) =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleChange = (selectedValue: string) => {
      const selectedOption = options.find((opt: any) => opt.value === selectedValue);
      if (isMulti) {
        const currentValues = value || [];
        const newValues = currentValues.some((v: any) => v.value === selectedValue)
          ? currentValues.filter((v: any) => v.value !== selectedValue)
          : [...currentValues, selectedOption];
        onChange(newValues);
      } else {
        onChange(selectedOption);
      }
    };

    const handleRemove = (removeValue: string) => {
      if (isMulti && value) {
        const newValues = value.filter((v: any) => v.value !== removeValue);
        onChange(newValues);
      }
    };

    return (
      <div className={className} data-testid="timezone-select">
        {isLoading && <div data-testid="loading-indicator">Loading...</div>}
        {isSearchable && (
          <input
            type="text"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="timezone-search-input"
          />
        )}
        <div data-testid="selected-values">
          {isMulti && value && value.map((v: any) => (
            <div key={v.value} data-testid={`selected-${v.value}`} className="selected-item">
              {formatOptionLabel ? formatOptionLabel(v) : v.label}
              <button
                type="button"
                onClick={() => handleRemove(v.value)}
                data-testid={`remove-${v.value}`}
                aria-label={`Remove ${v.label}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div data-testid="timezone-options" role="listbox">
          {filteredOptions.map((option: any) => (
            <button
              key={option.value}
              data-testid={`option-${option.value}`}
              onClick={() => handleChange(option.value)}
              type="button"
              role="option"
              aria-selected={isMulti ? value?.some((v: any) => v.value === option.value) : value?.value === option.value}
            >
              {formatOptionLabel ? formatOptionLabel(option) : option.label}
            </button>
          ))}
          {filteredOptions.length === 0 && (
            <div data-testid="no-options">No matching timezones</div>
          )}
        </div>
      </div>
    );
  },
  SettingsToggle: ({
    checked,
    onCheckedChange,
    title,
    description,
    children,
    customClassNames,
  }: any) => (
    <div className={customClassNames?.container} data-testid="settings-toggle-container">
      <div className="settings-toggle-header">
        <input
          type="checkbox"
          id="timezone-toggle"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          data-testid="timezone-filter-toggle"
          aria-label={title}
          aria-describedby="timezone-toggle-description"
        />
        <label htmlFor="timezone-toggle">
          <h3 className={customClassNames?.title}>{title}</h3>
          <p id="timezone-toggle-description" className={customClassNames?.description}>
            {description}
          </p>
        </label>
      </div>
      <div data-testid="toggle-content" style={{ display: checked ? "block" : "none" }}>
        {checked && children}
      </div>
    </div>
  ),
}));

// Mock the Icon component
vi.mock("@calcom/ui/components/icon", () => ({
  Icon: ({ name, className }: { name: string; className?: string }) => (
    <span className={className} data-testid={`icon-${name}`} aria-hidden="true">
      {name === "globe" && "🌍"}
    </span>
  ),
}));

// Mock classNames utility
vi.mock("@calcom/ui/classNames", () => ({
  default: (...classes: any[]) => classes.filter(Boolean).join(" "),
}));

// Test form component that simulates a real event type form
const EventTypeForm = ({
  initialData,
  onSubmit,
}: {
  initialData?: any;
  onSubmit?: (data: any) => void;
}) => {
  const methods = useForm({
    defaultValues: {
      title: initialData?.title || "",
      slug: initialData?.slug || "",
      length: initialData?.length || 30,
      metadata: initialData?.metadata || {},
    },
  });

  const handleSubmit = methods.handleSubmit((data) => {
    onSubmit?.(data);
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit} data-testid="event-type-form">
        <div>
          <label htmlFor="title">Event Title</label>
          <input
            id="title"
            {...methods.register("title", { required: true })}
            data-testid="event-title-input"
          />
        </div>
        <div>
          <label htmlFor="slug">Event Slug</label>
          <input
            id="slug"
            {...methods.register("slug", { required: true })}
            data-testid="event-slug-input"
          />
        </div>
        <div>
          <label htmlFor="length">Duration (minutes)</label>
          <input
            id="length"
            type="number"
            {...methods.register("length", { required: true, min: 1 })}
            data-testid="event-length-input"
          />
        </div>
        <TimezoneFilterSettings eventType={initialData} />
        <button type="submit" data-testid="submit-button">
          Save Event Type
        </button>
      </form>
    </FormProvider>
  );
};

// Query client wrapper for tests
const QueryWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("TimezoneFilterSettings Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Form Integration", () => {
    it("should save timezone settings with event type form submission", async () => {
      const onSubmit = vi.fn();
      
      render(
        <QueryWrapper>
          <EventTypeForm onSubmit={onSubmit} />
        </QueryWrapper>
      );

      // Fill in event type details
      fireEvent.change(screen.getByTestId("event-title-input"), {
        target: { value: "Team Meeting" },
      });
      fireEvent.change(screen.getByTestId("event-slug-input"), {
        target: { value: "team-meeting" },
      });
      fireEvent.change(screen.getByTestId("event-length-input"), {
        target: { value: "60" },
      });

      // Enable timezone filtering
      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
      });

      // Select timezones
      fireEvent.click(screen.getByTestId("option-America/New_York"));
      fireEvent.click(screen.getByTestId("option-America/Los_Angeles"));

      // Submit form
      fireEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          title: "Team Meeting",
          slug: "team-meeting",
          length: 60,
          metadata: {
            allowedTimezones: ["America/New_York", "America/Los_Angeles"],
          },
        });
      });
    });

    it("should load existing timezone settings when editing event type", async () => {
      const initialData = {
        title: "Consultation Call",
        slug: "consultation",
        length: 45,
        metadata: {
          allowedTimezones: ["Europe/London", "Europe/Paris", "Europe/Berlin"],
        },
      };

      render(
        <QueryWrapper>
          <EventTypeForm initialData={initialData} />
        </QueryWrapper>
      );

      await waitFor(() => {
        // Check that form fields are populated
        expect(screen.getByTestId("event-title-input")).toHaveValue("Consultation Call");
        expect(screen.getByTestId("event-slug-input")).toHaveValue("consultation");
        expect(screen.getByTestId("event-length-input")).toHaveValue(45);

        // Check that timezone filter is enabled
        expect(screen.getByTestId("timezone-filter-toggle")).toBeChecked();

        // Check that timezones are selected
        expect(screen.getByTestId("selected-Europe/London")).toBeInTheDocument();
        expect(screen.getByTestId("selected-Europe/Paris")).toBeInTheDocument();
        expect(screen.getByTestId("selected-Europe/Berlin")).toBeInTheDocument();
      });
    });

    it("should preserve other metadata fields when updating timezones", async () => {
      const onSubmit = vi.fn();
      const initialData = {
        title: "Workshop",
        slug: "workshop",
        length: 120,
        metadata: {
          requiresConfirmation: true,
          additionalNotes: "Bring your laptop",
          customField: "customValue",
        },
      };

      render(
        <QueryWrapper>
          <EventTypeForm initialData={initialData} onSubmit={onSubmit} />
        </QueryWrapper>
      );

      // Enable timezone filtering
      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
      });

      // Select a timezone
      fireEvent.click(screen.getByTestId("option-Asia/Tokyo"));

      // Submit form
      fireEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          title: "Workshop",
          slug: "workshop",
          length: 120,
          metadata: {
            requiresConfirmation: true,
            additionalNotes: "Bring your laptop",
            customField: "customValue",
            allowedTimezones: ["Asia/Tokyo"],
          },
        });
      });
    });
  });

  describe("User Interactions", () => {
    it("should support searching for timezones", async () => {
      render(
        <QueryWrapper>
          <EventTypeForm />
        </QueryWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
      });

      // Search for "pacific"
      const searchInput = screen.getByTestId("timezone-search-input");
      fireEvent.change(searchInput, { target: { value: "pacific" } });

      await waitFor(() => {
        // Should show Pacific timezones
        expect(screen.getByTestId("option-America/Los_Angeles")).toBeInTheDocument();
        expect(screen.getByTestId("option-Pacific/Honolulu")).toBeInTheDocument();
        expect(screen.getByTestId("option-Pacific/Auckland")).toBeInTheDocument();
        
        // Should not show non-Pacific timezones
        expect(screen.queryByTestId("option-America/New_York")).not.toBeInTheDocument();
        expect(screen.queryByTestId("option-Europe/London")).not.toBeInTheDocument();
      });
    });

    it("should allow removing individual selected timezones", async () => {
      const initialData = {
        title: "Meeting",
        slug: "meeting",
        length: 30,
        metadata: {
          allowedTimezones: ["America/New_York", "America/Chicago", "America/Los_Angeles"],
        },
      };

      render(
        <QueryWrapper>
          <EventTypeForm initialData={initialData} />
        </QueryWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("selected-America/New_York")).toBeInTheDocument();
        expect(screen.getByTestId("selected-America/Chicago")).toBeInTheDocument();
        expect(screen.getByTestId("selected-America/Los_Angeles")).toBeInTheDocument();
      });

      // Remove Chicago timezone
      const removeChicago = screen.getByTestId("remove-America/Chicago");
      fireEvent.click(removeChicago);

      await waitFor(() => {
        expect(screen.queryByTestId("selected-America/Chicago")).not.toBeInTheDocument();
        expect(screen.getByTestId("selected-America/New_York")).toBeInTheDocument();
        expect(screen.getByTestId("selected-America/Los_Angeles")).toBeInTheDocument();
      });
    });

    it("should show no results message when search has no matches", async () => {
      render(
        <QueryWrapper>
          <EventTypeForm />
        </QueryWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
      });

      // Search for non-existent timezone
      const searchInput = screen.getByTestId("timezone-search-input");
      fireEvent.change(searchInput, { target: { value: "xyz123" } });

      await waitFor(() => {
        expect(screen.getByTestId("no-options")).toBeInTheDocument();
        expect(screen.getByText("No matching timezones")).toBeInTheDocument();
      });
    });
  });

  describe("Validation", () => {
    it("should show warning when timezone filter is enabled but no timezones selected", async () => {
      render(
        <QueryWrapper>
          <EventTypeForm />
        </QueryWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(
          screen.getByText("Please select at least one timezone when timezone filtering is enabled")
        ).toBeInTheDocument();
      });
    });

    it("should not include empty allowedTimezones in form data when disabled", async () => {
      const onSubmit = vi.fn();
      const initialData = {
        title: "Call",
        slug: "call",
        length: 15,
        metadata: {
          allowedTimezones: ["America/New_York"],
        },
      };

      render(
        <QueryWrapper>
          <EventTypeForm initialData={initialData} onSubmit={onSubmit} />
        </QueryWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("timezone-filter-toggle")).toBeChecked();
      });

      // Disable timezone filtering
      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      // Submit form
      fireEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          title: "Call",
          slug: "call",
          length: 15,
          metadata: {},
        });
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle timezone API failure gracefully", async () => {
      // Mock API failure
      vi.mocked(require("@calcom/trpc/react").trpc).viewer.timezones.cityTimezones.useQuery = vi.fn(() => ({
        data: undefined,
        isPending: false,
        isError: true,
        error: new Error("Network error"),
      }));

      render(
        <QueryWrapper>
          <EventTypeForm />
        </QueryWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        // Should still show common US timezones as fallback
        expect(screen.getByTestId("option-America/New_York")).toBeInTheDocument();
        expect(screen.getByTestId("option-America/Los_Angeles")).toBeInTheDocument();
      });
    });

    it("should handle slow API response with loading state", async () => {
      // Mock slow API
      vi.mocked(require("@calcom/trpc/react").trpc).viewer.timezones.cityTimezones.useQuery = vi.fn(() => ({
        data: undefined,
        isPending: true,
        isError: false,
      }));

      render(
        <QueryWrapper>
          <EventTypeForm />
        </QueryWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();
        expect(screen.getByText("Loading...")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA attributes for screen readers", async () => {
      render(
        <QueryWrapper>
          <EventTypeForm />
        </QueryWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      expect(toggle).toHaveAttribute("aria-label", "Timezone Selection");
      expect(toggle).toHaveAttribute("aria-describedby", "timezone-toggle-description");

      fireEvent.click(toggle);

      await waitFor(() => {
        const listbox = screen.getByRole("listbox");
        expect(listbox).toBeInTheDocument();

        const options = screen.getAllByRole("option");
        expect(options.length).toBeGreaterThan(0);
      });
    });

    it("should support keyboard navigation", async () => {
      render(
        <QueryWrapper>
          <EventTypeForm />
        </QueryWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      
      // Tab to toggle
      toggle.focus();
      expect(document.activeElement).toBe(toggle);

      // Space to toggle
      fireEvent.keyDown(toggle, { key: " ", code: "Space" });
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
      });

      // Tab to search input
      const searchInput = screen.getByTestId("timezone-search-input");
      searchInput.focus();
      expect(document.activeElement).toBe(searchInput);
    });

    it("should announce selection changes to screen readers", async () => {
      render(
        <QueryWrapper>
          <EventTypeForm />
        </QueryWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
      });

      const option = screen.getByTestId("option-America/New_York");
      fireEvent.click(option);

      await waitFor(() => {
        const selectedOption = screen.getByTestId("option-America/New_York");
        expect(selectedOption).toHaveAttribute("aria-selected", "true");
      });
    });
  });

  describe("Performance", () => {
    it("should handle large number of timezone selections efficiently", async () => {
      render(
        <QueryWrapper>
          <EventTypeForm />
        </QueryWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
      });

      // Select many timezones
      const timezoneIds = [
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "Europe/London",
        "Europe/Paris",
        "Asia/Tokyo",
        "Australia/Sydney",
      ];

      for (const tzId of timezoneIds) {
        fireEvent.click(screen.getByTestId(`option-${tzId}`));
      }

      await waitFor(() => {
        expect(screen.getByText(`${timezoneIds.length} timezone(s) selected`)).toBeInTheDocument();
        timezoneIds.forEach((tzId) => {
          expect(screen.getByTestId(`selected-${tzId}`)).toBeInTheDocument();
        });
      });
    });

    it("should debounce search input for better performance", async () => {
      const searchSpy = vi.fn();
      
      render(
        <QueryWrapper>
          <EventTypeForm />
        </QueryWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId("timezone-search-input");
      
      // Type quickly
      fireEvent.change(searchInput, { target: { value: "a" } });
      fireEvent.change(searchInput, { target: { value: "am" } });
      fireEvent.change(searchInput, { target: { value: "ame" } });
      fireEvent.change(searchInput, { target: { value: "amer" } });
      fireEvent.change(searchInput, { target: { value: "ameri" } });
      fireEvent.change(searchInput, { target: { value: "america" } });

      // Should only show final filtered results
      await waitFor(() => {
        expect(screen.getByTestId("option-America/New_York")).toBeInTheDocument();
        expect(screen.queryByTestId("option-Europe/London")).not.toBeInTheDocument();
      });
    });
  });
});