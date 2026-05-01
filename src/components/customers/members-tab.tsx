"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  addCompanyMemberByEmailAction,
  removeCompanyMemberAction,
  updateCompanyMemberRoleAction,
} from "@/app/(dashboard)/customers/actions";
import type { CompanyMember } from "@/lib/queries/customers";

const ROLE_OPTIONS: Array<{
  value: CompanyMember["role"];
  label: string;
}> = [
  { value: "owner", label: "Chủ sở hữu" },
  { value: "marketing_manager", label: "Quản lý marketing" },
  { value: "viewer", label: "Xem" },
];

const ROLE_LABEL: Record<CompanyMember["role"], string> = {
  owner: "Chủ sở hữu",
  marketing_manager: "Quản lý marketing",
  viewer: "Xem",
};

export function MembersTab({
  companyId,
  members,
}: {
  companyId: string;
  members: CompanyMember[];
}) {
  const router = useRouter();
  const [isAdding, startAdd] = useTransition();
  const [isMutating, startMutate] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CompanyMember["role"]>("viewer");

  const onAdd = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Nhập email tài khoản customer cần gắn vào doanh nghiệp.");
      return;
    }
    startAdd(async () => {
      const result = await addCompanyMemberByEmailAction(companyId, trimmed, role);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã gắn tài khoản vào doanh nghiệp");
      setEmail("");
      setRole("viewer");
      router.refresh();
    });
  };

  const onChangeRole = (userId: string, next: CompanyMember["role"]) => {
    startMutate(async () => {
      const result = await updateCompanyMemberRoleAction(companyId, userId, next);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã cập nhật vai trò");
      router.refresh();
    });
  };

  const onRemove = (member: CompanyMember) => {
    if (
      !window.confirm(
        `Gỡ ${member.profile.full_name || member.profile.email || "tài khoản"} khỏi doanh nghiệp này?`,
      )
    ) {
      return;
    }
    startMutate(async () => {
      const result = await removeCompanyMemberAction(companyId, member.user_id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã gỡ khỏi doanh nghiệp");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">
          Gắn tài khoản customer vào doanh nghiệp
        </h3>
        <p className="mb-4 text-xs text-slate-500">
          Tài khoản customer phải đã tồn tại. Sau khi gắn, người dùng sẽ thấy
          được hợp đồng/dịch vụ/ticket của doanh nghiệp này.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAdd();
              }}
              placeholder="email@example.com"
              disabled={isAdding}
            />
          </div>
          <div className="sm:w-44">
            <Select
              value={role}
              onValueChange={(v) => setRole(v as CompanyMember["role"])}
              disabled={isAdding}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string | null) =>
                    ROLE_OPTIONS.find((o) => o.value === value)?.label ?? "—"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={onAdd} disabled={isAdding}>
            <UserPlus className="mr-2 h-4 w-4" />
            {isAdding ? "Đang gắn..." : "Gắn vào"}
          </Button>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <UserPlus className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-base font-semibold text-slate-900">
            Chưa có tài khoản nào
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Nhập email tài khoản customer ở trên để gắn vào doanh nghiệp này.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Người dùng</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Gắn lúc</TableHead>
                <TableHead className="w-12 text-right">{""}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell className="font-medium text-slate-900">
                    {m.profile.full_name || (
                      <span className="text-slate-400">(chưa đặt tên)</span>
                    )}
                    {!m.profile.is_active && (
                      <span className="ml-2 inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        Tạm khoá
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {m.profile.email ?? <span className="text-slate-400">—</span>}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={m.role}
                      onValueChange={(v) =>
                        onChangeRole(m.user_id, v as CompanyMember["role"])
                      }
                      disabled={isMutating}
                    >
                      <SelectTrigger className="h-8 w-40 text-xs">
                        <SelectValue>
                          {(value: string | null) =>
                            ROLE_LABEL[(value ?? "viewer") as CompanyMember["role"]] ?? "—"
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {format(new Date(m.created_at), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(m)}
                      disabled={isMutating}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
