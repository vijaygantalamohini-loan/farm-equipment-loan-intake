import { WorkflowType, WorkflowConfig } from '../entities/WorkflowDefinition';

export const LOAN_APPLICATION_WORKFLOW: WorkflowConfig = {
  initialState: 'draft',
  finalStates: ['funded', 'closed'],
  errorStates: ['rejected', 'cancelled'],
  states: [
    {
      name: 'draft',
      type: 'initial',
      allowedTransitions: ['submitted', 'cancelled'],
      actions: {
        onEnter: ['notify_dealer_draft_created'],
      },
    },
    {
      name: 'submitted',
      type: 'intermediate',
      allowedTransitions: ['under_review', 'cancelled'],
      requiredFields: ['borrower', 'loan_details', 'equipment'],
      actions: {
        onEnter: ['validate_application', 'notify_lenders', 'create_underwriting_request'],
      },
    },
    {
      name: 'under_review',
      type: 'intermediate',
      allowedTransitions: ['underwriting', 'additional_info_required', 'rejected'],
      actions: {
        onEnter: ['assign_reviewer', 'start_review_timer'],
      },
      timeout: 86400000, // 24 hours
    },
    {
      name: 'additional_info_required',
      type: 'intermediate',
      allowedTransitions: ['under_review', 'cancelled'],
      actions: {
        onEnter: ['notify_dealer_info_needed', 'create_task_list'],
      },
    },
    {
      name: 'underwriting',
      type: 'intermediate',
      allowedTransitions: ['decision_pending', 'rejected'],
      actions: {
        onEnter: ['start_underwriting_process', 'request_credit_check', 'verify_collateral'],
      },
    },
    {
      name: 'decision_pending',
      type: 'intermediate',
      allowedTransitions: ['approved', 'conditional_approval', 'rejected'],
      actions: {
        onEnter: ['aggregate_lender_responses', 'calculate_offers'],
      },
    },
    {
      name: 'conditional_approval',
      type: 'intermediate',
      allowedTransitions: ['approved', 'rejected', 'under_review'],
      actions: {
        onEnter: ['notify_dealer_conditions', 'create_condition_tasks'],
      },
    },
    {
      name: 'approved',
      type: 'intermediate',
      allowedTransitions: ['documents_pending', 'cancelled'],
      actions: {
        onEnter: ['notify_dealer_approval', 'generate_loan_documents', 'send_approval_email'],
      },
    },
    {
      name: 'documents_pending',
      type: 'intermediate',
      allowedTransitions: ['documents_received', 'cancelled'],
      actions: {
        onEnter: ['request_signatures', 'create_document_checklist'],
      },
    },
    {
      name: 'documents_received',
      type: 'intermediate',
      allowedTransitions: ['funding_pending', 'under_review'],
      actions: {
        onEnter: ['verify_documents', 'final_compliance_check'],
      },
    },
    {
      name: 'funding_pending',
      type: 'intermediate',
      allowedTransitions: ['funded', 'funding_failed'],
      actions: {
        onEnter: ['initiate_payment', 'notify_all_parties'],
      },
    },
    {
      name: 'funding_failed',
      type: 'intermediate',
      allowedTransitions: ['funding_pending', 'cancelled'],
      actions: {
        onEnter: ['notify_funding_failure', 'create_retry_task'],
      },
    },
    {
      name: 'funded',
      type: 'final',
      allowedTransitions: ['closed'],
      actions: {
        onEnter: ['disburse_funds', 'notify_funded', 'update_accounts'],
      },
    },
    {
      name: 'rejected',
      type: 'error',
      allowedTransitions: [],
      actions: {
        onEnter: ['notify_dealer_rejection', 'send_rejection_reasons'],
      },
    },
    {
      name: 'cancelled',
      type: 'error',
      allowedTransitions: [],
      actions: {
        onEnter: ['notify_cancellation', 'cleanup_resources'],
      },
    },
    {
      name: 'closed',
      type: 'final',
      allowedTransitions: [],
      actions: {
        onEnter: ['archive_application', 'final_notifications'],
      },
    },
  ],
};

export const UNDERWRITING_WORKFLOW: WorkflowConfig = {
  initialState: 'pending',
  finalStates: ['completed'],
  errorStates: ['failed', 'cancelled'],
  states: [
    {
      name: 'pending',
      type: 'initial',
      allowedTransitions: ['in_progress', 'cancelled'],
    },
    {
      name: 'in_progress',
      type: 'intermediate',
      allowedTransitions: ['credit_check', 'cancelled'],
      actions: {
        onEnter: ['assign_underwriter', 'load_application_data'],
      },
    },
    {
      name: 'credit_check',
      type: 'intermediate',
      allowedTransitions: ['collateral_review', 'failed'],
      actions: {
        onEnter: ['request_credit_report', 'verify_identity'],
      },
    },
    {
      name: 'collateral_review',
      type: 'intermediate',
      allowedTransitions: ['risk_assessment', 'failed'],
      actions: {
        onEnter: ['verify_equipment', 'assess_value', 'check_liens'],
      },
    },
    {
      name: 'risk_assessment',
      type: 'intermediate',
      allowedTransitions: ['decision', 'manual_review'],
      actions: {
        onEnter: ['calculate_risk_score', 'check_policies'],
      },
    },
    {
      name: 'manual_review',
      type: 'intermediate',
      allowedTransitions: ['decision', 'failed'],
      actions: {
        onEnter: ['assign_senior_underwriter', 'request_additional_docs'],
      },
    },
    {
      name: 'decision',
      type: 'intermediate',
      allowedTransitions: ['completed'],
      actions: {
        onEnter: ['generate_decision', 'calculate_terms'],
      },
    },
    {
      name: 'completed',
      type: 'final',
      allowedTransitions: [],
      actions: {
        onEnter: ['notify_decision', 'update_application'],
      },
    },
    {
      name: 'failed',
      type: 'error',
      allowedTransitions: [],
      actions: {
        onEnter: ['log_failure', 'notify_failure'],
      },
    },
    {
      name: 'cancelled',
      type: 'error',
      allowedTransitions: [],
    },
  ],
};
