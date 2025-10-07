import React from "react";
import { Copy, Split, Share, RotateCcw, Check } from "lucide-react";
import { useSnapshot } from "valtio";
import * as Tooltip from "@radix-ui/react-tooltip";
import { actions, store } from "./store";
import { sendMessage } from "./api";

interface MessageActionsProps {
  messageId: string;
  messageContent: string;
  chatId: string;
  isStreaming: boolean;
}

export function MessageActions({ messageId, messageContent, chatId, isStreaming }: MessageActionsProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(messageContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBranch = () => {
    actions.branchChat(chatId);
  };

  const handleShare = () => {
    // TODO: Implement share functionality
    console.log("Share message:", messageId);
  };

  const handleTryAgain = () => {
    // Find the chat
    const chat = actions.findChat(chatId);
    if (!chat) return;

    const messageIndex = chat.messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    // Get the last user message (should be right before this assistant message)
    const lastUserMessage = chat.messages[messageIndex - 1];
    if (!lastUserMessage || lastUserMessage.role !== "user") return;

    // Remove messages from this assistant message onwards
    chat.messages.splice(messageIndex);

    // Set up for resending
    actions.setLoading(chatId, true);

    // Create new assistant message for streaming
    const assistantMessage = actions.createMessage("assistant", "");
    actions.addMessage(chatId, assistantMessage);
    actions.setStreamingMessageId(chatId, assistantMessage.id);

    // Build message history (up to and including the last user message)
    const messageHistory = chat.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Get space ID
    const snap = useSnapshot(store);
    const spaceId = snap.activeSpaceId;
    if (!spaceId) {
      console.error("No active space ID");
      actions.setLoading(chatId, false);
      return;
    }

    // Send message
    sendMessage(
      spaceId,
      chatId,
      messageHistory,
      chat.model!,
      (chunk: string) => {
        actions.appendToMessage(chatId, assistantMessage.id, chunk);
      }
    ).catch((error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      actions.updateMessageContent(
        chatId,
        assistantMessage.id,
        `❌ Error: ${errorMessage}`
      );
    }).finally(() => {
      actions.setLoading(chatId, false);
      actions.setStreamingMessageId(chatId, null);
    });
  };

  if (isStreaming) return null;

  const buttonStyle = {
    backgroundColor: "transparent",
    border: "1px solid #2d302f",
    borderRadius: "6px",
    padding: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.2s ease",
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLElement).style.backgroundColor = "#1e2020";
    (e.currentTarget as HTMLElement).style.borderColor = "#5ba97d";
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
    (e.currentTarget as HTMLElement).style.borderColor = "#2d302f";
  };

  return (
    <Tooltip.Provider delayDuration={300}>
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginTop: "0px",
          marginBottom: "24px",
          opacity: 0.8,
        }}
      >
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              onClick={handleCopy}
              style={buttonStyle}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {copied ? (
                <Check size={14} color="#5ba97d" />
              ) : (
                <Copy size={14} color="#8d9693" />
              )}
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              style={{
                backgroundColor: "#1e2020",
                color: "#edecec",
                padding: "6px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                border: "1px solid #2d302f",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
              }}
              sideOffset={5}
            >
              Copy
              <Tooltip.Arrow
                style={{
                  fill: "#1e2020",
                }}
              />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>

        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              onClick={handleBranch}
              style={buttonStyle}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <Split size={14} color="#8d9693" style={{ transform: "rotate(90deg)" }} />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              style={{
                backgroundColor: "#1e2020",
                color: "#edecec",
                padding: "6px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                border: "1px solid #2d302f",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
              }}
              sideOffset={5}
            >
              Branch
              <Tooltip.Arrow
                style={{
                  fill: "#1e2020",
                }}
              />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>

        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              onClick={handleShare}
              style={buttonStyle}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <Share size={14} color="#8d9693" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              style={{
                backgroundColor: "#1e2020",
                color: "#edecec",
                padding: "6px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                border: "1px solid #2d302f",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
              }}
              sideOffset={5}
            >
              Share
              <Tooltip.Arrow
                style={{
                  fill: "#1e2020",
                }}
              />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>

        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              onClick={handleTryAgain}
              style={buttonStyle}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <RotateCcw size={14} color="#8d9693" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              style={{
                backgroundColor: "#1e2020",
                color: "#edecec",
                padding: "6px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                border: "1px solid #2d302f",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
              }}
              sideOffset={5}
            >
              Try again
              <Tooltip.Arrow
                style={{
                  fill: "#1e2020",
                }}
              />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>
    </Tooltip.Provider>
  );
}
