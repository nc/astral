import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Copy, X, Check } from "lucide-react";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string | null;
  isLoading: boolean;
}

export function ShareDialog({ open, onOpenChange, shareUrl, isLoading }: ShareDialogProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "var(--modal-overlay)",
            zIndex: 1000,
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
            maxWidth: "500px",
            border: "1px solid var(--border-primary)",
            zIndex: 1001,
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          }}
        >
          <Dialog.Title
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "16px",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Share Chat
          </Dialog.Title>

          <Dialog.Description
            style={{
              margin: 0,
              fontSize: "14px",
              color: "var(--text-tertiary)",
              marginBottom: "20px",
              fontFamily: "'Inter', sans-serif",
              lineHeight: "20px",
            }}
          >
            Anyone with this link can view this chat. The shared version is a snapshot and won't include future messages.
          </Dialog.Description>

          {isLoading ? (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                color: "var(--text-tertiary)",
                fontSize: "14px",
              }}
            >
              Creating shareable link...
            </div>
          ) : shareUrl ? (
            <div>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginBottom: "16px",
                }}
              >
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  style={{
                    flex: 1,
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-primary)",
                    borderRadius: "6px",
                    padding: "10px 12px",
                    color: "var(--text-primary)",
                    fontSize: "14px",
                    fontFamily: "'Inter', sans-serif",
                    outline: "none",
                  }}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={handleCopy}
                  style={{
                    backgroundColor: copied ? "var(--accent-primary)" : "var(--bg-secondary)",
                    border: "1px solid var(--border-primary)",
                    borderRadius: "6px",
                    padding: "10px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    color: copied ? "#ffffff" : "var(--text-primary)",
                    fontSize: "14px",
                    fontWeight: 600,
                    fontFamily: "'Inter', sans-serif",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    if (!copied) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-hover)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!copied) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-secondary)";
                    }
                  }}
                >
                  {copied ? (
                    <>
                      <Check size={16} />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                color: "#ff6b6b",
                fontSize: "14px",
              }}
            >
              Failed to create shareable link
            </div>
          )}

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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
