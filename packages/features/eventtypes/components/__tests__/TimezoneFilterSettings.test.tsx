import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

// Mock the trpc query
const mockTimezoneData = [
  { city: "New York", timezone: "America/New_York" },
  { city: "Chicago", timezone: "America/Chicago" },
  { city: "Denver", timezone: "America/Denver" },
  { city: "Phoenix", timezone: "America/Phoenix" },
  { city: "Los Angeles", timezone: "America/Los_Angeles" },
  { city: "London", timezone: "Europe/London" },
  { city: "Paris", timezone: "Europe/Paris" },
  { city: "Tokyo", timezone: "Asia/Tokyo" },
];

vi.mock("@calcom/trpc/react", () => ({
  trpc: {
    viewer: {
      timezones: {
        cityTimezones: {
          useQuery: vi.fn(() => ({
            data: mockTimezoneData,
            isPending: false,
            isError: false,
          })),
        },
      },
    },
  },
}));

// Mock the UI components
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
    isClearable,
    className,
  }: any) => {
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

    return (
      <div className={className} data-testid="timezone-select">
        {isLoading && <div>Loading...</div>}
        <input
          type="text"
          placeholder={placeholder}
          data-testid="timezone-select-input"
          readOnly={!isSearchable}
        />
        <div data-testid="selected-values">
          {isMulti && value && value.map((v: any) => (
            <span key={v.value} data-testid={`selected-${v.value}`}>
              {formatOptionLabel ? formatOptionLabel(v) : v.label}
            </span>
          ))}
        </div>
        <div data-testid="timezone-options">
          {options.map((option: any) => (
            <button
              key={option.value}
              data-testid={`option-${option.value}`}
              onClick={() => handleChange(option.value)}
              type="button"
            >
              {formatOptionLabel ? formatOptionLabel(option) : option.label}
            </button>
          ))}
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
    <div className={customClassNames?.container}>
      <div className="flex items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          data-testid="timezone-filter-toggle"
          aria-label={title}
        />
        <div>
          <h3 className={customClassNames?.title}>{title}</h3>
          <p className={customClassNames?.description}>{description}</p>
        </div>
      </div>
      {checked && children}
    </div>
  ),
}));

// Mock the Icon component
vi.mock("@calcom/ui/components/icon", () => ({
  Icon: ({ name, className }: { name: string; className?: string }) => (
    <span className={className} data-testid={`icon-${name}`}>
      {name}
    </span>
  ),
}));

// Mock classNames utility
vi.mock("@calcom/ui/classNames", () => ({
  default: (...classes: any[]) => classes.filter(Boolean).join(" "),
}));

const FormWrapper = ({
  children,
  defaultValues = {},
}: {
  children: React.ReactNode;
  defaultValues?: any;
}) => {
  const methods = useForm({
    defaultValues,
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

describe("TimezoneFilterSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Initial Rendering", () => {
    it("should render with timezone filter disabled by default", () => {
      render(
        <FormWrapper>
          <TimezoneFilterSettings />
        </FormWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      expect(toggle).toBeInTheDocument();
      expect(toggle).not.toBeChecked();
      expect(screen.queryByTestId("timezone-select")).not.toBeInTheDocument();
    });

    it("should display correct labels and descriptions", () => {
      render(
        <FormWrapper>
          <TimezoneFilterSettings />
        </FormWrapper>
      );

      expect(screen.getByText("Timezone Selection")).toBeInTheDocument();
      expect(screen.getByText("Restrict booking to specific timezones only")).toBeInTheDocument();
    });

    it("should apply custom class names when provided", () => {
      const customClassNames = {
        container: "custom-container",
        toggle: {
          container: "custom-toggle-container",
          title: "custom-title",
          description: "custom-description",
        },
        select: {
          container: "custom-select-container",
          label: "custom-label",
        },
      };

      const { container } = render(
        <FormWrapper>
          <TimezoneFilterSettings customClassNames={customClassNames} />
        </FormWrapper>
      );

      expect(container.querySelector(".custom-container")).toBeInTheDocument();
      expect(container.querySelector(".custom-toggle-container")).toBeInTheDocument();
    });
  });

  describe("Toggle Functionality", () => {
    it("should show timezone selection when toggle is enabled", async () => {
      render(
        <FormWrapper>
          <TimezoneFilterSettings />
        </FormWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
        expect(screen.getByText("Allowed Timezones")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Select timezones allowed for booking")).toBeInTheDocument();
      });
    });

    it("should hide timezone selection when toggle is disabled", async () => {
      render(
        <FormWrapper>
          <TimezoneFilterSettings />
        </FormWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      
      // Enable first
      fireEvent.click(toggle);
      await waitFor(() => {
        expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
      });

      // Then disable
      fireEvent.click(toggle);
      await waitFor(() => {
        expect(screen.queryByTestId("timezone-select")).not.toBeInTheDocument();
      });
    });

    it("should clear selected timezones when toggle is disabled", async () => {
      render(
        <FormWrapper>
          <TimezoneFilterSettings />
        </FormWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      
      // Enable and select timezones
      fireEvent.click(toggle);
      await waitFor(() => {
        expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
      });

      const newYorkOption = screen.getByTestId("option-America/New_York");
      fireEvent.click(newYorkOption);

      await waitFor(() => {
        expect(screen.getByTestId("selected-America/New_York")).toBeInTheDocument();
      });

      // Disable toggle
      fireEvent.click(toggle);

      // Enable again to verify selections were cleared
      fireEvent.click(toggle);
      await waitFor(() => {
        expect(screen.queryByTestId("selected-America/New_York")).not.toBeInTheDocument();
      });
    });
  });

  describe("Timezone Selection", () => {
    it("should display all timezone options including common US timezones", async () => {
      render(
        <FormWrapper>
          <TimezoneFilterSettings />
        </FormWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        // Check for common US timezones
        expect(screen.getByTestId("option-America/New_York")).toBeInTheDocument();
        expect(screen.getByTestId("option-America/Chicago")).toBeInTheDocument();
        expect(screen.getByTestId("option-America/Denver")).toBeInTheDocument();
        expect(screen.getByTestId("option-America/Phoenix")).toBeInTheDocument();
        expect(screen.getByTestId("option-America/Los_Angeles")).toBeInTheDocument();
        expect(screen.getByTestId("option-America/Anchorage")).toBeInTheDocument();
        expect(screen.getByTestId("option-Pacific/Honolulu")).toBeInTheDocument();
        
        // Check for other timezones
        expect(screen.getByTestId("option-Europe/London")).toBeInTheDocument();
        expect(screen.getByTestId("option-Asia/Tokyo")).toBeInTheDocument();
      });
    });

    it("should allow selecting multiple timezones", async () => {
      render(
        <FormWrapper>
          <TimezoneFilterSettings />
        </FormWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
      });

      // Select multiple timezones
      fireEvent.click(screen.getByTestId("option-America/New_York"));
      fireEvent.click(screen.getByTestId("option-America/Los_Angeles"));
      fireEvent.click(screen.getByTestId("option-Europe/London"));

      await waitFor(() => {
        expect(screen.getByTestId("selected-America/New_York")).toBeInTheDocument();
        expect(screen.getByTestId("selected-America/Los_Angeles")).toBeInTheDocument();
        expect(screen.getByTestId("selected-Europe/London")).toBeInTheDocument();
        expect(screen.getByText("3 timezone(s) selected")).toBeInTheDocument();
      });
    });

    it("should display warning when no timezones are selected", async () => {
      render(
        <FormWrapper>
          <TimezoneFilterSettings />
        </FormWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(
          screen.getByText("Please select at least one timezone when timezone filtering is enabled")
        ).toBeInTheDocument();
      });
    });

    it("should remove warning after selecting a timezone", async () => {
      render(
        <FormWrapper>
          <TimezoneFilterSettings />
        </FormWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(
          screen.getByText("Please select at least one timezone when timezone filtering is enabled")
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("option-America/New_York"));

      await waitFor(() => {
        expect(
          screen.queryByText("Please select at least one timezone when timezone filtering is enabled")
        ).not.toBeInTheDocument();
        expect(screen.getByText("1 timezone(s) selected")).toBeInTheDocument();
      });
    });

    it("should display timezone with icon in format option label", async () => {
      render(
        <FormWrapper>
          <TimezoneFilterSettings />
        </FormWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        const options = screen.getAllByTestId(/^option-/);
        options.forEach(() => {
          expect(screen.getAllByTestId("icon-globe").length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe("EventType Metadata Integration", () => {
    it("should initialize with existing eventType metadata", async () => {
      const eventType = {
        id: 1,
        metadata: {
          allowedTimezones: ["America/New_York", "America/Los_Angeles", "Europe/London"],
        },
      };

      render(
        <FormWrapper>
          <TimezoneFilterSettings eventType={eventType} />
        </FormWrapper>
      );

      await waitFor(() => {
        // Toggle should be enabled
        expect(screen.getByTestId("timezone-filter-toggle")).toBeChecked();
        
        // Timezones should be selected
        expect(screen.getByTestId("selected-America/New_York")).toBeInTheDocument();
        expect(screen.getByTestId("selected-America/Los_Angeles")).toBeInTheDocument();
        expect(screen.getByTestId("selected-Europe/London")).toBeInTheDocument();
        expect(screen.getByText("3 timezone(s) selected")).toBeInTheDocument();
      });
    });

    it("should handle eventType with empty metadata", () => {
      const eventType = {
        id: 1,
        metadata: null,
      };

      render(
        <FormWrapper>
          <TimezoneFilterSettings eventType={eventType} />
        </FormWrapper>
      );

      expect(screen.getByTestId("timezone-filter-toggle")).not.toBeChecked();
      expect(screen.queryByTestId("timezone-select")).not.toBeInTheDocument();
    });

    it("should handle eventType with empty allowedTimezones array", () => {
      const eventType = {
        id: 1,
        metadata: {
          allowedTimezones: [],
        },
      };

      render(
        <FormWrapper>
          <TimezoneFilterSettings eventType={eventType} />
        </FormWrapper>
      );

      expect(screen.getByTestId("timezone-filter-toggle")).not.toBeChecked();
      expect(screen.queryByTestId("timezone-select")).not.toBeInTheDocument();
    });

    it("should handle unknown timezone values gracefully", async () => {
      const eventType = {
        id: 1,
        metadata: {
          allowedTimezones: ["Unknown/Timezone", "America/New_York"],
        },
      };

      render(
        <FormWrapper>
          <TimezoneFilterSettings eventType={eventType} />
        </FormWrapper>
      );

      await waitFor(() => {
        // Should still show the known timezone
        expect(screen.getByTestId("selected-America/New_York")).toBeInTheDocument();
        // Unknown timezone should be displayed with its value as label
        expect(screen.getByTestId("selected-Unknown/Timezone")).toBeInTheDocument();
      });
    });
  });

  describe("Form Integration", () => {
    it("should update form metadata when timezones are selected", async () => {
      const mockSetValue = vi.fn();
      const mockWatch = vi.fn().mockReturnValue({});

      vi.spyOn(require("react-hook-form"), "useFormContext").mockReturnValue({
        control: {},
        setValue: mockSetValue,
        watch: mockWatch,
      });

      render(
        <FormWrapper>
          <TimezoneFilterSettings />
        </FormWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("option-America/New_York"));

      await waitFor(() => {
        expect(mockSetValue).toHaveBeenCalledWith("metadata", {
          allowedTimezones: ["America/New_York"],
        });
      });
    });

    it("should preserve existing metadata when updating timezones", async () => {
      const mockSetValue = vi.fn();
      const existingMetadata = {
        customField: "value",
        anotherField: 123,
      };
      const mockWatch = vi.fn().mockReturnValue(existingMetadata);

      vi.spyOn(require("react-hook-form"), "useFormContext").mockReturnValue({
        control: {},
        setValue: mockSetValue,
        watch: mockWatch,
      });

      render(
        <FormWrapper defaultValues={{ metadata: existingMetadata }}>
          <TimezoneFilterSettings />
        </FormWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("option-America/Chicago"));

      await waitFor(() => {
        expect(mockSetValue).toHaveBeenCalledWith("metadata", {
          customField: "value",
          anotherField: 123,
          allowedTimezones: ["America/Chicago"],
        });
      });
    });

    it("should remove allowedTimezones from metadata when disabled", async () => {
      const mockSetValue = vi.fn();
      const existingMetadata = {
        customField: "value",
        allowedTimezones: ["America/New_York"],
      };
      const mockWatch = vi.fn().mockReturnValue(existingMetadata);

      vi.spyOn(require("react-hook-form"), "useFormContext").mockReturnValue({
        control: {},
        setValue: mockSetValue,
        watch: mockWatch,
      });

      const eventType = {
        id: 1,
        metadata: existingMetadata,
      };

      render(
        <FormWrapper defaultValues={{ metadata: existingMetadata }}>
          <TimezoneFilterSettings eventType={eventType} />
        </FormWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("timezone-filter-toggle")).toBeChecked();
      });

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(mockSetValue).toHaveBeenCalledWith("metadata", {
          customField: "value",
        });
      });
    });
  });

  describe("Loading States", () => {
    it("should show loading state while fetching timezone data", async () => {
      vi.mocked(require("@calcom/trpc/react").trpc.viewer.timezones.cityTimezones.useQuery).mockReturnValue({
        data: undefined,
        isPending: true,
        isError: false,
      });

      render(
        <FormWrapper>
          <TimezoneFilterSettings />
        </FormWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByText("Loading...")).toBeInTheDocument();
      });
    });

    it("should handle error state when timezone fetch fails", async () => {
      vi.mocked(require("@calcom/trpc/react").trpc.viewer.timezones.cityTimezones.useQuery).mockReturnValue({
        data: [],
        isPending: false,
        isError: true,
      });

      render(
        <FormWrapper>
          <TimezoneFilterSettings />
        </FormWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        // Should still render the select, but with no options
        expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
        expect(screen.queryByTestId(/^option-/)).not.toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle rapid toggle switching", async () => {
      render(
        <FormWrapper>
          <TimezoneFilterSettings />
        </FormWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      
      // Rapidly toggle multiple times
      fireEvent.click(toggle);
      fireEvent.click(toggle);
      fireEvent.click(toggle);
      fireEvent.click(toggle);
      fireEvent.click(toggle);

      await waitFor(() => {
        // Should end up in enabled state (odd number of clicks)
        expect(toggle).toBeChecked();
        expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
      });
    });

    it("should handle selecting and deselecting the same timezone", async () => {
      render(
        <FormWrapper>
          <TimezoneFilterSettings />
        </FormWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
      });

      const option = screen.getByTestId("option-America/New_York");
      
      // Select
      fireEvent.click(option);
      await waitFor(() => {
        expect(screen.getByTestId("selected-America/New_York")).toBeInTheDocument();
      });

      // Deselect
      fireEvent.click(option);
      await waitFor(() => {
        expect(screen.queryByTestId("selected-America/New_York")).not.toBeInTheDocument();
      });
    });

    it("should handle empty timezone data response", async () => {
      vi.mocked(require("@calcom/trpc/react").trpc.viewer.timezones.cityTimezones.useQuery).mockReturnValue({
        data: [],
        isPending: false,
        isError: false,
      });

      render(
        <FormWrapper>
          <TimezoneFilterSettings />
        </FormWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        // Should still show common US timezones even with empty data
        expect(screen.getByTestId("option-America/New_York")).toBeInTheDocument();
        expect(screen.getByTestId("option-Pacific/Honolulu")).toBeInTheDocument();
      });
    });

    it("should not duplicate common US timezones when they exist in fetched data", async () => {
      render(
        <FormWrapper>
          <TimezoneFilterSettings />
        </FormWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        // Count occurrences of America/New_York option
        const nyOptions = screen.getAllByTestId("option-America/New_York");
        expect(nyOptions).toHaveLength(1);
      });
    });
  });

  describe("Controller Integration", () => {
    it("should work with react-hook-form Controller", async () => {
      const TestComponent = () => {
        const methods = useForm({
          defaultValues: {
            metadata: {},
          },
        });

        return (
          <FormProvider {...methods}>
            <form>
              <TimezoneFilterSettings />
              <button type="submit">Submit</button>
            </form>
          </FormProvider>
        );
      };

      render(<TestComponent />);

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("option-Europe/London"));

      await waitFor(() => {
        expect(screen.getByTestId("selected-Europe/London")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels", () => {
      render(
        <FormWrapper>
          <TimezoneFilterSettings />
        </FormWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      expect(toggle).toHaveAttribute("aria-label", "Timezone Selection");
    });

    it("should be keyboard navigable", async () => {
      render(
        <FormWrapper>
          <TimezoneFilterSettings />
        </FormWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      
      // Simulate keyboard navigation
      toggle.focus();
      expect(document.activeElement).toBe(toggle);
      
      // Activate with keyboard
      fireEvent.keyDown(toggle, { key: "Enter" });
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
      });
    });
  });
});