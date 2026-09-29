"use client";

/**
 * Choosing and uploading bike photos.
 *
 * Phone photos are often 4–8 MB. Before sending, this shrinks each one in
 * the browser to at most 1600px (the size the server keeps anyway), so an
 * owner on mobile data uploads a few hundred KB instead of megabytes. The
 * server does not trust that step: `lib/images.ts` decodes, checks and
 * re-encodes every file it receives.
 *
 * Without JavaScript the <form> still posts the original files straight to
 * the Server Action — slower, but it works.
 */

import { startTransition, useActionState, useRef, useState } from "react";

import { idleState, type ActionState } from "@/lib/definitions";

const MAX_DIMENSION = 1600;
const ACCEPT = "image/jpeg,image/png,image/webp";

/** Scales an image down in a canvas. Falls back to the original on any failure. */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    // JPEG rather than WebP: Safari cannot encode WebP from a canvas.
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    // A format the browser cannot decode — let the server give the reason.
    return file;
  }
}

type Preview = { file: File; url: string };

export function PhotoUploader({
  action,
  remaining,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  /** How many more photos this bike may have. */
  remaining: number;
}) {
  // `pending` comes from useActionState rather than useFormStatus: the
  // upload is started by hand in onSubmit, which useFormStatus cannot see.
  const [state, formAction, pending] = useActionState(action, idleState);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [preparing, setPreparing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function clear() {
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    setPreviews([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onChoose(files: FileList | null) {
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    setPreviews(
      Array.from(files ?? []).map((file) => ({ file, url: URL.createObjectURL(file) })),
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Take over from the native submit so the files can be shrunk first.
    event.preventDefault();
    if (previews.length === 0) return;

    setPreparing(true);
    const formData = new FormData();
    for (const { file } of previews) {
      formData.append("photos", await shrink(file));
    }
    setPreparing(false);
    clear();

    startTransition(() => formAction(formData));
  }

  const tooMany = previews.length > remaining;

  if (remaining <= 0) {
    return (
      <p className="rounded-xl bg-black/[0.03] p-3 text-sm text-black/60 dark:bg-white/[0.04] dark:text-white/60">
        This bike has the maximum number of photos. Delete one to add another.
      </p>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-dashed border-black/20 p-4 dark:border-white/20"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Add photos
        <input
          ref={inputRef}
          type="file"
          name="photos"
          accept={ACCEPT}
          multiple
          onChange={(event) => onChoose(event.target.files)}
          aria-describedby="photos-hint"
          className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-accent-foreground"
        />
      </label>
      <p id="photos-hint" className="text-xs text-black/50 dark:text-white/50">
        JPG, PNG or WebP, up to 8 MB each. You can add {remaining} more. Show the whole bike in good light — the
        first photo is the one tourists see in search.
      </p>

      {previews.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {previews.map((preview) => (
            <li key={preview.url} className="aspect-square overflow-hidden rounded-lg bg-black/5 dark:bg-white/5">
              {/* A local blob: URL, so next/image has nothing to optimize. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.url} alt={preview.file.name} className="size-full object-cover" />
            </li>
          ))}
        </ul>
      ) : null}

      {tooMany ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          You chose {previews.length} photos but can add only {remaining}.
        </p>
      ) : null}

      {state.errors?.photos ? (
        <ul role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.errors.photos.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      {state.status === "success" && state.message ? (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
          {state.message}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        {/* Not disabled while nothing is chosen: without JavaScript the
            previews never appear, and the button must still submit. */}
        <button
          type="submit"
          disabled={preparing || pending || tooMany}
          className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground transition-opacity disabled:opacity-50"
        >
          {preparing
            ? "Preparing…"
            : pending
              ? "Uploading…"
              : `Upload ${previews.length || ""} ${previews.length === 1 ? "photo" : "photos"}`}
        </button>
        {previews.length > 0 ? (
          <button type="button" onClick={clear} className="text-sm text-black/60 hover:underline dark:text-white/60">
            Clear
          </button>
        ) : null}
      </div>
    </form>
  );
}
