import * as Dialog from "@radix-ui/react-dialog";
import { X, Check } from "lucide-react";
import { useSnapshot } from "valtio";
import { store, actions } from "../store";
import { themes } from "../themes";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const snap = useSnapshot(store);

  const handleThemeChange = (themeName: string) => {
    actions.setTheme(themeName);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            backgroundColor: "var(--modal-overlay)",
            position: "fixed",
            inset: 0,
            zIndex: 2000,
          }}
        />
        <Dialog.Content
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "var(--bg-primary)",
            borderRadius: "12px",
            padding: "24px",
            width: "90vw",
            maxWidth: "560px",
            maxHeight: "80vh",
            overflowY: "auto",
            border: "1px solid var(--border-primary)",
            zIndex: 2001,
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
            outline: "none",
          }}
        >
          <Dialog.Title
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "24px",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Settings
          </Dialog.Title>

          <Dialog.Close asChild>
            <button
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "4px",
                transition: "background-color 0.2s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
              }}
            >
              <X size={20} color="var(--text-tertiary)" />
            </button>
          </Dialog.Close>

          {/* Theme Selector */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "16px",
                fontWeight: "600",
                color: "var(--text-primary)",
              }}
            >
              Theme
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "8px",
              }}
            >
              {Object.values(themes).map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => handleThemeChange(theme.name)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderRadius: "6px",
                    backgroundColor: snap.theme === theme.name ? "var(--accent-primary)" : "var(--bg-secondary)",
                    border: `1px solid ${snap.theme === theme.name ? "var(--accent-primary)" : "var(--border-primary)"}`,
                    color: snap.theme === theme.name ? "var(--button-primary-text)" : "var(--text-secondary)",
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (snap.theme !== theme.name) {
                      e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (snap.theme !== theme.name) {
                      e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                    }
                  }}
                >
                  <span>{theme.displayName}</span>
                  {snap.theme === theme.name && (
                    <Check size={16} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
