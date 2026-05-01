"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings, UserCog } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  staff: "Nhân viên",
  support: "CSKH",
  accountant: "Kế toán",
  owner: "Owner",
  marketing_manager: "Marketing Manager",
  // Intentionally no "viewer" entry — customer audience renders nothing
  // under the name (avoid the generic "Viewer" label that confused users).
};

export function UserMenu({
  fullName,
  email,
  avatarUrl,
  role,
}: {
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const initials =
    fullName
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(-2)
      .join("")
      .toUpperCase() || "U";

  const onSignOut = () => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2.5 rounded-lg p-1.5 pr-2 transition-colors hover:bg-slate-100",
          isPending && "opacity-60",
        )}
      >
        <Avatar className="h-9 w-9 border border-slate-200">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={fullName} /> : null}
          <AvatarFallback className="bg-blue-100 text-sm font-medium text-blue-700">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="hidden text-left md:block">
          <p className="text-sm font-medium text-slate-900 leading-tight">
            {fullName || "User"}
          </p>
          {ROLE_LABEL[role] && (
            <p className="text-xs text-slate-500 leading-tight">
              {ROLE_LABEL[role]}
            </p>
          )}
        </div>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="text-sm font-medium">{fullName || "User"}</p>
          <p className="text-xs text-slate-500 font-normal truncate">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <UserCog className="mr-2 h-4 w-4" />
          Hồ sơ cá nhân
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          Cài đặt
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={onSignOut}
          disabled={isPending}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
