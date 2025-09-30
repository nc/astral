import { useState } from "react";
import { actions } from "./store";
import { sendMessage } from "./api";
import { ChatComposer } from "./ChatComposer";

interface ChatEmptyStateProps {
  chatId: string;
  selectedModel: string | null;
  input: string;
  isLoading: boolean;
}

export function ChatEmptyState({
  chatId,
  selectedModel,
  input,
  isLoading,
}: ChatEmptyStateProps) {
  const [shouldClearEditor, setShouldClearEditor] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return "Good morning, Namit";
    } else if (hour < 17) {
      return "Good afternoon, Namit";
    } else {
      return "Good evening, Namit";
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || isLoading || !selectedModel) return;

    const userMessage = actions.createMessage("user", input);
    actions.addMessage(chatId, userMessage);
    actions.setLoading(chatId, true);
    actions.clearInput(chatId);
    setShouldClearEditor(true);

    // Create assistant message with empty content for streaming
    const assistantMessage = actions.createMessage("assistant", "");
    actions.addMessage(chatId, assistantMessage);
    actions.setStreamingMessageId(chatId, assistantMessage.id);

    // Build the full message history including the new user message
    const messageHistory = [userMessage].map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      await sendMessage(messageHistory, selectedModel, (chunk: string) => {
        actions.appendToMessage(chatId, assistantMessage.id, chunk);
      });
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      actions.updateMessageContent(
        chatId,
        assistantMessage.id,
        `❌ Error: ${errorMessage}`
      );
    } finally {
      actions.setLoading(chatId, false);
      actions.setStreamingMessageId(chatId, null);
    }
  };

  const handleInputChange = (value: string) => {
    actions.setInput(chatId, value);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        alignItems: "flex-start",
        justifyContent: "center",
        position: "relative",
        width: "100%",
        height: "100%",
        flex: 1,
      }}
    >
      {/* Greeting */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Inter', sans-serif",
          fontWeight: "600",
          justifyContent: "center",
          lineHeight: "0",
          fontStyle: "normal",
          opacity: "0.8",
          position: "relative",
          flexShrink: "0",
          fontSize: "14px",
          paddingLeft: "12px",
          color: "white",
          width: "100%",
        }}
      >
        <p style={{ lineHeight: "24px", margin: 0 }}>{getGreeting()}</p>
      </div>

      {/* ChatComposer with empty state styling */}
      <ChatComposer
        chatId={chatId}
        selectedModel={selectedModel}
        input={input}
        isLoading={isLoading}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        shouldClear={shouldClearEditor}
        onCleared={() => setShouldClearEditor(false)}
        placeholder="How can I help you today?"
        showModelSelector={true}
      />
    </div>
  );
}
