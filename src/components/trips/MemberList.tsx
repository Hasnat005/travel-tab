"use client";

import { useActionState, useTransition } from "react";
import { Crown, MoreVertical } from "lucide-react";
import { toast } from "sonner";

import { createTripInvite, removeMemberAction } from "@/app/_actions/trips";
import MaterialCard from "@/components/ui/MaterialCard";
import MaterialButton from "@/components/ui/MaterialButton";

type Member = {
  user_id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    username?: string | null;
    avatar_url?: string | null;
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

function displayNameForUser(user: Member["user"]) {
  const username = user.username?.trim();
  if (username) return `@${username}`;
  const name = user.name?.trim();
  if (name) return name;
  return user.email;
}

function secondaryLabelForUser(user: Member["user"]) {
  const username = user.username?.trim();
  if (username) return user.name?.trim() ? user.name : null;
  return obfuscateEmail(user.email);
}

function avatarInitialForUser(user: Member["user"]) {
  const username = user.username?.trim();
  const source = username || user.name?.trim() || user.email;
  const first = source.trim().charAt(0);
  return first ? first.toUpperCase() : "?";
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
  const [isInvitePending, startInviteTransition] = useTransition();

  const [removeState, removeAction, removePending] = useActionState<
    RemoveMemberResult,
    FormData
  >(removeMemberAction, { success: true });

  async function handleShareInvite() {
    let url: string;
    try {
      const res = await createTripInvite(tripId);
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      url = res.url;
    } catch {
      toast.error("Failed to create invite link.");
      return;
    }

    const shareData: ShareData = {
      title: "Join my Trip!",
      text: "Click here to join this trip team:",
      url,
    };

    if (navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch {
        // Ignore share cancellation/errors.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareData.url ?? "");
      toast.success("Link copied!");
    } catch {
      toast.error("Failed to copy link.");
    }
  }

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
          const displayName = displayNameForUser(m.user);
          const secondary = secondaryLabelForUser(m.user);
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
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="shrink-0">
                  {m.user.avatar_url ? (
                    <img
                      src={m.user.avatar_url}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#333537] text-sm font-semibold text-[#A8C7FA]"
                      aria-hidden="true"
                    >
                      {avatarInitialForUser(m.user)}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-[#E3E3E3]">{displayName}</p>
                    {isCreator ? (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/15 px-2.5 py-0.5 text-xs font-medium text-yellow-300">
                        <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                        Creator
                      </span>
                    ) : null}
                  </div>
                  {secondary ? (
                    <p className="truncate text-xs text-[#C4C7C5]">{secondary}</p>
                  ) : null}
                </div>
              </div>

              {canShowRemove ? (
                <details className="relative shrink-0">
                  <summary
                    className="list-none inline-flex h-11 w-11 items-center justify-center rounded-full text-[#C4C7C5] hover:bg-white/5"
                    aria-label={removeLabel}
                  >
                    <MoreVertical className="h-5 w-5" aria-hidden="true" />
                  </summary>
                  <div className="absolute right-0 z-10 mt-2 w-40 rounded-[14px] border border-white/10 bg-[#2A2A2A] p-1 shadow-lg">
                    <form action={removeAction}>
                      <input type="hidden" name="tripId" value={tripId} />
                      <input type="hidden" name="memberUserId" value={m.user_id} />
                      <button
                        type="submit"
                        disabled={removePending}
                        className="flex w-full items-center rounded-[12px] px-3 py-2 text-left text-sm text-[#E3E3E3] hover:bg-white/5 disabled:opacity-60"
                      >
                        {removePending ? "Working…" : removeLabel}
                      </button>
                    </form>
                  </div>
                </details>
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

      <button
        type="button"
        onClick={() => startInviteTransition(handleShareInvite)}
        disabled={isInvitePending}
        className={
          [
            "mt-5 h-11 w-full rounded-full",
            "bg-[#2A2A2A] text-[#E3E3E3]",
            "text-sm font-medium",
            "hover:bg-[#333537]",
            "transition-colors",
            "disabled:opacity-60 disabled:pointer-events-none",
          ].join(" ")
        }
      >
        {isInvitePending ? "Working…" : "Invite Members via Link"}
      </button>
    </MaterialCard>
  );
}
