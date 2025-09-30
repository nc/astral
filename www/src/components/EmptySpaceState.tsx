import { useState } from "react";
import { useSnapshot } from "valtio";
import { store, actions } from "../store";
import { ChatComposer } from "../ChatComposer";
import { sendMessage } from "../api";

interface EmptySpaceStateProps {
  spaceId: string;
}

export function EmptySpaceState({ spaceId }: EmptySpaceStateProps) {
  const snap = useSnapshot(store);
  const [shouldClear, setShouldClear] = useState(false);

  const handleInputChange = (value: string) => {
    actions.setEmptySpaceInput(value);
  };

  const handleSubmit = async () => {
    console.log("EmptySpaceState handleSubmit called", {
      input: snap.emptySpaceInput,
      selectedModels: snap.emptySpaceModels,
    });

    if (!snap.emptySpaceInput.trim() || snap.emptySpaceModels.length === 0) {
      console.log("EmptySpaceState handleSubmit early return", {
        inputTrim: snap.emptySpaceInput.trim(),
        selectedModels: snap.emptySpaceModels,
      });
      return;
    }

    console.log(
      `EmptySpaceState: Creating ${snap.emptySpaceModels.length} chats with message`
    );

    const userMessageText = snap.emptySpaceInput.trim();
    const selectedModels = [...snap.emptySpaceModels]; // Copy the array

    // Clear the empty space state and trigger composer clear
    actions.clearEmptySpaceState();
    setShouldClear(true);

    // Create a chat for each selected model and start generation
    for (let i = 0; i < selectedModels.length; i++) {
      const model = selectedModels[i];

      // Create chat with model-specific title if multiple models
      const chatTitle =
        selectedModels.length > 1
          ? `New Chat (${model.split("-")[0]})` // e.g., "New Chat (claude)"
          : "New Chat";

      const chat = actions.createChat(spaceId, chatTitle);
      actions.setModel(chat.id, model);

      // Add the user message
      const userMessage = actions.createMessage("user", userMessageText);
      actions.addMessage(chat.id, userMessage);

      // Set loading state and create assistant message
      actions.setLoading(chat.id, true);
      const assistantMessage = actions.createMessage("assistant", "");
      actions.addMessage(chat.id, assistantMessage);
      actions.setStreamingMessageId(chat.id, assistantMessage.id);

      // Set the first chat as active
      if (i === 0) {
        actions.setActiveChat(chat.id);
      }

      // Build the message history for the API call
      const messageHistory = [userMessage].map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      console.log(`Sending message to ${model}:`, messageHistory);

      // Start generation for this chat (don't await - let them run in parallel)
      sendMessage(messageHistory, model, (chunk: string) => {
        actions.appendToMessage(chat.id, assistantMessage.id, chunk);
      })
        .catch((error) => {
          console.error(
            `EmptySpaceState: Error sending message to ${model}:`,
            error
          );
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred";

          actions.updateMessageContent(
            chat.id,
            assistantMessage.id,
            `❌ Error: ${errorMessage}`
          );
        })
        .finally(() => {
          actions.setLoading(chat.id, false);
          actions.setStreamingMessageId(chat.id, null);
        });
    }
  };

  const handleCleared = () => {
    setShouldClear(false);
  };

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

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "560px",
          maxWidth: "90%",
          display: "flex",
          flexDirection: "column",
          gap: "41px",
          alignItems: "center",
        }}
      >
        {/* Greeting */}
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: "500",
            fontSize: "24px",
            lineHeight: "24px",
            textAlign: "center",
            color: "white",
            opacity: "0.6",
          }}
        >
          {getGreeting()}
        </div>

        <ChatComposer
          chatId="empty-space" // Use a special ID for empty space
          selectedModel={snap.emptySpaceModels[0] || null} // Pass first selected model for compatibility
          input={snap.emptySpaceInput}
          isLoading={false}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          shouldClear={shouldClear}
          onCleared={handleCleared}
          placeholder="How can I help you today?"
          showModelSelector={true}
          mode="empty-space" // Pass mode to ChatComposer
        />
      </div>
    </div>
  );
}
