import { z } from 'zod';

// Borrower: require first and last name; others optional
export const BorrowerSchema = z.object({
  firstName: z.string().min(1, 'firstName'),
  lastName: z.string().min(1, 'lastName'),
  email: z.string().optional(),
  phone: z.string().optional(),
  annualIncome: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number().gt(0, 'annualIncome')
  ).optional(),
  operationPurpose: z.string().optional(),
  yearsInOperation: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number().min(0, 'yearsInOperation')
  ).optional(),
  naicsCode: z.string().optional(),
  farmLegalEntity: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).optional(),
});

// Dealer: require dealershipName minimally
export const DealerSchema = z.object({
  dealershipName: z.string().min(1, 'dealershipName'),
  contactPerson: z.string().optional(),
  phoneNumber: z.string().optional(),
  email: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).optional(),
});

// Asset schema: primary serial optional (trade-in serial optional too)
export const AssetSchema = z.object({
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.string().optional(),
  serialNumber: z.preprocess(
    (v) => {
      if (v === undefined || v === null) return undefined;
      const trimmed = String(v).trim();
      return trimmed === "" ? undefined : trimmed;
    },
    z.string().optional()
  ).optional(),
  condition: z.string().optional(),
  valueEstimate: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number().positive('valueEstimate')
  ).optional(),
  equipmentType: z.string().optional(),
});

export const LoanSchema = z.object({
  purpose: z.string().optional(),
  cashDown: z.union([z.number(), z.string()]).optional(),
  termMonths: z.coerce.number().optional(),
  condition: z.string().optional(),
  // Require NAICS code (string or number). If string, must be non-empty.
  naicsCode: z.union([
    z.number(),
    z.string().min(1, 'naicsCode')
  ]),
  hasTradeIn: z.boolean().optional(),
  purchaseAssets: z.array(AssetSchema).min(1, 'purchaseAssets[0]').default([]),
  tradeIns: z.array(AssetSchema).optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  serialNumber: z.string().optional(),
}).superRefine((loan, ctx) => {
  // Require numeric valueEstimate for purchase assets
  (loan.purchaseAssets || []).forEach((asset, idx) => {
    if (asset && asset.valueEstimate !== undefined && Number.isNaN(Number(asset.valueEstimate))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['purchaseAssets', idx, 'valueEstimate'],
        message: 'valueEstimate',
      });
    }
  });

  // If trade-ins exist, require numeric valueEstimate and, if provided, a non-empty serial
  (loan.tradeIns || []).forEach((asset, idx) => {
    if (asset && asset.valueEstimate !== undefined && Number.isNaN(Number(asset.valueEstimate))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tradeIns', idx, 'valueEstimate'],
        message: 'valueEstimate',
      });
    }
  });
});

export const DocumentSchema = z.object({
  name: z.string().optional(),
  fileUrl: z.string().optional(),
});

export const DocumentsConsentsSchema = z.object({
  documents: z.array(DocumentSchema).default([]),
  consents: z.object({
    creditCheck: z.boolean({ message: 'consents.creditCheck' }),
    shareWithLenders: z.boolean({ message: 'consents.shareWithLenders' }),
  }),
});

// Utility: get readable field names from zod errors
export function zodIssuesToFields(issues) {
  const fields = [];
  for (const i of issues || []) {
    const path = i.path?.join('.') || i.message || 'unknown';
    fields.push(path);
  }
  return fields;
}

export function validateBorrower(borrower) {
  const r = BorrowerSchema.safeParse(borrower || {});
  return r.success ? [] : zodIssuesToFields(r.error.issues);
}

export function validateDealer(dealer) {
  const r = DealerSchema.safeParse(dealer || {});
  return r.success ? [] : zodIssuesToFields(r.error.issues);
}

export function validateLoan(loan) {
  const r = LoanSchema.safeParse(loan || {});
  return r.success ? [] : zodIssuesToFields(r.error.issues);
}

export function validateDocuments(docObj) {
  const r = DocumentsConsentsSchema.safeParse(docObj || { documents: [], consents: { creditCheck: false, shareWithLenders: false } });
  return r.success ? [] : zodIssuesToFields(r.error.issues);
}
