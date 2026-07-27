"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { archiveSchema, type ArchiveInput } from "@/lib/validations/archive";
import { updateArchiveAction } from "@/lib/actions/archive-actions";

interface EditArchiveFormProps {
  archiveId: string;
  initialName: string;
  initialDescription: string;
}

export function EditArchiveForm({
  archiveId,
  initialName,
  initialDescription,
}: EditArchiveFormProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ArchiveInput>({
    resolver: zodResolver(archiveSchema),
    defaultValues: { name: initialName, description: initialDescription },
  });

  async function onSubmit(values: ArchiveInput) {
    setServerError(null);
    setSuccess(false);
    const result = await updateArchiveAction({
      archiveId,
      name: values.name,
      description: values.description,
    });
    if (!result.ok) {
      setServerError(result.error ?? "Something went wrong.");
      return;
    }
    setSuccess(true);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="space-y-3">
        {success ? (
          <p
            role="status"
            className="rounded-lg bg-forest-50 px-3 py-2 text-sm text-forest-700"
          >
            Archive updated.
          </p>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setEditing(true);
            setSuccess(false);
          }}
        >
          <Pencil className="mr-2 h-4 w-4" aria-hidden />
          Edit archive
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {serverError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-800"
        >
          {serverError}
        </div>
      ) : null}

      <Input
        label="Archive name"
        required
        error={errors.name?.message}
        {...register("name")}
      />

      <div className="space-y-1.5">
        <Label htmlFor="edit-description">Description</Label>
        <textarea
          id="edit-description"
          rows={4}
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 shadow-sm outline-none transition focus:border-warm-400 focus:ring-2 focus:ring-warm-200"
          {...register("description")}
        />
        {errors.description?.message ? (
          <p className="text-sm text-red-700">{errors.description.message}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" isLoading={isSubmitting}>
          Save changes
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            reset({ name: initialName, description: initialDescription });
            setServerError(null);
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
