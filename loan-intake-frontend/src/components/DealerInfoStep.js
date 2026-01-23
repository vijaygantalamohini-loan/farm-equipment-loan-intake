import React, { useState, useEffect, useMemo } from "react";
import { autoValidateAddress, createAddressChangeHandler } from "../utils/addressUtils";

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
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
      <h2>Dealer Information</h2>
      <p style={{ color: "#666", marginBottom: "20px" }}>
        {user?.location && user?.vendor
          ? "Auto-filled from your profile. This represents your dealership location. You can edit if needed."
          : "Enter dealership information manually. This will be saved for future applications."
        }
      </p>

      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Dealership Name *
        </label>
        <input
          type="text"
          value={dealer.dealershipName}
          onChange={(e) => handleChange("dealershipName", e.target.value)}
          placeholder="Enter dealership name"
          required
          style={{
            width: "100%",
            padding: "8px",
            fontSize: "14px",
            border: isMissing("dealershipName") ? "1px solid #dc3545" : undefined,
          }}
        />
        {isMissing("dealershipName") && (
          <div style={{ color: "#dc3545", fontSize: "12px", marginTop: "4px" }}>Required</div>
        )}
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Contact Person *
        </label>
        <input
          type="text"
          value={dealer.contactPerson}
          onChange={(e) => handleChange("contactPerson", e.target.value)}
          placeholder="Sales representative name"
          required
          style={{
            width: "100%",
            padding: "8px",
            fontSize: "14px",
            border: isMissing("contactPerson") ? "1px solid #dc3545" : undefined,
          }}
        />
        {isMissing("contactPerson") && (
          <div style={{ color: "#dc3545", fontSize: "12px", marginTop: "4px" }}>Required</div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Phone Number *
          </label>
          <input
            type="tel"
            value={dealer.phoneNumber}
            onChange={(e) => handleChange("phoneNumber", e.target.value)}
            placeholder="(555) 123-4567"
            required
            style={{
              width: "100%",
              padding: "8px",
              fontSize: "14px",
              border: isMissing("phoneNumber") ? "1px solid #dc3545" : undefined,
            }}
          />
          {isMissing("phoneNumber") && (
            <div style={{ color: "#dc3545", fontSize: "12px", marginTop: "4px" }}>Required</div>
          )}
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Email *
          </label>
          <input
            type="email"
            value={dealer.email}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="contact@dealership.com"
            required
            style={{
              width: "100%",
              padding: "8px",
              fontSize: "14px",
              border: isMissing("email") ? "1px solid #dc3545" : undefined,
            }}
          />
          {isMissing("email") && (
            <div style={{ color: "#dc3545", fontSize: "12px", marginTop: "4px" }}>Required</div>
          )}
        </div>
      </div>

      <h3 style={{ marginTop: "25px", marginBottom: "15px" }}>Dealership Address</h3>

      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Street Address *
        </label>
        <input
          type="text"
          value={dealer.address.street}
          onChange={(e) => handleAddressChange("street", e.target.value)}
          placeholder="123 Main Street"
          required
          style={{
            width: "100%",
            padding: "8px",
            fontSize: "14px",
            border: isMissing("street") ? "1px solid #dc3545" : undefined,
          }}
        />
        {isMissing("street") && (
          <div style={{ color: "#dc3545", fontSize: "12px", marginTop: "4px" }}>Required</div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "15px", marginBottom: "15px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            City *
          </label>
          <input
            type="text"
            value={dealer.address.city}
            onChange={(e) => handleAddressChange("city", e.target.value)}
            placeholder="City"
            required
            style={{
              width: "100%",
              padding: "8px",
              fontSize: "14px",
              border: isMissing("city") ? "1px solid #dc3545" : undefined,
            }}
          />
          {isMissing("city") && (
            <div style={{ color: "#dc3545", fontSize: "12px", marginTop: "4px" }}>Required</div>
          )}
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            State *
          </label>
          <input
            type="text"
            value={dealer.address.state}
            onChange={(e) => handleAddressChange("state", e.target.value)}
            onBlur={validateAddress}
            placeholder="ST"
            maxLength="2"
            required
            style={{
              width: "100%",
              padding: "8px",
              fontSize: "14px",
              textTransform: "uppercase",
              border: isMissing("state") ? "1px solid #dc3545" : undefined,
            }}
          />
          {isMissing("state") && (
            <div style={{ color: "#dc3545", fontSize: "12px", marginTop: "4px" }}>Required</div>
          )}
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            ZIP Code *
          </label>
          <input
            type="text"
            value={dealer.address.zip}
            onChange={(e) => handleAddressChange("zip", e.target.value)}
            onBlur={validateAddress}
            placeholder="12345"
            maxLength="10"
            required
            style={{
              width: "100%",
              padding: "8px",
              fontSize: "14px",
              border: isMissing("zip") ? "1px solid #dc3545" : undefined,
            }}
          />
          {isMissing("zip") && (
            <div style={{ color: "#dc3545", fontSize: "12px", marginTop: "4px" }}>Required</div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Dealer License Number
        </label>
        <input
          type="text"
          value={dealer.dealerLicenseNumber}
          onChange={(e) => handleChange("dealerLicenseNumber", e.target.value)}
          placeholder="Optional - State dealer license number"
          style={{ width: "100%", padding: "8px", fontSize: "14px" }}
        />
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Additional Notes
        </label>
        <textarea
          value={dealer.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          placeholder="Any additional information about the dealer or transaction"
          rows="3"
          style={{ width: "100%", padding: "8px", fontSize: "14px", fontFamily: "inherit" }}
        />
      </div>

      {(user?.location && user?.vendor) && (
        <div style={{ marginBottom: "20px", padding: "10px", backgroundColor: "#d1ecf1", border: "1px solid #17a2b8", borderRadius: "4px" }}>
          <p style={{ margin: "0 0 10px 0", fontSize: "14px" }}>
            Using your profile information ({user.vendor.name} - {user.location.name})
            <button 
              type="button"
              onClick={handleClearSaved}
              style={{ 
                marginLeft: "10px",
                padding: "5px 10px", 
                fontSize: "12px", 
                cursor: "pointer",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "4px"
              }}
            >
              Clear Saved Info
            </button>
          </p>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "30px" }}>
        <button
          onClick={prevStep}
          style={{ padding: "10px 30px", fontSize: "16px", cursor: "pointer" }}
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          style={{ padding: "10px 30px", fontSize: "16px", cursor: "pointer", backgroundColor: "#007bff", color: "white", border: "none" }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default DealerInfoStep;
