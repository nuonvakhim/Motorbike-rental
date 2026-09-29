"use client";

/**
 * One form for creating and editing a shop. The action is passed in already
 * bound (to the shop id, when editing), so this component does not need to
 * know which of the two it is doing beyond the button label.
 */

import { useActionState } from "react";

import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { DEPOSIT_POLICIES } from "@/lib/catalog";
import { idleState, type ActionState } from "@/lib/definitions";

export type ShopDefaults = {
  name: string;
  cityId: string;
  description: string;
  address: string;
  phone: string;
  whatsapp: string;
  openHours: string;
  depositPolicy: string;
  depositAmount: number | null;
};

export function ShopForm({
  action,
  cities,
  defaults,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  cities: { id: string; name: string }[];
  defaults?: ShopDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Shop name" name="name" defaultValue={defaults?.name} error={errors.name} required />
        <SelectField label="City" name="cityId" defaultValue={defaults?.cityId ?? ""} error={errors.cityId} required>
          <option value="" disabled>
            Choose a city
          </option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </SelectField>
      </div>

      <TextArea
        label="Description"
        name="description"
        rows={4}
        defaultValue={defaults?.description}
        hint="What makes your shop good to rent from? Delivery, languages spoken, bike condition…"
        error={errors.description}
        required
      />

      <TextField label="Address" name="address" defaultValue={defaults?.address} error={errors.address} required />

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Phone" name="phone" type="tel" defaultValue={defaults?.phone} error={errors.phone} required />
        <TextField
          label="WhatsApp (optional)"
          name="whatsapp"
          type="tel"
          defaultValue={defaults?.whatsapp}
          error={errors.whatsapp}
        />
        <TextField
          label="Opening hours"
          name="openHours"
          placeholder="7:00 – 20:00 daily"
          defaultValue={defaults?.openHours}
          error={errors.openHours}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Deposit policy"
          name="depositPolicy"
          defaultValue={defaults?.depositPolicy ?? "cash"}
          hint="Tourists can filter for shops that do not keep passports."
          error={errors.depositPolicy}
        >
          {DEPOSIT_POLICIES.map((policy) => (
            <option key={policy.value} value={policy.value}>
              {policy.label}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Cash deposit (USD)"
          name="depositAmount"
          type="number"
          min={0}
          step={1}
          defaultValue={defaults?.depositAmount ?? ""}
          hint="Leave blank if you do not take cash."
          error={errors.depositAmount}
        />
      </div>

      {state.message ? (
        <p
          role="status"
          className={`text-sm ${state.status === "success" ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}`}
        >
          {state.message}
        </p>
      ) : null}

      <SubmitButton className="self-start">{submitLabel}</SubmitButton>
    </form>
  );
}
