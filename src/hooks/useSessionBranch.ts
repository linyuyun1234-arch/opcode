/**
 * useSessionBranch - 会话分支管理 Hook
 * 
 * 提供会话分支的状态管理和操作方法
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { ClaudeStreamMessage } from '@/components/AgentExecution';

export interface Branch {
  id: string;
  name: string;
  parentBranchId: string | null;
  forkMessageIndex: number;
  messages: ClaudeStreamMessage[];
  createdAt: number;
  isActive: boolean;
  description?: string;
}

export interface UseSessionBranchOptions {
  sessionId?: string;
  initialMessages?: ClaudeStreamMessage[];
  onBranchChange?: (branchId: string) => void;
  persistKey?: string; // 用于本地存储的 key
}

export interface UseSessionBranchReturn {
  // 状态
  branches: Branch[];
  currentBranchId: string;
  currentBranch: Branch | null;
  messages: ClaudeStreamMessage[];
  
  // 操作
  createBranch: (name: string, forkMessageIndex: number, description?: string) => string;
  switchBranch: (branchId: string) => void;
  deleteBranch: (branchId: string) => boolean;
  renameBranch: (branchId: string, newName: string) => void;
  mergeBranch: (sourceBranchId: string, targetBranchId: string) => boolean;
  
  // 消息操作
  addMessage: (message: ClaudeStreamMessage) => void;
  addMessages: (messages: ClaudeStreamMessage[]) => void;
  updateMessage: (index: number, message: ClaudeStreamMessage) => void;
  clearMessages: () => void;
  
  // 工具方法
  getBranchHistory: (branchId: string) => Branch[];
  canDeleteBranch: (branchId: string) => boolean;
  exportBranches: () => string;
  importBranches: (data: string) => boolean;
}

// 生成唯一 ID
const generateId = () => `branch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// 默认主分支 ID
const MAIN_BRANCH_ID = 'main';

export function useSessionBranch(options: UseSessionBranchOptions = {}): UseSessionBranchReturn {
  const { 
    sessionId, 
    initialMessages = [], 
    onBranchChange,
    persistKey 
  } = options;

  // 初始化分支状态
  const [branches, setBranches] = useState<Branch[]>(() => {
    // 尝试从本地存储恢复
    if (persistKey) {
      try {
        const stored = localStorage.getItem(`session_branches_${persistKey}`);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (e) {
        console.warn('[useSessionBranch] Failed to restore from localStorage:', e);
      }
    }

    // 创建主分支
    return [{
      id: MAIN_BRANCH_ID,
      name: '主分支',
      parentBranchId: null,
      forkMessageIndex: 0,
      messages: initialMessages,
      createdAt: Date.now(),
      isActive: true
    }];
  });

  const [currentBranchId, setCurrentBranchId] = useState<string>(MAIN_BRANCH_ID);

  // 持久化到本地存储
  useEffect(() => {
    if (persistKey && branches.length > 0) {
      try {
        localStorage.setItem(`session_branches_${persistKey}`, JSON.stringify(branches));
      } catch (e) {
        console.warn('[useSessionBranch] Failed to persist to localStorage:', e);
      }
    }
  }, [branches, persistKey]);

  // 当前分支
  const currentBranch = useMemo(() => 
    branches.find(b => b.id === currentBranchId) || null,
    [branches, currentBranchId]
  );

  // 当前消息列表
  const messages = useMemo(() => 
    currentBranch?.messages || [],
    [currentBranch]
  );

  // 创建分支
  const createBranch = useCallback((
    name: string,
    forkMessageIndex: number,
    description?: string
  ): string => {
    const newId = generateId();
    const parentBranch = branches.find(b => b.id === currentBranchId);
    
    if (!parentBranch) {
      console.error('[useSessionBranch] Parent branch not found');
      return '';
    }

    // 复制分叉点之前的消息
    const forkedMessages = parentBranch.messages.slice(0, forkMessageIndex + 1);

    const newBranch: Branch = {
      id: newId,
      name,
      parentBranchId: currentBranchId,
      forkMessageIndex,
      messages: [...forkedMessages],
      createdAt: Date.now(),
      isActive: false,
      description
    };

    setBranches(prev => [...prev, newBranch]);
    
    // 自动切换到新分支
    setCurrentBranchId(newId);
    setBranches(prev => prev.map(b => ({
      ...b,
      isActive: b.id === newId
    })));

    onBranchChange?.(newId);

    return newId;
  }, [branches, currentBranchId, onBranchChange]);

  // 切换分支
  const switchBranch = useCallback((branchId: string) => {
    const targetBranch = branches.find(b => b.id === branchId);
    if (!targetBranch) {
      console.error('[useSessionBranch] Target branch not found:', branchId);
      return;
    }

    setCurrentBranchId(branchId);
    setBranches(prev => prev.map(b => ({
      ...b,
      isActive: b.id === branchId
    })));

    onBranchChange?.(branchId);
  }, [branches, onBranchChange]);

  // 删除分支
  const deleteBranch = useCallback((branchId: string): boolean => {
    // 不能删除主分支
    if (branchId === MAIN_BRANCH_ID) {
      console.warn('[useSessionBranch] Cannot delete main branch');
      return false;
    }

    // 不能删除有子分支的分支
    const hasChildren = branches.some(b => b.parentBranchId === branchId);
    if (hasChildren) {
      console.warn('[useSessionBranch] Cannot delete branch with children');
      return false;
    }

    // 如果删除的是当前分支，切换到父分支或主分支
    if (branchId === currentBranchId) {
      const branch = branches.find(b => b.id === branchId);
      const targetId = branch?.parentBranchId || MAIN_BRANCH_ID;
      setCurrentBranchId(targetId);
    }

    setBranches(prev => prev.filter(b => b.id !== branchId));
    return true;
  }, [branches, currentBranchId]);

  // 重命名分支
  const renameBranch = useCallback((branchId: string, newName: string) => {
    setBranches(prev => prev.map(b => 
      b.id === branchId ? { ...b, name: newName } : b
    ));
  }, []);

  // 合并分支
  const mergeBranch = useCallback((
    sourceBranchId: string,
    targetBranchId: string
  ): boolean => {
    const sourceBranch = branches.find(b => b.id === sourceBranchId);
    const targetBranch = branches.find(b => b.id === targetBranchId);

    if (!sourceBranch || !targetBranch) {
      console.error('[useSessionBranch] Source or target branch not found');
      return false;
    }

    // 找到共同祖先点
    const forkIndex = sourceBranch.forkMessageIndex;
    
    // 获取源分支中新增的消息
    const newMessages = sourceBranch.messages.slice(forkIndex + 1);

    // 将新消息添加到目标分支
    setBranches(prev => prev.map(b => {
      if (b.id === targetBranchId) {
        return {
          ...b,
          messages: [...b.messages, ...newMessages]
        };
      }
      return b;
    }));

    return true;
  }, [branches]);

  // 添加消息
  const addMessage = useCallback((message: ClaudeStreamMessage) => {
    setBranches(prev => prev.map(b => {
      if (b.id === currentBranchId) {
        return {
          ...b,
          messages: [...b.messages, message]
        };
      }
      return b;
    }));
  }, [currentBranchId]);

  // 批量添加消息
  const addMessages = useCallback((newMessages: ClaudeStreamMessage[]) => {
    setBranches(prev => prev.map(b => {
      if (b.id === currentBranchId) {
        return {
          ...b,
          messages: [...b.messages, ...newMessages]
        };
      }
      return b;
    }));
  }, [currentBranchId]);

  // 更新消息
  const updateMessage = useCallback((index: number, message: ClaudeStreamMessage) => {
    setBranches(prev => prev.map(b => {
      if (b.id === currentBranchId) {
        const newMessages = [...b.messages];
        newMessages[index] = message;
        return {
          ...b,
          messages: newMessages
        };
      }
      return b;
    }));
  }, [currentBranchId]);

  // 清空消息
  const clearMessages = useCallback(() => {
    setBranches(prev => prev.map(b => {
      if (b.id === currentBranchId) {
        return {
          ...b,
          messages: []
        };
      }
      return b;
    }));
  }, [currentBranchId]);

  // 获取分支历史
  const getBranchHistory = useCallback((branchId: string): Branch[] => {
    const history: Branch[] = [];
    let current = branches.find(b => b.id === branchId);

    while (current) {
      history.unshift(current);
      if (current.parentBranchId) {
        current = branches.find(b => b.id === current!.parentBranchId);
      } else {
        break;
      }
    }

    return history;
  }, [branches]);

  // 检查是否可以删除分支
  const canDeleteBranch = useCallback((branchId: string): boolean => {
    if (branchId === MAIN_BRANCH_ID) return false;
    const hasChildren = branches.some(b => b.parentBranchId === branchId);
    return !hasChildren;
  }, [branches]);

  // 导出分支数据
  const exportBranches = useCallback((): string => {
    return JSON.stringify({
      version: 1,
      sessionId,
      branches,
      currentBranchId,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }, [branches, currentBranchId, sessionId]);

  // 导入分支数据
  const importBranches = useCallback((data: string): boolean => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.version !== 1 || !Array.isArray(parsed.branches)) {
        throw new Error('Invalid format');
      }

      setBranches(parsed.branches);
      setCurrentBranchId(parsed.currentBranchId || MAIN_BRANCH_ID);
      return true;
    } catch (e) {
      console.error('[useSessionBranch] Failed to import branches:', e);
      return false;
    }
  }, []);

  return {
    // 状态
    branches,
    currentBranchId,
    currentBranch,
    messages,
    
    // 分支操作
    createBranch,
    switchBranch,
    deleteBranch,
    renameBranch,
    mergeBranch,
    
    // 消息操作
    addMessage,
    addMessages,
    updateMessage,
    clearMessages,
    
    // 工具方法
    getBranchHistory,
    canDeleteBranch,
    exportBranches,
    importBranches
  };
}

export default useSessionBranch;
