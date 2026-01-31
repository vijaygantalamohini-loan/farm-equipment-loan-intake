import { underwritingService } from "../services/underwriting.service";

export interface ApplicationSubmittedEvent {
  applicationId: string;
  lenderId: string;
  borrowerData: any;
  loanData: any;
  collateralData?: any;
}

export async function handleApplicationSubmitted(event: ApplicationSubmittedEvent): Promise<void> {
  await underwritingService.createRequest({
    applicationId: event.applicationId,
    lenderId: event.lenderId,
    borrowerData: event.borrowerData,
    loanData: event.loanData,
    collateralData: event.collateralData,
  });
}
