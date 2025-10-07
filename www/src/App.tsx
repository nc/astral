import { useEffect, useState } from "react";
import { useSnapshot } from "valtio";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { store, actions, type Space as ISpace } from "./store";
import { SpacesList } from "./SpacesList";
import { Space } from "./Space";
import { SignIn } from "./SignIn";
import { SharedChat } from "./SharedChat";
import "./App.css";

interface UserInfo {
  userId: string;
  email: string;
  name: string;
  picture: string;
}

function App() {
  const snap = useSnapshot(store);
  const [isInitialized, setIsInitialized] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);

  // Check if this is a shared chat URL
  const pathMatch = window.location.pathname.match(/^\/share\/([^/]+)$/);
  const shareId = pathMatch ? pathMatch[1] : null;

  // If viewing a shared chat, render it directly without authentication
  if (shareId) {
    return <SharedChat shareId={shareId} />;
  }

  // Check for OAuth callback on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId');
    const email = params.get('email');
    const name = params.get('name');
    const picture = params.get('picture');

    if (userId && email && name) {
      // Store user info
      const userInfo: UserInfo = { userId, email, name, picture: picture || '' };
      setUser(userInfo);
      localStorage.setItem('user', JSON.stringify(userInfo));

      // Clean up URL
      window.history.replaceState({}, '', '/');
    } else {
      // Check localStorage for existing session
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (error) {
          console.error('Failed to parse stored user:', error);
          localStorage.removeItem('user');
        }
      }
    }
  }, []);

  // Initialize from backend when user is authenticated
  useEffect(() => {
    if (user) {
      actions.init(user.userId).then(() => {
        setIsInitialized(true);
        console.log('App initialized from backend for user:', user.email);
      }).catch(error => {
        console.error('Failed to initialize app:', error);
        setIsInitialized(true); // Still show UI even if init fails
      });
    }
  }, [user]);

  const activeSpace = snap.activeSpaceId
    ? snap.spaces[snap.activeSpaceId]
    : undefined;

  // Show sign-in page if not authenticated
  if (!user) {
    return <SignIn />;
  }

  // Show loading while initializing
  if (!isInitialized) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#151817',
        color: '#edecec',
      }}>
        <div>Loading your spaces...</div>
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
      {snap.sidebarVisible && <SpacesList user={user} />}

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
