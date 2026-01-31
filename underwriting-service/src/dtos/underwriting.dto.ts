import { z } from "zod";

export const CreateUnderwritingRequestDtoSchema = z.object({
  applicationId: z.string(),
  lenderId: z.string(),
  borrowerData: z.object({
    firstName: z.string(),
    lastName: z.string(),
    creditScore: z.number().optional(),
    income: z.number().optional(),
    employmentStatus: z.string().optional(),
  }),
  loanData: z.object({
    amount: z.number(),
    term: z.number(),
    purpose: z.string().optional(),
  }),
  collateralData: z.object({
    equipmentType: z.string().optional(),
    equipmentValue: z.number().optional(),
    year: z.number().optional(),
    make: z.string().optional(),
    model: z.string().optional(),
  }).optional(),
});

export type CreateUnderwritingRequestDto = z.infer<typeof CreateUnderwritingRequestDtoSchema>;

export const UpdateUnderwritingStatusDtoSchema = z.object({
  status: z.enum(["pending", "in_review", "approved", "rejected", "more_info_needed"]),
  notes: z.string().optional(),
  decision: z.object({
    approved: z.boolean(),
    approvedAmount: z.number().optional(),
    interestRate: z.number().optional(),
    term: z.number().optional(),
    conditions: z.array(z.string()).optional(),
    reason: z.string().optional(),
  }).optional(),
});

export type UpdateUnderwritingStatusDto = z.infer<typeof UpdateUnderwritingStatusDtoSchema>;
