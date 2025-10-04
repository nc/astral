import {
  useEffect,
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  $getRoot,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
} from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { ArrowUp } from "lucide-react";
import type { EditorState } from "lexical";
import { ModelSelector } from "./ModelSelector";
import { actions } from "./store";

interface ChatComposerProps {
  chatId: string;
  selectedModel: string | null;
  input: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  shouldClear: boolean;
  onCleared: () => void;
  placeholder?: string;
  showModelSelector?: boolean;
  mode?: "chat" | "empty-space";
}

export interface ChatComposerRef {
  focus: () => void;
}

// Component to handle Enter key submission
function EnterKeyPressPlugin({
  onEnterKeyPress,
}: {
  onEnterKeyPress: () => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const removeListener = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent) => {
        if (event.shiftKey || event.metaKey || event.ctrlKey) {
          return false; // Allow shift+enter, cmd+enter, ctrl+enter for new lines
        }
        event.preventDefault();
        onEnterKeyPress();
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    return removeListener;
  }, [editor, onEnterKeyPress]);

  return null;
}

// Component to handle Escape key to blur editor
function EscapeKeyBlurPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const removeListener = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      (event: KeyboardEvent) => {
        event.preventDefault();
        editor.blur();
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    return removeListener;
  }, [editor]);

  return null;
}

// Component to clear editor content
function ClearEditorPlugin({
  shouldClear,
  onCleared,
}: {
  shouldClear: boolean;
  onCleared: () => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (shouldClear) {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
      });
      onCleared();
    }
  }, [shouldClear, editor, onCleared]);

  return null;
}

// Component to handle focus functionality
function FocusPlugin({
  onFocusSetup,
}: {
  onFocusSetup: (focusFn: () => void) => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const focusEditor = () => {
      editor.focus();
    };
    onFocusSetup(focusEditor);
  }, [editor, onFocusSetup]);

  return null;
}

const lexicalConfig = {
  namespace: "ChatInput",
  theme: {
    text: {
      bold: "editor-text-bold",
      italic: "editor-text-italic",
      underline: "editor-text-underline",
    },
  },
  onError: (error: Error) => {
    console.error("Lexical error:", error);
  },
};

export const ChatComposer = forwardRef<ChatComposerRef, ChatComposerProps>(
  (
    {
      chatId,
      selectedModel,
      input,
      isLoading,
      onInputChange,
      onSubmit,
      shouldClear,
      onCleared,
      placeholder = "How can I help you today?",
      showModelSelector = true,
      mode = "chat",
    },
    ref
  ) => {
    console.log(
      "Rendering ChatComposer for chatId:",
      chatId,
      "with input:",
      input
    );

    const [isFocused, setIsFocused] = useState(false);
    const composerRef = useRef<HTMLDivElement>(null);
    const focusFnRef = useRef<(() => void) | null>(null);

    // Expose focus method to parent components via ref
    useImperativeHandle(ref, () => ({
      focus: () => {
        if (focusFnRef.current) {
          focusFnRef.current();
        }
      },
    }));

    const handleFocusSetup = (focusFn: () => void) => {
      focusFnRef.current = focusFn;
    };

    // Measure and store the composer height
    useEffect(() => {
      const measureHeight = () => {
        if (composerRef.current) {
          const height = composerRef.current.offsetHeight;
          actions.setChatComposerHeight(height);
        }
      };

      // Measure initially
      measureHeight();

      // Use ResizeObserver to track height changes
      if (composerRef.current) {
        const resizeObserver = new ResizeObserver(measureHeight);
        resizeObserver.observe(composerRef.current);

        return () => {
          resizeObserver.disconnect();
        };
      }
    }, []);

    const handleEditorChange = (editorState: EditorState) => {
      editorState.read(() => {
        const root = $getRoot();
        const textContent = root.getTextContent();
        onInputChange(textContent);
      });
    };

    const handleSubmit = () => {
      if (!input.trim() || isLoading || !selectedModel) return;
      onSubmit();
    };

    const handleComposerClick = (e: React.MouseEvent) => {
      // Don't focus if clicking on buttons or other interactive elements
      const target = e.target as HTMLElement;
      const isInteractive =
        target.tagName === "BUTTON" ||
        target.closest("button") ||
        target.closest('[role="button"]') ||
        target.closest("[data-radix-dropdown-trigger]");

      if (!isInteractive && focusFnRef.current) {
        focusFnRef.current();
      }
    };

    return (
      <div
        ref={composerRef}
        style={{
          padding: "0px 8px 8px",
          width: "100%",
        }}
      >
        <div
          onClick={handleComposerClick}
          style={{
            position: "relative",
            width: "100%",
            backgroundColor: "rgb(30, 32, 32)",
            borderRadius: 9,
            border: isFocused ? "1px solid #5ba97d" : "1px solid transparent",
            transition: "border-color 0.2s ease",
            cursor: "text",
            boxShadow: "0 -1px 3px rgba(0, 0, 0, 0.2)",
          }}
        >
          <div>
            {/* Lexical Editor */}
            <div
              style={{
                marginBottom: "48px", // Leave space for model selector and send button
                position: "relative",
                width: "100%",
              }}
            >
              <LexicalComposer initialConfig={lexicalConfig}>
                <PlainTextPlugin
                  contentEditable={
                    <ContentEditable
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      style={{
                        backgroundColor: "transparent",
                        padding: "12px",
                        border: "none",
                        borderRadius: "0",
                        boxSizing: "border-box",
                        fontSize: "14px",
                        color: isFocused ? "#ffffff" : "#8d9693",
                        outline: "none",
                        minHeight: "48px",
                        resize: "none",
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: "400",
                        width: "100%",
                        lineHeight: "24px",
                        transition: "color 0.2s ease",
                      }}
                    />
                  }
                  placeholder={
                    <div
                      style={{
                        position: "absolute",
                        top: "0",
                        padding: 12,
                        left: "0",
                        color: "#8d9693",
                        fontSize: "14px",
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: "400",
                        lineHeight: "24px",
                        pointerEvents: "none",
                        userSelect: "none",
                      }}
                    >
                      {placeholder}
                    </div>
                  }
                  ErrorBoundary={LexicalErrorBoundary}
                />
                <EnterKeyPressPlugin onEnterKeyPress={handleSubmit} />
                <EscapeKeyBlurPlugin />
                <OnChangePlugin onChange={handleEditorChange} />
                <HistoryPlugin />
                <ClearEditorPlugin
                  shouldClear={shouldClear}
                  onCleared={onCleared}
                />
                <FocusPlugin onFocusSetup={handleFocusSetup} />
              </LexicalComposer>
            </div>

            {/* Model selector and send button positioned in bottom right */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "center",
                position: "absolute",
                bottom: "12px",
                right: "12px",
              }}
            >
              {showModelSelector && (
                <ModelSelector
                  chatId={chatId}
                  selectedModel={selectedModel}
                  mode={mode}
                />
              )}

              {/* Send button */}
              <button
                onClick={handleSubmit}
                disabled={isLoading || !input.trim() || !selectedModel}
                style={{
                  backgroundColor: "#5ba97d",
                  boxSizing: "border-box",
                  display: "flex",
                  gap: "12px",
                  height: "36px",
                  alignItems: "center",
                  paddingLeft: "12px",
                  paddingRight: "12px",
                  borderRadius: "9px",
                  cursor:
                    isLoading || !input.trim() || !selectedModel
                      ? "not-allowed"
                      : "pointer",
                  border: "none",
                  opacity:
                    isLoading || !input.trim() || !selectedModel ? 0.5 : 1,
                }}
              >
                <ArrowUp size={14} color="white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
