import { useEffect, useState } from "react";
import { useSnapshot } from "valtio";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { store, actions, type Space as ISpace } from "./store";
import { SpacesList } from "./SpacesList";
import { Space } from "./Space";
import "./App.css";

function App() {
  const snap = useSnapshot(store);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from backend on mount
  useEffect(() => {
    actions.init().then(() => {
      setIsInitialized(true);
      console.log('App initialized from backend');
    }).catch(error => {
      console.error('Failed to initialize app:', error);
      setIsInitialized(true); // Still show UI even if init fails
    });
  }, []);

  const activeSpace = snap.activeSpaceId
    ? snap.spaces[snap.activeSpaceId]
    : undefined;

  if (!isInitialized) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100vw', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

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
          Select or create a new space to get started
        </div>
      )}
    </div>
  );
}

export default App;
