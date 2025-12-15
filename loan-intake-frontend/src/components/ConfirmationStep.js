import React from "react";

function ConfirmationStep({ formData }) {
  const handleSubmitToBackend = async () => {
    try {
      const response = await fetch("http://localhost:8000/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        alert("Application submitted successfully!");
      } else {
        alert("Submission failed. Please try again.");
      }
    } catch (error) {
      console.error("Error submitting application:", error);
      alert("Error submitting application. Check backend connection.");
    }
  };

  return (
    <div>
      <h2>Confirmation</h2>
      <p>Review your application details before submission:</p>

      <pre style={{ textAlign: "left", background: "#f4f4f4", padding: "10px" }}>
        {JSON.stringify(formData, null, 2)}
      </pre>

      <button onClick={handleSubmitToBackend}>Submit Application</button>
    </div>
  );
}

export default ConfirmationStep;