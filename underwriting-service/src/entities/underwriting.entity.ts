export type UnderwritingStatus = "pending" | "in_review" | "approved" | "rejected" | "more_info_needed";

export interface UnderwritingRequest {
  id: string;
  applicationId: string;
  lenderId: string;
  status: UnderwritingStatus;
  borrowerData: {
    firstName: string;
    lastName: string;
    creditScore?: number;
    income?: number;
    employmentStatus?: string;
  };
  loanData: {
    amount: number;
    term: number;
    purpose?: string;
  };
  collateralData?: {
    equipmentType?: string;
    equipmentValue?: number;
    year?: number;
    make?: string;
    model?: string;
  };
  decision?: {
    approved: boolean;
    approvedAmount?: number;
    interestRate?: number;
    term?: number;
    conditions?: string[];
    reason?: string;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface UnderwritingActivity {
  id: string;
  underwritingId: string;
  activityType: "status_change" | "note_added" | "decision_made" | "info_requested";
  description: string;
  performedBy?: string;
  createdAt: string;
}
