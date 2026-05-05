"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type Props = {
  initialCount: number;
  currentUserId: string;
};

/**
 * Chuông noti có Realtime subscription. Khi có row mới insert vào
 * notifications cho currentUserId, badge tự +1 (không cần F5). Cũng
 * router.refresh() để layout server reload count chính xác (đề phòng
 * miss event nếu offline lúc insert xảy ra).
 *
 * Realtime tôn trọng RLS — server chỉ broadcast cho user_id match nhờ
 * policy notifications_select_self.
 */
export function NotificationBell({ initialCount, currentUserId }: Props) {
  const [count, setCount] = useState(initialCount);
  const lastInitialRef = useRef(initialCount);
  const router = useRouter();

  // Sync với initialCount khi prop thay đổi (sau router.refresh hoặc
  // navigation). Compare ref để tránh setState mỗi render — chỉ chạy
  // khi prop thực sự đổi.
  useEffect(() => {
    if (lastInitialRef.current !== initialCount) {
      lastInitialRef.current = initialCount;
      setCount(initialCount);
    }
  }, [initialCount]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`noti:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        () => {
          setCount((c) => c + 1);
          // Refresh server tree để các noti page khác cũng update
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, router]);

  return (
    <Link
      href="/notifications"
      aria-label="Thông báo"
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500",
        "hover:bg-slate-100 hover:text-slate-700",
      )}
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute right-1.5 top-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
