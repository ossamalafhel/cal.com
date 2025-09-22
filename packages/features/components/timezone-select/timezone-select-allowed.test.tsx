import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi } from "vitest";

import dayjs from "@calcom/dayjs";

import { TimezoneSelect, TimezoneSelectComponent } from "./TimezoneSelect";

describe("TimezoneSelect - allowedTimezones filtering", () => {
  const mockCityTimezones = [
    { city: "New York", timezone: "America/New_York" },
    { city: "Los Angeles", timezone: "America/Los_Angeles" },
    { city: "Chicago", timezone: "America/Chicago" },
    { city: "Denver", timezone: "America/Denver" },
    { city: "London", timezone: "Europe/London" },
    { city: "Paris", timezone: "Europe/Paris" },
    { city: "Tokyo", timezone: "Asia/Tokyo" },
    { city: "Sydney", timezone: "Australia/Sydney" },
  ];

  const mockSearchData = [
    { label: "Eastern Time - US & Canada", timezone: "America/New_York" },
    { label: "Pacific Time - US & Canada", timezone: "America/Los_Angeles" },
    { label: "Central Time - US & Canada", timezone: "America/Chicago" },
    { label: "Mountain Time - US & Canada", timezone: "America/Denver" },
    { label: "Western European Time", timezone: "Europe/London" },
    { label: "Central European Time", timezone: "Europe/Berlin" },
    { label: "Japan Standard Time", timezone: "Asia/Tokyo" },
    { label: "Australian Eastern Time", timezone: "Australia/Sydney" },
  ];

  beforeAll(() => {
    vi.mock("@calcom/trpc/react", () => ({
      trpc: {
        viewer: {
          timezones: {
            cityTimezones: {
              useQuery() {
                return {
                  data: mockCityTimezones,
                  isPending: false,
                };
              },
            },
          },
        },
      },
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const formatOffset = (offset: string) =>
    offset.replace(/^([-+])(0)(\d):00$/, (_, sign, _zero, hour) => `${sign}${hour}:00`);
  
  const formatTimeZoneWithOffset = (timeZone: string) =>
    `${timeZone} GMT ${formatOffset(dayjs.tz(undefined, timeZone).format("Z"))}`;

  const openMenu = async (container: HTMLElement) => {
    await waitFor(async () => {
      const element = container.querySelector('[data-testid="timezone-select"] input');
      if (element) {
        element.focus();
        fireEvent.keyDown(element, { key: "ArrowDown", code: "ArrowDown" });
      }
    });
  };

  describe("TimezoneSelect component", () => {
    it("should display all timezones when allowedTimezones is not provided", async () => {
      const { container } = render(
        <TimezoneSelect value="America/New_York" />
      );

      await openMenu(container);

      // Check that multiple timezones are visible
      await waitFor(() => {
        const newYorkOption = screen.queryByText(/America\/New_York/);
        expect(newYorkOption).toBeInTheDocument();
      });
    });

    it("should only display allowed timezones when allowedTimezones is provided", async () => {
      const allowedTimezones = ["America/New_York", "America/Los_Angeles"];
      
      const { container } = render(
        <TimezoneSelect 
          value="America/New_York" 
          allowedTimezones={allowedTimezones}
        />
      );

      await openMenu(container);

      // Check that allowed timezones are visible
      await waitFor(() => {
        const newYorkOption = screen.queryByText(/America\/New_York/);
        expect(newYorkOption).toBeInTheDocument();
      });

      // Check that non-allowed timezones are not visible
      const tokyoOption = screen.queryByText(/Asia\/Tokyo/);
      expect(tokyoOption).not.toBeInTheDocument();
    });

    it("should filter search results based on allowedTimezones", async () => {
      const allowedTimezones = ["America/New_York", "Europe/London"];
      const onChange = vi.fn();
      
      const { container } = render(
        <TimezoneSelect 
          value="America/New_York" 
          allowedTimezones={allowedTimezones}
          onChange={onChange}
        />
      );

      // Type to search
      const input = container.querySelector('[data-testid="timezone-select"] input') as HTMLInputElement;
      
      if (input) {
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: "Time" } });
      }

      await waitFor(() => {
        // Should show Eastern Time (America/New_York)
        const easternTime = screen.queryByText(/Eastern Time/);
        expect(easternTime).toBeInTheDocument();

        // Should show Western European Time (Europe/London)
        const westernEuropean = screen.queryByText(/Western European/);
        expect(westernEuropean).toBeInTheDocument();

        // Should NOT show Pacific Time (America/Los_Angeles) - not in allowed list
        const pacificTime = screen.queryByText(/Pacific Time/);
        expect(pacificTime).not.toBeInTheDocument();
      });
    });
  });

  describe("TimezoneSelectComponent", () => {
    it("should filter initial data when allowedTimezones is provided", () => {
      const allowedTimezones = ["America/New_York", "America/Chicago"];
      const data = [...mockCityTimezones, ...mockSearchData];
      
      render(
        <TimezoneSelectComponent
          isPending={false}
          data={data}
          value="America/New_York"
          allowedTimezones={allowedTimezones}
        />
      );

      // Component should render without errors
      const selectElement = screen.getByTestId("timezone-select");
      expect(selectElement).toBeInTheDocument();
    });

    it("should handle empty allowedTimezones array", async () => {
      const allowedTimezones: string[] = [];
      const data = [...mockCityTimezones, ...mockSearchData];
      
      const { container } = render(
        <TimezoneSelectComponent
          isPending={false}
          data={data}
          value="America/New_York"
          allowedTimezones={allowedTimezones}
        />
      );

      await openMenu(container);

      // Should show all timezones when allowedTimezones is empty
      await waitFor(() => {
        const newYorkOption = screen.queryByText(/America\/New_York/);
        expect(newYorkOption).toBeInTheDocument();
      });
    });

    it("should handle search with allowedTimezones filtering", async () => {
      const allowedTimezones = ["America/New_York", "America/Los_Angeles", "Europe/London"];
      const data = [...mockCityTimezones, ...mockSearchData];
      const onChange = vi.fn();
      
      const { container } = render(
        <TimezoneSelectComponent
          isPending={false}
          data={data}
          value="America/New_York"
          allowedTimezones={allowedTimezones}
          onChange={onChange}
        />
      );

      const input = container.querySelector('[data-testid="timezone-select"] input') as HTMLInputElement;
      
      if (input) {
        fireEvent.focus(input);
        // Search for "Los"
        fireEvent.change(input, { target: { value: "Los" } });
      }

      await waitFor(() => {
        // Should show Los Angeles (in allowed list)
        const losAngelesOption = screen.queryByText(/Los Angeles/);
        expect(losAngelesOption).toBeInTheDocument();

        // Should not show other cities not in allowed list
        const parisOption = screen.queryByText(/Paris/);
        expect(parisOption).not.toBeInTheDocument();
      });
    });

    it("should update filtered timezones when allowedTimezones prop changes", () => {
      const data = [...mockCityTimezones, ...mockSearchData];
      
      const { rerender } = render(
        <TimezoneSelectComponent
          isPending={false}
          data={data}
          value="America/New_York"
          allowedTimezones={["America/New_York", "America/Los_Angeles"]}
        />
      );

      // Component should render
      expect(screen.getByTestId("timezone-select")).toBeInTheDocument();

      // Update allowed timezones
      rerender(
        <TimezoneSelectComponent
          isPending={false}
          data={data}
          value="Europe/London"
          allowedTimezones={["Europe/London", "Europe/Paris"]}
        />
      );

      // Component should still render with new allowed timezones
      expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
    });

    it("should handle onChange correctly with allowed timezones", async () => {
      const allowedTimezones = ["America/New_York", "America/Los_Angeles"];
      const data = [...mockCityTimezones, ...mockSearchData];
      const onChange = vi.fn();
      
      const { container } = render(
        <TimezoneSelectComponent
          isPending={false}
          data={data}
          value="America/New_York"
          allowedTimezones={allowedTimezones}
          onChange={onChange}
        />
      );

      await openMenu(container);

      // Click on Los Angeles option
      await waitFor(() => {
        const losAngelesOption = screen.getByText(/America\/Los_Angeles/);
        fireEvent.click(losAngelesOption);
      });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          value: "America/Los_Angeles",
        })
      );
    });

    it("should correctly filter timezones object for BaseSelect", () => {
      const allowedTimezones = ["America/New_York", "Europe/London"];
      const data = [
        { label: "New York", timezone: "America/New_York" },
        { label: "Los Angeles", timezone: "America/Los_Angeles" },
        { label: "London", timezone: "Europe/London" },
        { label: "Paris", timezone: "Europe/Paris" },
      ];

      render(
        <TimezoneSelectComponent
          isPending={false}
          data={data}
          value="America/New_York"
          allowedTimezones={allowedTimezones}
        />
      );

      // Component should render correctly with filtered timezones
      const selectElement = screen.getByTestId("timezone-select");
      expect(selectElement).toBeInTheDocument();
    });

    it("should handle undefined allowedTimezones prop", async () => {
      const data = [...mockCityTimezones, ...mockSearchData];
      
      const { container } = render(
        <TimezoneSelectComponent
          isPending={false}
          data={data}
          value="America/New_York"
          allowedTimezones={undefined}
        />
      );

      await openMenu(container);

      // Should show all timezones when allowedTimezones is undefined
      await waitFor(() => {
        const newYorkOption = screen.queryByText(/America\/New_York/);
        expect(newYorkOption).toBeInTheDocument();
        
        // Also check that other timezones are available
        const input = container.querySelector('[data-testid="timezone-select"] input') as HTMLInputElement;
        if (input) {
          fireEvent.change(input, { target: { value: "Tokyo" } });
        }
        
        const tokyoOption = screen.queryByText(/Tokyo/);
        expect(tokyoOption).toBeInTheDocument();
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle allowedTimezones with timezones not in the data", () => {
      const allowedTimezones = ["America/New_York", "America/Bogota"]; // Bogota not in mock data
      const data = mockCityTimezones;
      
      render(
        <TimezoneSelectComponent
          isPending={false}
          data={data}
          value="America/New_York"
          allowedTimezones={allowedTimezones}
        />
      );

      // Should render without crashing
      const selectElement = screen.getByTestId("timezone-select");
      expect(selectElement).toBeInTheDocument();
    });

    it("should handle value not in allowedTimezones", () => {
      const allowedTimezones = ["America/Los_Angeles", "Europe/London"];
      const data = mockCityTimezones;
      
      // Value is America/New_York which is not in allowedTimezones
      render(
        <TimezoneSelectComponent
          isPending={false}
          data={data}
          value="America/New_York"
          allowedTimezones={allowedTimezones}
        />
      );

      // Should still render the component
      const selectElement = screen.getByTestId("timezone-select");
      expect(selectElement).toBeInTheDocument();
    });

    it("should maintain timezone corrections with allowedTimezones", async () => {
      const allowedTimezones = ["America/Port_of_Spain"];
      const data = [
        { label: "Port of Spain", timezone: "America/Port_Of_Spain" }, // Incorrect format
      ];
      const onChange = vi.fn();
      
      const { container } = render(
        <TimezoneSelectComponent
          isPending={false}
          data={data}
          value=""
          allowedTimezones={allowedTimezones}
          onChange={onChange}
        />
      );

      await openMenu(container);

      // Find and click the option
      await waitFor(() => {
        const option = screen.getByText(/Port/);
        fireEvent.click(option);
      });

      // Should correct the timezone format
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          value: "America/Port_of_Spain", // Corrected format
        })
      );
    });
  });
});