"use client";

import { useActionState } from "react";

import { TextArea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState, type ActionState } from "@/lib/definitions";

export function ReviewForm({
  action,
  existing,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  existing: { rating: number; comment: string } | null;
}) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl border border-black/10 p-4 dark:border-white/10">
      <h3 className="font-semibold">{existing ? "Update your review" : "Rode with this shop? Leave a review"}</h3>

      <fieldset>
        <legend className="text-sm font-medium">Rating</legend>
        {/* Radios in reverse order so CSS can highlight "this star and all before it". */}
        <div className="mt-1 flex flex-row-reverse justify-end gap-1">
          {[5, 4, 3, 2, 1].map((value) => (
            <label key={value} className="peer cursor-pointer text-2xl text-black/20 has-[:checked]:text-amber-500 peer-has-[:checked]:text-amber-500 hover:text-amber-400 dark:text-white/20">
              <input
                type="radio"
                name="rating"
                value={value}
                defaultChecked={existing?.rating === value}
                className="sr-only"
              />
              <span aria-hidden>★</span>
              <span className="sr-only">
                {value} {value === 1 ? "star" : "stars"}
              </span>
            </label>
          ))}
        </div>
        {state.errors?.rating ? (
          <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
            {state.errors.rating[0]}
          </p>
        ) : null}
      </fieldset>

      <TextArea
        label="Your experience"
        name="comment"
        rows={3}
        defaultValue={existing?.comment}
        placeholder="Bike condition, deposit handling, friendliness…"
        error={state.errors?.comment}
      />

      {state.message ? (
        <p
          role="status"
          className={`text-sm ${state.status === "success" ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}`}
        >
          {state.message}
        </p>
      ) : null}

      <SubmitButton pendingLabel="Saving…" className="self-start">
        {existing ? "Update review" : "Post review"}
      </SubmitButton>
    </form>
  );
}
