import { type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as ScrollArea from "@radix-ui/react-scroll-area";

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: ReactNode;
  color?: string;
}

interface DropdownProps {
  trigger: ReactNode;
  options: DropdownOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxHeight?: number;
  width?: number;
}

export function Dropdown({
  trigger,
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  disabled = false,
  maxHeight = 200,
  width = 200,
}: DropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        {trigger}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderRadius: "9px",
            border: "1px solid var(--border-primary)",
            padding: "0px",
            zIndex: 1000,
            width: `${width}px`,
            maxHeight: `${maxHeight}px`,
            overflow: "hidden",
          }}
        >
          <ScrollArea.Root
            style={{
              width: "100%",
              height: "auto",
              maxHeight: `${maxHeight}px`,
              borderRadius: "9px",
            }}
          >
            <ScrollArea.Viewport
              style={{
                width: "100%",
                height: "auto",
                maxHeight: `${maxHeight}px`,
                padding: "4px",
                borderRadius: "9px",
              }}
            >
              {options.map((option) => (
                <DropdownMenu.Item
                  key={option.value}
                  onSelect={() =>
                    !option.disabled && onValueChange(option.value)
                  }
                  disabled={option.disabled}
                  style={{
                    fontSize: "14px",
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: "400",
                    color: option.disabled ? "#666" : option.color || "var(--text-primary)",
                    backgroundColor: "transparent",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    cursor: option.disabled ? "not-allowed" : "pointer",
                    outline: "none",
                    userSelect: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                  onMouseEnter={(e) => {
                    if (!option.disabled) {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        "var(--bg-hover)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "transparent";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flex: 1,
                    }}
                  >
                    {option.icon && (
                      <span style={{ display: "flex", alignItems: "center" }}>
                        {option.icon}
                      </span>
                    )}
                    <span>{option.label}</span>
                  </div>
                  {value === option.value && (
                    <div
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: "var(--accent-primary)",
                      }}
                    />
                  )}
                </DropdownMenu.Item>
              ))}
            </ScrollArea.Viewport>

            <ScrollArea.Scrollbar
              orientation="vertical"
              style={{
                display: "flex",
                userSelect: "none",
                touchAction: "none",
                padding: "2px",
                background: "transparent",
                transition: "background 160ms ease-out",
                width: "8px",
              }}
            >
              <ScrollArea.Thumb
                style={{
                  flex: 1,
                  background: "#4a5568",
                  borderRadius: "4px",
                  position: "relative",
                  transition: "background 160ms ease-out",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--accent-primary)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#4a5568";
                }}
              />
            </ScrollArea.Scrollbar>

            <ScrollArea.Corner style={{ background: "var(--bg-secondary)" }} />
          </ScrollArea.Root>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
