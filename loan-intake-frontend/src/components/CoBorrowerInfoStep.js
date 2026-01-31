import React, { useState, useEffect } from "react";
import { autoValidateAddress, createAddressChangeHandler } from "../utils/addressUtils";
import { ChevronDown } from "lucide-react";

function CoBorrowerInfoStep({ onNext, nextStep, prevStep, initialData, onDraftChange = () => {} }) {
  const [coBorrower, setCoBorrower] = useState({
    firstName: initialData?.firstName || "",
    lastName: initialData?.lastName || "",
    dateOfBirth: initialData?.dateOfBirth || "",
    ssn: initialData?.ssn || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    address: { 
      street: initialData?.address?.street || "", 
      city: initialData?.address?.city || "", 
      state: initialData?.address?.state || "", 
      zip: initialData?.address?.zip || "" 
    },
    employerName: initialData?.employerName || "",
    annualIncome: initialData?.annualIncome || "",
    status: initialData?.status || ""
  });

  // Sync local state when initialData changes (resume prefill)
  useEffect(() => {
    setCoBorrower({
      firstName: initialData?.firstName || "",
      lastName: initialData?.lastName || "",
      dateOfBirth: initialData?.dateOfBirth || "",
      ssn: initialData?.ssn || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      address: { 
        street: initialData?.address?.street || "", 
        city: initialData?.address?.city || "", 
        state: initialData?.address?.state || "", 
        zip: initialData?.address?.zip || "" 
      },
      employerName: initialData?.employerName || "",
      annualIncome: initialData?.annualIncome || "",
      status: initialData?.status || ""
    });
  }, [initialData]);

  const handleChange = (field, value) => {
    setCoBorrower(prev => {
      const updated = { ...prev, [field]: value };
      try { onDraftChange({ coBorrower: updated }); } catch {}
      return updated;
    });
  };

  const handleAddressChange = createAddressChangeHandler((updater) => {
    setCoBorrower(prev => {
      const updated = updater(prev);
      try { onDraftChange({ coBorrower: updated }); } catch {}
      return updated;
    });
  });

  const validateAddress = () => {
    autoValidateAddress(coBorrower.address, (newAddress) => {
      setCoBorrower(prev => ({ ...prev, address: newAddress }));
    });
  };

  const handleSubmit = () => {
    onNext({ coBorrower });
    nextStep();
  };

  return (
    <div className="mx-auto px-4 sm:px-6 py-8 bg-white">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black mb-2">Co-Borrower Information</h1>
        <p className="text-gray-700">
          Please provide information about the co-borrower (if applicable).
        </p>
      </div>

      {/* Personal Information */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-black mb-4">Personal Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <FormField
            label="First Name *"
            placeholder="First Name"
            value={coBorrower.firstName}
            onChange={e => handleChange("firstName", e.target.value)}
          />
          <FormField
            label="Last Name *"
            placeholder="Last Name"
            value={coBorrower.lastName}
            onChange={e => handleChange("lastName", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <FormField
            label="Date of Birth *"
            type="date"
            value={coBorrower.dateOfBirth}
            onChange={e => handleChange("dateOfBirth", e.target.value)}
          />
          <FormField
            label="SSN *"
            placeholder="123-45-6789"
            value={coBorrower.ssn}
            onChange={e => handleChange("ssn", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Email *"
            placeholder="email@example.com"
            value={coBorrower.email}
            onChange={e => handleChange("email", e.target.value)}
          />
          <FormField
            label="Phone *"
            placeholder="(555) 123-4567"
            value={coBorrower.phone}
            onChange={e => handleChange("phone", e.target.value)}
          />
        </div>
      </div>

      {/* Address Section */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-black mb-4">Address</h2>

        <div className="mb-6">
          <FormField
            label="Street Address *"
            placeholder="123 Main Street"
            value={coBorrower.address.street}
            onChange={e => handleAddressChange("street", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <FormField
            label="City *"
            placeholder="City"
            value={coBorrower.address.city}
            onChange={e => handleAddressChange("city", e.target.value)}
          />
          <FormField
            label="State *"
            placeholder="ST"
            maxLength="2"
            value={coBorrower.address.state}
            onChange={e => handleAddressChange("state", e.target.value)}
            onBlur={validateAddress}
          />
          <FormField
            label="ZIP Code *"
            placeholder="12345"
            maxLength="10"
            value={coBorrower.address.zip}
            onChange={e => handleAddressChange("zip", e.target.value)}
            onBlur={validateAddress}
          />
        </div>
      </div>

      {/* Employment Section */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-black mb-4">Employment</h2>

        <div className="mb-6">
          <FormField
            label="Employer/Farm Name *"
            placeholder="Employer/Farm Name"
            value={coBorrower.employerName}
            onChange={e => handleChange("employerName", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Annual Income ($) *"
            type="number"
            placeholder="50000"
            value={coBorrower.annualIncome}
            onChange={e => handleChange("annualIncome", e.target.value)}
          />
          <div>
            <label className="block text-sm font-semibold text-black mb-2">
              Employment Status *
            </label>
            <div className="relative">
              <select
                value={coBorrower.status}
                onChange={e => handleChange("status", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black appearance-none bg-white pr-10"
              >
                <option value="">Select Status</option>
                <option value="employed">Employed</option>
                <option value="self-employed">Self-Employed</option>
                <option value="unemployed">Unemployed</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row justify-between gap-4 mt-10 pt-8 border-t border-gray-300">
        <button
          onClick={prevStep}
          className="px-6 py-3 font-semibold text-black bg-gray-200 rounded-lg hover:bg-gray-300 transition"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          className="px-6 py-3 font-semibold text-white bg-black rounded-lg hover:bg-gray-800 transition"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// Reusable FormField Component
function FormField({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
  onBlur,
  maxLength,
  ...props
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-black mb-2">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        maxLength={maxLength}
        className="w-full px-3 py-2 border-2 border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition"
        {...props}
      />
    </div>
  );
}

export default CoBorrowerInfoStep;
