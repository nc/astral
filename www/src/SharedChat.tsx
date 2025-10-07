import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface SharedChatData {
  chatName: string;
  model: string;
  messages: Message[];
  createdAt: number;
}

const customStyle = {
  ...vscDarkPlus,
  'pre[class*="language-"]': {
    ...vscDarkPlus['pre[class*="language-"]'],
    background: "transparent",
    margin: 0,
    padding: 0,
    fontSize: "13px",
    lineHeight: "24px",
  },
  'code[class*="language-"]': {
    ...vscDarkPlus['code[class*="language-"]'],
    background: "transparent",
    fontSize: "13px",
    lineHeight: "24px",
  },
};

export function SharedChat({ shareId }: { shareId: string }) {
  const [chatData, setChatData] = useState<SharedChatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSharedChat = async () => {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8787";
        const response = await fetch(`${backendUrl}/api/share/${shareId}`);

        if (!response.ok) {
          throw new Error("Failed to load shared chat");
        }

        const data = await response.json();
        setChatData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchSharedChat();
  }, [shareId]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100vw",
          height: "100vh",
          backgroundColor: "#151817",
          color: "#edecec",
        }}
      >
        <div>Loading shared chat...</div>
      </div>
    );
  }

  if (error || !chatData) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100vw",
          height: "100vh",
          backgroundColor: "#151817",
          color: "#edecec",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ fontSize: "18px" }}>Failed to load shared chat</div>
        <div style={{ fontSize: "14px", color: "#8d9693" }}>
          {error || "This link may be invalid or expired"}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        width: "100vw",
        height: "100vh",
        backgroundColor: "#151817",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          position: "relative",
          top: 8,
          height: "calc(100vh - 16px)",
          borderRadius: "12px",
          margin: "0px auto",
          display: "flex",
          flexDirection: "column",
          background: "var(--card-bg)",
          maxWidth: "800px",
          width: "100%",
        }}
      >
        <div
          style={{
            position: "relative",
            height: "calc(100vh - 16px)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              alignItems: "flex-end",
              width: "100%",
            }}
          >
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
                {chatData.model === "claude-sonnet-4-5-20250929"
                  ? "Claude Sonnet 4.5"
                  : chatData.model === "claude-opus-4-1-20250805"
                  ? "Claude Opus 4.1"
                  : chatData.model === "claude-3-5-sonnet-20241022"
                  ? "Claude Sonnet 4"
                  : chatData.model === "claude-3-5-haiku-20241022"
                  ? "Claude 3.5 Haiku"
                  : chatData.model === "claude-3-opus-20240229"
                  ? "Claude 3 Opus"
                  : chatData.model === "gpt-5-2025-08-07"
                  ? "GPT-5"
                  : chatData.model === "gpt-5-mini-2025-08-07"
                  ? "GPT-5 Mini"
                  : chatData.model === "gpt-5-nano-2025-08-07"
                  ? "GPT-5 Nano"
                  : chatData.model === "gpt-5-chat-latest"
                  ? "GPT-5 Chat"
                  : chatData.model === "gpt-4o"
                  ? "GPT-4o"
                  : chatData.model === "gpt-4o-mini"
                  ? "GPT-4o Mini"
                  : chatData.model === "gpt-4-turbo"
                  ? "GPT-4 Turbo"
                  : chatData.model === "gpt-3.5-turbo"
                  ? "GPT-3.5 Turbo"
                  : chatData.model === "o1-preview"
                  ? "o1-preview"
                  : chatData.model === "o1-mini"
                  ? "o1-mini"
                  : chatData.model}
              </div>
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
                Shared Chat
              </div>
            </div>
          </div>

          <div
            style={{
              width: "100%",
              display: "table",
              margin: "0 auto",
            }}
          >
            <ScrollArea.Root
              style={{
                flex: 1,
                height: "calc(100vh - 80px)",
              }}
            >
              <ScrollArea.Viewport
                style={{
                  width: "100%",
                  height: "100%",
                  padding: "24px 8px",
                }}
              >
                {chatData.messages.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      marginBottom: "10px",
                      maxWidth: "640px",
                      display: "table",
                      width: "100%",
                      padding: message.role === "user" ? "12px 12px" : "0px 8px",
                      margin: message.role === "user" ? "0px auto 12px" : "0px auto",
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
                              <strong style={{ fontWeight: "700", color: "#edecec" }}>
                                {children}
                              </strong>
                            ),
                            p: ({ children }) => (
                              <p style={{ margin: "0px 0px 24px 0px" }}>{children}</p>
                            ),
                            code: ({ node, inline, className, children, ...props }) => {
                              const match = /language-(\w+)/.exec(className || "");
                              const codeString = String(children).replace(/\n$/, "");

                              return !inline && match ? (
                                <ScrollArea.Root
                                  style={{
                                    width: "100%",
                                    maxWidth: "640px",
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
                                    <SyntaxHighlighter
                                      style={customStyle}
                                      language={match[1]}
                                      PreTag="div"
                                      customStyle={{
                                        background: "transparent",
                                        margin: 0,
                                        padding: 0,
                                      }}
                                      {...props}
                                    >
                                      {codeString}
                                    </SyntaxHighlighter>
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
                                    />
                                  </ScrollArea.Scrollbar>
                                  <ScrollArea.Corner style={{ background: "#1E2020" }} />
                                </ScrollArea.Root>
                              ) : (
                                <code
                                  className={className}
                                  style={{
                                    backgroundColor: "#1E2020",
                                    padding: "2px 4px",
                                    borderRadius: "3px",
                                    fontFamily: "monospace",
                                    fontSize: "13px",
                                  }}
                                  {...props}
                                >
                                  {children}
                                </code>
                              );
                            },
                            ul: ({ children }) => (
                              <ul style={{ margin: "0px 0px 24px 0px", paddingLeft: "20px" }}>
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol style={{ margin: "8px 0px", paddingLeft: "20px" }}>
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li style={{ margin: "0px 0px 0px" }}>{children}</li>
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
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      ) : (
                        <p style={{ margin: "0px" }}>{message.content}</p>
                      )}
                    </div>
                  </div>
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
                />
              </ScrollArea.Scrollbar>

              <ScrollArea.Corner style={{ background: "transparent" }} />
            </ScrollArea.Root>
          </div>
        </div>
      </div>
    </div>
  );
}
