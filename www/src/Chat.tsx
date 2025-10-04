import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { Split, Ellipsis, Trash2, ChevronDown } from "lucide-react";
import { useSnapshot } from "valtio";
import { actions, store } from "./store";
import type { Chat as ChatType } from "./store";
import { sendMessage } from "./api";
import { ChatEmptyState } from "./ChatEmptyState";
import { ChatComposer, type ChatComposerRef } from "./ChatComposer";
import { Dropdown, type DropdownOption } from "./components/Dropdown";

interface ChatProps {
  chat: ChatType;
}

export function Chat({ chat }: ChatProps) {
  console.log(`Rendering Chat: ${chat.id} - ${chat.title}`);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [shouldClearEditor, setShouldClearEditor] = React.useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const chatComposerRef = useRef<ChatComposerRef>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = React.useState(true);
  const isInitialLoad = useRef(true);
  const snap = useSnapshot(store);
  const isActive = chat.id === snap.activeChatId;

  // Measure and store the header height
  useEffect(() => {
    const measureHeaderHeight = () => {
      if (headerRef.current) {
        const height = headerRef.current.offsetHeight;
        actions.setChatHeaderHeight(height);
      }
    };

    // Measure initially
    measureHeaderHeight();

    // Use ResizeObserver to track height changes
    if (headerRef.current) {
      const resizeObserver = new ResizeObserver(measureHeaderHeight);
      resizeObserver.observe(headerRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, []);

  // Check if user is near bottom of chat
  const checkIfNearBottom = () => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollArea;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setIsNearBottom(distanceFromBottom <= 48);
  };

  // Add scroll listener to track position
  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const handleScroll = () => {
      checkIfNearBottom();
    };

    scrollArea.addEventListener("scroll", handleScroll);

    // Check initially
    checkIfNearBottom();

    return () => {
      scrollArea.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Smart auto-scroll: only scroll when user is near bottom
  useEffect(() => {
    if (isNearBottom) {
      const behavior = isInitialLoad.current ? "auto" : "smooth";
      messagesEndRef.current?.scrollIntoView({ behavior });

      // After first scroll, mark as no longer initial load
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
      }
    }
  }, [chat.messages.length, chat.streamingMessageId, isNearBottom]);

  // Additional effect to scroll during streaming (when message content updates)
  useEffect(() => {
    if (chat.streamingMessageId && isNearBottom) {
      // Always smooth during streaming (never initial load during streaming)
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat.messages.map((m) => m.content).join(""), isNearBottom]);

  // Handle Enter key press to focus chat composer when this chat is active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Enter" &&
        isActive &&
        !e.shiftKey &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        // Only focus if the target is not already an input element
        const target = e.target as HTMLElement;
        const isInputElement =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable;

        if (
          !isInputElement &&
          chatComposerRef.current &&
          chat.messages.length > 0
        ) {
          e.preventDefault();
          chatComposerRef.current.focus();
        }
      }
    };

    if (isActive) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isActive, chat.messages.length]);

  const handleSubmit = async () => {
    if (!chat.input.trim() || chat.isLoading || !chat.model) return;

    const userMessage = actions.createMessage("user", chat.input);
    actions.addMessage(chat.id, userMessage);
    actions.setLoading(chat.id, true);
    actions.clearInput(chat.id);
    setShouldClearEditor(true);

    // Create assistant message with empty content for streaming
    const assistantMessage = actions.createMessage("assistant", "");
    actions.addMessage(chat.id, assistantMessage);
    actions.setStreamingMessageId(chat.id, assistantMessage.id);

    // Build the full message history including the new user message
    const messageHistory = [...chat.messages, userMessage].map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    console.log("Sending message history:", messageHistory);

    // Get the space ID for this chat
    const spaceId = snap.activeSpaceId;
    if (!spaceId) {
      console.error("No active space ID");
      actions.setLoading(chat.id, false);
      return;
    }

    try {
      await sendMessage(
        spaceId,
        chat.id,
        messageHistory,
        chat.model!,
        (chunk: string) => {
          actions.appendToMessage(chat.id, assistantMessage.id, chunk);
        }
      );
    } catch (error) {
      console.error("=== CHAT ERROR HANDLER ===");
      console.error("Error sending message:", error);
      console.error("Error type:", typeof error);
      console.error("Error instanceof Error:", error instanceof Error);
      if (error instanceof Error) {
        console.error("Error.message:", error.message);
        console.error("Error.stack:", error.stack);
      }
      console.error("Error keys:", Object.keys(error || {}));

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Final error message to display:", errorMessage);

      actions.updateMessageContent(
        chat.id,
        assistantMessage.id,
        `❌ Error: ${errorMessage}`
      );
      console.error("Error message updated in store");
    } finally {
      actions.setLoading(chat.id, false);
      actions.setStreamingMessageId(chat.id, null);
    }
  };

  const handleInputChange = (value: string) => {
    actions.setInput(chat.id, value);
  };

  const handleBranch = () => {
    actions.branchChat(chat.id);
  };

  const handleRemove = () => {
    try {
      actions.removeChat(chat.id);
    } catch (error) {
      // Could show a toast or alert here if needed
      console.warn("Cannot remove chat:", error);
    }
  };

  const handleChatAction = (action: string) => {
    switch (action) {
      case "remove":
        handleRemove();
        break;
      default:
        break;
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsNearBottom(true); // Update state to reflect new position
  };

  const chatMenuOptions: DropdownOption[] = [
    {
      value: "remove",
      label: "Remove Chat",
      icon: <Trash2 size={14} />,
      color: "#ff6b6b",
    },
  ];

  return (
    <div
      onClick={() => {
        if (!isActive) {
          console.log(`Clicking to activate chat: ${chat.id}`);
          actions.setActiveChat(chat.id);
        }
      }}
      onMouseEnter={(e) => {
        // if (!isActive) {
        //   (e.currentTarget as HTMLElement).style.boxShadow =
        //     "0 0 0 1px #5ba97d";
        // }
      }}
      onMouseLeave={(e) => {
        // if (!isActive) {
        //   (e.currentTarget as HTMLElement).style.boxShadow = "none";
        // }
      }}
      style={{
        position: "relative",
        top: 8,
        height: "calc(100vh - 16px)", // Subtract space header height (57px + border)
        borderRadius: "12px",
        margin: "0px 8px 0px 0px",
        display: "flex",
        flexDirection: "column",
        background: "var(--card-bg)",
        boxSizing: "border-box",
        flexShrink: 0,
        // boxShadow: isActive ? "0 0 0 2px #5ba97d" : "none",
        transition: "box-shadow 0.2s ease",
        cursor: isActive ? "default" : "pointer",
      }}
    >
      <div
        style={{
          position: "relative",
          height: "calc(100vh - 16px)",
        }}
      >
        <style>
          {`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
        `}
        </style>
        <div
          ref={headerRef}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            alignItems: "flex-end",
            width: "100%",
          }}
        >
          {/* Header buttons - right aligned */}
          <div
            style={{
              display: "flex",
              gap: "4px",
              width: "100%",
              justifyContent: "flex-end",
              boxShadow: "inset 0 -1px 0 0 #2d302f",
              padding: 8,
            }}
          >
            {/* Model name */}
            {chat.model && chat.messages.length > 0 && (
              <div
                style={{
                  border: "1px solid #2d302f",
                  borderRadius: "9px",
                  padding: "4px 12px",
                  fontSize: "14px",
                  color: "#8d9693",
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: "600",
                  lineHeight: "14px",
                  whiteSpace: "nowrap",
                }}
              >
                {chat.model === "claude-sonnet-4-5-20250929"
                  ? "Claude Sonnet 4.5"
                  : chat.model === "claude-opus-4-1-20250805"
                  ? "Claude Opus 4.1"
                  : chat.model === "claude-3-5-sonnet-20241022"
                  ? "Claude Sonnet 4"
                  : chat.model === "claude-3-5-haiku-20241022"
                  ? "Claude 3.5 Haiku"
                  : chat.model === "claude-3-opus-20240229"
                  ? "Claude 3 Opus"
                  : chat.model === "gpt-5-2025-08-07"
                  ? "GPT-5"
                  : chat.model === "gpt-5-mini-2025-08-07"
                  ? "GPT-5 Mini"
                  : chat.model === "gpt-5-nano-2025-08-07"
                  ? "GPT-5 Nano"
                  : chat.model === "gpt-5-chat-latest"
                  ? "GPT-5 Chat"
                  : chat.model === "gpt-4o"
                  ? "GPT-4o"
                  : chat.model === "gpt-4o-mini"
                  ? "GPT-4o Mini"
                  : chat.model === "gpt-4-turbo"
                  ? "GPT-4 Turbo"
                  : chat.model === "gpt-3.5-turbo"
                  ? "GPT-3.5 Turbo"
                  : chat.model === "o1-preview"
                  ? "o1-preview"
                  : chat.model === "o1-mini"
                  ? "o1-mini"
                  : chat.model}
              </div>
            )}

            {/* Branch button */}
            <button
              onClick={handleBranch}
              style={{
                backgroundColor: "#1e2020",
                border: "none",
                borderRadius: "9px",
                padding: "4px 12px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
                height: "24px",
              }}
            >
              <Split
                size={14}
                color="#8d9693"
                style={{ transform: "rotate(90deg)" }}
              />
              <span
                style={{
                  color: "#8d9693",
                  fontSize: "14px",
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: "600",
                  lineHeight: "14px",
                  whiteSpace: "nowrap",
                }}
              >
                Branch
              </span>
            </button>
            {/* Chat menu dropdown */}
            <Dropdown
              trigger={
                <button
                  style={{
                    backgroundColor: "#1e2020",
                    border: "none",
                    borderRadius: "9px",
                    padding: "4px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    height: "24px",
                    width: "38px",
                  }}
                >
                  <Ellipsis size={14} color="#8d9693" />
                </button>
              }
              options={chatMenuOptions}
              onValueChange={handleChatAction}
              width={200}
              maxHeight={120}
            />
          </div>
        </div>
        <div
          style={{
            width: "100%",
            display: "table",
            margin: "0 auto",
          }}
        >
          {chat.messages.length === 0 ? (
            <ChatEmptyState
              chatId={chat.id}
              selectedModel={chat.model}
              input={chat.input}
              spaceId={snap.activeSpaceId!}
              isLoading={chat.isLoading}
            />
          ) : (
            <ScrollArea.Root
              style={{
                flex: 1,
                height: `calc(100vh - ${
                  snap.chatHeaderHeight + snap.chatComposerHeight + 16
                }px)`, // 80px accounts for margins and padding
              }}
            >
              <ScrollArea.Viewport
                ref={scrollAreaRef}
                style={{
                  width: "100%",
                  height: "100%",
                  padding: "8px",
                  // paddingRight: "0px", // Add space for scrollbar,
                }}
              >
                {chat.messages.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      marginBottom: "10px",
                      maxWidth: "720px",
                      display: "table",
                      width: "100%",
                      padding:
                        message.role === "user" ? "12px 12px" : "8px 8px",
                      margin: message.role === "user" ? "0px auto" : "0px auto",
                      borderRadius: "9px",
                      color: "#FFFFFF",
                      backgroundColor:
                        message.role === "user" ? "#1E2020" : "transparent",
                    }}
                  >
                    <div
                      style={{
                        margin: "0px 0px",
                        color: "#edecec",
                        fontSize: "14px",
                        lineHeight: "24px",
                      }}
                    >
                      {message.role === "assistant" ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            strong: ({ children }) => (
                              <strong
                                style={{ fontWeight: "700", color: "#edecec" }}
                              >
                                {children}
                              </strong>
                            ),
                            p: ({ children }) => (
                              <p
                                style={{
                                  margin: "0px 0px 0px 0px",
                                }}
                              >
                                {children}
                              </p>
                            ),
                            code: ({ children }) => (
                              <code
                                style={{
                                  backgroundColor: "#1E2020",
                                  padding: "0px",
                                  borderRadius: "3px",
                                  fontFamily: "monospace",
                                  fontSize: "13px",
                                  lineHeight: "24px",
                                }}
                              >
                                {children}
                              </code>
                            ),
                            pre: ({ children }) => (
                              <ScrollArea.Root
                                style={{
                                  width: "100%",
                                  maxWidth: "720px",
                                  backgroundColor: "#1E2020",
                                  borderRadius: "9px",
                                  margin: "0px 0px 24px",
                                }}
                              >
                                <ScrollArea.Viewport
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    padding: "12px",
                                  }}
                                >
                                  <pre
                                    style={{
                                      backgroundColor: "transparent",
                                      padding: "0",
                                      margin: "0",
                                      fontSize: "14px",
                                      lineHeight: "24px",
                                      fontFamily: "monospace",
                                      color: "#edecec",
                                      whiteSpace: "pre",
                                      overflow: "visible",
                                    }}
                                  >
                                    {children}
                                  </pre>
                                </ScrollArea.Viewport>
                                <ScrollArea.Scrollbar
                                  orientation="horizontal"
                                  style={{
                                    display: "flex",
                                    userSelect: "none",
                                    touchAction: "none",
                                    padding: "2px",
                                    background: "transparent",
                                    transition: "background 160ms ease-out",
                                    height: "8px",
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
                                      (
                                        e.currentTarget as HTMLElement
                                      ).style.background = "#5ba97d";
                                    }}
                                    onMouseLeave={(e) => {
                                      (
                                        e.currentTarget as HTMLElement
                                      ).style.background = "#4a5568";
                                    }}
                                  />
                                </ScrollArea.Scrollbar>
                                <ScrollArea.Corner
                                  style={{ background: "#1E2020" }}
                                />
                              </ScrollArea.Root>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote
                                style={{
                                  borderLeft: "3px solid #ddd",
                                  paddingLeft: "12px",
                                  margin: "8px 0",
                                  fontStyle: "italic",
                                  color: "#666",
                                }}
                              >
                                {children}
                              </blockquote>
                            ),
                            ul: ({ children }) => (
                              <ul
                                style={{
                                  margin: "0px 0px 24px 0px",
                                  paddingLeft: "20px",
                                }}
                              >
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol
                                style={{
                                  margin: "8px 0px",
                                  paddingLeft: "20px",
                                }}
                              >
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li style={{ margin: "0px 0px 0px" }}>
                                {children}
                              </li>
                            ),
                            h1: ({ children }) => (
                              <h1
                                style={{
                                  fontSize: "24px",
                                  margin: "16px 0 12px 0",
                                  lineHeight: "24px",
                                  fontWeight: "600",
                                }}
                              >
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2
                                style={{
                                  fontSize: "20px",
                                  margin: "24px 0 24px 0",
                                  fontWeight: "600",
                                  lineHeight: "24px",
                                }}
                              >
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3
                                style={{
                                  fontSize: "16px",
                                  margin: "16px 0 12px 0",
                                  fontWeight: "600",
                                  lineHeight: "24px",
                                }}
                              >
                                {children}
                              </h3>
                            ),
                            table: ({ children }) => (
                              <ScrollArea.Root
                                style={{
                                  width: "100%",
                                  maxWidth: "720px",
                                  margin: "16px 0",
                                }}
                              >
                                <ScrollArea.Viewport
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                  }}
                                >
                                  <table
                                    style={{
                                      borderCollapse: "collapse",
                                      width: "100%",
                                      fontSize: "14px",
                                      lineHeight: "24px",
                                    }}
                                  >
                                    {children}
                                  </table>
                                </ScrollArea.Viewport>
                                <ScrollArea.Scrollbar
                                  orientation="horizontal"
                                  style={{
                                    display: "flex",
                                    userSelect: "none",
                                    touchAction: "none",
                                    padding: "2px",
                                    background: "transparent",
                                    height: "8px",
                                  }}
                                >
                                  <ScrollArea.Thumb
                                    style={{
                                      flex: 1,
                                      background: "#4a5568",
                                      borderRadius: "4px",
                                      position: "relative",
                                    }}
                                  />
                                </ScrollArea.Scrollbar>
                              </ScrollArea.Root>
                            ),
                            tbody: ({ children }) => <tbody>{children}</tbody>,
                            tr: ({ children }) => (
                              <tr
                                style={{
                                  borderBottom: "1px solid #2d302f",
                                }}
                              >
                                {children}
                              </tr>
                            ),
                            th: ({ children }) => (
                              <th
                                style={{
                                  padding: "4px 4px 2px",
                                  textAlign: "left",
                                  fontWeight: "600",
                                  color: "#edecec",
                                  borderBottom: "2px solid #2d302f",
                                }}
                              >
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td
                                style={{
                                  padding: "4px 4px 3px",
                                  color: "#edecec",
                                }}
                              >
                                {children}
                              </td>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      ) : (
                        <p style={{ margin: "0" }}>{message.content}</p>
                      )}
                      {chat.streamingMessageId === message.id && (
                        <span
                          style={{
                            animation: "blink 1s infinite",
                            marginLeft: "2px",
                          }}
                        >
                          ▋
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {chat.isLoading && !chat.streamingMessageId && (
                  <div
                    style={{
                      padding: "10px",
                      fontStyle: "italic",
                      color: "#666",
                    }}
                  >
                    Claude is typing...
                  </div>
                )}

                {/* Auto-scroll anchor */}
                <div ref={messagesEndRef} />
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
                    (e.currentTarget as HTMLElement).style.background =
                      "#5ba97d";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "#4a5568";
                  }}
                />
              </ScrollArea.Scrollbar>

              <ScrollArea.Corner style={{ background: "transparent" }} />
            </ScrollArea.Root>
          )}

          {/* Floating scroll to bottom button */}
          {chat.messages.length > 0 && !isNearBottom && (
            <button
              onClick={scrollToBottom}
              style={{
                position: "absolute",
                bottom: `${snap.chatComposerHeight + 16}px`, // Position above chat composer
                left: "50%",
                transform: "translateX(-50%)",
                backgroundColor: "#1e2020",
                border: "1px solid #2d302f",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: 10,
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "#2d302f";
                (e.currentTarget as HTMLElement).style.transform =
                  "translateX(-50%) scale(1.05)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "#1e2020";
                (e.currentTarget as HTMLElement).style.transform =
                  "translateX(-50%) scale(1)";
              }}
            >
              <ChevronDown size={20} color="#8d9693" />
            </button>
          )}

          {chat.messages.length > 0 && (
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
              <div
                style={{
                  maxWidth: 744,
                  width: "100%",
                  display: "table",
                  margin: "0 auto",
                }}
              >
                <ChatComposer
                  ref={chatComposerRef}
                  chatId={chat.id}
                  selectedModel={chat.model}
                  input={chat.input}
                  isLoading={chat.isLoading}
                  onInputChange={handleInputChange}
                  onSubmit={handleSubmit}
                  shouldClear={shouldClearEditor}
                  onCleared={() => setShouldClearEditor(false)}
                  placeholder="Type your message..."
                  showModelSelector={false}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
