"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Lock, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loginSchema, type LoginInput } from "@/lib/auth/schemas";
import { loginAction } from "./actions";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
      rememberMe: false,
      audience: "internal",
    },
  });

  const audience = useWatch({ control, name: "audience" });
  const rememberMe = useWatch({ control, name: "rememberMe" });

  function onSubmit(values: LoginInput) {
    startTransition(async () => {
      const result = await loginAction(values);
      if (result && !result.ok) {
        toast.error(result.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Tabs
        value={audience}
        onValueChange={(v) =>
          setValue("audience", v as LoginInput["audience"], { shouldDirty: true })
        }
      >
        <TabsList className="grid w-full grid-cols-2 group-data-horizontal/tabs:h-12 rounded-xl bg-slate-100 p-1.5">
          <TabsTrigger
            value="internal"
            className="rounded-lg gap-2 text-sm font-medium text-slate-500 data-active:text-slate-900 data-active:bg-white data-active:shadow-sm data-active:ring-1 data-active:ring-slate-200/80"
          >
            <User className="h-4 w-4" />
            Đăng nhập nội bộ
          </TabsTrigger>
          <TabsTrigger
            value="customer"
            className="rounded-lg gap-2 text-sm font-medium text-slate-500 data-active:text-slate-900 data-active:bg-white data-active:shadow-sm data-active:ring-1 data-active:ring-slate-200/80"
          >
            <BuildingIcon />
            Đăng nhập khách hàng
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        <Label htmlFor="identifier" className="text-slate-700 font-medium">
          Email hoặc số điện thoại
        </Label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="identifier"
            type="text"
            autoComplete="username"
            placeholder="Nhập email hoặc số điện thoại"
            className={cn(
              "h-11 pl-10 bg-slate-50/50",
              errors.identifier && "border-red-500 focus-visible:ring-red-500/20",
            )}
            {...register("identifier")}
          />
        </div>
        {errors.identifier && (
          <p className="text-xs text-red-600">{errors.identifier.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-slate-700 font-medium">
            Mật khẩu
          </Label>
          <a
            href="/forgot-password"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Quên mật khẩu?
          </a>
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Nhập mật khẩu"
            className={cn(
              "h-11 pl-10 pr-10 bg-slate-50/50",
              errors.password && "border-red-500 focus-visible:ring-red-500/20",
            )}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-600">{errors.password.message}</p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600 select-none">
        <Checkbox
          checked={rememberMe}
          onCheckedChange={(c) => setValue("rememberMe", c === true)}
        />
        Ghi nhớ đăng nhập
      </label>

      <Button
        type="submit"
        disabled={isPending}
        className="mt-1 h-11 w-full bg-blue-600 hover:bg-blue-700 text-base font-medium shadow-sm gap-2"
      >
        {isPending ? "Đang đăng nhập..." : "Đăng nhập"}
        {!isPending && <ArrowRight className="h-4 w-4" />}
      </Button>
    </form>
  );
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </svg>
  );
}

