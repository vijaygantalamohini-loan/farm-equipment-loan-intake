import React, { useId, useState } from "react";

function Tooltip({ content, children }) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();
  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setVisible((prev) => !prev);
    }
    if (event.key === "Escape") {
      setVisible(false);
    }
  };

  return (
    <span
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      onKeyDown={handleKeyDown}
      aria-describedby={content ? tooltipId : undefined}
      aria-expanded={visible}
      style={{ position: "relative", display: "inline-block" }}
    >
      {children}
      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "120%",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#212529",
            color: "#fff",
            padding: "6px 10px",
            borderRadius: "4px",
            fontSize: "12px",
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}

export default Tooltip;
