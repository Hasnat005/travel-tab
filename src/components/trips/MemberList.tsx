"use client";

import { useActionState, useEffect, useRef } from "react";

import { addMemberAction, removeMemberAction } from "@/app/_actions/trips";
import MaterialCard from "@/components/ui/MaterialCard";
import MaterialButton from "@/components/ui/MaterialButton";
import MaterialInput from "@/components/ui/MaterialInput";

type Member = {
  user_id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    username?: string | null;
  };
};

type AddMemberResult =
  | { success: true }
  | {
      success: false;
      message: string;
    };

type RemoveMemberResult =
  | { success: true }
  | {
      success: false;
      message: string;
    };

function obfuscateEmail(email: string) {
  const at = email.indexOf("@");
  if (at <= 1) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const localPrefix = local.slice(0, Math.min(4, local.length));
  const domainParts = domain.split(".");
  const domainName = domainParts[0] ?? domain;
  const domainTld = domainParts.length > 1 ? domainParts[domainParts.length - 1] : "";
  const domainPrefix = domainName.slice(0, Math.min(3, domainName.length));

  return `${localPrefix}...@${domainPrefix}...${domainTld ? `.${domainTld}` : ""}`;
}

export default function MemberList({
  tripId,
  creatorId,
  currentUserId,
  members,
}: {
  tripId: string;
  creatorId?: string | null;
  currentUserId: string;
  members: Member[];
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [state, formAction, isPending] = useActionState<AddMemberResult, FormData>(
    addMemberAction,
    { success: true }
  );

  const [removeState, removeAction, removePending] = useActionState<
    RemoveMemberResult,
    FormData
  >(removeMemberAction, { success: true });

  useEffect(() => {
    if (state.success) {
      // Clear input on success.
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [state.success]);

  return (
    <MaterialCard>
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">Trip Team</h2>
        <p className="text-sm text-[#C4C7C5]">
          People included in this trip.
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        {members.map((m) => {
          const username = m.user.username?.trim();
          const displayName = username ? `@${username}` : m.user.name?.trim() ? m.user.name : null;
          const secondary = username ? (m.user.name?.trim() ? m.user.name : null) : obfuscateEmail(m.user.email);
          const isCreator = creatorId != null && m.user_id === creatorId;
          const isSelf = m.user_id === currentUserId;
          const canRemoveOther = creatorId != null && currentUserId === creatorId;
          const canShowRemove = (canRemoveOther && !isCreator) || (isSelf && !isCreator);
          const removeLabel = isSelf ? "Leave" : "Remove";

          return (
            <div
              key={m.user_id}
              className="flex items-center justify-between gap-3 rounded-[18px] bg-[#2A2A2A] px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">
                    {displayName ?? m.user.email}
                  </p>
                  {isCreator ? (
                    <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-xs text-[#C4C7C5]">
                      Creator
                    </span>
                  ) : null}
                </div>
                {secondary ? <p className="truncate text-xs text-[#C4C7C5]">{secondary}</p> : null}
              </div>

              {canShowRemove ? (
                <form action={removeAction} className="shrink-0">
                  <input type="hidden" name="tripId" value={tripId} />
                  <input type="hidden" name="memberUserId" value={m.user_id} />
                  <MaterialButton type="submit" variant="text" disabled={removePending}>
                    {removePending ? "Working…" : removeLabel}
                  </MaterialButton>
                </form>
              ) : null}
            </div>
          );
        })}
      </div>

      {!removeState.success ? (
        <p className="mt-3 text-sm text-red-400">
          {removeState.message}
        </p>
      ) : null}

      <form action={formAction} className="mt-4">
        <input type="hidden" name="tripId" value={tripId} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[#E3E3E3]">
            Invite by email
          </span>
          <div className="flex items-end gap-2">
            <MaterialInput
              ref={inputRef}
              name="email"
              type="email"
              required
              placeholder="name@example.com"
            />

            <MaterialButton type="submit" variant="tonal" disabled={isPending}>
              {isPending ? "Inviting…" : "Invite"}
            </MaterialButton>
          </div>
        </label>

        {!state.success ? (
          <p className="mt-2 text-sm text-red-400">{state.message}</p>
        ) : null}
      </form>
    </MaterialCard>
  );
}
