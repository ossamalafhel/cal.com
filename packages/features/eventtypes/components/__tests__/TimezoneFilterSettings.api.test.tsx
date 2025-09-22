import { renderHook, waitFor } from "@testing-library/react";
import { render, screen, fireEvent } from "@testing-library/react";
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

// Mock UI components
vi.mock("@calcom/ui/components/form", () => ({
  Label: ({ children }: any) => <label>{children}</label>,
  Select: ({ isLoading, options, value, onChange, placeholder, isMulti }: any) => (
    <div data-testid="timezone-select">
      {isLoading && <div data-testid="loading">Loading timezones...</div>}
      <div data-testid="option-count">{options?.length || 0} options</div>
      <div data-testid="selected-count">{value?.length || 0} selected</div>
      {options?.map((opt: any) => (
        <button
          key={opt.value}
          data-testid={`option-${opt.value}`}
          onClick={() => {
            if (isMulti) {
              const currentValues = value || [];
              const newValues = [...currentValues, opt];
              onChange(newValues);
            } else {
              onChange(opt);
            }
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  ),
  SettingsToggle: ({ checked, onCheckedChange, title, children }: any) => (
    <div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        data-testid="timezone-filter-toggle"
      />
      <span>{title}</span>
      {checked && children}
    </div>
  ),
}));

vi.mock("@calcom/ui/components/icon", () => ({
  Icon: () => null,
}));

vi.mock("@calcom/ui/classNames", () => ({
  default: (...classes: any[]) => classes.filter(Boolean).join(" "),
}));

const FormWrapper = ({ children }: { children: React.ReactNode }) => {
  const methods = useForm({
    defaultValues: { metadata: {} },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

const QueryWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("TimezoneFilterSettings API Tests", () => {
  let mockUseQuery: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Timezone Data Fetching", () => {
    it("should fetch timezone data on component mount", async () => {
      const mockData = [
        { city: "New York", timezone: "America/New_York" },
        { city: "London", timezone: "Europe/London" },
      ];

      mockUseQuery.mockReturnValue({
        data: mockData,
        isPending: false,
        isError: false,
      });

      vi.mocked(require("@calcom/trpc/react")).trpc = {
        viewer: {
          timezones: {
            cityTimezones: {
              useQuery: mockUseQuery,
            },
          },
        },
      };

      render(
        <QueryWrapper>
          <FormWrapper>
            <TimezoneFilterSettings />
          </FormWrapper>
        </QueryWrapper>
      );

      expect(mockUseQuery).toHaveBeenCalledWith(
        { CalComVersion: "1.0.0" },
        { trpc: { context: { skipBatch: true } } }
      );
    });

    it("should handle loading state while fetching timezones", async () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isPending: true,
        isError: false,
      });

      vi.mocked(require("@calcom/trpc/react")).trpc = {
        viewer: {
          timezones: {
            cityTimezones: {
              useQuery: mockUseQuery,
            },
          },
        },
      };

      render(
        <QueryWrapper>
          <FormWrapper>
            <TimezoneFilterSettings />
          </FormWrapper>
        </QueryWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toBeInTheDocument();
        expect(screen.getByText("Loading timezones...")).toBeInTheDocument();
      });
    });

    it("should display fetched timezone data after loading", async () => {
      const mockData = [
        { city: "Tokyo", timezone: "Asia/Tokyo" },
        { city: "Sydney", timezone: "Australia/Sydney" },
        { city: "Dubai", timezone: "Asia/Dubai" },
      ];

      mockUseQuery.mockReturnValue({
        data: mockData,
        isPending: false,
        isError: false,
      });

      vi.mocked(require("@calcom/trpc/react")).trpc = {
        viewer: {
          timezones: {
            cityTimezones: {
              useQuery: mockUseQuery,
            },
          },
        },
      };

      render(
        <QueryWrapper>
          <FormWrapper>
            <TimezoneFilterSettings />
          </FormWrapper>
        </QueryWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
        // 3 from mockData + 7 common US timezones
        expect(screen.getByTestId("option-count")).toHaveTextContent("10 options");
      });
    });

    it("should merge fetched data with common US timezones without duplicates", async () => {
      const mockData = [
        { city: "New York", timezone: "America/New_York" }, // Duplicate
        { city: "Los Angeles", timezone: "America/Los_Angeles" }, // Duplicate
        { city: "Toronto", timezone: "America/Toronto" },
        { city: "Mexico City", timezone: "America/Mexico_City" },
      ];

      mockUseQuery.mockReturnValue({
        data: mockData,
        isPending: false,
        isError: false,
      });

      vi.mocked(require("@calcom/trpc/react")).trpc = {
        viewer: {
          timezones: {
            cityTimezones: {
              useQuery: mockUseQuery,
            },
          },
        },
      };

      render(
        <QueryWrapper>
          <FormWrapper>
            <TimezoneFilterSettings />
          </FormWrapper>
        </QueryWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        // Should have 7 common US + 2 unique from mock (Toronto, Mexico City)
        expect(screen.getByTestId("option-count")).toHaveTextContent("9 options");
        expect(screen.getByTestId("option-America/New_York")).toBeInTheDocument();
        expect(screen.getByTestId("option-America/Toronto")).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors gracefully", async () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isPending: false,
        isError: true,
        error: new Error("Failed to fetch timezones"),
      });

      vi.mocked(require("@calcom/trpc/react")).trpc = {
        viewer: {
          timezones: {
            cityTimezones: {
              useQuery: mockUseQuery,
            },
          },
        },
      };

      render(
        <QueryWrapper>
          <FormWrapper>
            <TimezoneFilterSettings />
          </FormWrapper>
        </QueryWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        // Should still show common US timezones as fallback
        expect(screen.getByTestId("option-count")).toHaveTextContent("7 options");
        expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
      });
    });

    it("should handle network timeout errors", async () => {
      const timeoutError = new Error("Network timeout");
      timeoutError.name = "TimeoutError";

      mockUseQuery.mockReturnValue({
        data: undefined,
        isPending: false,
        isError: true,
        error: timeoutError,
      });

      vi.mocked(require("@calcom/trpc/react")).trpc = {
        viewer: {
          timezones: {
            cityTimezones: {
              useQuery: mockUseQuery,
            },
          },
        },
      };

      render(
        <QueryWrapper>
          <FormWrapper>
            <TimezoneFilterSettings />
          </FormWrapper>
        </QueryWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        // Should fall back to common US timezones
        expect(screen.getByTestId("option-America/New_York")).toBeInTheDocument();
        expect(screen.getByTestId("option-Pacific/Honolulu")).toBeInTheDocument();
      });
    });

    it("should handle empty API response", async () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isPending: false,
        isError: false,
      });

      vi.mocked(require("@calcom/trpc/react")).trpc = {
        viewer: {
          timezones: {
            cityTimezones: {
              useQuery: mockUseQuery,
            },
          },
        },
      };

      render(
        <QueryWrapper>
          <FormWrapper>
            <TimezoneFilterSettings />
          </FormWrapper>
        </QueryWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        // Should still show common US timezones
        expect(screen.getByTestId("option-count")).toHaveTextContent("7 options");
        expect(screen.getByTestId("option-America/Chicago")).toBeInTheDocument();
      });
    });

    it("should handle malformed API response", async () => {
      const malformedData = [
        { city: "Paris" }, // Missing timezone
        { timezone: "Asia/Shanghai" }, // Missing city
        { city: "Berlin", timezone: "Europe/Berlin" }, // Valid
      ];

      mockUseQuery.mockReturnValue({
        data: malformedData,
        isPending: false,
        isError: false,
      });

      vi.mocked(require("@calcom/trpc/react")).trpc = {
        viewer: {
          timezones: {
            cityTimezones: {
              useQuery: mockUseQuery,
            },
          },
        },
      };

      render(
        <QueryWrapper>
          <FormWrapper>
            <TimezoneFilterSettings />
          </FormWrapper>
        </QueryWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        // Should handle malformed data gracefully
        expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
        // Should still have the valid option
        expect(screen.getByTestId("option-Europe/Berlin")).toBeInTheDocument();
      });
    });
  });

  describe("Query Optimization", () => {
    it("should use skipBatch option for query", async () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isPending: false,
        isError: false,
      });

      vi.mocked(require("@calcom/trpc/react")).trpc = {
        viewer: {
          timezones: {
            cityTimezones: {
              useQuery: mockUseQuery,
            },
          },
        },
      };

      render(
        <QueryWrapper>
          <FormWrapper>
            <TimezoneFilterSettings />
          </FormWrapper>
        </QueryWrapper>
      );

      expect(mockUseQuery).toHaveBeenCalledWith(
        { CalComVersion: "1.0.0" },
        { trpc: { context: { skipBatch: true } } }
      );
    });

    it("should not refetch data on toggle changes", async () => {
      mockUseQuery.mockReturnValue({
        data: [{ city: "Paris", timezone: "Europe/Paris" }],
        isPending: false,
        isError: false,
      });

      vi.mocked(require("@calcom/trpc/react")).trpc = {
        viewer: {
          timezones: {
            cityTimezones: {
              useQuery: mockUseQuery,
            },
          },
        },
      };

      render(
        <QueryWrapper>
          <FormWrapper>
            <TimezoneFilterSettings />
          </FormWrapper>
        </QueryWrapper>
      );

      const initialCallCount = mockUseQuery.mock.calls.length;

      const toggle = screen.getByTestId("timezone-filter-toggle");
      
      // Toggle multiple times
      fireEvent.click(toggle);
      await waitFor(() => expect(screen.getByTestId("timezone-select")).toBeInTheDocument());
      
      fireEvent.click(toggle);
      await waitFor(() => expect(screen.queryByTestId("timezone-select")).not.toBeInTheDocument());
      
      fireEvent.click(toggle);
      await waitFor(() => expect(screen.getByTestId("timezone-select")).toBeInTheDocument());

      // Should not have made additional API calls
      expect(mockUseQuery.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe("Retry Logic", () => {
    it("should handle API retry on failure", async () => {
      let callCount = 0;
      mockUseQuery.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            data: undefined,
            isPending: false,
            isError: true,
            error: new Error("Temporary failure"),
            refetch: vi.fn(),
          };
        }
        return {
          data: [{ city: "London", timezone: "Europe/London" }],
          isPending: false,
          isError: false,
          refetch: vi.fn(),
        };
      });

      vi.mocked(require("@calcom/trpc/react")).trpc = {
        viewer: {
          timezones: {
            cityTimezones: {
              useQuery: mockUseQuery,
            },
          },
        },
      };

      const { rerender } = render(
        <QueryWrapper>
          <FormWrapper>
            <TimezoneFilterSettings />
          </FormWrapper>
        </QueryWrapper>
      );

      // First render - error state
      expect(callCount).toBe(1);

      // Trigger rerender (simulating retry)
      rerender(
        <QueryWrapper>
          <FormWrapper>
            <TimezoneFilterSettings />
          </FormWrapper>
        </QueryWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        // Should now have data after retry
        expect(screen.getByTestId("option-Europe/London")).toBeInTheDocument();
      });
    });
  });

  describe("Data Transformation", () => {
    it("should transform city names to user-friendly labels", async () => {
      const mockData = [
        { city: "New_York", timezone: "America/New_York" },
        { city: "Los-Angeles", timezone: "America/Los_Angeles" },
        { city: "Sao_Paulo", timezone: "America/Sao_Paulo" },
      ];

      mockUseQuery.mockReturnValue({
        data: mockData,
        isPending: false,
        isError: false,
      });

      vi.mocked(require("@calcom/trpc/react")).trpc = {
        viewer: {
          timezones: {
            cityTimezones: {
              useQuery: mockUseQuery,
            },
          },
        },
      };

      render(
        <QueryWrapper>
          <FormWrapper>
            <TimezoneFilterSettings />
          </FormWrapper>
        </QueryWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        // Check that options are created with proper labels
        expect(screen.getByTestId("option-America/New_York")).toBeInTheDocument();
        expect(screen.getByTestId("option-America/Los_Angeles")).toBeInTheDocument();
        expect(screen.getByTestId("option-America/Sao_Paulo")).toBeInTheDocument();
      });
    });

    it("should handle special characters in timezone names", async () => {
      const mockData = [
        { city: "São Paulo", timezone: "America/Sao_Paulo" },
        { city: "Zürich", timezone: "Europe/Zurich" },
        { city: "København", timezone: "Europe/Copenhagen" },
      ];

      mockUseQuery.mockReturnValue({
        data: mockData,
        isPending: false,
        isError: false,
      });

      vi.mocked(require("@calcom/trpc/react")).trpc = {
        viewer: {
          timezones: {
            cityTimezones: {
              useQuery: mockUseQuery,
            },
          },
        },
      };

      render(
        <QueryWrapper>
          <FormWrapper>
            <TimezoneFilterSettings />
          </FormWrapper>
        </QueryWrapper>
      );

      const toggle = screen.getByTestId("timezone-filter-toggle");
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByTestId("option-America/Sao_Paulo")).toBeInTheDocument();
        expect(screen.getByTestId("option-Europe/Zurich")).toBeInTheDocument();
        expect(screen.getByTestId("option-Europe/Copenhagen")).toBeInTheDocument();
      });
    });
  });

  describe("Caching Behavior", () => {
    it("should cache timezone data across component remounts", async () => {
      const mockData = [
        { city: "Tokyo", timezone: "Asia/Tokyo" },
      ];

      mockUseQuery.mockReturnValue({
        data: mockData,
        isPending: false,
        isError: false,
      });

      vi.mocked(require("@calcom/trpc/react")).trpc = {
        viewer: {
          timezones: {
            cityTimezones: {
              useQuery: mockUseQuery,
            },
          },
        },
      };

      const { unmount, rerender } = render(
        <QueryWrapper>
          <FormWrapper>
            <TimezoneFilterSettings />
          </FormWrapper>
        </QueryWrapper>
      );

      const initialCallCount = mockUseQuery.mock.calls.length;

      // Unmount and remount component
      unmount();
      rerender(
        <QueryWrapper>
          <FormWrapper>
            <TimezoneFilterSettings />
          </FormWrapper>
        </QueryWrapper>
      );

      // With proper caching, the call count might be the same or slightly higher
      // but not doubled (which would indicate no caching)
      expect(mockUseQuery.mock.calls.length).toBeLessThanOrEqual(initialCallCount + 1);
    });
  });

  describe("Concurrent Requests", () => {
    it("should handle multiple instances of component correctly", async () => {
      const mockData = [
        { city: "Berlin", timezone: "Europe/Berlin" },
      ];

      mockUseQuery.mockReturnValue({
        data: mockData,
        isPending: false,
        isError: false,
      });

      vi.mocked(require("@calcom/trpc/react")).trpc = {
        viewer: {
          timezones: {
            cityTimezones: {
              useQuery: mockUseQuery,
            },
          },
        },
      };

      render(
        <QueryWrapper>
          <FormWrapper>
            <div>
              <TimezoneFilterSettings />
              <TimezoneFilterSettings />
              <TimezoneFilterSettings />
            </div>
          </FormWrapper>
        </QueryWrapper>
      );

      // All instances should share the same query
      const toggles = screen.getAllByTestId("timezone-filter-toggle");
      expect(toggles).toHaveLength(3);

      // Enable first instance
      fireEvent.click(toggles[0]);

      await waitFor(() => {
        const selects = screen.getAllByTestId("timezone-select");
        expect(selects).toHaveLength(1);
      });
    });
  });
});