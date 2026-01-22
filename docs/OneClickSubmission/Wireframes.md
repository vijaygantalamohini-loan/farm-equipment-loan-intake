# Wireframes for One-Click Submission UX Panels

---

## 1. OneClickSubmissionWizard (Overview)

```
+-----------------------------------------------------+
| ProgressStepper                                      |
|-----------------------------------------------------|
|                                                     |
| +-------------+  +-------------+  +----------------+ |
| | OCR Panel   |->| Explainability|->| Fraud Panel   | |
| +-------------+  +-------------+  +----------------+ |
|                                                     |
|                      Content Area                   |
|  +---------------------------------------------+    |
|  | Current Step Panel (e.g., OCRResultPanel)   |    |
|  |                                             |    |
|  | [Field Content and AI signals]               |    |
|  |                                             |    |
|  +---------------------------------------------+    |
|                                                     |
| [Back]            [Next]              [Cancel]      |
+-----------------------------------------------------+
```

---

## 2. OCRResultPanel Wireframe

```
+---------------- OCR Result -------------------------+
| Field            | Value          | Confidence Icon  |
|-----------------------------------------------------|
| First Name       | John           | [✓] 95%         |
| Last Name        | Doe            | [⚠️] 50%         |
| Address Line 1   | 123 Main St    | [✓] 90%         |
|-----------------------------------------------------|
| [ Edit Selected ]  [Flag for Review Toggle]         |
| Tooltip: Confidence levels explained here           |
+-----------------------------------------------------+
```

---

## 3. ExplainabilityPanel Wireframe

```
+------------ Explainability -------------------------+
| Field: First Name                                    |
| --------------------------------------------------- |
| Feature      | Importance                             |
|-------------------------------------------- +-------|
| Font Clarity | ████████████ 60%                      |
| Char Spacing | ███████     40%                        |
|-----------------------------------------------------|
| Textual Explanation:                                 |
| "Clear font and consistent character spacing..."  |
| [Expand/Collapse]                                    |
+-----------------------------------------------------+


+-----------------------------------------------------+
| Field: Address Line 1                                |
| Feature      | Importance                             |
| Text Length  | ██████████████ 80%                     |
| Context      | ████           20%                     |
| Textual Explanation:                                 |
| "Long text and contextual clue strongly indicate..."|
| [Expand/Collapse]                                    |
+-----------------------------------------------------+
```

---

## 4. FraudSignalPanel Wireframe

```
+---------------- Fraud Signals ---------------------+
| Risk Score: 75 - HIGH                               |
|----------------------------------------------------|
| Flags:                                             |
| * Unusual Device Location (High)                   |
| * Multiple Submissions (Medium)                     |
|----------------------------------------------------|
| [Acknowledge Risk]   [Request Manual Review]       |
| Tooltip: Explains what fraud signals mean          |
+----------------------------------------------------+
```

---

## 5. PrequalificationPanel Wireframe

```
+------------- Prequalification Status ---------------+
| Score: 85/100 [▓▓▓▓▓▓▓▓░░░░░] (Passed)               |
|-----------------------------------------------------|
| Actions:                                             |
| * Upload ID Document (Completed)                     |
| * Confirm Phone Number (Pending)                     |
|-----------------------------------------------------|
| [Retry Prequalification]                             |
| Tooltip: Explains score and eligibility criteria     |
+-----------------------------------------------------+
```

---

## 6. EquipmentIntelligencePanel Wireframe

```
+------------ Equipment Intelligence -----------------+
| Equipment ID: EQ-12345                              |
|----------------------------------------------------|
| Issues:                                             |
| * Battery Low (Warning)                             |
| * Maintenance Due Soon (Info)                       |
|----------------------------------------------------|
| Recommendations:                                    |
| - Charge device                                     |
| - Schedule maintenance                              |
|----------------------------------------------------|
| [Mark Issue Resolved]                               |
+----------------------------------------------------+
```

---

Next, I will prepare task organization documentation breaking down implementation work into actionable items.