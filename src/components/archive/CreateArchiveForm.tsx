"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { archiveSchema, type ArchiveInput } from "@/lib/validations/archive";
import { createArchiveAction } from "@/lib/actions/archive-actions";

export function CreateArchiveForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ArchiveInput>({
    resolver: zodResolver(archiveSchema),
    defaultValues: { name: "", description: "" },
  });

  async function onSubmit(values: ArchiveInput) {
    setServerError(null);
    const result = await createArchiveAction({
      name: values.name,
      description: values.description,
    });
    if (!result.ok) {
      setServerError(result.error ?? "Something went wrong.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
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
        placeholder="e.g. The Rivera Family"
        required
        autoFocus
        error={errors.name?.message}
        helperText="This is what your family will see."
        {...register("name")}
      />

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          rows={4}
          placeholder="A short note about this archive (optional)."
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 shadow-sm outline-none transition focus:border-warm-400 focus:ring-2 focus:ring-warm-200"
          {...register("description")}
        />
        {errors.description?.message ? (
          <p className="text-sm text-red-700">{errors.description.message}</p>
        ) : (
          <p className="text-sm text-stone-500">
            You can change this at any time.
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        isLoading={isSubmitting}
        className="w-full"
      >
        Create archive
      </Button>
    </form>
  );
}
