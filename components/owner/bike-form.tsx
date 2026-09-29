"use client";

import { useActionState } from "react";

import { CheckboxField, SelectField, TextArea, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { BIKE_TYPES } from "@/lib/catalog";
import { idleState, type ActionState } from "@/lib/definitions";

export type BikeDefaults = {
  name: string;
  type: string;
  engineCc: number;
  pricePerDay: number;
  quantity: number;
  helmetIncluded: boolean;
  description: string;
};

export function BikeForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  defaults?: BikeDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Model"
          name="name"
          placeholder="Honda Click 125"
          defaultValue={defaults?.name}
          error={errors.name}
          required
        />
        <SelectField label="Type" name="type" defaultValue={defaults?.type ?? "scooter"} error={errors.type}>
          {BIKE_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Engine (cc)"
          name="engineCc"
          type="number"
          min={0}
          defaultValue={defaults?.engineCc ?? 125}
          hint="0 for electric"
          error={errors.engineCc}
          required
        />
        <TextField
          label="Price per day (USD)"
          name="pricePerDay"
          type="number"
          min={1}
          step={1}
          defaultValue={defaults?.pricePerDay ?? 8}
          error={errors.pricePerDay}
          required
        />
        <TextField
          label="How many you have"
          name="quantity"
          type="number"
          min={1}
          defaultValue={defaults?.quantity ?? 1}
          hint="Bookings are counted against this"
          error={errors.quantity}
          required
        />
      </div>

      <CheckboxField label="Helmet included" name="helmetIncluded" defaultChecked={defaults?.helmetIncluded ?? true} />

      <TextArea
        label="Description (optional)"
        name="description"
        rows={3}
        defaultValue={defaults?.description}
        placeholder="Year, condition, storage box, phone holder…"
        error={errors.description}
      />

      {state.message ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      ) : null}

      <SubmitButton className="self-start">{submitLabel}</SubmitButton>
    </form>
  );
}
