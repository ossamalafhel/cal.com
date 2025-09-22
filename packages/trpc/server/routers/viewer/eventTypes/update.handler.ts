import { Prisma } from "@prisma/client";
import type { NextApiResponse, GetServerSidePropsContext } from "next";

import type { appDataSchemas } from "@calcom/app-store/apps.schemas.generated";
import { DailyLocationType } from "@calcom/app-store/locations";
import updateChildrenEventTypes from "@calcom/features/ee/managed-event-types/lib/handleChildrenEventTypes";
import {
  allowDisablingAttendeeConfirmationEmails,
  allowDisablingHostConfirmationEmails,
} from "@calcom/features/ee/workflows/lib/allowDisablingStandardEmails";
import tasker from "@calcom/features/tasker";
import { validateIntervalLimitOrder } from "@calcom/lib/intervalLimits/validateIntervalLimitOrder";
import logger from "@calcom/lib/logger";
import { getTranslation } from "@calcom/lib/server/i18n";
import { CalVideoSettingsRepository } from "@calcom/lib/server/repository/calVideoSettings";
import { HashedLinkRepository } from "@calcom/lib/server/repository/hashedLinkRepository";
import { MembershipRepository } from "@calcom/lib/server/repository/membership";
import { ScheduleRepository } from "@calcom/lib/server/repository/schedule";
import { HashedLinkService } from "@calcom/lib/server/service/hashedLinkService";
import { validateBookerLayouts } from "@calcom/lib/validateBookerLayouts";
import { validateAllowedTimezones } from "@calcom/lib/validateAllowedTimezones";
import type { PrismaClient } from "@calcom/prisma";
import { WorkflowTriggerEvents } from "@calcom/prisma/client";
import { SchedulingType, EventTypeAutoTranslatedField, RRTimestampBasis } from "@calcom/prisma/enums";
import { eventTypeAppMetadataOptionalSchema } from "@calcom/prisma/zod-utils";
import { eventTypeLocations } from "@calcom/prisma/zod-utils";

import { TRPCError } from "@trpc/server";

import type { TrpcSessionUser } from "../../../types";
import { setDestinationCalendarHandler } from "../../viewer/calendars/setDestinationCalendar.handler";
import type { TUpdateInputSchema } from "./update.schema";
import {
  ensureUniqueBookingFields,
  ensureEmailOrPhoneNumberIsPresent,
  handleCustomInputs,
  handlePeriodType,
} from "./util";

type SessionUser = NonNullable<TrpcSessionUser>;

type User = {
  id: SessionUser["id"];
  username: SessionUser["username"];
  profile: {
    id: SessionUser["profile"]["id"] | null;
  };
  userLevelSelectedCalendars: SessionUser["userLevelSelectedCalendars"];
  organizationId: number | null;
  email: SessionUser["email"];
  locale: string;
};

type UpdateOptions = {
  ctx: {
    user: User;
    res?: NextApiResponse | GetServerSidePropsContext["res"];
    prisma: PrismaClient;
  };
  input: TUpdateInputSchema;
};

export type UpdateEventTypeReturn = Awaited<ReturnType<typeof updateHandler>>;

export const updateHandler = async ({ ctx, input }: UpdateOptions) => {
  const {
    schedule,
    instantMeetingSchedule,
    periodType,
    locations,
    bookingLimits,
    durationLimits,
    maxActiveBookingsPerBooker,
    destinationCalendar,
    customInputs,
    recurringEvent,
    eventTypeColor,
    users,
    children,
    assignAllTeamMembers,
    hosts,
    id,
    multiplePrivateLinks,
    // Extract this from the input so it doesn't get saved in the db
    // eslint-disable-next-line
    userId,
    bookingFields,
    offsetStart,
    secondaryEmailId,
    aiPhoneCallConfig,
    isRRWeightsEnabled,
    autoTranslateDescriptionEnabled,
    description: newDescription,
    title: newTitle,
    seatsPerTimeSlot,
    restrictionScheduleId,
    calVideoSettings,
    ...rest
  } = input;

  const eventType = await ctx.prisma.eventType.findUniqueOrThrow({
    where: { id },
    select: {
      title: true,
      locations: true,
      description: true,
      seatsPerTimeSlot: true,
      recurringEvent: true,
      maxActiveBookingsPerBooker: true,
      fieldTranslations: {
        select: {
          field: true,
        },
      },
      isRRWeightsEnabled: true,
      hosts: {
        select: {
          userId: true,
          priority: true,
          weight: true,
          isFixed: true,
        },
      },
      aiPhoneCallConfig: {
        select: {
          generalPrompt: true,
          beginMessage: true,
          enabled: true,
          llmId: true,
        },
      },
      calVideoSettings: {
        select: {
          disableRecordingForOrganizer: true,
          disableRecordingForGuests: true,
          enableAutomaticTranscription: true,
          enableAutomaticRecordingForOrganizer: true,
          disableTranscriptionForGuests: true,
          disableTranscriptionForOrganizer: true,
          redirectUrlOnExit: true,
        },
      },
      children: {
        select: {
          userId: true,
        },
      },
      workflows: {
        select: {
          workflowId: true,
        },
      },
      team: {
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
          rrTimestampBasis: true,
          parent: {
            select: {
              slug: true,
            },
          },
          members: {
            select: {
              role: true,
              accepted: true,
              user: {
                select: {
                  name: true,
                  id: true,
                  email: true,
                  eventTypes: {
                    select: {
                      slug: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (input.teamId && eventType.team?.id && input.teamId !== eventType.team.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const finalSeatsPerTimeSlot = seatsPerTimeSlot ?? eventType.seatsPerTimeSlot;
  const finalRecurringEvent = recurringEvent ?? eventType.recurringEvent;

  if (finalSeatsPerTimeSlot && finalRecurringEvent) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Recurring Events and Offer Seats cannot be active at the same time.",
    });
  }

  const teamId = input.teamId || eventType.team?.id;
  const guestsField = bookingFields?.find((field) => field.name === "guests");

  ensureUniqueBookingFields(bookingFields);
  ensureEmailOrPhoneNumberIsPresent(bookingFields);

  if (autoTranslateDescriptionEnabled && !ctx.user.organizationId) {
    logger.error(
      "Auto-translating description requires an organization. This should not happen - UI controls should prevent this state."
    );
  }

  const data: Prisma.EventTypeUpdateInput = {
    ...rest,
    // autoTranslate feature is allowed for org users only
    autoTranslateDescriptionEnabled: !!(ctx.user.organizationId && autoTranslateDescriptionEnabled),
    description: newDescription,
    title: newTitle,
    bookingFields,
    isRRWeightsEnabled,
    rrSegmentQueryValue:
      rest.rrSegmentQueryValue === null ? Prisma.DbNull : (rest.rrSegmentQueryValue as Prisma.InputJsonValue),
    metadata: rest.metadata === null ? Prisma.DbNull : (rest.metadata as Prisma.InputJsonObject),
    eventTypeColor: eventTypeColor === null ? Prisma.DbNull : (eventTypeColor as Prisma.InputJsonObject),
    disableGuests: guestsField?.hidden ?? false,
    seatsPerTimeSlot,
    maxLeadThreshold:
      eventType.team?.rrTimestampBasis && eventType.team?.rrTimestampBasis !== RRTimestampBasis.CREATED_AT
        ? null
        : rest.maxLeadThreshold,
  };
  data.locations = locations ?? undefined;

  if (periodType) {
    data.periodType = handlePeriodType(periodType);
  }

  if (recurringEvent) {
    data.recurringEvent = {
      dstart: recurringEvent.dtstart as unknown as Prisma.InputJsonObject,
      interval: recurringEvent.interval,
      count: recurringEvent.count,
      freq: recurringEvent.freq,
      until: recurringEvent.until as unknown as Prisma.InputJsonObject,
      tzid: recurringEvent.tzid,
    };
  } else if (recurringEvent === null) {
    data.recurringEvent = Prisma.DbNull;
  }

  if (destinationCalendar) {
    /** We connect or create a destination calendar to the event type instead of the user */
    await setDestinationCalendarHandler({
      ctx,
      input: {
        ...destinationCalendar,
        eventTypeId: id,
      },
    });
  }

  if (customInputs) {
    data.customInputs = handleCustomInputs(customInputs, id);
  }

  if (bookingLimits) {
    const isValid = validateIntervalLimitOrder(bookingLimits);
    if (!isValid)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Booking limits must be in ascending order." });
    data.bookingLimits = bookingLimits;
  }

  if (maxActiveBookingsPerBooker) {
    if (maxActiveBookingsPerBooker && maxActiveBookingsPerBooker < 1) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Booker booking limit must be greater than 0." });
    }

    if (maxActiveBookingsPerBooker && (recurringEvent || eventType.recurringEvent)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Recurring Events and booker active bookings limit cannot be active at the same time.",
      });
    }

    if (eventType.maxActiveBookingsPerBooker && recurringEvent) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Recurring Events and booker active bookings limit cannot be active at the same time.",
      });
    }

    data.maxActiveBookingsPerBooker = maxActiveBookingsPerBooker;
  }

  if (durationLimits) {
    const isValid = validateIntervalLimitOrder(durationLimits);
    if (!isValid)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Duration limits must be in ascending order." });
    data.durationLimits = durationLimits;
  }

  if (offsetStart !== undefined) {
    if (offsetStart < 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Offset start time must be zero or greater." });
    }
    data.offsetStart = offsetStart;
  }

  const bookerLayoutsError = validateBookerLayouts(input.metadata?.bookerLayouts || null);
  if (bookerLayoutsError) {
    const t = await getTranslation("en", "common");
    throw new TRPCError({ code: "BAD_REQUEST", message: t(bookerLayoutsError) });
  }

  // Validate allowedTimezones if provided in metadata
  if (input.metadata?.allowedTimezones) {
    const timezoneValidation = validateAllowedTimezones(input.metadata.allowedTimezones);
    if (!timezoneValidation.isValid) {
      throw new TRPCError({ 
        code: "BAD_REQUEST", 
        message: timezoneValidation.error || "Invalid timezone(s) provided" 
      });
    }
  }

  if (schedule) {
    // Check that the schedule belongs to the user
    const userScheduleQuery = await ctx.prisma.schedule.findFirst({
      where: {
        userId: ctx.user.id,
        id: schedule,
      },
    });
    if (userScheduleQuery) {
      data.schedule = {
        connect: {
          id: schedule,
        },
      };
    }
  }
  // allows unsetting a schedule through { schedule: null, ... }
  else if (null === schedule || schedule === 0) {
    data.schedule = {
      disconnect: true,
    };
  }

  if (instantMeetingSchedule) {
    data.instantMeetingSchedule = {
      connect: {
        id: instantMeetingSchedule,
      },
    };
  } else if (schedule === null) {
    data.instantMeetingSchedule = {
      disconnect: true,
    };
  }

  const membershipRepo = new MembershipRepository(ctx.prisma);

  // Load all users added to this event type
  if (users) {
    data.users = {
      set: [],
      connect: users.map((userId) => ({ id: userId })),
    };
  }

  if (teamId && hosts) {
    const teamMemberIds = await membershipRepo.findMemberIdsCanConfigureEventTypes(teamId);
    const teamMemberIdsIncludingNullUserId = teamMemberIds
      .filter((teamMemberId): teamMemberId is number => teamMemberId !== null)
      .map((teamMemberId) => ({ userId: teamMemberId }));
    const weCanCreateJustForMemberIds = hosts.filter((host) => teamMemberIds.includes(host.userId));
    const hostIds = weCanCreateJustForMemberIds.map((host) => host.userId);
    data.hosts = {
      deleteMany: {},
      create: weCanCreateJustForMemberIds.map((host) => ({
        ...host,
        scheduleId: host.scheduleId || undefined,
        isFixed: host.priority !== 2 && host.isFixed,
      })),
    };

    if (weCanCreateJustForMemberIds.length !== hosts.length) {
      // Mismatch between hosts submitted and hosts that can be created for this team
      const removedHostIds = hosts.filter((host) => !hostIds.includes(host.userId)).map((host) => host.userId);
      const removedHostNames = eventType.team?.members
        .filter((member) => removedHostIds.includes(member.user.id))
        .map((member) => member.user.name || member.user.id);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `You don't have permission to add ${removedHostNames?.join(", ")} to this event type.`,
      });
    }

    // If all team members are given same priority then or
    if ((hosts.some((host) => host.priority === 1) || hosts.every((host) => host.priority === null))) {
      // @TODO: FIND ME A BETTER PLACE
      if (assignAllTeamMembers && eventType.team?.parentId) {
        const membersWithoutHost = await membershipRepo.findMembersWithoutHost(eventType.team.id);
        const usersNotInHosts = membersWithoutHost.filter(
          (userId) => !teamMemberIdsIncludingNullUserId.find((host) => host.userId === userId)
        );
        if (usersNotInHosts.length > 0) {
          data.hosts = {
            deleteMany: {},
            create: [
              ...weCanCreateJustForMemberIds.map((host) => ({
                ...host,
                isFixed: host.priority !== 2 && host.isFixed,
                scheduleId: host.scheduleId || undefined,
              })),
              ...usersNotInHosts.map((userId) => ({
                userId: userId,
                isFixed: false,
              })),
            ],
          };
        }
      }

      const scheduleRepository = new ScheduleRepository(ctx.prisma);
      if (weCanCreateJustForMemberIds.length === 1 && !eventType.team?.parentId) {
        const userId = weCanCreateJustForMemberIds[0].userId;
        const defaultScheduleId = await scheduleRepository.getDefaultByUserId(userId);
        data.schedule = { connect: { id: defaultScheduleId } };
      } else {
        data.schedulingType = SchedulingType.ROUND_ROBIN;
      }
    }
  }

  // Only validate team's event type children
  if (teamId && children && children.length) {
    const assignedUsers = children
      .map((ch) => ch.owner)
      .filter((owner): owner is (typeof owner & { id: number }) => owner?.id !== undefined)
      .map((owner) => owner.id);
    const teamMembers = await ctx.prisma.membership.findMany({
      where: {
        teamId,
        userId: {
          in: assignedUsers,
        },
        accepted: true,
      },
    });
    const teamMemberIds = teamMembers.map((member) => member.userId);

    // To prevent making some unintended changes, we let users do it on purpose from event type page
    children = children.filter((ch) => {
      const childrenOwnerInTeam = !!ch.owner?.id && teamMemberIds.includes(ch.owner.id);
      const existedBeforeAsChild = eventType.children.find((child) => child.userId === ch.owner?.id);
      return childrenOwnerInTeam || existedBeforeAsChild;
    });

    // Store children
    const currentChildrenWithUserId = eventType.children.filter((ch) => ch.userId !== null).map((ch) => ch.userId);
    const deleteChildrenIds = currentChildrenWithUserId.filter(
      (id) => !children.map((ch) => ch.owner?.id).includes(id)
    );
    const createChildren = children.filter(
      (ch) => ch.owner?.id && !currentChildrenWithUserId.includes(ch.owner?.id)
    );
    data.children = {
      deleteMany: {
        userId: {
          in: deleteChildrenIds as number[],
        },
      },
      createMany: {
        data: createChildren.map((ch) => ({
          hidden: ch.hidden,
          owner: {
            connect: {
              id: ch.owner?.id || 0,
            },
          },
        })),
      },
    };
  }

  if (restrictionScheduleId) {
    if (restrictionScheduleId < 0) {
      data.restrictionSchedule = {
        disconnect: true,
      };
    } else {
      const restrictionScheduleBelongsToUser = await ctx.prisma.schedule.findFirst({
        where: {
          userId: ctx.user.id,
          id: restrictionScheduleId,
        },
      });
      if (restrictionScheduleBelongsToUser) {
        data.restrictionSchedule = {
          connect: {
            id: restrictionScheduleId,
          },
        };
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Schedule doesn't belong to the user",
        });
      }
    }
  }

  if (input.metadata?.disableStandardEmails?.all) {
    if (!eventType?.team?.parentId) {
      input.metadata.disableStandardEmails.all.host = false;
      input.metadata.disableStandardEmails.all.attendee = false;
    }
  }

  if (input.metadata?.disableStandardEmails?.confirmation) {
    //check if user is allowed to disabled standard emails
    const workflows = await ctx.prisma.workflow.findMany({
      where: {
        activeOn: {
          some: {
            eventTypeId: input.id,
          },
        },
        trigger: WorkflowTriggerEvents.NEW_EVENT,
      },
      include: {
        steps: true,
      },
    });

    if (input.metadata?.disableStandardEmails.confirmation?.host) {
      if (!allowDisablingHostConfirmationEmails(workflows)) {
        input.metadata.disableStandardEmails.confirmation.host = false;
      }
    }

    if (input.metadata?.disableStandardEmails.confirmation?.attendee) {
      if (!allowDisablingAttendeeConfirmationEmails(workflows)) {
        input.metadata.disableStandardEmails.confirmation.attendee = false;
      }
    }
  }

  const apps = eventTypeAppMetadataOptionalSchema.parse(input.metadata?.apps);
  for (const appKey in apps) {
    const app = apps[appKey as keyof typeof appDataSchemas];
    // There should only be one enabled payment app in the metadata
    if (app.enabled && app.price && app.currency) {
      data.price = app.price;
      data.currency = app.currency;
      break;
    }
  }
  console.log("multiplePrivateLinks", multiplePrivateLinks);
  // Handle multiple private links using the service
  const privateLinksRepo = HashedLinkRepository.create();
  const connectedLinks = await privateLinksRepo.findLinksByEventTypeId(input.id);
  console.log("connectedLinks", connectedLinks);
  const connectedMultiplePrivateLinks = connectedLinks.map((link) => link.link);

  const privateLinksService = new HashedLinkService();
  await privateLinksService.handleMultiplePrivateLinks({
    eventTypeId: input.id,
    multiplePrivateLinks,
    connectedMultiplePrivateLinks,
  });

  if (assignAllTeamMembers !== undefined) {
    data.assignAllTeamMembers = assignAllTeamMembers;
  }

  // Validate the secondary email
  if (secondaryEmailId) {
    const secondaryEmail = await ctx.prisma.secondaryEmail.findUnique({
      where: {
        id: secondaryEmailId,
        userId: ctx.user.id,
      },
    });
    // Make sure the secondary email id belongs to the current user and its a verified one
    if (secondaryEmail && secondaryEmail.emailVerified) {
      data.secondaryEmail = {
        connect: {
          id: secondaryEmailId,
        },
      };
      // Delete the data if the user selected his original email to send the events to, which means the value coming will be -1
    } else if (secondaryEmailId === -1) {
      data.secondaryEmail = {
        disconnect: true,
      };
    }
  }

  if (aiPhoneCallConfig) {
    if (aiPhoneCallConfig.enabled) {
      await ctx.prisma.aIPhoneCallConfiguration.upsert({
        where: {
          eventTypeId: id,
        },
        update: {
          ...aiPhoneCallConfig,
          guestEmail: !!aiPhoneCallConfig?.guestEmail ? aiPhoneCallConfig.guestEmail : null,
          guestCompany: !!aiPhoneCallConfig?.guestCompany ? aiPhoneCallConfig.guestCompany : null,
        },
        create: {
          ...aiPhoneCallConfig,
          guestEmail: !!aiPhoneCallConfig?.guestEmail ? aiPhoneCallConfig.guestEmail : null,
          guestCompany: !!aiPhoneCallConfig?.guestCompany ? aiPhoneCallConfig.guestCompany : null,
          eventTypeId: id,
        },
      });
    } else if (!aiPhoneCallConfig.enabled && eventType.aiPhoneCallConfig) {
      await ctx.prisma.aIPhoneCallConfiguration.delete({
        where: {
          eventTypeId: id,
        },
      });
    }
  }

  if (calVideoSettings) {
    await CalVideoSettingsRepository.createOrUpdateCalVideoSettings({
      eventTypeId: id,
      calVideoSettings,
    });
  }

  const parsedEventTypeLocations = eventTypeLocations.safeParse(eventType.locations ?? []);

  const isCalVideoLocationActive = locations
    ? locations.some((location) => location.type === DailyLocationType)
    : parsedEventTypeLocations.success &&
      parsedEventTypeLocations.data?.some((location) => location.type === DailyLocationType);

  if (eventType.calVideoSettings && !isCalVideoLocationActive) {
    await CalVideoSettingsRepository.deleteCalVideoSettings(id);
  }

  // Logic for updating `fieldTranslations`
  // user has no translations OR user is changing the field
  const hasNoDescriptionTranslations =
    eventType.fieldTranslations.filter((trans) => trans.field === EventTypeAutoTranslatedField.DESCRIPTION)
      .length === 0;
  const description = newDescription ?? (hasNoDescriptionTranslations ? eventType.description : undefined);
  const hasNoTitleTranslations =
    eventType.fieldTranslations.filter((trans) => trans.field === EventTypeAutoTranslatedField.TITLE)
      .length === 0;
  const title = newTitle ?? (hasNoTitleTranslations ? eventType.title : undefined);

  if (ctx.user.organizationId && autoTranslateDescriptionEnabled && (title || description)) {
    await tasker.create("translateEventTypeData", {
      eventTypeId: id,
      description,
      title,
      userLocale: ctx.user.locale,
      userId: ctx.user.id,
    });
  }

  const updatedEventTypeSelect = {
    slug: true,
    schedulingType: true,
  } satisfies Prisma.EventTypeSelect;
  let updatedEventType: Prisma.EventTypeGetPayload<{ select: typeof updatedEventTypeSelect }>;
  try {
    updatedEventType = await ctx.prisma.eventType.update({
      where: { id },
      data,
      select: updatedEventTypeSelect,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        // instead of throwing a 500 error, catch the conflict and throw a 400 error.
        throw new TRPCError({ message: "error_event_type_url_duplicate", code: "BAD_REQUEST" });
      }
    }
    throw e;
  }
  const updatedValues = Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      // @ts-expect-error Element implicitly has any type
      acc[key] = value;
    }
    return acc;
  }, {});

  // Handling updates to children event types (managed events types)
  await updateChildrenEventTypes({
    eventTypeId: id,
    currentUserId: ctx.user.id,
    oldEventType: eventType,
    updatedEventType,
    children,
    profileId: ctx.user.profile.id,
    prisma: ctx.prisma,
    updatedValues,
  });

  const res = ctx.res as NextApiResponse;
  if (typeof res?.revalidate !== "undefined") {
    try {
      await res?.revalidate(`/${ctx.user.username}/${updatedEventType.slug}`);
    } catch (e) {
      // if reach this it is because the event type page has not been created, so it is not possible to revalidate it
      logger.debug((e as Error)?.message);
    }
  }
  return { eventType };
};