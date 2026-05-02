"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createCustomerAction,
  type ActionResult,
} from "@/app/(dashboard)/customers/actions";
import { createContractAction } from "@/app/(dashboard)/contracts/actions";
import { onboardSchema, type OnboardInput } from "@/lib/validation/onboard";

export type OnboardActionResult = ActionResult<{
  customerId: string;
  contractId: string | null;
  /** Set when contract was attempted but failed — UI can show partial-success
   *  message and direct user to /customers/{id} to continue manually. */
  contractWarning: string | null;
}>;

function flattenZodErrors(
  error: import("zod").ZodError,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Composite action behind the onboard wizard. Sequential, best-effort:
 *
 *  1) Create the customer (delegates to createCustomerAction so role-based
 *     AM enforcement, audit logging, RLS rules stay consistent).
 *  2) If the user filled in the contract step, create the contract for that
 *     new customer (delegates to createContractAction — handles auto-fork
 *     of templates per service line).
 *
 * If step 2 fails after step 1 succeeded we DON'T roll back the customer:
 *   - The cascade undo for fork-template side effects is messy (multiple
 *     tables already written by createContractAction).
 *   - The user usually still wants the customer recorded; they can finish
 *     the contract from /customers/{id}.
 *
 * The result surfaces a `contractWarning` so the wizard can route the user
 * to the customer detail page with a toast explaining what's left to do.
 */
export async function onboardCustomerAction(
  input: OnboardInput,
): Promise<OnboardActionResult> {
  const parsed = onboardSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  // Step 1: customer
  const customerResult = await createCustomerAction(parsed.data.customer);
  if (!customerResult.ok) return customerResult;
  const customerId = customerResult.data!.id;

  // Step 2: contract (optional)
  const contractInput = parsed.data.contract;
  if (!contractInput) {
    revalidatePath("/customers");
    return {
      ok: true,
      data: { customerId, contractId: null, contractWarning: null },
    };
  }

  const contractResult = await createContractAction({
    ...contractInput,
    company_id: customerId,
  });

  if (!contractResult.ok) {
    // Customer is already saved — surface a partial success so the wizard
    // can take the user straight to /customers/{id} to retry the contract.
    return {
      ok: true,
      data: {
        customerId,
        contractId: null,
        contractWarning: contractResult.message,
      },
    };
  }

  revalidatePath("/customers");
  revalidatePath("/contracts");
  revalidatePath("/projects");
  return {
    ok: true,
    data: {
      customerId,
      contractId: contractResult.data!.id,
      contractWarning: null,
    },
  };
}

export async function onboardCustomerAndRedirect(
  input: OnboardInput,
): Promise<OnboardActionResult> {
  const result = await onboardCustomerAction(input);
  if (!result.ok) return result;
  // If contract failed mid-way, land on the customer detail page so the
  // user can continue manually; otherwise land on the contract detail.
  const target = result.data!.contractId
    ? `/contracts/${result.data!.contractId}`
    : `/customers/${result.data!.customerId}`;
  redirect(target);
}
