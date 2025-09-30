import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { Check } from "lucide-react";
import { actions } from "../store";

interface MultiModelSelectorProps {
  selectedModels: string[];
}

const AVAILABLE_MODELS = [
  // Anthropic Models - Latest
  {
    id: "claude-sonnet-4-5-20250929",
    name: "Claude Sonnet 4.5",
    displayName: "Claude Sonnet 4.5",
    description: "Anthropic's newest and most advanced model (Sep 2025)",
    provider: "Anthropic",
  },
  {
    id: "claude-opus-4-1-20250805",
    name: "Claude Opus 4.1",
    displayName: "Claude Opus 4.1",
    description: "Anthropic's most advanced coding model (Aug 2025)",
    provider: "Anthropic",
  },
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    displayName: "Claude Sonnet 4",
    description: "Anthropic's most capable, balanced speed and quality",
    provider: "Anthropic",
  },
  {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    displayName: "Claude 3.5 Haiku",
    description: "Anthropic's fastest, most cost-effective",
    provider: "Anthropic",
  },
  {
    id: "claude-3-opus-20240229",
    name: "Claude 3 Opus",
    displayName: "Claude 3 Opus",
    description: "Anthropic's most capable, slower",
    provider: "Anthropic",
  },

  // OpenAI Models - GPT-5 Series (Latest 2025)
  {
    id: "gpt-5-2025-08-07",
    name: "GPT-5",
    displayName: "GPT-5",
    description:
      "OpenAI's most advanced model with 400K context (requires registration)",
    provider: "OpenAI",
  },
  {
    id: "gpt-5-mini-2025-08-07",
    name: "GPT-5 Mini",
    displayName: "GPT-5 Mini",
    description: "Faster, cost-effective GPT-5 variant",
    provider: "OpenAI",
  },
  {
    id: "gpt-5-nano-2025-08-07",
    name: "GPT-5 Nano",
    displayName: "GPT-5 Nano",
    description: "Ultra-fast, lightweight GPT-5 variant",
    provider: "OpenAI",
  },
  {
    id: "gpt-5-chat-latest",
    name: "GPT-5 Chat",
    displayName: "GPT-5 Chat",
    description: "Optimized GPT-5 for conversational tasks",
    provider: "OpenAI",
  },

  // OpenAI Models - Previous Generation
  {
    id: "gpt-4o",
    name: "GPT-4o",
    displayName: "GPT-4o",
    description: "OpenAI's flagship multimodal model",
    provider: "OpenAI",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    displayName: "GPT-4o Mini",
    description: "Smaller, faster, cost-effective version of GPT-4o",
    provider: "OpenAI",
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    displayName: "GPT-4 Turbo",
    description: "High-intelligence model for complex tasks",
    provider: "OpenAI",
  },
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    displayName: "GPT-3.5 Turbo",
    description: "Fast, capable, and cost-effective",
    provider: "OpenAI",
  },

  // Reasoning Models
  {
    id: "o1-preview",
    name: "o1-preview",
    displayName: "o1-preview",
    description: "OpenAI's reasoning model for complex problems",
    provider: "OpenAI",
  },
  {
    id: "o1-mini",
    name: "o1-mini",
    displayName: "o1-mini",
    description: "Faster reasoning model for coding and STEM",
    provider: "OpenAI",
  },
];

export function MultiModelSelector({ selectedModels }: MultiModelSelectorProps) {
  const getDisplayText = () => {
    if (selectedModels.length === 0) {
      return "Select a model";
    } else if (selectedModels.length === 1) {
      const model = AVAILABLE_MODELS.find(m => m.id === selectedModels[0]);
      return model?.displayName || "Select a model";
    } else {
      const modelNames = selectedModels
        .map(id => AVAILABLE_MODELS.find(m => m.id === id)?.displayName)
        .filter(Boolean);
      return modelNames.join(", ");
    }
  };

  const handleModelToggle = (modelId: string, shiftKey: boolean) => {
    console.log(`MultiModelSelector: handleModelToggle called with modelId=${modelId}, shiftKey=${shiftKey}`);
    actions.toggleEmptySpaceModel(modelId, shiftKey);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <div
          style={{
            backgroundColor: "#1e2020",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingLeft: "12px",
            paddingRight: "12px",
            paddingTop: "4px",
            paddingBottom: "4px",
            borderRadius: "9px",
            cursor: "pointer",
            border: "none",
            gap: "4px",
          }}
        >
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: "400",
              fontSize: "14px",
              color: "#8d9693",
              lineHeight: "14px",
              whiteSpace: "nowrap",
            }}
          >
            {getDisplayText()}
          </div>
          <div style={{ width: "16px", height: "16px" }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 6L8 10L12 6"
                stroke="#8d9693"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          style={{
            backgroundColor: "#1e2020",
            borderRadius: "9px",
            border: "1px solid #2d302f",
            padding: "0px",
            zIndex: 1000,
            width: "300px",
            maxHeight: "300px",
            overflow: "hidden",
          }}
        >
          <ScrollArea.Root
            style={{
              width: "100%",
              height: "auto",
              maxHeight: "300px",
              borderRadius: "9px",
            }}
          >
            <ScrollArea.Viewport
              style={{
                width: "100%",
                height: "auto",
                maxHeight: "300px",
                padding: "4px",
                borderRadius: "9px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontFamily: "'Inter', sans-serif",
                  color: "#8d9693",
                  padding: "8px 12px 4px",
                  fontWeight: "600",
                }}
              >
                Hold Shift to select multiple models
              </div>
                {AVAILABLE_MODELS.map((model) => {
                  const isSelected = selectedModels.includes(model.id);
                  return (
                    <div
                      key={model.id}
                      onClick={(e) => {
                        // Handle the click with access to shiftKey
                        e.preventDefault();
                        e.stopPropagation();
                        handleModelToggle(model.id, e.shiftKey);
                      }}
                      style={{
                        fontSize: "14px",
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: "400",
                        color: "#fdfdfd",
                        backgroundColor: isSelected ? "#2d302f" : "transparent",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        outline: "none",
                        userSelect: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = "#2d302f";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                        }
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        {model.displayName}
                      </div>
                      {isSelected && (
                        <Check
                          size={14}
                          style={{
                            color: "#5ba97d",
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar
              orientation="vertical"
              style={{
                display: "flex",
                userSelect: "none",
                touchAction: "none",
                padding: "2px",
                background: "transparent",
                width: "8px",
              }}
            >
              <ScrollArea.Thumb
                style={{
                  flex: 1,
                  background: "#8d9693",
                  borderRadius: "4px",
                  position: "relative",
                }}
              />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}