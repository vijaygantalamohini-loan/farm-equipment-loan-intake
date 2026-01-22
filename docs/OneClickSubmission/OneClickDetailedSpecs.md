# One-Click Submission UX - Detailed Component Specifications

---

## 1. OneClickSubmissionWizard

### Responsibilities
- Orchestrates the entire submission flow
- Manages global state, step transitions, and rendering

### Props
```typescript
interface OneClickSubmissionWizardProps {
  initialData?: SubmissionData;
  onSubmit?: (finalData: SubmissionData) => Promise<void>;
  onCancel?: () => void;
  config?: WizardConfig;
}
```

### State
```typescript
interface WizardState {
  currentStepIndex: number;
  submissionData: SubmissionData;
  stepStatuses: Record<StepId, 'pending' | 'loading' | 'success' | 'error'>;
  errors: Record<StepId, string | null>;
}
```

### Events
- goNextStep()
- goPrevStep()
- goToStep(stepId: StepId)
- updateSubmissionData(partialUpdate: Partial<SubmissionData>)
- retryStep(stepId: StepId)

---

## 2. OCRResultPanel

### Description
Displays OCR extracted data with confidence scores and allows review and editing.

### Props
```typescript
interface OCRField {
  name: string;
  value: string;
  confidence: number;
  flagged?: boolean;
}

interface OCRResultPanelProps {
  fields: OCRField[];
  confidenceThreshold: number;
  onFieldEdit: (fieldName: string, newValue: string) => void;
  onFlagToggle?: (fieldName: string, flagged: boolean) => void;
  loading?: boolean;
  error?: string | null;
}
```

### UI Sketch
```
-------------------------------------
| OCR Results                       |
|-----------------------------------|
| Field Name        | Value        |
| --------------------------------- |
| First Name        | John [✓]     |
| Last Name         | Doe  [⚠️ Low] |
| Address Line 1    | 123 Main St [✓]|
|-----------------------------------|
| [Edit] [Flag for Review]         |
| Tooltip: Confidence: 95%          |
-------------------------------------
```

### Interaction Flow
1. Load and display fields.
2. Highlight low-confidence.
3. Allow inline or modal editing.
4. Flag/unflag fields for manual review.
5. Propagate edits to wizard state.
6. Show tooltips.

---

## 3. ExplainabilityPanel

### Description
Shows AI model explainability for why data was extracted or flagged.

### Props
```typescript
interface ExplanationItem {
  fieldName: string;
  scores: Record<string, number>;
  textualExplanation: string;
  expanded?: boolean;
}

interface ExplainabilityPanelProps {
  explanations: ExplanationItem[];
  onToggleExpand?: (fieldName: string) => void;
  loading?: boolean;
  error?: string | null;
}
```

### UI Sketch
```
---------------------------------------------
| Explainability                         [+] |
|-------------------------------------------|
| First Name                              ▼  |
|   - Font clarity: 0.6 (high influence)   |
|   - Char spacing: 0.4                     |
|   Explanation: Clear font helps detect    |
|-------------------------------------------|
| Address Line 1                          [+] |
|   - Text length: 0.8                     |
|   - Context: 0.2                         |
|   Explanation: Longer text matched format|
---------------------------------------------
```

### Interaction Flow
1. Show collapsible field explanations.
2. Allow drilling down.
3. Tooltips for terms.
4. Link back to OCR field.

---

## 4. FraudSignalPanel

### Description
Shows fraud detection flags and risk scores.

### Props
```typescript
interface FraudRule {
  id: string;
  description: string;
  triggered: boolean;
  severity: 'low' | 'medium' | 'high';
}

interface FraudSignalPanelProps {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  triggeredRules: FraudRule[];
  onAcknowledge?: () => void;
  loading?: boolean;
  error?: string | null;
}
```

### UI Sketch
```
----------------------------------------
| Fraud Signals                   [⚠️] |
|--------------------------------------|
| Risk Score: 75 (High)                 |
| Flags:                              |
|  - Unusual device location [High]    |
|  - Multiple fast submissions [Med]   |
| [Acknowledge] [Request Review]        |
----------------------------------------
```

### Interaction Flow
1. Show color-coded risk.
2. List triggered rules.
3. Allow user acknowledgement.
4. Show rule detail.

---

## 5. PrequalificationPanel

### Description
Shows prequal score, eligibility, and required next steps.

### Props
```typescript
interface PrequalAction {
  id: string;
  description: string;
  url?: string;
  required: boolean;
  status: 'pending' | 'completed' | 'failed';
}

interface PrequalificationPanelProps {
  score: number;
  status: 'passed' | 'failed' | 'pending';
  actions: PrequalAction[];
  onRetry?: () => void;
  loading?: boolean;
  error?: string | null;
}
```

### UI Sketch
```
-------------------------------------------------
| Prequalification Status                        |
|------------------------------------------------|
| Score: 85/100 [▓▓▓▓▓▓▓▓▓░░░] (Passed)           |
| Pending Actions:                               |
| - Upload ID document (Completed)               |
| - Confirm phone number (Pending)                |
| [Retry Prequalification]                        |
-------------------------------------------------
```

### Interaction Flow
1. Show progress bar/gauge.
2. Show required actions.
3. Enable retry.
4. Halt/send to support if failed.

---

## 6. EquipmentIntelligencePanel

### Description
Displays equipment intelligence insights and recommendations.

### Props
```typescript
interface EquipmentIssue {
  id: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  resolved: boolean;
}

interface EquipmentIntelligencePanelProps {
  equipmentId: string;
  issues: EquipmentIssue[];
  recommendations: string[];
  onIssueResolve?: (issueId: string) => void;
  loading?: boolean;
  error?: string | null;
}
```

### UI Sketch
```
-----------------------------------------
| Equipment Intelligence           [ℹ️] |
|---------------------------------------|
| Equipment ID: EQ-12345                |
| Issues:                             |
| - Battery level low (Warning)       |
| - Maintenance due soon (Info)       |
| Recommendations:                  |
| - Charge battery                   |
| - Schedule maintenance            |
-----------------------------------------
```

### Interaction Flow
1. List issues with severity icons.
2. Allow marking resolved.
3. Show recommendations.
4. Expand equipment details.

---

If you want me to save this file in a specific folder or format, or generate further detailed design documents (like user journey maps or wireframes), please let me know!