"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Force refresh layout 1 lần khi mount.
 *
 * Dùng khi server component đã làm 1 mutation (vd. markAllNotificationsAsRead)
 * mà cần parent layout (header badge) cập nhật ngay lập tức — vì layout đã
 * render xong trước khi page server component chạy mutation.
 *
 * useRef đảm bảo chỉ refresh 1 lần, tránh loop.
 */
export function RefreshOnMount() {
  const router = useRouter();
  const refreshedRef = useRef(false);

  useEffect(() => {
    if (refreshedRef.current) return;
    refreshedRef.current = true;
    router.refresh();
  }, [router]);

  return null;
}
