/**
 * DiffRollback - 交互式 Diff 回滚组件
 * 
 * 在 Diff 视图上显示 Revert 按钮，允许用户回滚文件变更
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Undo2,
  Check,
  AlertTriangle,
  FileText,
  Clock,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import * as Diff from 'diff';

export interface FileChange {
  filePath: string;
  oldContent: string;
  newContent: string;
  changeType: 'create' | 'modify' | 'delete';
  timestamp: number;
  toolCallId?: string;
}

export interface DiffRollbackProps {
  fileChange: FileChange;
  onRollback?: (filePath: string, originalContent: string) => Promise<boolean>;
  onPreview?: (filePath: string) => void;
  className?: string;
}

export const DiffRollback: React.FC<DiffRollbackProps> = ({
  fileChange,
  onRollback,
  onPreview,
  className
}) => {
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackSuccess, setRollbackSuccess] = useState<boolean | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDiff, setShowDiff] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 计算 diff
  const diffLines = Diff.diffLines(fileChange.oldContent, fileChange.newContent);
  
  // 统计变更
  const stats = {
    additions: diffLines.filter(d => d.added).reduce((sum, d) => sum + (d.count || 0), 0),
    deletions: diffLines.filter(d => d.removed).reduce((sum, d) => sum + (d.count || 0), 0),
    unchanged: diffLines.filter(d => !d.added && !d.removed).reduce((sum, d) => sum + (d.count || 0), 0)
  };

  // 执行回滚
  const handleRollback = useCallback(async () => {
    if (!onRollback) return;
    
    setIsRollingBack(true);
    setError(null);
    
    try {
      const success = await onRollback(fileChange.filePath, fileChange.oldContent);
      setRollbackSuccess(success);
      
      if (success) {
        // 3秒后重置状态
        setTimeout(() => {
          setRollbackSuccess(null);
        }, 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '回滚失败');
      setRollbackSuccess(false);
    } finally {
      setIsRollingBack(false);
      setShowConfirmDialog(false);
    }
  }, [onRollback, fileChange.filePath, fileChange.oldContent]);

  // 获取文件名
  const fileName = fileChange.filePath.split('/').pop() || fileChange.filePath;

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 变更类型标签
  const changeTypeLabel = {
    create: { text: '新建', color: 'text-green-500 bg-green-500/10' },
    modify: { text: '修改', color: 'text-blue-500 bg-blue-500/10' },
    delete: { text: '删除', color: 'text-red-500 bg-red-500/10' }
  };

  return (
    <div className={cn("rounded-lg border bg-card overflow-hidden", className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b">
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-mono truncate" title={fileChange.filePath}>
              {fileName}
            </span>
            <Badge 
              variant="outline" 
              className={cn("text-[10px] shrink-0", changeTypeLabel[fileChange.changeType].color)}
            >
              {changeTypeLabel[fileChange.changeType].text}
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {/* 变更统计 */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-green-500">+{stats.additions}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-red-500">-{stats.deletions}</span>
          </div>
          
          {/* 时间 */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatTime(fileChange.timestamp)}</span>
          </div>
          
          {/* 操作按钮 */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setShowDiff(!showDiff)}
              title={showDiff ? "隐藏差异" : "显示差异"}
            >
              {showDiff ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
            
            {onPreview && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => onPreview(fileChange.filePath)}
                title="在编辑器中预览"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            )}
            
            {/* 回滚按钮 */}
            {onRollback && fileChange.changeType !== 'create' && (
              <>
                {rollbackSuccess === true ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-green-500"
                    disabled
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    已回滚
                  </Button>
                ) : rollbackSuccess === false ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-red-500"
                    onClick={() => setShowConfirmDialog(true)}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                    重试
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={isRollingBack}
                  >
                    {isRollingBack ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Undo2 className="h-3.5 w-3.5 mr-1" />
                    )}
                    回滚
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Diff 视图 */}
      <AnimatePresence>
        {showDiff && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="max-h-[400px] overflow-y-auto">
              <pre className="text-xs font-mono p-4 leading-relaxed">
                {diffLines.map((part, index) => {
                  const lines = part.value.split('\n').filter((line, i, arr) => 
                    // 保留换行，但过滤最后一个空行
                    i < arr.length - 1 || line !== ''
                  );
                  
                  return lines.map((line, lineIndex) => (
                    <div
                      key={`${index}-${lineIndex}`}
                      className={cn(
                        "px-2 -mx-2",
                        part.added && "bg-green-500/10 text-green-700 dark:text-green-400",
                        part.removed && "bg-red-500/10 text-red-700 dark:text-red-400 line-through opacity-70"
                      )}
                    >
                      <span className="inline-block w-6 text-muted-foreground/50 select-none">
                        {part.added ? '+' : part.removed ? '-' : ' '}
                      </span>
                      {line || ' '}
                    </div>
                  ));
                })}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 错误提示 */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
          <div className="flex items-center gap-2 text-xs text-red-500">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* 回滚确认对话框 */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <Undo2 className="h-5 w-5" />
              确认回滚
            </DialogTitle>
            <DialogDescription>
              确定要将 <code className="font-mono bg-muted px-1 rounded">{fileName}</code> 恢复到修改前的状态吗？
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-3">
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground">变更统计</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-green-500">+{stats.additions} 行新增</span>
                <span className="text-red-500">-{stats.deletions} 行删除</span>
              </div>
            </div>
            
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-700 dark:text-amber-400">
                <p className="font-medium">注意</p>
                <p className="text-xs mt-1 opacity-80">
                  回滚操作将覆盖当前文件内容。如果文件在此之后有其他修改，这些修改也将丢失。
                </p>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              取消
            </Button>
            <Button
              variant="default"
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleRollback}
              disabled={isRollingBack}
            >
              {isRollingBack ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  回滚中...
                </>
              ) : (
                <>
                  <Undo2 className="h-4 w-4 mr-2" />
                  确认回滚
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/**
 * 批量回滚面板 - 显示多个文件变更并支持批量回滚
 */
export interface BatchRollbackPanelProps {
  fileChanges: FileChange[];
  onRollback: (filePath: string, originalContent: string) => Promise<boolean>;
  onRollbackAll?: () => Promise<boolean>;
  className?: string;
}

export const BatchRollbackPanel: React.FC<BatchRollbackPanelProps> = ({
  fileChanges,
  onRollback,
  onRollbackAll,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRollingBackAll, setIsRollingBackAll] = useState(false);

  const handleRollbackAll = useCallback(async () => {
    if (!onRollbackAll) return;
    
    setIsRollingBackAll(true);
    try {
      await onRollbackAll();
    } finally {
      setIsRollingBackAll(false);
    }
  }, [onRollbackAll]);

  const totalStats = {
    additions: fileChanges.reduce((sum, fc) => {
      const diff = Diff.diffLines(fc.oldContent, fc.newContent);
      return sum + diff.filter(d => d.added).reduce((s, d) => s + (d.count || 0), 0);
    }, 0),
    deletions: fileChanges.reduce((sum, fc) => {
      const diff = Diff.diffLines(fc.oldContent, fc.newContent);
      return sum + diff.filter(d => d.removed).reduce((s, d) => s + (d.count || 0), 0);
    }, 0)
  };

  return (
    <div className={cn("rounded-lg border bg-card overflow-hidden", className)}>
      {/* 头部 */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-muted/30 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium">文件变更</span>
          <Badge variant="outline">{fileChanges.length} 个文件</Badge>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-500">+{totalStats.additions}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-red-500">-{totalStats.deletions}</span>
          </div>
          
          {onRollbackAll && fileChanges.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
              onClick={(e) => {
                e.stopPropagation();
                handleRollbackAll();
              }}
              disabled={isRollingBackAll}
            >
              {isRollingBackAll ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Undo2 className="h-3.5 w-3.5 mr-1" />
              )}
              全部回滚
            </Button>
          )}
        </div>
      </div>

      {/* 文件列表 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="divide-y">
              {fileChanges.map((fileChange, index) => (
                <DiffRollback
                  key={`${fileChange.filePath}-${index}`}
                  fileChange={fileChange}
                  onRollback={onRollback}
                  className="rounded-none border-0"
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DiffRollback;
