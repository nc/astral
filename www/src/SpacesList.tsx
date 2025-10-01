import { useState } from "react";
import { useSnapshot } from "valtio";
import { Eclipse, Plus, Trash2, Edit2 } from "lucide-react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { store, actions } from "./store";
import { RenameSpaceModal } from "./components/RenameSpaceModal";

export function SpacesList() {
  console.log("Rendering SpacesList");
  const snap = useSnapshot(store);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [spaceToRename, setSpaceToRename] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleCreateSpace = () => {
    actions.createSpace("New Space");
  };

  const handleRemoveSpace = (spaceId: string) => {
    try {
      actions.removeSpace(spaceId);
    } catch (error) {
      // Could show a toast or alert here if needed
      console.warn("Cannot remove space:", error);
    }
  };

  const handleRenameSpace = (spaceId: string, currentName: string) => {
    setSpaceToRename({ id: spaceId, name: currentName });
    setRenameModalOpen(true);
  };

  const closeRenameModal = () => {
    setRenameModalOpen(false);
    setSpaceToRename(null);
  };

  return (
    <div
      style={{
        width: "200px",
        height: "100vh",
        backgroundColor: "#151817",
        position: "relative",
        borderRight: "1px solid #1D2120",
      }}
    >
      <div
        style={{
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          padding: "0px",
          position: "relative",
          width: "200px",
          height: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            position: "relative",
            flexShrink: "0",
            width: "100%",
          }}
        >
          {/* Header with logo and title */}
          <div
            style={{
              display: "flex",
              gap: "4px",
              position: "relative",
              padding: "12px 8px 4px",
              width: "100%",
            }}
          >
            <Eclipse
              size={16}
              color="#8d9693"
              style={{
                position: "relative",
                top: 3,
                left: 0,
                margin: 4,
              }}
            />
            <div
              style={{
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                height: "32px",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: "0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: "600",
                  fontStyle: "normal",
                  position: "relative",
                  flexShrink: "0",
                  color: "#8d9693",
                  fontSize: "16px",
                }}
              >
                <p style={{ lineHeight: "24px", margin: 0 }}>Astral</p>
              </div>
            </div>
          </div>

          <div
            style={{
              position: "relative",
              width: "100%",
              padding: "8px 8px",
            }}
          >
            <button
              onClick={handleCreateSpace}
              style={{
                flexDirection: "column",
                fontFamily: "'Inter', sans-serif",
                // fontWeight: "600",
                height: "36px",
                justifyContent: "center",
                fontStyle: "normal",
                borderRadius: "9px",
                position: "relative",
                padding: "0px 12px",
                // color: "#8d9693",
                fontSize: "14px",
                width: "100%",
                backgroundColor: "#1e2020",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Plus
                size={14}
                style={{ marginRight: 8, position: "relative", top: 2 }}
              />
              New Space
            </button>
          </div>

          {/* Spaces List */}
          <div
            style={{
              display: "grid",
              width: "100%",
              gridTemplateRows: "max-content",
              lineHeight: "0",
              padding: "0px 8px",
              placeItems: "start",
              position: "relative",
              flexShrink: "0",
            }}
          >
            {/* Spaces Header */}
            <div
              style={{
                gridArea: "1 / 1",
                boxSizing: "border-box",
                display: "flex",
                gap: "20px",
                height: "36px",
                alignItems: "center",
                marginLeft: "0",
                marginTop: "0px",
                position: "relative",
                borderRadius: "4px",
                width: "100%",
              }}
            >
              <div
                style={{
                  flexBasis: "0",
                  display: "flex",
                  flexDirection: "column",
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: "600",
                  flexGrow: "1",
                  justifyContent: "center",
                  lineHeight: "0",
                  minHeight: "1px",
                  minWidth: "1px",
                  fontStyle: "normal",
                  position: "relative",
                  flexShrink: "0",
                  color: "#8d9693",
                  fontSize: "12px",
                }}
              >
                <p style={{ lineHeight: "20px", margin: 0 }}>Spaces</p>
              </div>
            </div>

            {/* Space Items */}
            {snap.spaceOrder.map((spaceId, spaceIndex) => {
              const space = snap.spaces[spaceId];
              const isActive = space.id === snap.activeSpaceId;
              return (
                <ContextMenu.Root key={space.id}>
                  <ContextMenu.Trigger asChild>
                    <div
                      onClick={() => actions.setActiveSpace(space.id)}
                      style={{
                        gridArea: "1 / 1",
                        boxSizing: "border-box",
                        display: "flex",
                        gap: "12px",
                        alignItems: "center",
                        marginLeft: "0",
                        marginTop: `${40 + spaceIndex * 36}px`,
                        paddingLeft: "12px",
                        paddingRight: "12px",
                        paddingTop: "10px",
                        paddingBottom: "10px",
                        position: "relative",
                        borderRadius: "9px",
                        width: "100%",
                        backgroundColor: isActive
                          ? "rgba(255,255,255,0.06)"
                          : "transparent",
                        cursor: "pointer",
                        transition: "background-color 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          (
                            e.currentTarget as HTMLElement
                          ).style.backgroundColor = "rgba(255,255,255,0.03)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          (
                            e.currentTarget as HTMLElement
                          ).style.backgroundColor = "transparent";
                        }
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          fontFamily: "'Inter', sans-serif",
                          fontWeight: "400",
                          justifyContent: "center",
                          lineHeight: "0",
                          fontStyle: "normal",
                          position: "relative",
                          flexShrink: "0",
                          color: "#fdfdfd",
                          fontSize: "14px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <p
                          style={{
                            lineHeight: "16px",
                            whiteSpace: "pre",
                            margin: 0,
                          }}
                        >
                          {space.name}
                        </p>
                      </div>
                    </div>
                  </ContextMenu.Trigger>

                  <ContextMenu.Portal>
                    <ContextMenu.Content
                      style={{
                        backgroundColor: "#1e2020",
                        borderRadius: "9px",
                        border: "1px solid #2d302f",
                        padding: "4px",
                        zIndex: 1000,
                        minWidth: "160px",
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                      }}
                    >
                      <ContextMenu.Item
                        onSelect={() => handleRenameSpace(space.id, space.name)}
                        style={{
                          fontSize: "14px",
                          fontFamily: "'Inter', sans-serif",
                          fontWeight: "400",
                          color: "#fdfdfd",
                          backgroundColor: "transparent",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          outline: "none",
                          userSelect: "none",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                        onMouseEnter={(e) => {
                          (
                            e.currentTarget as HTMLElement
                          ).style.backgroundColor = "#2d302f";
                        }}
                        onMouseLeave={(e) => {
                          (
                            e.currentTarget as HTMLElement
                          ).style.backgroundColor = "transparent";
                        }}
                      >
                        <Edit2 size={14} />
                        Rename Space
                      </ContextMenu.Item>
                      <ContextMenu.Item
                        onSelect={() => handleRemoveSpace(space.id)}
                        style={{
                          fontSize: "14px",
                          fontFamily: "'Inter', sans-serif",
                          fontWeight: "400",
                          backgroundColor: "transparent",
                          color: "#fdfdfd",

                          padding: "8px 12px",
                          borderRadius: "6px",
                          outline: "none",
                          userSelect: "none",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                        onMouseEnter={(e) => {
                          (
                            e.currentTarget as HTMLElement
                          ).style.backgroundColor = "#2d302f";
                        }}
                        onMouseLeave={(e) => {
                          (
                            e.currentTarget as HTMLElement
                          ).style.backgroundColor = "transparent";
                        }}
                      >
                        <Trash2 size={14} />
                        Remove Space
                      </ContextMenu.Item>
                    </ContextMenu.Content>
                  </ContextMenu.Portal>
                </ContextMenu.Root>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rename Space Modal */}
      {spaceToRename && (
        <RenameSpaceModal
          isOpen={renameModalOpen}
          onClose={closeRenameModal}
          spaceId={spaceToRename.id}
          currentName={spaceToRename.name}
        />
      )}
    </div>
  );
}
