import React, { useState } from "react";
import BorrowerInfoStep from "./components/BorrowerInfoStep";
import CoBorrowerInfoStep from "./components/CoBorrowerInfoStep";
import LoanRequestStep from "./components/LoanRequestStep";
import DocumentsAndConsentsStep from "./components/DocumentsAndConsentsStep";
import ConfirmationStep from "./components/ConfirmationStep";

function LoanApplicationWizard() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({});

  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => prev - 1);

  const updateData = (newData) => {
    setFormData(prev => ({ ...prev, ...newData }));
  };

  return (
    <div>
      <h2>Step {step} of 5</h2>
      <progress value={step} max="5"></progress>

      {step === 1 && (
        <BorrowerInfoStep
          onNext={updateData}
          nextStep={nextStep}
        />
      )}

      {step === 2 && (
        <CoBorrowerInfoStep
          onNext={updateData}
          nextStep={nextStep}
          prevStep={prevStep}
        />
      )}

      {step === 3 && (
        <LoanRequestStep
          onNext={updateData}
          nextStep={nextStep}
          prevStep={prevStep}
        />
      )}

      {step === 4 && (
        <DocumentsAndConsentsStep
          onNext={updateData}
          nextStep={nextStep}
          prevStep={prevStep}
        />
      )}

      {step === 5 && (
        <ConfirmationStep
          formData={formData}
        />
      )}
    </div>
  );
}

export default LoanApplicationWizard;