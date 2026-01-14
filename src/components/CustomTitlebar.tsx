import React, { useState } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { TooltipProvider } from '@/components/ui/tooltip-modern';
import { ProjectSelector } from '@/components/ProjectSelector';
import { type Project } from '@/lib/api';

interface CustomTitlebarProps {
  currentProjectPath?: string;
  onProjectSelect?: (project: Project) => void;
  onOpenProject?: () => void;
}

export const CustomTitlebar: React.FC<CustomTitlebarProps> = ({
  currentProjectPath,
  onProjectSelect,
  onOpenProject,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleMinimize = async () => {
    try {
      const window = getCurrentWindow();
      await window.minimize();
    } catch (error) {
      console.error('Failed to minimize window:', error);
    }
  };

  const handleMaximize = async () => {
    try {
      const window = getCurrentWindow();
      const isMaximized = await window.isMaximized();
      if (isMaximized) {
        await window.unmaximize();
      } else {
        await window.maximize();
      }
    } catch (error) {
      console.error('Failed to maximize/unmaximize window:', error);
    }
  };

  const handleClose = async () => {
    try {
      const window = getCurrentWindow();
      await window.close();
    } catch (error) {
      console.error('Failed to close window:', error);
    }
  };

  return (
    <TooltipProvider>
      <div
        className="relative z-[200] h-11 backdrop-blur-sm flex items-center justify-between select-none border-b border-border/50 tauri-drag"
        style={{ backgroundColor: 'var(--color-card)' }}
        data-tauri-drag-region
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Left side - macOS Traffic Light buttons */}
        <div className="flex items-center space-x-2 pl-5">
          <div className="flex items-center space-x-2">
            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              className="group relative w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-all duration-200 flex items-center justify-center tauri-no-drag"
              title="Close"
            >
              {isHovered && (
                <X size={8} className="text-red-900 opacity-60 group-hover:opacity-100" />
              )}
            </button>

            {/* Minimize button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMinimize();
              }}
              className="group relative w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-all duration-200 flex items-center justify-center tauri-no-drag"
              title="Minimize"
            >
              {isHovered && (
                <Minus size={8} className="text-yellow-900 opacity-60 group-hover:opacity-100" />
              )}
            </button>

            {/* Maximize button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMaximize();
              }}
              className="group relative w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 transition-all duration-200 flex items-center justify-center tauri-no-drag"
              title="Maximize"
            >
              {isHovered && (
                <Square size={6} className="text-green-900 opacity-60 group-hover:opacity-100" />
              )}
            </button>
          </div>
        </div>

        {/* Center - Project Selector */}
        <div className="absolute left-1/2 -translate-x-1/2 tauri-no-drag">
          {onProjectSelect && (
            <ProjectSelector
              currentProjectPath={currentProjectPath}
              onProjectSelect={onProjectSelect}
              onOpenProject={onOpenProject}
            />
          )}
        </div>

        {/* Right side - empty for balance */}
        <div className="w-20" />
      </div>
    </TooltipProvider>
  );
};
