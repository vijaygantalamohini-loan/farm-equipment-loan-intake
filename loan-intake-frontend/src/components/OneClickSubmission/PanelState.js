import React from "react";

import LoadingIndicator from "./LoadingIndicator";

function PanelState({
  loading,
  loadingLabel,
  error,
  errorActionLabel = "Retry",
  onErrorAction,
  children,
}) {
  if (loading) {
    return <LoadingIndicator label={loadingLabel || "Loading..."} />;
  }

  if (error) {
    return (
      <div>
        <div style={{ color: "#b00020", marginBottom: "8px" }}>{error}</div>
        {onErrorAction && (
          <button onClick={onErrorAction}>{errorActionLabel}</button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

export default PanelState;
