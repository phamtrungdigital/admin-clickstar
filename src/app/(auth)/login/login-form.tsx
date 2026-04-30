"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
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
    watch,
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

  const audience = watch("audience");

  function onSubmit(values: LoginInput) {
    startTransition(async () => {
      const result = await loginAction(values);
      if (result && !result.ok) {
        toast.error(result.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
      <Tabs
        value={audience}
        onValueChange={(v) =>
          setValue("audience", v as LoginInput["audience"], { shouldDirty: true })
        }
      >
        <TabsList className="grid w-full grid-cols-2 bg-slate-100/80 p-1 h-10">
          <TabsTrigger
            value="internal"
            className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm gap-2"
          >
            <User className="h-4 w-4" />
            Đăng nhập nội bộ
          </TabsTrigger>
          <TabsTrigger
            value="customer"
            className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm gap-2"
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
              "h-12 pl-10 pr-10 bg-slate-50/50",
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
          checked={watch("rememberMe")}
          onCheckedChange={(c) => setValue("rememberMe", c === true)}
        />
        Ghi nhớ đăng nhập
      </label>

      <Button
        type="submit"
        disabled={isPending}
        className="h-11 w-full bg-blue-600 hover:bg-blue-700 text-base font-medium shadow-sm gap-2"
      >
        {isPending ? "Đang đăng nhập..." : "Đăng nhập"}
        {!isPending && <ArrowRight className="h-4 w-4" />}
      </Button>

      <div className="relative my-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-slate-500">Hoặc đăng nhập với</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-10 gap-2 border-slate-200"
          disabled
        >
          <GoogleIcon />
          Google
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 gap-2 border-slate-200"
          disabled
        >
          <MicrosoftIcon />
          Microsoft
        </Button>
      </div>
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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3-3C17.2 1.7 14.7.5 12 .5 7.4.5 3.4 3.1 1.4 7l3.5 2.7C5.9 6.9 8.7 5 12 5z" />
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.4-1.2 2.6-2.4 3.4l3.5 2.7c2-1.9 3.9-4.7 3.9-8.3z" />
      <path fill="#FBBC04" d="M4.9 14.3c-.3-.7-.4-1.5-.4-2.3 0-.8.1-1.6.4-2.3L1.4 7C.5 8.5 0 10.2 0 12c0 1.8.5 3.5 1.4 5l3.5-2.7z" />
      <path fill="#34A853" d="M12 23.5c3.2 0 5.9-1.1 7.9-2.9l-3.5-2.7c-1 .7-2.3 1.1-4.4 1.1-3.3 0-6.1-1.9-7.1-4.7L1.4 17c2 3.9 6 6.5 10.6 6.5z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#F25022" d="M0 0h11.4v11.4H0z" />
      <path fill="#7FBA00" d="M12.6 0H24v11.4H12.6z" />
      <path fill="#00A4EF" d="M0 12.6h11.4V24H0z" />
      <path fill="#FFB900" d="M12.6 12.6H24V24H12.6z" />
    </svg>
  );
}
