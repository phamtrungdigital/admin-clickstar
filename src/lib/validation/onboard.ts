import { z } from "zod";

import { createCompanySchema } from "@/lib/validation/companies";
import { createContractSchema } from "@/lib/validation/contracts";

/**
 * Schema gộp cho wizard onboard: 1 KH + (tuỳ chọn) 1 hợp đồng đầu tiên.
 * Khi `contract` là null, chỉ tạo KH. Khi có contract, server action sẽ
 * inject `company_id` từ customer vừa tạo trước khi gọi createContractAction.
 */
export const onboardSchema = z.object({
  customer: createCompanySchema,
  // contract.company_id sẽ được inject sau (omit ở đây để form không cần
  // điền trùng — KH đang tạo song song chưa có id).
  contract: createContractSchema.omit({ company_id: true }).nullable(),
});

export type OnboardInput = z.input<typeof onboardSchema>;
export type OnboardParsed = z.output<typeof onboardSchema>;
