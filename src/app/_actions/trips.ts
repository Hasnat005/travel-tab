"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

type CreateTripResult =
  | { success: true }
  | { success: false; error: string; redirectTo?: string };

const createTripSchema = z
  .object({
    name: z.string().trim().min(1, "Trip name is required"),
    destination: z.string().trim().min(1, "Destination is required"),
    start_date: z.string().min(1, "Start date is required"),
    end_date: z.string().min(1, "End date is required"),
    notes: z
      .string()
      .trim()
      .max(2000, "Notes must be 2000 characters or less")
      .optional()
      .or(z.literal("")),
  })
  .strict();

function parseDateOnly(value: string): Date {
  // Expect YYYY-MM-DD from <input type="date">.
  // Use UTC midnight for stability across timezones.
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

export async function createTrip(formData: FormData): Promise<CreateTripResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Please log in to create a trip.", redirectTo: "/login" };
  }

  const parsed = createTripSchema.safeParse({
    name: formData.get("name"),
    destination: formData.get("destination"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return { success: false, error: message };
  }

  const startDate = parseDateOnly(parsed.data.start_date);
  const endDate = parseDateOnly(parsed.data.end_date);
  if (endDate.getTime() < startDate.getTime()) {
    return { success: false, error: "End date must be after start date" };
  }

  // Supabase Auth users live in `auth.users`, but our app models a `User` table in `public`.
  // Ensure a corresponding row exists BEFORE inserting anything with FK references.
  try {
    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email ?? `${user.id}@example.invalid`,
        name:
          typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null,
        username:
          typeof user.user_metadata?.username === "string"
            ? user.user_metadata.username
            : null,
      },
      update: {
        email: user.email ?? undefined,
        name:
          typeof user.user_metadata?.name === "string"
            ? user.user_metadata.name
            : undefined,
        username:
          typeof user.user_metadata?.username === "string"
            ? user.user_metadata.username
            : undefined,
      },
    });

    await prisma.$transaction(async (tx) => {
      const created = await tx.trip.create({
        data: {
          creator_id: user.id,
          name: parsed.data.name,
          destination: parsed.data.destination,
          start_date: startDate,
          end_date: endDate,
          notes: parsed.data.notes ? parsed.data.notes : null,
          members: { create: { user_id: user.id } },
        },
        select: { id: true },
      });

      await tx.tripLog.create({
        data: {
          trip_id: created.id,
          action_type: "TRIP_CREATED",
          performed_by: user.id,
          timestamp: new Date(),
          details: {
            name: parsed.data.name,
            destination: parsed.data.destination,
          },
        },
      });

      return created;
    });

    revalidatePath("/trips");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to create trip." };
  }
}

export async function getUserTrips() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const trips = await prisma.trip.findMany({
    where: { members: { some: { user_id: user.id } } },
    orderBy: { start_date: "desc" },
    select: {
      id: true,
      name: true,
      destination: true,
      start_date: true,
      end_date: true,
      _count: { select: { members: true } },
    },
  });

  return trips;
}

type AddMemberResult =
  | { success: true }
  | {
      success: false;
      message: string;
    };

export async function addMember(tripId: string, email: string): Promise<AddMemberResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!tripId) {
    return { success: false, message: "Missing trip id." };
  }
  if (!normalizedEmail) {
    return { success: false, message: "Email is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Please log in to invite members." };
  }

  const inviterMembership = await prisma.tripMember.findUnique({
    where: { trip_id_user_id: { trip_id: tripId, user_id: user.id } },
    select: { trip_id: true },
  });

  // Security: only existing members can invite/add others.
  if (!inviterMembership) {
    return { success: false, message: "You must be a trip member to invite others." };
  }

  const invitedUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, name: true, username: true },
  });

  if (!invitedUser) {
    return {
      success: false,
      message: "User not found. They must sign up for TravelTab first.",
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.tripMember.findUnique({
      where: {
        trip_id_user_id: { trip_id: tripId, user_id: invitedUser.id },
      },
      select: { user_id: true },
    });

    if (existing) {
      return {
        ok: false as const,
        message: "User is already in this trip.",
      };
    }

    await tx.tripMember.create({
      data: { trip_id: tripId, user_id: invitedUser.id },
    });

    const [inviter, trip] = await Promise.all([
      tx.user.findUnique({
        where: { id: user.id },
        select: { id: true, name: true, email: true, username: true },
      }),
      tx.trip.findUnique({
        where: { id: tripId },
        select: { id: true },
      }),
    ]);

    // Trip might have been deleted mid-flight; membership insert succeeded, so still return success.
    if (trip) {
      const inviterLabel =
        inviter?.username?.trim() || inviter?.name?.trim() || inviter?.email || user.email || user.id;
      const invitedLabel =
        invitedUser.username?.trim() || invitedUser.name?.trim() || invitedUser.email;
      await tx.tripLog.create({
        data: {
          trip_id: tripId,
          action_type: "MEMBER_ADDED",
          performed_by: user.id,
          timestamp: new Date(),
          details: {
            message: `User ${inviterLabel} added User ${invitedLabel}`,
            invited_user_id: invitedUser.id,
            invited_email: invitedUser.email,
          },
        },
      });
    }

    return { ok: true as const };
  });

  if (!result.ok) {
    return { success: false, message: result.message };
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/trips");
  return { success: true };
}

export async function addMemberAction(
  _prevState: AddMemberResult,
  formData: FormData
): Promise<AddMemberResult> {
  const tripId = String(formData.get("tripId") ?? "");
  const email = String(formData.get("email") ?? "");
  return addMember(tripId, email);
}

type RemoveMemberResult =
  | { success: true }
  | {
      success: false;
      message: string;
    };

export async function removeMember(
  tripId: string,
  memberUserId: string
): Promise<RemoveMemberResult> {
  if (!tripId) {
    return { success: false, message: "Missing trip id." };
  }
  if (!memberUserId) {
    return { success: false, message: "Missing member id." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Please log in." };
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, creator_id: true },
  });

  if (!trip) {
    return { success: false, message: "Trip not found." };
  }

  const requesterMembership = await prisma.tripMember.findUnique({
    where: { trip_id_user_id: { trip_id: tripId, user_id: user.id } },
    select: { user_id: true },
  });

  if (!requesterMembership) {
    return { success: false, message: "You must be a trip member." };
  }

  const isCreator = trip.creator_id === user.id;
  const isSelf = memberUserId === user.id;

  // Authorization: creator can remove anyone (except themselves); any user can remove themselves (leave trip).
  if (!isCreator && !isSelf) {
    return { success: false, message: "Only the trip creator can remove other members." };
  }

  if (memberUserId === trip.creator_id) {
    return { success: false, message: "Trip creator cannot be removed." };
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.tripMember.findUnique({
      where: { trip_id_user_id: { trip_id: tripId, user_id: memberUserId } },
      select: { user_id: true },
    });

    if (!existing) {
      return { ok: false as const, message: "User is not in this trip." };
    }

    await tx.tripMember.delete({
      where: { trip_id_user_id: { trip_id: tripId, user_id: memberUserId } },
    });

    const [actor, removed] = await Promise.all([
      tx.user.findUnique({
        where: { id: user.id },
        select: { name: true, email: true },
      }),
      tx.user.findUnique({
        where: { id: memberUserId },
        select: { name: true, email: true },
      }),
    ]);

    const actorLabel = actor?.name?.trim() || actor?.email || user.email || user.id;
    const removedLabel = removed?.name?.trim() || removed?.email || memberUserId;

    await tx.tripLog.create({
      data: {
        trip_id: tripId,
        action_type: "MEMBER_REMOVED",
        performed_by: user.id,
        timestamp: new Date(),
        details: {
          message: `User ${actorLabel} removed User ${removedLabel}`,
          removed_user_id: memberUserId,
        },
      },
    });

    return { ok: true as const };
  });

  if (!result.ok) {
    return { success: false, message: result.message };
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/trips");
  return { success: true };
}

export async function removeMemberAction(
  _prevState: RemoveMemberResult,
  formData: FormData
): Promise<RemoveMemberResult> {
  const tripId = String(formData.get("tripId") ?? "");
  const memberUserId = String(formData.get("memberUserId") ?? "");
  return removeMember(tripId, memberUserId);
}
