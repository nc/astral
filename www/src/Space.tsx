import { useSnapshot } from "valtio";
import { useEffect, useRef } from "react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { store, actions } from "./store";
import type { Space as SpaceType } from "./store";
import { Chat } from "./Chat";
import { EmptySpaceState } from "./components/EmptySpaceState";

interface SpaceProps {
  space: SpaceType;
}

export function Space({ space }: SpaceProps) {
  const snap = useSnapshot(store);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const chatRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const isInitialMount = useRef(true);
  const previousActiveChatId = useRef(snap.activeChatId);


  // Function to scroll to make a specific chat fully visible
  const scrollToChatIfNeeded = (chatId: string, useSmooth = false) => {
    const viewport = scrollViewportRef.current;
    const chatElement = chatRefs.current.get(chatId);

    if (!viewport || !chatElement) {
      console.log("Cannot scroll: missing viewport or chat element", {
        viewport: !!viewport,
        chatElement: !!chatElement,
      });
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const chatRect = chatElement.getBoundingClientRect();

    console.log("Scroll check:", {
      viewportLeft: viewportRect.left,
      viewportRight: viewportRect.right,
      chatLeft: chatRect.left,
      chatRight: chatRect.right,
      chatWidth: chatRect.width,
    });

    // Check if chat is fully visible
    const isFullyVisible =
      chatRect.left >= viewportRect.left &&
      chatRect.right <= viewportRect.right;

    if (!isFullyVisible) {
      // Calculate scroll position to center the chat
      const viewportWidth = viewportRect.width;
      const chatWidth = chatRect.width;
      const chatLeftRelativeToViewport = chatRect.left - viewportRect.left;

      // Calculate target scroll position to center the chat
      const targetScrollLeft =
        viewport.scrollLeft +
        chatLeftRelativeToViewport -
        (viewportWidth - chatWidth) / 2;

      console.log("Scrolling to make chat visible:", {
        currentScrollLeft: viewport.scrollLeft,
        targetScrollLeft,
        chatLeftRelativeToViewport,
        useSmooth,
      });

      // Use smooth scroll only when explicitly requested (keyboard navigation)
      const behavior = useSmooth ? "smooth" : "auto";
      viewport.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior,
      });
    } else {
      console.log("Chat is already fully visible, no scroll needed");
    }
  };

  // Handle keyboard navigation for chat switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        // Cmd/Ctrl key pressed
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();

          const currentChatIndex = space.chatOrder.findIndex(
            (chatId) => chatId === snap.activeChatId
          );
          if (currentChatIndex === -1) return; // No active chat found

          let nextIndex: number;
          if (e.key === "ArrowLeft") {
            // Go to previous chat (left)
            nextIndex =
              currentChatIndex > 0
                ? currentChatIndex - 1
                : space.chatOrder.length - 1;
          } else {
            // Go to next chat (right)
            nextIndex =
              currentChatIndex < space.chatOrder.length - 1
                ? currentChatIndex + 1
                : 0;
          }

          const nextChatId = space.chatOrder[nextIndex];
          if (nextChatId) {
            console.log(
              `Switching chat: ${e.key} from ${currentChatIndex} to ${nextIndex}`
            );
            actions.setActiveChat(nextChatId);

            // Scroll to make the new active chat visible (force smooth for keyboard navigation)
            setTimeout(() => scrollToChatIfNeeded(nextChatId, true), 100);
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [space.chatOrder, snap.activeChatId]);

  // Reset scroll position when space changes
  useEffect(() => {
    // Reset the initial mount flag when space changes
    isInitialMount.current = true;

    // Try scrolling immediately
    const viewport = scrollViewportRef.current;
    if (viewport) {
      console.log("Scrolling to beginning immediately for space:", space.id);
      viewport.scrollTo({ left: 0, behavior: "auto" });
    }

    // Also try with setTimeout 0 to ensure it happens after render
    const timeout = setTimeout(() => {
      const viewport = scrollViewportRef.current;
      if (viewport) {
        console.log("Scrolling to beginning (deferred) for space:", space.id);
        viewport.scrollTo({ left: 0, behavior: "auto" });
      }
    }, 0);

    // Mark initial mount as complete after a longer delay to ensure everything is rendered
    const initCompleteTimeout = setTimeout(() => {
      console.log("Marking initial mount as complete for space:", space.id);
      isInitialMount.current = false;
    }, 200);

    return () => {
      clearTimeout(timeout);
      clearTimeout(initCompleteTimeout);
    };
  }, [space.id]); // Re-run when space changes

  // Handle active chat changes (for mouse clicks on chats within the space)
  useEffect(() => {
    console.log("Active chat effect:", {
      activeChatId: snap.activeChatId,
      previousActiveChatId: previousActiveChatId.current,
      isInitialMount: isInitialMount.current,
    });
    // If active chat changed and it's not initial mount, smooth scroll to it (mouse click)
    if (snap.activeChatId && snap.activeChatId !== previousActiveChatId.current && !isInitialMount.current) {
      console.log("Active chat changed via click, smooth scrolling to:", snap.activeChatId);
      setTimeout(() => scrollToChatIfNeeded(snap.activeChatId!, true), 50);
    }
    previousActiveChatId.current = snap.activeChatId;
  }, [snap.activeChatId]);

  // Scroll to active chat after initial render (when switching spaces)
  useEffect(() => {
    if (snap.activeChatId && space.chats[snap.activeChatId]) {
      // Delay to ensure the chats are rendered
      setTimeout(() => {
        console.log("Scrolling to active chat after space render:", snap.activeChatId);
        scrollToChatIfNeeded(snap.activeChatId!, true);
      }, 150);
    }
  }, []); // Only on mount

  // If no chats exist, show empty state
  // Note: We removed the hasChatsWithMessages check because messages are loaded
  // lazily when a chat becomes active, so they may be empty initially
  if (space.chatOrder.length === 0) {
    return <EmptySpaceState spaceId={space.id} />;
  }

  return (
    <div
      style={{
        width: snap.sidebarVisible ? "calc(100vw - 200px)" : "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        transition: "width 0.3s ease",
      }}
    >
      {/* Horizontal scrolling container for chats */}
      <ScrollArea.Root
        style={{
          width: snap.sidebarVisible ? "calc(100vw - 200px)" : "100vw",
          overflow: "hidden",
          height: "calc(100vh)",
        }}
        type="always"
      >
        <ScrollArea.Viewport
          ref={scrollViewportRef}
          style={{
            width: "100%",
            height: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              height: "100%",
              paddingLeft: 8,
              width: space.chatOrder.length === 1 ? "100%" : undefined,
            }}
          >
            {space.chatOrder.map((chatId) => {
              const chat = space.chats[chatId];
              return (
                <div
                  key={chat.id}
                  ref={(el) => {
                    if (el) {
                      chatRefs.current.set(chat.id, el);
                    } else {
                      chatRefs.current.delete(chat.id);
                    }
                  }}
                  style={{
                    width: space.chatOrder.length === 1 ? "100%" : undefined,
                  }}
                >
                  <Chat chat={chat} />
                </div>
              );
            })}
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar
          orientation="horizontal"
          style={{
            height: "4px",
          }}
        >
          <ScrollArea.Thumb
            style={{
              flex: 1,
              backgroundColor: "var(--card-bg)",
              borderRadius: "6px",
              height: "4px",
            }}
          />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
}
