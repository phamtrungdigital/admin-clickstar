"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to server console (visible in Vercel function logs) for debug
    console.error("[dashboard/error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-200">
        <AlertTriangle className="h-7 w-7" />
      </span>
      <h1 className="text-xl font-semibold text-slate-900">
        Có lỗi xảy ra khi tải trang
      </h1>
      <p className="text-sm text-slate-600">
        Vui lòng thử lại. Nếu lỗi lặp lại, gửi mã lỗi bên dưới cho team kỹ thuật
        để check.
      </p>
      {(error.message || error.digest) && (
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-slate-50 p-3 text-left">
          {error.digest && (
            <p className="text-xs text-slate-500">
              Mã lỗi:{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-700">
                {error.digest}
              </code>
            </p>
          )}
          {error.message && (
            <p className="mt-1 break-words text-xs text-slate-700">
              {error.message}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => reset()}
          className="gap-1.5"
        >
          <RefreshCw className="h-4 w-4" />
          Thử lại
        </Button>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Về Tổng quan
        </Link>
      </div>
    </div>
  );
}
