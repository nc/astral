import { Dropdown, type DropdownOption } from "./components/Dropdown";
import { MultiModelSelector } from "./components/MultiModelSelector";
import { store, actions } from "./store";
import { useSnapshot } from "valtio";

interface ModelSelectorProps {
  chatId: string;
  selectedModel: string | null;
  mode?: 'chat' | 'empty-space';
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

export function ModelSelector({ chatId, selectedModel, mode = 'chat' }: ModelSelectorProps) {
  const snap = useSnapshot(store);

  // For empty-space mode, use the multi-model selector
  if (mode === 'empty-space') {
    return <MultiModelSelector selectedModels={snap.emptySpaceModels} />;
  }

  // Regular single-model selector for chat mode
  const selectedModelInfo = AVAILABLE_MODELS.find(
    (model) => model.id === selectedModel
  );
  const displayText = selectedModelInfo?.displayName || "Select a model";

  const handleModelSelect = (modelId: string) => {
    actions.setModel(chatId, modelId);
  };

  // Convert models to dropdown options
  const options: DropdownOption[] = AVAILABLE_MODELS.map((model) => ({
    value: model.id,
    label: model.displayName,
  }));

  // Create trigger element
  const trigger = (
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
        {displayText}
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
  );

  return (
    <Dropdown
      trigger={trigger}
      options={options}
      value={selectedModel || undefined}
      onValueChange={handleModelSelect}
      placeholder="Select a model"
      maxHeight={300}
      width={167}
    />
  );
}