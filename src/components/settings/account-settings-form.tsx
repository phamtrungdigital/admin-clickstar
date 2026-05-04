"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  changeMyPasswordAction,
  updateMyProfileAction,
} from "@/app/(dashboard)/settings/actions";
import {
  changeMyPasswordSchema,
  updateMyProfileSchema,
  type ChangeMyPasswordInput,
  type UpdateMyProfileInput,
} from "@/lib/validation/account-settings";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export function AccountSettingsForm({
  defaults,
  email,
}: {
  defaults: UpdateMyProfileInput;
  email: string;
}) {
  return (
    <Tabs defaultValue="profile" className="w-full">
      <TabsList>
        <TabsTrigger value="profile">Hồ sơ</TabsTrigger>
        <TabsTrigger value="password">Mật khẩu</TabsTrigger>
      </TabsList>
      <TabsContent value="profile" className="mt-4">
        <ProfileTab defaults={defaults} email={email} />
      </TabsContent>
      <TabsContent value="password" className="mt-4">
        <PasswordTab />
      </TabsContent>
    </Tabs>
  );
}

function ProfileTab({
  defaults,
  email,
}: {
  defaults: UpdateMyProfileInput;
  email: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UpdateMyProfileInput>({
    resolver: zodResolver(updateMyProfileSchema),
    defaultValues: defaults,
  });

  const avatarUrl = watch("avatar_url");
  const fullName = watch("full_name");
  const initials =
    (fullName ?? "?")
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(-2)
      .join("")
      .toUpperCase() || "U";

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(`Ảnh quá ${MAX_AVATAR_BYTES / 1024 / 1024}MB`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Chỉ hỗ trợ ảnh");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vui lòng đăng nhập lại");
        return;
      }
      const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
      const path = `${user.id}/avatar.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, {
          contentType: file.type,
          upsert: true,
          cacheControl: "60",
        });
      if (error) {
        toast.error(`Upload lỗi: ${error.message}`);
        return;
      }
      // avatars bucket is public — get public URL with cache-buster
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = pub.publicUrl + `?t=${Date.now()}`;
      setValue("avatar_url", publicUrl, { shouldDirty: true });
      toast.success("Đã cập nhật ảnh");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = (values: UpdateMyProfileInput) => {
    startTransition(async () => {
      const result = await updateMyProfileAction(values);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã cập nhật hồ sơ");
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 rounded-xl border border-slate-200 bg-white p-6"
    >
      <div className="flex items-start gap-4">
        <Avatar className="h-20 w-20 border border-slate-200">
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} alt={fullName} />
          ) : null}
          <AvatarFallback className="bg-blue-100 text-lg font-medium text-blue-700">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <Label className="text-sm font-medium text-slate-700">Ảnh đại diện</Label>
          <p className="mt-0.5 text-xs text-slate-500">
            JPG/PNG/WEBP, tối đa 2 MB. Khuyến nghị vuông &gt;= 200×200.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isPending}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang upload...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" /> Đổi ảnh
                </>
              )}
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setValue("avatar_url", "", { shouldDirty: true })
                }
                disabled={isPending}
              >
                Xoá ảnh
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">Họ tên *</Label>
          <Input
            {...register("full_name")}
            placeholder="Nguyễn Văn A"
            className={cn(errors.full_name && "border-red-500")}
          />
          {errors.full_name && (
            <p className="text-xs text-red-600">{errors.full_name.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">Email</Label>
          <Input value={email} disabled />
          <p className="text-xs text-slate-500">
            Email là định danh đăng nhập, liên hệ admin nếu cần đổi.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">Số điện thoại</Label>
          <Input
            {...register("phone")}
            placeholder="0987 654 321"
            className={cn(errors.phone && "border-red-500")}
          />
        </div>
      </div>

      <div className="flex items-center justify-end border-t border-slate-200 pt-4">
        <Button
          type="submit"
          disabled={isPending || uploading}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Lưu thay đổi
        </Button>
      </div>
    </form>
  );
}

function PasswordTab() {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangeMyPasswordInput>({
    resolver: zodResolver(changeMyPasswordSchema),
    defaultValues: { new_password: "", confirm_password: "" },
  });

  const onSubmit = (values: ChangeMyPasswordInput) => {
    startTransition(async () => {
      const result = await changeMyPasswordAction(values);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      reset();
      toast.success("Đã đổi mật khẩu. Lần đăng nhập sau dùng mật khẩu mới.");
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 rounded-xl border border-slate-200 bg-white p-6"
    >
      <p className="text-sm text-slate-600">
        Đổi mật khẩu cho phiên đăng nhập hiện tại. Tối thiểu 6 ký tự.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">
            Mật khẩu mới *
          </Label>
          <Input
            type="password"
            autoComplete="new-password"
            {...register("new_password")}
            className={cn(errors.new_password && "border-red-500")}
          />
          {errors.new_password && (
            <p className="text-xs text-red-600">{errors.new_password.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">
            Xác nhận mật khẩu *
          </Label>
          <Input
            type="password"
            autoComplete="new-password"
            {...register("confirm_password")}
            className={cn(errors.confirm_password && "border-red-500")}
          />
          {errors.confirm_password && (
            <p className="text-xs text-red-600">
              {errors.confirm_password.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end border-t border-slate-200 pt-4">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Đổi mật khẩu
        </Button>
      </div>
    </form>
  );
}
