import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { SD_Light } from "@sd/assets/icons";
import appIconUrl from "../../src-tauri/icons/icon.png?url";

type MenuKey = "Spacedrive" | "File" | "Edit" | "View" | null;

function MenuDropdown({
  items,
  onClose,
}: {
  items: { label?: string; type?: "separator"; onClick?: () => void; disabled?: boolean }[];
  onClose: () => void;
}) {
  return (
    <div className="sd-menu-dropdown">
      {items.map((item, i) =>
        item.type === "separator" ? (
          <div key={`sep-${i}`} className="sd-menu-separator" />
        ) : (
          <button
            key={item.label}
            className="sd-menu-item no-drag"
            disabled={item.disabled}
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
          >
            <span>{item.label}</span>
          </button>
        )
      )}
    </div>
  );
}

export default function TitleBar() {
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);
  const [isMax, setIsMax] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [iconSrc, setIconSrc] = useState<string>(appIconUrl);
  const win = getCurrentWebviewWindow();
  const spacedriveRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    win.isMaximized().then(setIsMax).catch(() => {});
    win.isFullscreen().then(setIsFull).catch(() => {});
  }, []);

  useEffect(() => {
    const root = document.getElementById("root");
    if (root) {
      (root as HTMLElement).style.zoom = String(zoom);
    }
  }, [zoom]);

  const spacedriveMenu = useMemo(
    () => [
      {
        label: "Settings",
        onClick: () => {
          invoke("show_window", {
            window: { type: "Settings", page: null },
          });
        },
      },
      { type: "separator" as const },
      {
        label: "Exit",
        onClick: () => {
          win.close();
        },
      },
    ],
    []
  );

  const fileMenu = useMemo(
    () => [
      {
        label: "New Window",
        onClick: () => {
          invoke("show_window", {
            window: { type: "Explorer", library_id: "", path: "" },
          });
        },
      },
      { type: "separator" as const },
      {
        label: "Open...",
        onClick: async () => {
          const path = await open({ directory: true, multiple: false });
          if (typeof path === "string" && path.length > 0) {
            invoke("show_window", {
              window: { type: "Explorer", library_id: "", path },
            });
          }
        },
      },
      {
        label: "Close Window",
        onClick: () => {
          win.close();
        },
      },
    ],
    []
  );

  const exec = (cmd: string) => {
    try {
      document.execCommand(cmd);
    } catch {}
  };

  const editMenu = useMemo(
    () => [
      { label: "Undo", onClick: () => exec("undo") },
      { label: "Redo", onClick: () => exec("redo") },
      { type: "separator" as const },
      { label: "Cut", onClick: () => exec("cut") },
      { label: "Copy", onClick: () => exec("copy") },
      { label: "Paste", onClick: () => exec("paste") },
      { type: "separator" as const },
      { label: "Select All", onClick: () => exec("selectAll") },
    ],
    []
  );

  const viewMenu = useMemo(
    () => [
      {
        label: "Reload",
        onClick: () => {
          location.reload();
        },
      },
      { type: "separator" as const },
      {
        label: "Toggle Fullscreen",
        onClick: async () => {
          const cur = await win.isFullscreen();
          await win.setFullscreen(!cur);
          setIsFull(!cur);
        },
      },
      { type: "separator" as const },
      {
        label: "Zoom In",
        onClick: () => {
          setZoom((z) => Math.min(2, Number((z + 0.1).toFixed(1))));
        },
      },
      {
        label: "Zoom Out",
        onClick: () => {
          setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(1))));
        },
      },
      {
        label: "Reset Zoom",
        onClick: () => {
          setZoom(1);
        },
      },
    ],
    []
  );

  return (
    <div className="sd-titlebar" data-tauri-drag-region>
      <div className="sd-left">
        <img
          src={iconSrc}
          className="sd-app-icon no-drag"
          alt="Spacedrive"
          onError={() => setIconSrc(SD_Light)}
        />
        <div
          ref={spacedriveRef}
          className="sd-menu no-drag"
          onMouseEnter={() => setOpenMenu("Spacedrive")}
          onMouseLeave={() => setOpenMenu((m) => (m === "Spacedrive" ? null : m))}
          onClick={() =>
            setOpenMenu((m) => (m === "Spacedrive" ? null : "Spacedrive"))
          }
        >
          <span className="sd-menu-label">Spacedrive</span>
          {openMenu === "Spacedrive" && (
            <MenuDropdown items={spacedriveMenu} onClose={() => setOpenMenu(null)} />
          )}
        </div>
        <div
          ref={fileRef}
          className="sd-menu no-drag"
          onMouseEnter={() => setOpenMenu("File")}
          onMouseLeave={() => setOpenMenu((m) => (m === "File" ? null : m))}
          onClick={() => setOpenMenu((m) => (m === "File" ? null : "File"))}
        >
          <span className="sd-menu-label">File</span>
          {openMenu === "File" && (
            <MenuDropdown items={fileMenu} onClose={() => setOpenMenu(null)} />
          )}
        </div>
        <div
          ref={editRef}
          className="sd-menu no-drag"
          onMouseEnter={() => setOpenMenu("Edit")}
          onMouseLeave={() => setOpenMenu((m) => (m === "Edit" ? null : m))}
          onClick={() => setOpenMenu((m) => (m === "Edit" ? null : "Edit"))}
        >
          <span className="sd-menu-label">Edit</span>
          {openMenu === "Edit" && (
            <MenuDropdown items={editMenu} onClose={() => setOpenMenu(null)} />
          )}
        </div>
        <div
          ref={viewRef}
          className="sd-menu no-drag"
          onMouseEnter={() => setOpenMenu("View")}
          onMouseLeave={() => setOpenMenu((m) => (m === "View" ? null : m))}
          onClick={() => setOpenMenu((m) => (m === "View" ? null : "View"))}
        >
          <span className="sd-menu-label">View</span>
          {openMenu === "View" && (
            <MenuDropdown items={viewMenu} onClose={() => setOpenMenu(null)} />
          )}
        </div>
      </div>
      <div className="sd-center" />
      <div className="sd-right">
        <button
          className="sd-win-btn no-drag"
          aria-label="Minimize"
          onClick={() => {
            win
              .minimize()
              .catch((e) => console.error("[TitleBar] minimize failed", e));
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="1" y="4.5" width="8" height="1" fill="#c9c9c9" />
          </svg>
        </button>
        <button
          className="sd-win-btn no-drag"
          aria-label="Maximize"
          onClick={async () => {
            try {
              const isFs = await win.isFullscreen();
              if (isFs) {
                await win.setFullscreen(false);
                setIsFull(false);
              }
              const cur = await win.isMaximized();
              if (cur) {
                await win.unmaximize();
              } else {
                await win.maximize();
              }
              setIsMax(!cur);
            } catch (e) {
              console.error("[TitleBar] maximize/unmaximize failed", e);
            }
          }}
        >
          {isMax ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="2" y="2" width="6" height="6" stroke="#c9c9c9" fill="none" />
              <rect x="3" y="3" width="4" height="4" stroke="#c9c9c9" fill="none" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="2" y="2" width="6" height="6" stroke="#c9c9c9" fill="none" />
            </svg>
          )}
        </button>
        <button
          className="sd-win-btn sd-close no-drag"
          aria-label="Close"
          onClick={() => win.close()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="2" y1="2" x2="8" y2="8" stroke="#ffffff" />
            <line x1="8" y1="2" x2="2" y2="8" stroke="#ffffff" />
          </svg>
        </button>
      </div>
    </div>
  );
}
