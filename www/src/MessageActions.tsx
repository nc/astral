import React from "react";
import { Copy, Split, Share, RotateCcw, Check } from "lucide-react";
import { useSnapshot } from "valtio";
import * as Tooltip from "@radix-ui/react-tooltip";
import { actions, store } from "./store";
import { sendMessage, shareChat } from "./api";
import { ShareDialog } from "./ShareDialog";

interface MessageActionsProps {
  messageId: string;
  messageContent: string;
  chatId: string;
  isStreaming: boolean;
}

export function MessageActions({ messageId, messageContent, chatId, isStreaming }: MessageActionsProps) {
  const [copied, setCopied] = React.useState(false);
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false);
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);
  const [isSharing, setIsSharing] = React.useState(false);
  const snap = useSnapshot(store);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(messageContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBranch = () => {
    actions.branchChat(chatId);
  };

  const handleShare = async () => {
    setShareDialogOpen(true);
    setIsSharing(true);
    setShareUrl(null);

    try {
      const spaceId = snap.activeSpaceId;
      if (!spaceId) {
        console.error("No active space ID");
        setIsSharing(false);
        return;
      }

      const url = await shareChat(spaceId, chatId);
      setShareUrl(url);
    } catch (error) {
      console.error("Error sharing chat:", error);
    } finally {
      setIsSharing(false);
    }
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

    // Build message history BEFORE removing messages (up to and including the last user message)
    const messageHistory = chat.messages.slice(0, messageIndex).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Remove messages from this assistant message onwards
    chat.messages.splice(messageIndex);

    // Set up for resending
    actions.setLoading(chatId, true);

    // Create new assistant message for streaming
    const assistantMessage = actions.createMessage("assistant", "");
    actions.addMessage(chatId, assistantMessage);
    actions.setStreamingMessageId(chatId, assistantMessage.id);

    // Get space ID from snapshot
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
    border: "1px solid var(--border-primary)",
    borderRadius: "6px",
    padding: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.2s ease",
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-secondary)";
    (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-primary)";
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
    (e.currentTarget as HTMLElement).style.borderColor = "var(--border-primary)";
  };

  return (
    <>
      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        shareUrl={shareUrl}
        isLoading={isSharing}
      />
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
                <Check size={14} color="var(--accent-primary)" />
              ) : (
                <Copy size={14} color="var(--text-tertiary)" />
              )}
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              style={{
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-primary)",
                padding: "6px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                border: "1px solid var(--border-primary)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
              }}
              sideOffset={5}
            >
              Copy
              <Tooltip.Arrow
                style={{
                  fill: "var(--bg-secondary)",
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
              <Split size={14} color="var(--text-tertiary)" style={{ transform: "rotate(90deg)" }} />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              style={{
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-primary)",
                padding: "6px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                border: "1px solid var(--border-primary)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
              }}
              sideOffset={5}
            >
              Branch
              <Tooltip.Arrow
                style={{
                  fill: "var(--bg-secondary)",
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
              <Share size={14} color="var(--text-tertiary)" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              style={{
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-primary)",
                padding: "6px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                border: "1px solid var(--border-primary)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
              }}
              sideOffset={5}
            >
              Share
              <Tooltip.Arrow
                style={{
                  fill: "var(--bg-secondary)",
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
              <RotateCcw size={14} color="var(--text-tertiary)" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              style={{
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-primary)",
                padding: "6px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                border: "1px solid var(--border-primary)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
              }}
              sideOffset={5}
            >
              Try again
              <Tooltip.Arrow
                style={{
                  fill: "var(--bg-secondary)",
                }}
              />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>
    </Tooltip.Provider>
    </>
  );
}
