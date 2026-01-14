import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  MessageSquare,
  Bot,
  ChevronRight,
  ChevronDown,
  Settings,
  Gauge,
  Plug,
  FolderOpen,
  Search,
  PanelLeftClose,
  PanelLeft,
  RefreshCw,
  Clock,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type Project, type Session } from "@/lib/api";
import { useTabContext } from "@/contexts/TabContext";
import { useOverlay } from "@/contexts/OverlayContext";

interface AgentSidebarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onNewChat?: () => void;
  onSwitchSession?: (session: Session) => void;
  className?: string;
  autoCollapse?: boolean; // 自动收缩模式
}

interface ProjectWithSessions extends Project {
  sessions_data: Session[];
  isExpanded: boolean;
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({
  collapsed = false,
  onCollapsedChange,
  onNewChat,
  onSwitchSession,
  className,
  autoCollapse = true // 默认启用自动收缩
}) => {
  const { tabs, activeTabId } = useTabContext();
  const { openOverlay } = useOverlay();
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<ProjectWithSessions[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [runningSessions, setRunningSessions] = useState<Set<string>>(new Set());
  
  // 自动收缩状态
  const [isHovering, setIsHovering] = useState(false);
  const collapseTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // 实际显示状态：如果启用自动收缩，则取决于鼠标悬停状态
  const isActuallyCollapsed = autoCollapse ? !isHovering : collapsed;
  
  // 鼠标进入侧边栏
  const handleMouseEnter = useCallback(() => {
    if (!autoCollapse) return;
    
    // 清除收缩定时器
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
    
    setIsHovering(true);
  }, [autoCollapse]);
  
  // 鼠标离开侧边栏
  const handleMouseLeave = useCallback(() => {
    if (!autoCollapse) return;
    
    // 延迟收缩，避免误触发
    collapseTimeoutRef.current = setTimeout(() => {
      setIsHovering(false);
    }, 300); // 300ms 延迟
  }, [autoCollapse]);
  
  // 清理定时器
  useEffect(() => {
    return () => {
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
      }
    };
  }, []);

  // Get the current active session ID
  const activeSessionId = useMemo(() => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    return activeTab?.sessionId || null;
  }, [tabs, activeTabId]);

  // Load running sessions
  const loadRunningSessions = useCallback(async () => {
    try {
      const runningProcesses = await api.listRunningClaudeSessions();
      const runningIds = new Set<string>();
      
      runningProcesses.forEach((process: any) => {
        if (process.process_type?.ClaudeSession?.session_id) {
          runningIds.add(process.process_type.ClaudeSession.session_id);
        }
      });
      
      setRunningSessions(runningIds);
    } catch (err) {
      console.error("Failed to load running sessions:", err);
    }
  }, []);

  // Load projects and their sessions
  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const projectList = await api.listProjects();
      
      // Sort by most recent session first
      const sortedProjects = projectList.sort((a, b) => {
        const aTime = a.most_recent_session || a.created_at;
        const bTime = b.most_recent_session || b.created_at;
        return bTime - aTime;
      });

      // Take top 10 most recent projects
      const recentProjects = sortedProjects.slice(0, 10);

      // Load sessions for each project
      const projectsWithSessions: ProjectWithSessions[] = await Promise.all(
        recentProjects.map(async (project) => {
          try {
            const sessions = await api.getProjectSessions(project.id);
            // Sort sessions by created_at descending
            const sortedSessions = sessions.sort((a, b) => b.created_at - a.created_at);
            return {
              ...project,
              sessions_data: sortedSessions.slice(0, 10), // Limit to 10 sessions per project
              isExpanded: false
            };
          } catch {
            return {
              ...project,
              sessions_data: [],
              isExpanded: false
            };
          }
        })
      );

      setProjects(projectsWithSessions);
      
      // Auto-expand the first project with sessions
      const firstWithSessions = projectsWithSessions.find(p => p.sessions_data.length > 0);
      if (firstWithSessions) {
        setExpandedProjects(new Set([firstWithSessions.id]));
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Delay loading to not block initial render
    const timer = setTimeout(() => {
      loadProjects();
      loadRunningSessions();
    }, 100);
    
    // Poll for running sessions every 3 seconds
    const interval = setInterval(loadRunningSessions, 3000);

    // 监听刷新事件
    const handleRefresh = () => {
      loadProjects();
      loadRunningSessions();
    };
    window.addEventListener('refresh-sessions', handleRefresh);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('refresh-sessions', handleRefresh);
    };
  }, [loadProjects, loadRunningSessions]);

  // Filter projects and sessions based on search
  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projects;

    const query = searchQuery.toLowerCase();
    return projects
      .map(project => {
        const projectMatches = project.path.toLowerCase().includes(query);
        const matchingSessions = project.sessions_data.filter(session =>
          session.first_message?.toLowerCase().includes(query) ||
          session.id.toLowerCase().includes(query)
        );

        if (projectMatches || matchingSessions.length > 0) {
          return {
            ...project,
            sessions_data: projectMatches ? project.sessions_data : matchingSessions,
            isExpanded: true // Auto-expand when searching
          };
        }
        return null;
      })
      .filter((p): p is ProjectWithSessions => p !== null);
  }, [projects, searchQuery]);

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const getProjectName = (path: string) => {
    return path.split("/").pop() || path;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getSessionTitle = (session: Session) => {
    if (session.first_message) {
      // Truncate to first 50 chars
      const msg = session.first_message.trim();
      return msg.length > 50 ? msg.slice(0, 50) + '...' : msg;
    }
    return `Session ${session.id.slice(0, 8)}`;
  };

  // Collapsed state
  if (isActuallyCollapsed) {
    return (
      <div 
        className={cn(
          "w-14 h-full flex flex-col items-center py-3 gap-1",
          "bg-background border-r border-border/50",
          "transition-all duration-200 ease-in-out",
          className
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl hover:bg-muted/50"
          onClick={() => onCollapsedChange?.(false)}
          title="Expand Sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
        
        <div className="h-4" />
        
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl hover:bg-muted/50"
          onClick={onNewChat}
          title="New Chat"
        >
          <Plus className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl hover:bg-muted/50"
          onClick={() => openOverlay("agents")}
          title="Agents"
        >
          <Bot className="h-4 w-4" />
        </Button>
        
        <div className="flex-1" />
        
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl hover:bg-muted/50"
          onClick={() => openOverlay("mcp")}
          title="MCP Servers"
        >
          <Plug className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl hover:bg-muted/50"
          onClick={() => openOverlay("usage")}
          title="Usage"
        >
          <Gauge className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl hover:bg-muted/50"
          onClick={() => openOverlay("settings")}
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Expanded state
  return (
    <div 
      className={cn(
        "w-64 h-full flex flex-col",
        "bg-background border-r border-border/50",
        "transition-all duration-200 ease-in-out",
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header */}
      <div className="p-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground/80">Recent Sessions</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg hover:bg-muted/50"
            onClick={() => {
              loadProjects();
              loadRunningSessions();
            }}
            title="Refresh"
            disabled={loading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg hover:bg-muted/50"
            onClick={onNewChat}
            title="New Chat"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg hover:bg-muted/50"
            onClick={() => onCollapsedChange?.(true)}
            title="Collapse Sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-sm rounded-lg neu-pressed border-0"
          />
        </div>
      </div>

      {/* Project/Session List */}
      <div className="flex-1 overflow-y-auto px-2">
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
            Loading...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {searchQuery ? "No matches" : "No recent sessions"}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredProjects.map((project) => {
              const isExpanded = searchQuery ? true : expandedProjects.has(project.id);
              
              return (
                <div key={project.id}>
                  {/* Project Header */}
                  <button
                    onClick={() => toggleProject(project.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm",
                      "hover:bg-muted/30 transition-colors"
                    )}
                  >
                    <span className="text-muted-foreground">
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1 text-left truncate font-medium text-foreground/80">
                      {getProjectName(project.path)}
                    </span>
                    <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded-md bg-muted/50">
                      {project.sessions_data.length}
                    </span>
                  </button>

                  {/* Sessions */}
                  <AnimatePresence>
                    {isExpanded && project.sessions_data.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-2 pl-2 border-l border-border/30 space-y-0.5 py-1">
                          {project.sessions_data.map((session) => {
                            const isActive = activeSessionId === session.id;
                            const isRunning = runningSessions.has(session.id);
                            
                            return (
                              <div
                                key={session.id}
                                className={cn(
                                  "group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all",
                                  isActive
                                    ? "neu-pressed bg-primary/5"
                                    : "hover:bg-muted/30"
                                )}
                                onClick={() => onSwitchSession?.(session)}
                              >
                                <span className={cn(
                                  "shrink-0",
                                  isActive ? "text-primary" : "text-muted-foreground"
                                )}>
                                  <MessageSquare className="h-4 w-4" />
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className={cn(
                                    "text-sm truncate",
                                    isActive ? "text-primary font-medium" : "text-foreground/80"
                                  )}>
                                    {getSessionTitle(session)}
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {formatTime(session.created_at)}
                                  </div>
                                </div>
                                
                                {/* Status indicator */}
                                {isRunning ? (
                                  // Running animation
                                  <Loader2 className="h-3.5 w-3.5 text-yellow-500 animate-spin shrink-0" />
                                ) : isActive ? (
                                  // Active (current open) - green dot
                                  <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="p-2 space-y-0.5 border-t border-border/30">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start h-8 text-sm rounded-lg hover:bg-muted/30 font-normal"
          onClick={() => openOverlay("agents")}
        >
          <Bot className="h-4 w-4 mr-2 text-muted-foreground" />
          <span className="text-foreground/80">Agents</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start h-8 text-sm rounded-lg hover:bg-muted/30 font-normal"
          onClick={() => openOverlay("mcp")}
        >
          <Plug className="h-4 w-4 mr-2 text-muted-foreground" />
          <span className="text-foreground/80">MCP Servers</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start h-8 text-sm rounded-lg hover:bg-muted/30 font-normal"
          onClick={() => openOverlay("usage")}
        >
          <Gauge className="h-4 w-4 mr-2 text-muted-foreground" />
          <span className="text-foreground/80">Usage</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start h-8 text-sm rounded-lg hover:bg-muted/30 font-normal"
          onClick={() => openOverlay("settings")}
        >
          <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
          <span className="text-foreground/80">Settings</span>
        </Button>
      </div>
    </div>
  );
};
