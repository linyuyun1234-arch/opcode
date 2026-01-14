/**
 * SessionBranch - 会话分支组件
 * 
 * 允许用户在对话的任意节点创建分支，探索不同的解决方案
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch,
  GitFork,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Check,
  History,
  Clock,
  MessageSquare,
  MoreHorizontal,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { ClaudeStreamMessage } from './AgentExecution';

export interface Branch {
  id: string;
  name: string;
  parentBranchId: string | null;
  forkMessageIndex: number; // 从哪条消息分叉
  messages: ClaudeStreamMessage[];
  createdAt: number;
  isActive: boolean;
  description?: string;
}

export interface SessionBranchProps {
  branches: Branch[];
  currentBranchId: string;
  messages: ClaudeStreamMessage[];
  onCreateBranch: (name: string, forkMessageIndex: number, description?: string) => void;
  onSwitchBranch: (branchId: string) => void;
  onDeleteBranch: (branchId: string) => void;
  onMergeBranch?: (sourceBranchId: string, targetBranchId: string) => void;
  className?: string;
}

export const SessionBranch: React.FC<SessionBranchProps> = ({
  branches,
  currentBranchId,
  messages,
  onCreateBranch,
  onSwitchBranch,
  onDeleteBranch,
  onMergeBranch,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchDescription, setNewBranchDescription] = useState('');
  const [forkMessageIndex, setForkMessageIndex] = useState(-1);

  const currentBranch = useMemo(() => 
    branches.find(b => b.id === currentBranchId),
    [branches, currentBranchId]
  );

  const sortedBranches = useMemo(() => 
    [...branches].sort((a, b) => b.createdAt - a.createdAt),
    [branches]
  );

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  // 创建分支
  const handleCreateBranch = useCallback(() => {
    if (!newBranchName.trim()) return;
    
    onCreateBranch(
      newBranchName.trim(),
      forkMessageIndex >= 0 ? forkMessageIndex : messages.length - 1,
      newBranchDescription.trim() || undefined
    );
    
    setShowCreateDialog(false);
    setNewBranchName('');
    setNewBranchDescription('');
    setForkMessageIndex(-1);
  }, [newBranchName, newBranchDescription, forkMessageIndex, messages.length, onCreateBranch]);

  // 删除分支
  const handleDeleteBranch = useCallback((branchId: string) => {
    onDeleteBranch(branchId);
    setShowDeleteDialog(null);
  }, [onDeleteBranch]);

  return (
    <div className={cn("relative", className)}>
      {/* 当前分支指示器 */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors",
          "bg-card hover:bg-muted/50",
          isExpanded && "rounded-b-none border-b-0"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <GitBranch className="h-4 w-4 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {currentBranch?.name || '主分支'}
            </span>
            {currentBranch?.isActive && (
              <Badge variant="secondary" className="text-[10px] px-1.5">
                当前
              </Badge>
            )}
          </div>
          {currentBranch?.description && (
            <p className="text-xs text-muted-foreground truncate">
              {currentBranch.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-xs">
            {branches.length} 个分支
          </Badge>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* 分支列表 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border border-t-0 rounded-b-lg bg-card"
          >
            <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
              {sortedBranches.map((branch) => (
                <div
                  key={branch.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-md transition-colors cursor-pointer group",
                    branch.id === currentBranchId
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => onSwitchBranch(branch.id)}
                >
                  <GitFork className="h-3.5 w-3.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {branch.name}
                      </span>
                      {branch.id === currentBranchId && (
                        <Check className="h-3 w-3 text-green-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {branch.messages.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(branch.createdAt)}
                      </span>
                    </div>
                  </div>
                  
                  {/* 分支操作菜单 */}
                  <Popover
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    }
                    content={
                      <div className="w-40 p-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSwitchBranch(branch.id);
                          }}
                        >
                          <ArrowRight className="h-3 w-3 mr-2" />
                          切换到此分支
                        </Button>
                        {onMergeBranch && branch.id !== currentBranchId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMergeBranch(branch.id, currentBranchId);
                            }}
                          >
                            <GitBranch className="h-3 w-3 mr-2" />
                            合并到当前
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-xs text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteDialog(branch.id);
                          }}
                          disabled={branch.id === currentBranchId && branches.length === 1}
                        >
                          <Trash2 className="h-3 w-3 mr-2" />
                          删除分支
                        </Button>
                      </div>
                    }
                    align="end"
                  />
                </div>
              ))}
            </div>

            {/* 创建新分支按钮 */}
            <div className="p-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setForkMessageIndex(-1);
                  setNewBranchName(`分支 ${branches.length + 1}`);
                  setShowCreateDialog(true);
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-2" />
                创建新分支
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 创建分支对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitFork className="h-5 w-5" />
              创建新分支
            </DialogTitle>
            <DialogDescription>
              从当前对话创建一个新分支，探索不同的解决方案
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">分支名称</label>
              <Input
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="输入分支名称..."
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">描述 (可选)</label>
              <Input
                value={newBranchDescription}
                onChange={(e) => setNewBranchDescription(e.target.value)}
                placeholder="简短描述这个分支的目的..."
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">分叉点</label>
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border">
                <History className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {forkMessageIndex >= 0
                    ? `从第 ${forkMessageIndex + 1} 条消息分叉`
                    : `从最新消息分叉 (第 ${messages.length} 条)`
                  }
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                新分支将包含分叉点之前的所有消息
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreateBranch} disabled={!newBranchName.trim()}>
              <GitFork className="h-4 w-4 mr-2" />
              创建分支
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              删除分支
            </DialogTitle>
            <DialogDescription>
              确定要删除这个分支吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteDialog && handleDeleteBranch(showDeleteDialog)}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/**
 * 分支消息标记组件 - 用于在消息上显示分叉按钮
 */
export interface BranchMessageMarkerProps {
  messageIndex: number;
  onFork: (messageIndex: number) => void;
  className?: string;
}

export const BranchMessageMarker: React.FC<BranchMessageMarkerProps> = ({
  messageIndex,
  onFork,
  className
}) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity",
        "text-muted-foreground hover:text-primary",
        className
      )}
      onClick={() => onFork(messageIndex)}
      title="从此处创建分支"
    >
      <GitFork className="h-3 w-3 mr-1" />
      <span className="text-xs">分支</span>
    </Button>
  );
};

export default SessionBranch;
