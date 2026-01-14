/**
 * useFileChanges - 文件变更追踪 Hook
 * 
 * 追踪 Agent 对文件的变更，支持回滚操作
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { api } from '@/lib/api';
import type { FileChange } from '@/components/DiffRollback';

export interface UseFileChangesOptions {
  sessionId?: string;
  maxChanges?: number; // 最大追踪的变更数量
  autoTrack?: boolean; // 是否自动追踪工具调用中的文件变更
}

export interface UseFileChangesReturn {
  fileChanges: FileChange[];
  
  // 操作
  trackChange: (change: FileChange) => void;
  rollback: (filePath: string, originalContent: string) => Promise<boolean>;
  rollbackAll: () => Promise<boolean>;
  clearChanges: () => void;
  
  // 查询
  getChangesByFile: (filePath: string) => FileChange[];
  getLatestChange: (filePath: string) => FileChange | null;
  hasChanges: boolean;
  
  // 状态
  isTrackingEnabled: boolean;
  setTrackingEnabled: (enabled: boolean) => void;
}

export function useFileChanges(options: UseFileChangesOptions = {}): UseFileChangesReturn {
  const { 
    sessionId, 
    maxChanges = 100,
    autoTrack = true 
  } = options;

  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [isTrackingEnabled, setTrackingEnabled] = useState(autoTrack);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // 自动追踪工具调用中的文件变更
  useEffect(() => {
    if (!isTrackingEnabled || !sessionId) return;

    const setupListener = async () => {
      try {
        // 监听文件写入事件
        const unlisten = await listen<{
          filePath: string;
          oldContent: string;
          newContent: string;
          toolCallId?: string;
        }>(`file-change:${sessionId}`, (event) => {
          const { filePath, oldContent, newContent, toolCallId } = event.payload;
          
          trackChange({
            filePath,
            oldContent,
            newContent,
            changeType: oldContent ? 'modify' : 'create',
            timestamp: Date.now(),
            toolCallId
          });
        });

        unlistenRef.current = unlisten;
      } catch (e) {
        console.warn('[useFileChanges] Failed to setup listener:', e);
      }
    };

    setupListener();

    return () => {
      unlistenRef.current?.();
    };
  }, [sessionId, isTrackingEnabled]);

  // 追踪文件变更
  const trackChange = useCallback((change: FileChange) => {
    setFileChanges(prev => {
      const newChanges = [change, ...prev];
      // 限制最大数量
      if (newChanges.length > maxChanges) {
        return newChanges.slice(0, maxChanges);
      }
      return newChanges;
    });
  }, [maxChanges]);

  // 回滚单个文件
  const rollback = useCallback(async (
    filePath: string, 
    originalContent: string
  ): Promise<boolean> => {
    try {
      // 调用后端 API 写入原始内容
      await api.saveClaudeMdFile(filePath, originalContent);
      
      // 从变更列表中移除该文件的变更
      setFileChanges(prev => prev.filter(c => c.filePath !== filePath));
      
      return true;
    } catch (error) {
      console.error('[useFileChanges] Failed to rollback:', error);
      return false;
    }
  }, []);

  // 回滚所有变更
  const rollbackAll = useCallback(async (): Promise<boolean> => {
    try {
      // 按时间倒序回滚，确保正确的顺序
      const sortedChanges = [...fileChanges].sort((a, b) => b.timestamp - a.timestamp);
      
      // 去重，每个文件只回滚一次（使用最早的版本）
      const fileMap = new Map<string, FileChange>();
      for (const change of sortedChanges) {
        if (!fileMap.has(change.filePath)) {
          fileMap.set(change.filePath, change);
        }
      }

      let allSuccess = true;
      for (const [filePath, change] of fileMap) {
        if (change.changeType !== 'create') {
          const success = await rollback(filePath, change.oldContent);
          if (!success) {
            allSuccess = false;
          }
        }
      }

      if (allSuccess) {
        setFileChanges([]);
      }

      return allSuccess;
    } catch (error) {
      console.error('[useFileChanges] Failed to rollback all:', error);
      return false;
    }
  }, [fileChanges, rollback]);

  // 清除所有变更记录
  const clearChanges = useCallback(() => {
    setFileChanges([]);
  }, []);

  // 获取指定文件的所有变更
  const getChangesByFile = useCallback((filePath: string): FileChange[] => {
    return fileChanges.filter(c => c.filePath === filePath);
  }, [fileChanges]);

  // 获取指定文件的最新变更
  const getLatestChange = useCallback((filePath: string): FileChange | null => {
    const changes = getChangesByFile(filePath);
    return changes.length > 0 ? changes[0] : null;
  }, [getChangesByFile]);

  const hasChanges = fileChanges.length > 0;

  return {
    fileChanges,
    
    trackChange,
    rollback,
    rollbackAll,
    clearChanges,
    
    getChangesByFile,
    getLatestChange,
    hasChanges,
    
    isTrackingEnabled,
    setTrackingEnabled
  };
}

export default useFileChanges;
