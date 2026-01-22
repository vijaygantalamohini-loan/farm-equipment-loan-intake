# User Journey Maps for One-Click Submission

---

## Overview

These journeys describe typical user interactions with the One-Click Submission flow, highlighting key steps, decision points, AI integration moments, and feedback.

---

## 1. Initial Submission Journey

**Goal:** User submits a document with minimal input.

```
Start
  |
  V
User clicks "One-Click Submission" button
  |
  V
Upload document or image
  |
  V
System triggers OCR
  |
  V
[AI: OCR results & confidence returned]
  |
  V
Display OCRResultPanel with data and confidence scores
  |
  V
User reviews flagged low-confidence fields
  |
  +----- Yes -----------------------------------> User corrects fields --> Update OCRResultPanel
  |
  +----- No -----------------------------------> Proceed
  |
  V
ExplainabilityPanel renders AI explanations
  |
  V
FraudSignalPanel shows risk score and alerts
  |
  +----- High Risk -----------------------------> User prompted for manual review / additional info
  |
  +----- Low/Medium Risk -----------------------> Proceed
  |
  V
PrequalificationPanel shows eligibility and next steps
  |
  +----- Eligible ------------------------------> Proceed
  |
  +----- Ineligible ----------------------------> Show info and help; option to cancel or retry
  |
  V
EquipmentIntelligencePanel shows insights
  |
  V
User confirms and submits
  |
  V
[Backend processes submission completely]
  |
  V
Show submission success or failure notification
  |
  V
End
```

---

## 2. Low Confidence / Review Focused Journey

**Goal:** User focuses on improving low-confidence data.

```
Start
  |
  V
Upload document/image
  |
  V
OCR with low confidence fields detected
  |
  V
DataReviewPanel opens with highlights on questionable fields
  |
  V
User edits data
  |
  +----- Changes valid -------------------------> DataReviewPanel updates confidence, clears flags
  |
  +----- Changes invalid -----------------------> Prompt user with error guidance
  |
  V
User re-submits for verification
  |
  V
Workflow continues as normal
```

---

## 3. Fraud Alert Focused Journey

**Goal:** User manages flagged fraud risk.

```
Start
  |
  V
Document submission
  |
  V
FraudSignalPanel shows high risk score
  |
  V
User reads fraud explanations
  |
  +----- User acknowledges risk ----------------> Continue with caution
  |
  +----- User requests manual review ------------> Opens support channel
  |
  V
Next steps or submission blocked
```

---

## 4. Prequalification Failure Journey

**Goal:** User fails eligibility and receives guidance.

```
Start
  |
  V
Submission processes
  |
  V
Prequalification fails
  |
  V
PrequalificationPanel shows failed status
  |
  V
User reads reasons and help links
  |
  V
User retries submission with improvements or cancels
```


---

**End of User Journeys**

Next, I will create detailed wireframes for the key UI panels based on these journeys.