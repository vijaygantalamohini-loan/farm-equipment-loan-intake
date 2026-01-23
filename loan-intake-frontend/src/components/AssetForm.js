import React, { useState, useRef, useEffect } from "react";
import manufacturersData from "../data/manufacturers.json";
import { Html5Qrcode } from "html5-qrcode";
import { API_BASE } from "../services/api";

function AssetForm({ 
  asset, 
  assetIndex, 
  onChange, 
  onRemove, 
  canRemove = true,
  type = "purchase", // "purchase" or "trade-in"
  showSerialScanning = true,
  missingFields = [],
  onOcrResults = () => {}
}) {
  const [mode, setMode] = useState("manual");
  const [uploadedImage, setUploadedImage] = useState(null);
  const [ocrRawText, setOcrRawText] = useState("");
  const [barcodeScanning, setBarcodeScanning] = useState(false);
  const [barcodeError, setBarcodeError] = useState("");
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success'|'warning'|'error', text: string }
  const [lookupDetails, setLookupDetails] = useState(null);
  const html5QrCodeRef = useRef(null);
  const scannerRef = useRef(null);

  const fieldLabel = type === "trade-in" ? "Trade-in Value" : "Estimated Value";
  const serialLabel = "Serial Number / VIN *";
  const isMissing = (field) => missingFields.includes(field);

  // Upload or scan asset image
  const handleAssetUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);
    setUploadedImage(imageUrl);
    setMode("manual");

    const formData = new FormData();
    formData.append("file", file);

    alert("Processing image with OCR... Please wait.");

    try {
      const url = API_BASE ? `${API_BASE}/ocr/asset` : `/ocr/asset`;
      const response = await fetch(url, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const extracted = data.extractedData || {};
      
      console.log("OCR Response:", data);
      console.log("Extracted Data:", extracted);
      
      const newAsset = {
        make: extracted.make || extracted.manufacturer || "",
        model: extracted.model || "",
        year: extracted.year || "",
        serialNumber: extracted.serialNumber || "",
        valueEstimate: extracted.price || ""
      };

      console.log("New Asset Values:", newAsset);

      setOcrRawText(Array.isArray(data.rawText) ? data.rawText.join('\n') : data.rawText);
      onOcrResults({
        source: "invoice",
        assetIndex,
        assetType: type,
        ...data,
        extractedData: data.extractedData || data
      });

      // Update parent with OCR results - call onChange for ALL fields to ensure update
      onChange("make", newAsset.make);
      onChange("model", newAsset.model);
      onChange("year", newAsset.year);
      onChange("serialNumber", newAsset.serialNumber);
      onChange("valueEstimate", newAsset.valueEstimate);
      
      console.log("Form fields updated via onChange");

      setMode("manual");
      
      if (data.qualityWarning === "poor_quality") {
        alert(`⚠️ POOR IMAGE QUALITY DETECTED\n\nThe image is too blurry, low resolution, or has poor lighting.\n\nPlease retake the photo with better quality.`);
        return;
      }
      
      if (data.qualityWarning === "no_data_found") {
        alert(`⚠️ NO EQUIPMENT DATA FOUND\n\nOCR couldn't find Make, Model, Year, or Serial Number.`);
      }
    } catch (err) {
      console.error("Asset OCR failed:", err);
      alert(`Error: ${err.message}\n\nPlease enter manually.`);
      setMode("manual");
    }
  };

  // Barcode scanning
  const startBarcodeScanner = async () => {
    setBarcodeError("");
    setBarcodeScanning(true);
    
    try {
      const html5QrCode = new Html5Qrcode(`barcode-reader-${assetIndex}-${type}`);
      html5QrCodeRef.current = html5QrCode;
      
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          onChange("serialNumber", decodedText);
          stopBarcodeScanner();
          lookupSerialNumber(decodedText);
        },
        () => {}
      );
    } catch (err) {
      setBarcodeError(`Failed to start camera: ${err.message}`);
      setBarcodeScanning(false);
    }
  };

  const stopBarcodeScanner = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().then(() => {
        setBarcodeScanning(false);
      }).catch(() => {
        setBarcodeScanning(false);
      });
    }
  };

  const handleBarcodeImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setBarcodeError("");
    
    try {
      const html5QrCode = new Html5Qrcode(`barcode-reader-${assetIndex}-${type}`);
      const result = await html5QrCode.scanFile(file, true);
      onChange("serialNumber", result);
      lookupSerialNumber(result);
    } catch (err) {
      setBarcodeError(`Could not read barcode from image. ${err.message}`);
      alert(`Failed to read barcode from image.\n\nPlease use a clear, well-lit photo.`);
    }
  };

  const lookupSerialNumber = async (serialNum) => {
    if (!serialNum || serialNum.length < 6) return;
    setIsLookupLoading(true);
    setLookupDetails(null);
    
    try {
      const url = API_BASE ? `${API_BASE}/lookup/serial/${encodeURIComponent(serialNum)}` : `/lookup/serial/${encodeURIComponent(serialNum)}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.found) {
        if (data.make) onChange("make", data.make);
        if (data.model) onChange("model", data.model);
        if (data.year) onChange("year", data.year);
        if (data.valueEstimate) onChange("valueEstimate", data.valueEstimate);
        
        setLookupDetails(data);
        const parts = [];
        if (data.make) parts.push(`Make ${data.make}`);
        if (data.model) parts.push(`Model ${data.model}`);
        if (data.year) parts.push(`Year ${data.year}`);
        const msg = parts.length ? `Auto-filled: ${parts.join(', ')}` : (data.note || 'Serial recognized; verify details');
        setToast({ type: 'success', text: msg });
        setTimeout(() => setToast(null), 3000);
      } else {
        setLookupDetails(null);
        setToast({ type: 'warning', text: 'No details found for this serial. Please enter manually.' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error("Serial lookup error:", err);
      setLookupDetails(null);
      setToast({ type: 'error', text: 'Lookup error. Please try again or enter manually.' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsLookupLoading(false);
    }
  };

  const handleSerialNumberChange = (value) => {
    const trimmed = (value || "").trim();
    onChange("serialNumber", trimmed);
    
    if (scannerRef.current) clearTimeout(scannerRef.current);
    scannerRef.current = setTimeout(() => {
      lookupSerialNumber(trimmed);
    }, 1000);
  };

  // Auto-lookup serial number when component mounts with existing serial
  useEffect(() => {
    const serialNum = (asset.serialNumber || "").trim();
    // Only lookup on mount if serial exists and we don't have details yet
    if (serialNum && serialNum.length >= 6 && !lookupDetails) {
      const timer = setTimeout(() => {
        lookupSerialNumber(serialNum);
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetIndex]); // Only run when switching assets, not on every serial change

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const formatConfidence = (value) => {
    if (typeof value !== "number" || Number.isNaN(value)) return null;
    return `${Math.round(value * 100)}%`;
  };

  const mlMetadata = lookupDetails?.decodedInfo?.metadata?.ml_inference;
  const vinMetadata = lookupDetails?.decodedInfo?.metadata?.vin_fallback;

  return (
    <div style={{ 
      border: "1px solid #ddd", 
      padding: "20px", 
      borderRadius: "8px", 
      backgroundColor: "#fafafa",
      marginBottom: "20px"
    }}>
      {canRemove && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}>
          <button
            type="button"
            onClick={onRemove}
            style={{
              padding: "6px 12px",
              fontSize: "13px",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            🗑️ Remove
          </button>
        </div>
      )}

      {showSerialScanning && type === "purchase" && (
        <>
          <div style={{ marginBottom: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button 
              type="button"
              onClick={() => setMode("scan")}
              style={{ 
                padding: "8px 16px", 
                fontSize: "14px", 
                cursor: "pointer",
                backgroundColor: mode === "scan" ? "#007bff" : "#f0f0f0",
                color: mode === "scan" ? "white" : "black",
                border: "1px solid #ccc"
              }}
            >
              Scan Serial Plate
            </button>
            <button 
              type="button"
              onClick={() => setMode("upload")}
              style={{ 
                padding: "8px 16px", 
                fontSize: "14px", 
                cursor: "pointer",
                backgroundColor: mode === "upload" ? "#007bff" : "#f0f0f0",
                color: mode === "upload" ? "white" : "black",
                border: "1px solid #ccc"
              }}
            >
              Upload Invoice
            </button>
          </div>

          {mode === "scan" && (
            <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f9f9f9", border: "1px solid #ddd" }}>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleAssetUpload}
                style={{ marginBottom: "10px" }}
              />
              <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>Take a photo of the equipment serial plate.</p>
            </div>
          )}

          {mode === "upload" && (
            <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f9f9f9", border: "1px solid #ddd" }}>
              <input type="file" accept="image/*,.pdf" onChange={handleAssetUpload} style={{ marginBottom: "10px" }} />
              <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>Upload dealer invoice or screenshot.</p>
            </div>
          )}

          {barcodeScanning && (
            <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#e8f5e9", border: "2px solid #4caf50", borderRadius: "4px" }}>
              <h4 style={{ marginTop: 0, marginBottom: "10px", color: "#2e7d32" }}>📷 Barcode Scanner Active</h4>
              <div id={`barcode-reader-${assetIndex}-${type}`} style={{ width: "100%", maxWidth: "500px", margin: "0 auto" }}></div>
              <p style={{ marginTop: "10px", fontSize: "13px", color: "#555", textAlign: "center" }}>
                Point camera at barcode. It will auto-detect and fill the serial number.
              </p>
            </div>
          )}

          {!barcodeScanning && <div id={`barcode-reader-${assetIndex}-${type}`} style={{ display: "none" }}></div>}

          {ocrRawText && (
            <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#fffbf0", border: "2px solid #ffa500", borderRadius: "4px" }}>
              <h4 style={{ marginTop: 0, marginBottom: "10px", color: "#ff8c00" }}>📋 Raw OCR Text</h4>
              <textarea
                readOnly
                value={ocrRawText}
                style={{
                  width: "100%",
                  minHeight: "100px",
                  padding: "10px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  backgroundColor: "#fff",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  whiteSpace: "pre-wrap"
                }}
              />
            </div>
          )}
        </>
      )}

      {/* Serial Number first to auto-fetch details */}
      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          {serialLabel}
        </label>
        <input
          placeholder="Enter serial number or VIN"
          value={asset.serialNumber || ""}
          onChange={e => handleSerialNumberChange(e.target.value)}
          onKeyPress={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (scannerRef.current) clearTimeout(scannerRef.current);
              lookupSerialNumber(asset.serialNumber);
            }
          }}
          style={{ width: "100%", padding: "8px", fontSize: "14px", marginBottom: "8px", borderColor: isMissing("serialNumber") ? "red" : "#ccc" }}
        />

        {/* Lookup status and toast */}
        {isLookupLoading && (
          <div style={{ marginTop: "6px", fontSize: "12px", color: "#555" }}>⏳ Searching…</div>
        )}
        {toast && (
          <div
            style={{
              marginTop: "6px",
              padding: "6px 8px",
              borderRadius: "4px",
              fontSize: "12px",
              color: toast.type === 'error' ? "#721c24" : (toast.type === 'warning' ? "#856404" : "#155724"),
              background: toast.type === 'error' ? "#f8d7da" : (toast.type === 'warning' ? "#fff3cd" : "#d4edda"),
              border: `1px solid ${toast.type === 'error' ? '#f5c6cb' : (toast.type === 'warning' ? '#ffeeba' : '#c3e6cb')}`
            }}
          >
            {toast.text}
          </div>
        )}

        {lookupDetails && (
          <div
            style={{
              marginTop: "10px",
              padding: "10px 12px",
              borderRadius: "6px",
              backgroundColor: "#f1f5f9",
              border: "1px solid #cbd5e1",
              fontSize: "13px",
              lineHeight: 1.5
            }}
          >
            <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Decoded Details</div>
            <div>Source: {lookupDetails.source || "serial_decoder"}</div>
            {lookupDetails.confidence !== undefined && (
              <div>Legacy Confidence: {formatConfidence(lookupDetails.confidence) || "n/a"}</div>
            )}
            {lookupDetails.make && (
              <div>Make: {lookupDetails.make}</div>
            )}
            {lookupDetails.model && (
              <div>Model: {lookupDetails.model}</div>
            )}
            {lookupDetails.year && (
              <div>Year: {lookupDetails.year}</div>
            )}
            {mlMetadata && (
              <div style={{ marginTop: "6px" }}>
                <div style={{ fontWeight: "bold" }}>ML Suggestions</div>
                <div>Overall Confidence: {formatConfidence(mlMetadata.overall_confidence) || "n/a"}</div>
                <div>
                  Make: {mlMetadata.make?.label || "n/a"}
                  {mlMetadata.make?.confidence !== undefined && ` (${formatConfidence(mlMetadata.make.confidence) || 'n/a'})`}
                </div>
                <div>
                  Model: {mlMetadata.model?.label || "n/a"}
                  {mlMetadata.model?.confidence !== undefined && ` (${formatConfidence(mlMetadata.model.confidence) || 'n/a'})`}
                </div>
                <div>
                  Year: {mlMetadata.year?.label || "n/a"}
                  {mlMetadata.year?.confidence !== undefined && ` (${formatConfidence(mlMetadata.year.confidence) || 'n/a'})`}
                </div>
              </div>
            )}
            {vinMetadata && (
              <div style={{ marginTop: "6px" }}>
                <div style={{ fontWeight: "bold" }}>VIN Reference</div>
                <div>Year: {vinMetadata.year || "n/a"}</div>
                <div>Make: {vinMetadata.make || vinMetadata.manufacturer || "n/a"}</div>
              </div>
            )}
          </div>
        )}

        {showSerialScanning && type === "purchase" && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {!barcodeScanning && (
              <>
                <button
                  type="button"
                  onClick={startBarcodeScanner}
                  style={{
                    padding: "6px 12px",
                    fontSize: "13px",
                    backgroundColor: "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  📷 Scan Barcode
                </button>
                <label
                  style={{
                    padding: "6px 12px",
                    fontSize: "13px",
                    backgroundColor: "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    display: "inline-block"
                  }}
                >
                  📤 Upload Barcode Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBarcodeImageUpload}
                    style={{ display: "none" }}
                  />
                </label>
              </>
            )}
            {barcodeScanning && (
              <button
                type="button"
                onClick={stopBarcodeScanner}
                style={{
                  padding: "6px 12px",
                  fontSize: "13px",
                  backgroundColor: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                ⏹ Stop Scanning
              </button>
            )}
          </div>
        )}

        {barcodeError && (
          <p style={{ color: "red", fontSize: "12px", marginTop: "5px" }}>
            {barcodeError}
          </p>
        )}
      </div>

      {/* Auto-filled details below */}
      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Make/Manufacturer
        </label>
        <input
          list={`manufacturers-list-${assetIndex}-${type}`}
          placeholder="Type or select manufacturer"
          value={asset.make || ""}
          onChange={e => onChange("make", e.target.value)}
          style={{ width: "100%", padding: "8px", fontSize: "14px", borderColor: isMissing("make") ? "red" : "#ccc" }}
        />
        <datalist id={`manufacturers-list-${assetIndex}-${type}`}>
          {manufacturersData
            .sort((a, b) => a.manufacturer.localeCompare(b.manufacturer))
            .map(m => (
              <option key={m.manufacturer} value={m.manufacturer} />
            ))}
        </datalist>
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Model
        </label>
        <input
          placeholder="e.g., 5075E"
          value={asset.model || ""}
          onChange={e => onChange("model", e.target.value)}
          style={{ width: "100%", padding: "8px", fontSize: "14px", borderColor: isMissing("model") ? "red" : "#ccc" }}
        />
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Year
        </label>
        <input
          placeholder="2024"
          value={asset.year || ""}
          onChange={e => onChange("year", e.target.value)}
          style={{ width: "100%", padding: "8px", fontSize: "14px", borderColor: isMissing("year") ? "red" : "#ccc" }}
        />
      </div>

      {type === "purchase" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "15px", marginBottom: "15px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Condition
            </label>
            <select
              value={asset.condition || ""}
              onChange={e => onChange("condition", e.target.value)}
              style={{ width: "100%", padding: "8px", fontSize: "14px", borderColor: isMissing("condition") ? "red" : "#ccc" }}
            >
              <option value="">Select condition</option>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Poor">Poor</option>
            </select>
          </div>
        </div>
      )}

      {type === "trade-in" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Hours/Miles (Optional)
              </label>
              <input
                type="number"
                placeholder="e.g., 1500"
                value={asset.hoursOrMiles || ""}
                onChange={e => onChange("hoursOrMiles", e.target.value)}
                style={{ width: "100%", padding: "8px", fontSize: "14px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Condition
              </label>
              <select
                value={asset.condition || ""}
                onChange={e => onChange("condition", e.target.value)}
                style={{ width: "100%", padding: "8px", fontSize: "14px" }}
              >
                <option value="">Select condition</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
          </div>
        </>
      )}

      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          {fieldLabel} ($)
        </label>
        <input
          type="number"
          placeholder="75000"
          value={asset.valueEstimate || ""}
          onChange={e => onChange("valueEstimate", e.target.value)}
          style={{ width: "100%", padding: "8px", fontSize: "14px" }}
        />
      </div>

      {uploadedImage && (
        <div style={{ marginTop: "20px" }}>
          <h4 style={{ marginBottom: "10px" }}>Uploaded Image:</h4>
          <img 
            src={uploadedImage} 
            alt="Asset document" 
            style={{ maxWidth: "100%", border: "1px solid #ccc", borderRadius: "4px" }}
          />
        </div>
      )}
    </div>
  );
}

export default AssetForm;
