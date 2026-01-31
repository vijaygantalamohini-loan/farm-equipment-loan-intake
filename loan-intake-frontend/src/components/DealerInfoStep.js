import React, { useState, useEffect, useMemo } from "react";
import { autoValidateAddress, createAddressChangeHandler } from "../utils/addressUtils";
import { Info, Trash2 } from "lucide-react";

function DealerInfoStep({ onNext, nextStep, prevStep, user, initialData = {}, onDraftChange = () => {}, missingFields = [] }) {
  const [dealer, setDealer] = useState({
    dealershipName: initialData.dealershipName || "",
    contactPerson: initialData.contactPerson || "",
    phoneNumber: initialData.phoneNumber || "",
    email: initialData.email || "",
    address: {
      street: (initialData.address && initialData.address.street) || "",
      city: (initialData.address && initialData.address.city) || "",
      state: (initialData.address && initialData.address.state) || "",
      zip: (initialData.address && initialData.address.zip) || ""
    },
    dealerLicenseNumber: initialData.dealerLicenseNumber || "",
    notes: initialData.notes || ""
  });

  // Auto-fill missing fields from the rep's profile (vendor/location) without overwriting existing values
  useEffect(() => {
    const vendor = user?.vendor || {};
    const loc = user?.location || {};
    const locName = loc.name || loc.location_name || "";
    const locStreet = loc.street || loc.line1 || loc.address1 || "";
    const locCity = loc.city || "";
    const locState = loc.state || "";
    const locZip = loc.zip || loc.postal || loc.postalCode || "";
    const locPhone = loc.phone || vendor.phone || user?.phone || "";
    const locEmail = loc.email || vendor.email || user?.email || "";
    setDealer(prev => ({
      ...prev,
      dealershipName: (prev?.dealershipName && prev.dealershipName.trim()) ? prev.dealershipName : (vendor.name || locName || initialData.dealershipName || ""),
      contactPerson: (prev?.contactPerson && prev.contactPerson.trim()) ? prev.contactPerson : (vendor.contact || user?.name || initialData.contactPerson || ""),
      phoneNumber: (prev?.phoneNumber && prev.phoneNumber.trim()) ? prev.phoneNumber : (locPhone || initialData.phoneNumber || ""),
      email: (prev?.email && prev.email.trim()) ? prev.email : (locEmail || initialData.email || ""),
      address: {
        street: (prev?.address?.street && prev.address.street.trim()) ? prev.address.street : (locStreet || (initialData.address && initialData.address.street) || ""),
        city: (prev?.address?.city && prev.address.city.trim()) ? prev.address.city : (locCity || (initialData.address && initialData.address.city) || ""),
        state: (prev?.address?.state && prev.address.state.trim()) ? prev.address.state : (locState || (initialData.address && initialData.address.state) || ""),
        zip: (prev?.address?.zip && prev.address.zip.trim()) ? prev.address.zip : (locZip || (initialData.address && initialData.address.zip) || "")
      },
      dealerLicenseNumber: prev?.dealerLicenseNumber || initialData.dealerLicenseNumber || "",
      notes: prev?.notes || initialData.notes || ""
    }));
  }, [user, initialData]);

  // Sync local state when initialData changes (resume prefill), but avoid wiping auto-filled dealer
  useEffect(() => {
    const hasInitialData =
      (initialData.dealershipName && initialData.dealershipName.trim() !== "") ||
      (initialData.contactPerson && initialData.contactPerson.trim() !== "") ||
      (initialData.phoneNumber && initialData.phoneNumber.trim() !== "") ||
      (initialData.email && initialData.email.trim() !== "") ||
      (initialData.address && (
        initialData.address.street ||
        initialData.address.city ||
        initialData.address.state ||
        initialData.address.zip
      ));

    if (!hasInitialData) {
      return;
    }

    setDealer(prev => ({
      ...prev,
      dealershipName: initialData.dealershipName || prev.dealershipName || "",
      contactPerson: initialData.contactPerson || prev.contactPerson || "",
      phoneNumber: initialData.phoneNumber || prev.phoneNumber || "",
      email: initialData.email || prev.email || "",
      address: {
        street: (initialData.address && initialData.address.street) || prev.address.street || "",
        city: (initialData.address && initialData.address.city) || prev.address.city || "",
        state: (initialData.address && initialData.address.state) || prev.address.state || "",
        zip: (initialData.address && initialData.address.zip) || prev.address.zip || ""
      },
      dealerLicenseNumber: initialData.dealerLicenseNumber || prev.dealerLicenseNumber || "",
      notes: initialData.notes || prev.notes || ""
    }));
  }, [initialData]);

  // Save dealer info to localStorage whenever it changes
  useEffect(() => {
    if (dealer.dealershipName || dealer.email || dealer.phoneNumber) {
      localStorage.setItem("savedDealerInfo", JSON.stringify(dealer));
    }
  }, [dealer]);

  const handleChange = (field, value) => {
    setDealer(prev => {
      const updated = { ...prev, [field]: value };
      onDraftChange({ dealer: updated });
      return updated;
    });
  };

  const handleAddressChange = createAddressChangeHandler((updater) => {
    setDealer(prev => {
      const updated = updater(prev);
      onDraftChange({ dealer: updated });
      return updated;
    });
  });

  const validateAddress = () => {
    autoValidateAddress(dealer.address, (newAddress) => {
      setDealer(prev => ({ ...prev, address: newAddress }));
    });
  };

  const missingLookup = useMemo(() => {
    const set = new Set();
    const aliases = {
      dealerName: "dealershipName",
      name: "dealershipName",
      company_name: "dealershipName",
      companyName: "dealershipName",
      contact_name: "contactPerson",
      contact_person: "contactPerson",
      contactPersonName: "contactPerson",
      phone: "phoneNumber",
      phone_number: "phoneNumber",
      phoneNumber: "phoneNumber",
      email_address: "email",
      emailAddress: "email",
      address: "street",
      address_line1: "street",
      address1: "street",
      street_address: "street",
      city_name: "city",
      state_name: "state",
      postal_code: "zip",
      postalCode: "zip",
      zipcode: "zip",
    };
    (missingFields || []).forEach((field) => {
      if (!field) return;
      const value = String(field);
      set.add(value);
      if (value.includes('.')) {
        const parts = value.split('.');
        set.add(parts[parts.length - 1]);
      }
      const normalized = value.replace(/[^a-zA-Z0-9]+/g, '');
      if (normalized) set.add(normalized);
      if (aliases[value]) set.add(aliases[value]);
      if (aliases[normalized]) set.add(aliases[normalized]);
    });
    return set;
  }, [missingFields]);

  const isMissing = (field) => missingLookup.has(field);

  const handleSubmit = () => {
    console.debug('[DealerInfoStep] handleSubmit called. Dealer:', dealer);
    onNext({ dealer });
    nextStep();
  };

  const handleClearSaved = () => {
    if (window.confirm("Are you sure you want to clear the saved dealer information?")) {
      localStorage.removeItem("savedDealerInfo");
      setDealer({
        dealershipName: "",
        contactPerson: "",
        phoneNumber: "",
        email: "",
        address: {
          street: "",
          city: "",
          state: "",
          zip: ""
        },
        dealerLicenseNumber: "",
        notes: ""
      });
    }
  };

  return (
    <div className="mx-auto px-4 sm:px-6 py-8 bg-white">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black mb-2">Dealer Information</h1>
        <p className="text-gray-700">
          {user?.location && user?.vendor
            ? "Auto-filled from your profile. This represents your dealership location. You can edit if needed."
            : "Enter dealership information manually. This will be saved for future applications."
          }
        </p>
      </div>

      {/* Dealership Name */}
      <div className="mb-6">
        <FormField
          label="Dealership Name *"
          placeholder="Enter dealership name"
          value={dealer.dealershipName}
          onChange={(e) => handleChange("dealershipName", e.target.value)}
          error={isMissing("dealershipName")}
        />
      </div>

      {/* Contact Person */}
      <div className="mb-6">
        <FormField
          label="Contact Person *"
          placeholder="Sales representative name"
          value={dealer.contactPerson}
          onChange={(e) => handleChange("contactPerson", e.target.value)}
          error={isMissing("contactPerson")}
        />
      </div>

      {/* Phone & Email */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <FormField
          label="Phone Number *"
          type="tel"
          placeholder="(555) 123-4567"
          value={dealer.phoneNumber}
          onChange={(e) => handleChange("phoneNumber", e.target.value)}
          error={isMissing("phoneNumber")}
        />
        <FormField
          label="Email *"
          type="email"
          placeholder="contact@dealership.com"
          value={dealer.email}
          onChange={(e) => handleChange("email", e.target.value)}
          error={isMissing("email")}
        />
      </div>

      {/* Address Section */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-black mb-4">Dealership Address</h2>

        <div className="mb-6">
          <FormField
            label="Street Address *"
            placeholder="123 Main Street"
            value={dealer.address.street}
            onChange={(e) => handleAddressChange("street", e.target.value)}
            error={isMissing("street")}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <FormField
            label="City *"
            placeholder="City"
            value={dealer.address.city}
            onChange={(e) => handleAddressChange("city", e.target.value)}
            error={isMissing("city")}
          />
          <FormField
            label="State *"
            placeholder="ST"
            maxLength="2"
            value={dealer.address.state}
            onChange={(e) => handleAddressChange("state", e.target.value)}
            onBlur={validateAddress}
            error={isMissing("state")}
          />
          <FormField
            label="ZIP Code *"
            placeholder="12345"
            maxLength="10"
            value={dealer.address.zip}
            onChange={(e) => handleAddressChange("zip", e.target.value)}
            onBlur={validateAddress}
            error={isMissing("zip")}
          />
        </div>
      </div>

      {/* Additional Info */}
      <div className="mb-6">
        <FormField
          label="Dealer License Number"
          placeholder="Optional - State dealer license number"
          value={dealer.dealerLicenseNumber}
          onChange={(e) => handleChange("dealerLicenseNumber", e.target.value)}
        />
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-black mb-2">
          Additional Notes
        </label>
        <textarea
          value={dealer.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          placeholder="Any additional information about the dealer or transaction"
          rows="3"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition font-inherit"
        />
      </div>

      {/* Profile Info Alert */}
      {(user?.location && user?.vendor) && (
        <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-gray-800">
              Using your profile information ({user.vendor.name} - {user.location.name})
            </p>
            <button
              type="button"
              onClick={handleClearSaved}
              className="mt-2 flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
            >
              <Trash2 size={16} />
              Clear Saved Info
            </button>
          </div>
        </div>
      )}

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
  error = false,
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
        className={`w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition ${
          error ? "border-red-500" : "border-gray-500"
        }`}
        {...props}
      />
      {error && <p className="text-red-600 text-xs mt-1">Required</p>}
    </div>
  );
}

export default DealerInfoStep;
