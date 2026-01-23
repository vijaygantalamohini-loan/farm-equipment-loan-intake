export type Borrower = {
  creditScore?: number;
  annualIncome?: number;
};

export type Dealer = {
  state: string;
};

export type Equipment = {
  type: string;
  year: number;
  isNew: boolean;
  serialNumber?: string;
  value: number;
};

export type LoanApplication = {
  loanAmount: number;
  equipmentList: Equipment[];
  borrower: Borrower;
  dealer: Dealer;
  loanTermMonths: number;
  downPayment: number;
  naicsCode: string;
  tradeInPresent: boolean;
  creditScore?: number;
  annualIncome?: number;
};

export type LenderPreferences = {
  lenderId: string;
  displayName?: string;
  minLoanAmount: number;
  maxLoanAmount: number;
  allowedEquipmentTypes: string[];
  allowedStates: string[];
  allowedNaicsCodes: string[];
  minCreditScore?: number;
  minIncome?: number;
  maxLTV?: number;
  minDownPaymentPercent?: number;
  allowedLoanTerms: number[];
  allowUsedEquipment: boolean;
  requireSerialNumber: boolean;
  excludeTradeIns: boolean;
};

function safeArray(value?: string[]) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value?: number) {
  return typeof value === "number" && !Number.isNaN(value) ? value : 0;
}

export function routeApplication(
  application: LoanApplication,
  lenders: LenderPreferences[]
): string[] {
  const totalEquipmentValue = application.equipmentList.reduce(
    (sum, equipment) => sum + safeNumber(equipment.value),
    0
  );
  const normalizedEquipmentValue = totalEquipmentValue || 1;
  const ltv = application.loanAmount && normalizedEquipmentValue
    ? application.loanAmount / normalizedEquipmentValue
    : 0;
  const downPaymentPercent = application.downPayment && normalizedEquipmentValue
    ? application.downPayment / normalizedEquipmentValue
    : 0;
  const state = (application.dealer?.state || "").toUpperCase();

  const eligibleLenders: string[] = [];

  for (const lender of lenders) {
    const meetsLoanAmount =
      application.loanAmount >= lender.minLoanAmount &&
      application.loanAmount <= lender.maxLoanAmount;

    const meetsEquipmentTypes = application.equipmentList.every((eq) =>
      (lender.allowedEquipmentTypes || []).map((t) => t.toLowerCase()).includes(eq.type.toLowerCase())
    );

    const meetsState = safeArray(lender.allowedStates)
      .map((s) => s.toUpperCase())
      .includes(state);

    const meetsNaics = safeArray(lender.allowedNaicsCodes)
      .map((n) => n.toLowerCase())
      .includes(application.naicsCode.toLowerCase());

    const creditScore = safeNumber(application.creditScore);
    const meetsCredit = !lender.minCreditScore || creditScore >= lender.minCreditScore;

    const income = safeNumber(application.annualIncome);
    const meetsIncome = !lender.minIncome || income >= lender.minIncome;

    const meetsLTV = !lender.maxLTV || ltv <= lender.maxLTV;
    const meetsDownPayment = !lender.minDownPaymentPercent || downPaymentPercent >= lender.minDownPaymentPercent;

    const meetsLoanTerm = (lender.allowedLoanTerms || []).includes(application.loanTermMonths);

    const meetsUsedPolicy =
      lender.allowUsedEquipment || application.equipmentList.every((eq) => eq.isNew);

    const meetsSerialPolicy =
      !lender.requireSerialNumber ||
      application.equipmentList.every((eq) => Boolean(eq.serialNumber));

    const meetsTradeInPolicy =
      !lender.excludeTradeIns || !application.tradeInPresent;

    const eligible =
      meetsLoanAmount &&
      meetsEquipmentTypes &&
      meetsState &&
      meetsNaics &&
      meetsCredit &&
      meetsIncome &&
      meetsLTV &&
      meetsDownPayment &&
      meetsLoanTerm &&
      meetsUsedPolicy &&
      meetsSerialPolicy &&
      meetsTradeInPolicy;

    if (eligible) {
      eligibleLenders.push(lender.lenderId);
    }
  }

  return eligibleLenders;
}
