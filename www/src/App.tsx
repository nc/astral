import { useEffect } from "react";
import { useSnapshot } from "valtio";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { store, actions, type Space as ISpace } from "./store";
import { SpacesList } from "./SpacesList";
import { Space } from "./Space";
import "./App.css";

function App() {
  const snap = useSnapshot(store);

  // Initialize with a default space if none exist
  useEffect(() => {
    if (snap.spaceOrder.length === 0) {
      actions.createSpace("My First Space");
    }
  }, [snap.spaceOrder.length]);

  const activeSpace = snap.activeSpaceId ? snap.spaces[snap.activeSpaceId] : undefined;

  return (
    <div
      style={{
        display: "flex",
        width: "100vw",
        height: "100vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
        margin: 0,
        padding: 0,
        boxSizing: "border-box",
      }}
    >
      {/* Sidebar Toggle Button */}
      <button
        onClick={() => actions.toggleSidebar()}
        style={{
          position: "fixed",
          top: "16px",
          left: snap.sidebarVisible ? "168px" : "16px",
          zIndex: 1000,
          width: "24px",
          height: "24px",
          borderRadius: "32px",
          backgroundColor: "#151817",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "left 0.2s ease",
        }}
        title={snap.sidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
      >
        {snap.sidebarVisible ? (
          <ChevronLeft size={14} color="#8d9693" />
        ) : (
          <ChevronRight size={14} color="#8d9693" />
        )}
      </button>

      {/* Sidebar */}
      {snap.sidebarVisible && <SpacesList />}

      {/* Main Content */}
      {activeSpace ? (
        <Space key={activeSpace.id} space={activeSpace as ISpace} />
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#666",
            fontSize: "18px",
          }}
        >
          Select a space to get started
        </div>
      )}
    </div>
  );
}

export default App;
