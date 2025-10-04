import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
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
            maxHeight: "80vh",
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
                  Settings
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

          {/* Empty placeholder content */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "48px 24px",
              fontFamily: "'Inter', sans-serif",
              fontSize: "14px",
              color: "#8d9693",
            }}
          >
            Settings coming soon...
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
