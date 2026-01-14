import React, { createContext, useContext, useState, useCallback } from "react";

export type OverlayType = "settings" | "mcp" | "usage" | "agents" | null;

interface OverlayContextValue {
  /** 当前打开的浮窗类型 */
  activeOverlay: OverlayType;
  /** 打开指定浮窗 */
  openOverlay: (type: OverlayType) => void;
  /** 关闭当前浮窗 */
  closeOverlay: () => void;
  /** 检查指定浮窗是否打开 */
  isOverlayOpen: (type: OverlayType) => boolean;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

export const OverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeOverlay, setActiveOverlay] = useState<OverlayType>(null);

  const openOverlay = useCallback((type: OverlayType) => {
    setActiveOverlay(type);
  }, []);

  const closeOverlay = useCallback(() => {
    setActiveOverlay(null);
  }, []);

  const isOverlayOpen = useCallback((type: OverlayType) => {
    return activeOverlay === type;
  }, [activeOverlay]);

  return (
    <OverlayContext.Provider value={{ activeOverlay, openOverlay, closeOverlay, isOverlayOpen }}>
      {children}
    </OverlayContext.Provider>
  );
};

export const useOverlay = () => {
  const context = useContext(OverlayContext);
  if (!context) {
    throw new Error("useOverlay must be used within an OverlayProvider");
  }
  return context;
};
