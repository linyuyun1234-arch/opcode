import React from "react";
import { useOverlay } from "@/contexts/OverlayContext";
import { FullscreenOverlay } from "@/components/ui/fullscreen-overlay";
import { Settings } from "@/components/Settings";
import { MCPManager } from "@/components/MCPManager";
import { UsageDashboard } from "@/components/UsageDashboard";
import { Agents } from "@/components/Agents";

/**
 * 浮窗管理器 - 统一管理所有全屏浮窗
 * 替代原来的标签页方式，性能更好
 */
export const OverlayManager: React.FC = () => {
  const { activeOverlay, closeOverlay } = useOverlay();

  return (
    <>
      {/* Settings 浮窗 */}
      <FullscreenOverlay
        open={activeOverlay === "settings"}
        onClose={closeOverlay}
      >
        <Settings onBack={closeOverlay} />
      </FullscreenOverlay>

      {/* MCP 浮窗 */}
      <FullscreenOverlay
        open={activeOverlay === "mcp"}
        onClose={closeOverlay}
      >
        <MCPManager onBack={closeOverlay} />
      </FullscreenOverlay>

      {/* Usage 浮窗 */}
      <FullscreenOverlay
        open={activeOverlay === "usage"}
        onClose={closeOverlay}
      >
        <UsageDashboard onBack={closeOverlay} />
      </FullscreenOverlay>

      {/* Agents 浮窗 */}
      <FullscreenOverlay
        open={activeOverlay === "agents"}
        onClose={closeOverlay}
      >
        <Agents />
      </FullscreenOverlay>
    </>
  );
};

export default OverlayManager;
