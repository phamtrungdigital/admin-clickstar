"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AUDIENCE_OPTIONS,
  INTERNAL_ROLE_OPTIONS,
  createUserSchema,
  type CreateUserInput,
} from "@/lib/validation/users";
import {
  createUserAction,
  updateUserAction,
} from "@/app/(dashboard)/admin/users/actions";
import { cn } from "@/lib/utils";
import { useState } from "react";

export type UserFormProps = {
  mode: "create" | "edit";
  userId?: string;
  defaultValues?: Partial<CreateUserInput>;
};

export function UserForm({ mode, userId, defaultValues }: UserFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: defaultValues?.email ?? "",
      full_name: defaultValues?.full_name ?? "",
      phone: defaultValues?.phone ?? "",
      audience: defaultValues?.audience ?? "internal",
      internal_role: defaultValues?.internal_role ?? "staff",
      is_active: defaultValues?.is_active ?? true,
      password: defaultValues?.password ?? "",
    },
  });

  const audience = useWatch({ control, name: "audience" });
  const isActive = useWatch({ control, name: "is_active" });

  const onSubmit = (values: CreateUserInput) => {
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createUserAction(values)
          : await updateUserAction(userId!, {
              full_name: values.full_name,
              phone: values.phone,
              audience: values.audience,
              internal_role:
                values.audience === "internal" ? values.internal_role : null,
              is_active: values.is_active,
            });

      if (!result.ok) {
        toast.error(result.message);
        if (result.fieldErrors) {
          for (const [key, msg] of Object.entries(result.fieldErrors)) {
            setError(key as keyof CreateUserInput, { message: msg });
          }
        }
        return;
      }

      toast.success(mode === "create" ? "Đã tạo tài khoản" : "Đã cập nhật");
      const redirectId =
        mode === "create" && "data" in result && result.data
          ? result.data.id
          : userId;
      if (redirectId) {
        router.push(`/admin/users/${redirectId}`);
        router.refresh();
      } else {
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FormSection
        title="Thông tin tài khoản"
        description="Email là định danh đăng nhập — không đổi được sau khi tạo."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Email *" error={errors.email?.message}>
            <Input
              type="email"
              {...register("email")}
              placeholder="user@clickstar.vn"
              autoComplete="email"
              disabled={mode === "edit"}
            />
          </Field>
          <Field label="Họ và tên *" error={errors.full_name?.message}>
            <Input
              {...register("full_name")}
              placeholder="VD: Nguyễn Văn A"
              autoComplete="name"
            />
          </Field>
          <Field label="Số điện thoại" error={errors.phone?.message}>
            <Input {...register("phone")} placeholder="0987 654 321" />
          </Field>
          {mode === "create" && (
            <Field label="Mật khẩu khởi tạo *" error={errors.password?.message}>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  placeholder="Tối thiểu 6 ký tự"
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                User dùng mật khẩu này lần đầu rồi tự đổi sau.
              </p>
            </Field>
          )}
        </div>
      </FormSection>

      <FormSection
        title="Phân quyền"
        description="Đối tượng quyết định scope dữ liệu, vai trò quyết định hành động."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Đối tượng *" error={errors.audience?.message}>
            <Controller
              control={control}
              name="audience"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn đối tượng">
                      {(value: string | null) =>
                        AUDIENCE_OPTIONS.find((o) => o.value === value)?.label ??
                        "—"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIENCE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          {audience === "internal" && (
            <Field label="Vai trò *" error={errors.internal_role?.message}>
              <Controller
                control={control}
                name="internal_role"
                render={({ field }) => (
                  <Select
                    value={field.value ?? undefined}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn vai trò">
                        {(value: string | null) =>
                          INTERNAL_ROLE_OPTIONS.find((o) => o.value === value)
                            ?.label ?? "—"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {INTERNAL_ROLE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          <div>
                            <p className="font-medium">{o.label}</p>
                            <p className="text-[11px] text-slate-500">
                              {o.description}
                            </p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          )}
        </div>
      </FormSection>

      <FormSection title="Trạng thái">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <Checkbox
            checked={isActive}
            onCheckedChange={(c) => setValue("is_active", c === true)}
          />
          <div>
            <p className="text-sm font-medium text-slate-900">
              Tài khoản đang hoạt động
            </p>
            <p className="text-xs text-slate-500">
              Bỏ tick để vô hiệu hoá — user không đăng nhập được nhưng dữ liệu
              vẫn giữ.
            </p>
          </div>
        </label>
      </FormSection>

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Huỷ
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "Tạo tài khoản" : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
