import React, { useState, useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { actions } from "../store";

interface RenameSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  currentName: string;
}

export function RenameSpaceModal({
  isOpen,
  onClose,
  spaceId,
  currentName,
}: RenameSpaceModalProps) {
  const [spaceName, setSpaceName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset the input when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      setSpaceName(currentName);
      // Focus the input after a short delay to ensure modal is rendered
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select(); // Select all text for easy replacement
        }
      }, 0);
    }
  }, [isOpen, currentName]);

  const handleSave = () => {
    try {
      actions.renameSpace(spaceId, spaceName);
      onClose();
    } catch (error) {
      console.warn("Cannot rename space:", error);
      // Could show error feedback here
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            position: "fixed",
            inset: 0,
            zIndex: 2000,
          }}
        />
        <Dialog.Content
          style={{
            backgroundColor: "#151817",
            borderRadius: "9px",
            padding: "24px",
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "560px",
            zIndex: 2001,
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            outline: "none",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              gap: "24px",
              alignItems: "flex-start",
              width: "100%",
            }}
          >
            <div
              style={{
                flexGrow: 1,
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: "600",
                  justifyContent: "center",
                  lineHeight: "0",
                  fontStyle: "normal",
                  color: "#edecec",
                  fontSize: "20px",
                  whiteSpace: "nowrap",
                }}
              >
                <p style={{ lineHeight: "24px", margin: 0, whiteSpace: "pre" }}>
                  Rename space
                </p>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                style={{
                  width: "24px",
                  height: "24px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={16} color="#8d9693" />
              </button>
            </Dialog.Close>
          </div>

          {/* Input */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              width: "100%",
            }}
          >
            <input
              ref={inputRef}
              value={spaceName}
              onChange={(e) => setSpaceName(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                backgroundColor: "#1e2020",
                border: "none",
                borderRadius: "8px",
                padding: "12px 16px",
                width: "100%",
                height: "36px",
                boxSizing: "border-box",
                fontFamily: "'Inter', sans-serif",
                fontWeight: "400",
                fontSize: "13px",
                color: "#edecec",
                lineHeight: "24px",
                outline: "none",
              }}
            />
          </div>

          {/* Buttons */}
          <div
            style={{
              display: "flex",
              gap: "13px",
              justifyContent: "flex-end",
              width: "100%",
            }}
          >
            <button
              onClick={handleSave}
              disabled={!spaceName.trim()}
              style={{
                backgroundColor: "#5ba97d",
                border: "none",
                borderRadius: "9px",
                padding: "8px 12px",
                height: "36px",
                cursor: spaceName.trim() ? "pointer" : "not-allowed",
                opacity: spaceName.trim() ? 1 : 0.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: "600",
                  fontSize: "14px",
                  color: "#edecec",
                  lineHeight: "20px",
                  whiteSpace: "pre",
                }}
              >
                Save
              </div>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}