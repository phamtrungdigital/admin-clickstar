export type MilestoneStatus = "completed" | "in_progress" | "pending";

export type MockMilestone = {
  id: string;
  code: string;
  title: string;
  status: MilestoneStatus;
  starts_at: string;
  ends_at: string;
  progress_percent: number;
};

export type DeliverableStatus =
  | "pending_approval"
  | "approved"
  | "rejected";

export type MockDeliverable = {
  id: string;
  title: string;
  filename: string;
  delivered_at: string;
  delivered_by: string;
  status: DeliverableStatus;
  milestone_code: string;
};

export type MockTicket = {
  id: string;
  code: string;
  title: string;
  status: "new" | "in_progress" | "awaiting_customer" | "resolved";
  created_at: string;
};

export type MockReport = {
  id: string;
  period_label: string;
  published_at: string;
  filename: string;
};

export type MockPendingAction = {
  id: string;
  type: "approve_deliverable" | "provide_info" | "review_report";
  label: string;
  description: string;
  href: string;
  due_at?: string;
};

export type MockProject = {
  id: string;
  name: string;
  service_label: string;
  status: "in_progress" | "paused" | "completed";
  starts_at: string;
  ends_at: string;
  pm_name: string;
  contract_code: string;
  progress_percent: number;
  last_snapshot_at: string;
  milestones: MockMilestone[];
  deliverables: MockDeliverable[];
  tickets: MockTicket[];
  reports: MockReport[];
  pending_actions: MockPendingAction[];
};

const PROJECT_SEO_ABC: MockProject = {
  id: "demo-seo-abc",
  name: "SEO website abc.com",
  service_label: "SEO 6 tháng",
  status: "in_progress",
  starts_at: "2026-04-01",
  ends_at: "2026-09-30",
  pm_name: "Nguyễn Văn A",
  contract_code: "HD-2026-001",
  progress_percent: 65,
  last_snapshot_at: "2026-04-28T09:00:00Z",
  milestones: [
    {
      id: "m1",
      code: "M1",
      title: "Audit website",
      status: "completed",
      starts_at: "2026-04-01",
      ends_at: "2026-04-15",
      progress_percent: 100,
    },
    {
      id: "m2",
      code: "M2",
      title: "Keyword Research",
      status: "completed",
      starts_at: "2026-04-16",
      ends_at: "2026-04-30",
      progress_percent: 100,
    },
    {
      id: "m3",
      code: "M3",
      title: "Onpage SEO",
      status: "in_progress",
      starts_at: "2026-05-01",
      ends_at: "2026-05-25",
      progress_percent: 75,
    },
    {
      id: "m4",
      code: "M4",
      title: "Content SEO",
      status: "pending",
      starts_at: "2026-05-26",
      ends_at: "2026-06-15",
      progress_percent: 0,
    },
    {
      id: "m5",
      code: "M5",
      title: "Offpage SEO",
      status: "pending",
      starts_at: "2026-06-16",
      ends_at: "2026-07-14",
      progress_percent: 0,
    },
    {
      id: "m6",
      code: "M6",
      title: "Tracking & Tối ưu",
      status: "pending",
      starts_at: "2026-07-15",
      ends_at: "2026-09-30",
      progress_percent: 0,
    },
  ],
  deliverables: [
    {
      id: "d1",
      title: "Báo cáo Audit Website",
      filename: "audit_report_v1.pdf",
      delivered_at: "2026-04-15",
      delivered_by: "Phạm Quang Trung",
      status: "approved",
      milestone_code: "M1",
    },
    {
      id: "d2",
      title: "Danh sách từ khoá target",
      filename: "keywords_v2.xlsx",
      delivered_at: "2026-04-30",
      delivered_by: "Phạm Văn C",
      status: "approved",
      milestone_code: "M2",
    },
    {
      id: "d3",
      title: "Đề xuất Title & Meta cho 50 trang",
      filename: "title_meta_proposal.xlsx",
      delivered_at: "2026-04-28",
      delivered_by: "Lê Thị D",
      status: "pending_approval",
      milestone_code: "M3",
    },
  ],
  tickets: [
    {
      id: "t1",
      code: "TK-0024",
      title: "Yêu cầu thay đổi keyword chính cho trang sản phẩm",
      status: "in_progress",
      created_at: "2026-04-25",
    },
    {
      id: "t2",
      code: "TK-0019",
      title: "Báo lỗi trang chủ load chậm",
      status: "resolved",
      created_at: "2026-04-12",
    },
    {
      id: "t3",
      code: "TK-0015",
      title: "Cấp quyền truy cập Google Search Console",
      status: "resolved",
      created_at: "2026-04-05",
    },
  ],
  reports: [
    {
      id: "r1",
      period_label: "Tháng 4/2026",
      published_at: "2026-05-01",
      filename: "bao_cao_thang_04_2026.pdf",
    },
    {
      id: "r2",
      period_label: "Tháng 3/2026",
      published_at: "2026-04-01",
      filename: "bao_cao_thang_03_2026.pdf",
    },
  ],
  pending_actions: [
    {
      id: "pa1",
      type: "approve_deliverable",
      label: "Duyệt đề xuất Title & Meta",
      description:
        "Đội Onpage đã chuẩn bị Title + Meta cho 50 trang sản phẩm. Cần anh/chị xem và duyệt trước 02/05/2026 để team triển khai đúng tiến độ.",
      href: "#deliverable-d3",
      due_at: "2026-05-02",
    },
    {
      id: "pa2",
      type: "provide_info",
      label: "Cung cấp thông tin truy cập Google Analytics",
      description:
        "Để gắn tracking cho milestone Tracking & Tối ưu, team cần quyền view-only Google Analytics 4 của abc.com.",
      href: "/tickets/new?subject=Cung+cap+GA4",
    },
  ],
};

const PROJECT_WEB_XYZ: MockProject = {
  id: "demo-web-xyz",
  name: "Thiết kế website xyz.vn",
  service_label: "Website doanh nghiệp",
  status: "in_progress",
  starts_at: "2026-04-15",
  ends_at: "2026-06-15",
  pm_name: "Trần Thị B",
  contract_code: "HD-2026-002",
  progress_percent: 40,
  last_snapshot_at: "2026-04-27T14:30:00Z",
  milestones: [
    {
      id: "m1",
      code: "M1",
      title: "Khảo sát yêu cầu",
      status: "completed",
      starts_at: "2026-04-15",
      ends_at: "2026-04-22",
      progress_percent: 100,
    },
    {
      id: "m2",
      code: "M2",
      title: "Wireframe + Design",
      status: "in_progress",
      starts_at: "2026-04-23",
      ends_at: "2026-05-10",
      progress_percent: 60,
    },
    {
      id: "m3",
      code: "M3",
      title: "Dev Frontend",
      status: "pending",
      starts_at: "2026-05-11",
      ends_at: "2026-05-31",
      progress_percent: 0,
    },
    {
      id: "m4",
      code: "M4",
      title: "Dev Backend + Tích hợp",
      status: "pending",
      starts_at: "2026-06-01",
      ends_at: "2026-06-10",
      progress_percent: 0,
    },
    {
      id: "m5",
      code: "M5",
      title: "Test + Bàn giao",
      status: "pending",
      starts_at: "2026-06-11",
      ends_at: "2026-06-15",
      progress_percent: 0,
    },
  ],
  deliverables: [
    {
      id: "d1",
      title: "Bản khảo sát yêu cầu chi tiết",
      filename: "khao_sat_yeu_cau.pdf",
      delivered_at: "2026-04-22",
      delivered_by: "Trần Thị B",
      status: "approved",
      milestone_code: "M1",
    },
    {
      id: "d2",
      title: "Wireframe v1 — Trang chủ + 3 trang con",
      filename: "wireframe_v1.fig",
      delivered_at: "2026-04-26",
      delivered_by: "Phạm Văn E",
      status: "pending_approval",
      milestone_code: "M2",
    },
  ],
  tickets: [
    {
      id: "t1",
      code: "TK-0028",
      title: "Yêu cầu đổi màu chủ đạo từ xanh sang cam",
      status: "awaiting_customer",
      created_at: "2026-04-26",
    },
  ],
  reports: [
    {
      id: "r1",
      period_label: "Tháng 4/2026",
      published_at: "2026-05-01",
      filename: "bao_cao_thang_04_2026.pdf",
    },
  ],
  pending_actions: [
    {
      id: "pa1",
      type: "approve_deliverable",
      label: "Duyệt Wireframe v1",
      description:
        "Wireframe v1 cho trang chủ + 3 trang con đã sẵn sàng để anh/chị review.",
      href: "#deliverable-d2",
      due_at: "2026-05-01",
    },
  ],
};

export const MOCK_PROJECTS: MockProject[] = [PROJECT_SEO_ABC, PROJECT_WEB_XYZ];

export function getMockProject(id: string): MockProject | null {
  return MOCK_PROJECTS.find((p) => p.id === id) ?? null;
}
