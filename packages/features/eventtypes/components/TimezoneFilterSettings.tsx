import { useState, useEffect } from "react";
import { Controller, useFormContext } from "react-hook-form";
import type { MultiValue } from "react-select";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import classNames from "@calcom/ui/classNames";
import { Label, Select, SettingsToggle } from "@calcom/ui/components/form";
import { Icon } from "@calcom/ui/components/icon";

interface TimezoneOption {
  value: string;
  label: string;
}

interface TimezoneFilterSettingsProps {
  eventType?: {
    id: number;
    metadata?: {
      allowedTimezones?: string[];
    } | null;
  };
  customClassNames?: {
    container?: string;
    toggle?: {
      container?: string;
      title?: string;
      description?: string;
    };
    select?: {
      container?: string;
      label?: string;
    };
  };
}

export const TimezoneFilterSettings = ({ eventType, customClassNames }: TimezoneFilterSettingsProps) => {
  const { t } = useLocale();
  const formMethods = useFormContext();
  const { control, setValue, watch } = formMethods;
  
  const [isTimezoneFilterEnabled, setIsTimezoneFilterEnabled] = useState(false);
  const [selectedTimezones, setSelectedTimezones] = useState<TimezoneOption[]>([]);

  // Get the current metadata value from the form
  const metadata = watch("metadata");
  
  // Fetch available timezones
  const { data: timezoneData = [], isPending } = trpc.viewer.timezones.cityTimezones.useQuery(
    { CalComVersion: "1.0.0" },
    { trpc: { context: { skipBatch: true } } }
  );

  // Prepare timezone options for the multi-select
  const timezoneOptions: TimezoneOption[] = timezoneData.map(({ city, timezone }) => ({
    value: timezone,
    label: `${city} (${timezone})`,
  }));

  // Add common US timezones at the top of the list for easy selection
  const commonUSTimezones: TimezoneOption[] = [
    { value: "America/New_York", label: "Eastern Time - New York (America/New_York)" },
    { value: "America/Chicago", label: "Central Time - Chicago (America/Chicago)" },
    { value: "America/Denver", label: "Mountain Time - Denver (America/Denver)" },
    { value: "America/Phoenix", label: "Mountain Time - Phoenix (America/Phoenix)" },
    { value: "America/Los_Angeles", label: "Pacific Time - Los Angeles (America/Los_Angeles)" },
    { value: "America/Anchorage", label: "Alaska Time - Anchorage (America/Anchorage)" },
    { value: "Pacific/Honolulu", label: "Hawaii Time - Honolulu (Pacific/Honolulu)" },
  ];

  // Combine common timezones with all timezones, removing duplicates
  const allTimezoneOptions = [
    ...commonUSTimezones,
    ...timezoneOptions.filter(
      (tz) => !commonUSTimezones.some((common) => common.value === tz.value)
    ),
  ];

  // Initialize state from existing event type metadata
  useEffect(() => {
    if (eventType?.metadata?.allowedTimezones && eventType.metadata.allowedTimezones.length > 0) {
      setIsTimezoneFilterEnabled(true);
      const initialSelectedTimezones = eventType.metadata.allowedTimezones
        .map((tz) => {
          const option = allTimezoneOptions.find((opt) => opt.value === tz);
          return option || { value: tz, label: tz };
        })
        .filter(Boolean) as TimezoneOption[];
      setSelectedTimezones(initialSelectedTimezones);
    }
  }, [eventType?.metadata?.allowedTimezones]);

  // Update form metadata when timezone selection changes
  useEffect(() => {
    if (isTimezoneFilterEnabled && selectedTimezones.length > 0) {
      const currentMetadata = metadata || {};
      setValue("metadata", {
        ...currentMetadata,
        allowedTimezones: selectedTimezones.map((tz) => tz.value),
      });
    } else {
      // Remove allowedTimezones from metadata when disabled
      const currentMetadata = metadata || {};
      const { allowedTimezones, ...restMetadata } = currentMetadata;
      setValue("metadata", restMetadata);
    }
  }, [isTimezoneFilterEnabled, selectedTimezones, setValue]);

  const handleTimezoneToggle = (enabled: boolean) => {
    setIsTimezoneFilterEnabled(enabled);
    if (!enabled) {
      setSelectedTimezones([]);
    }
  };

  const handleTimezoneChange = (newValue: MultiValue<TimezoneOption>) => {
    setSelectedTimezones(newValue as TimezoneOption[]);
  };

  return (
    <div className={classNames("space-y-4", customClassNames?.container)}>
      <SettingsToggle
        checked={isTimezoneFilterEnabled}
        onCheckedChange={handleTimezoneToggle}
        title={t("timezone_selection")}
        description={t("timezone_selection_description")}
        customClassNames={{
          container: customClassNames?.toggle?.container,
          title: customClassNames?.toggle?.title,
          description: customClassNames?.toggle?.description,
        }}>
        <div className={classNames("mt-4", customClassNames?.select?.container)}>
          <Controller
            name="metadata.allowedTimezones"
            control={control}
            render={({ field: { onChange, value, ...field } }) => (
              <>
                <Label className={classNames("mb-2", customClassNames?.select?.label)}>
                  {t("allowed_timezones")}
                </Label>
                <Select
                  {...field}
                  isMulti
                  isLoading={isPending}
                  value={selectedTimezones}
                  onChange={handleTimezoneChange}
                  options={allTimezoneOptions}
                  placeholder={t("select_allowed_timezones")}
                  className="mb-2"
                  isSearchable
                  isClearable={false}
                  formatOptionLabel={(option: TimezoneOption) => (
                    <div className="flex items-center">
                      <Icon name="globe" className="mr-2 h-4 w-4" />
                      <span>{option.label}</span>
                    </div>
                  )}
                />
                {selectedTimezones.length > 0 && (
                  <div className="mt-2 text-sm text-default">
                    {t("selected_timezones_count", { count: selectedTimezones.length })}
                  </div>
                )}
                {isTimezoneFilterEnabled && selectedTimezones.length === 0 && (
                  <div className="mt-2 text-sm text-orange-600">
                    {t("no_timezones_selected_warning")}
                  </div>
                )}
              </>
            )}
          />
        </div>
      </SettingsToggle>
    </div>
  );
};

export default TimezoneFilterSettings;