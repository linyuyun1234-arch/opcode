import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Folder, FolderOpen, Plus, Check } from 'lucide-react';
import { api, type Project } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ProjectSelectorProps {
  currentProjectPath?: string;
  onProjectSelect: (project: Project) => void;
  onOpenProject?: () => void;
  className?: string;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  currentProjectPath,
  onProjectSelect,
  onOpenProject,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 获取当前项目名称
  const currentProjectName = currentProjectPath 
    ? currentProjectPath.split('/').pop() || 'Select Project'
    : 'Select Project';

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 打开时加载项目列表
  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const projectList = await api.listProjects();
      // 按最近使用排序
      const sorted = projectList.sort((a, b) => {
        const aTime = a.most_recent_session || a.created_at;
        const bTime = b.most_recent_session || b.created_at;
        return bTime - aTime;
      });
      setProjects(sorted.slice(0, 10)); // 只显示最近10个
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (project: Project) => {
    onProjectSelect(project);
    setIsOpen(false);
  };

  const getProjectName = (path: string) => path.split('/').pop() || path;

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* 选择器按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors tauri-no-drag",
          "hover:bg-muted/50 text-sm font-medium",
          isOpen && "bg-muted/50"
        )}
      >
        <Folder className="h-4 w-4 text-muted-foreground" />
        <span className="max-w-[200px] truncate">{currentProjectName}</span>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 text-muted-foreground transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* 下拉菜单 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 border border-border rounded-xl shadow-xl z-[300] overflow-hidden"
            style={{ backgroundColor: 'var(--background)' }}
          >
            {/* 项目列表 */}
            <div className="max-h-80 overflow-y-auto py-1">
              {loading ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : projects.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No projects yet
                </div>
              ) : (
                projects.map((project) => {
                  const isSelected = project.path === currentProjectPath;
                  return (
                    <button
                      key={project.id}
                      onClick={() => handleSelect(project)}
                      className={cn(
                        "w-full px-3 py-2 flex items-center gap-3 hover:bg-muted/50 transition-colors",
                        isSelected && "bg-primary/10"
                      )}
                    >
                      <FolderOpen className={cn(
                        "h-4 w-4 flex-shrink-0",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )} />
                      <div className="flex-1 text-left min-w-0">
                        <div className={cn(
                          "text-sm font-medium truncate",
                          isSelected && "text-primary"
                        )}>
                          {getProjectName(project.path)}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {project.path}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* 打开新项目 */}
            {onOpenProject && (
              <div className="border-t border-border p-1">
                <button
                  onClick={() => {
                    onOpenProject();
                    setIsOpen(false);
                  }}
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-muted/50 transition-colors rounded-lg"
                >
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Open Project...</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
