import React from "react";

import Tooltip from "./Tooltip";

const WHY_STYLE = {
  marginLeft: "6px",
  fontSize: "12px",
  color: "#6c757d",
  cursor: "help",
};

function WhyTooltip({ content, ariaLabel, label = "Why?" }) {
  return (
    <Tooltip content={content}>
      <span style={WHY_STYLE} aria-label={ariaLabel} role="button" tabIndex={0}>
        {label}
      </span>
    </Tooltip>
  );
}

export default WhyTooltip;
