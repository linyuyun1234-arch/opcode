/**
 * fileNavigation - 交互式文件控制服务
 * 
 * 提供文件导航功能，让 Agent 可以控制编辑器打开、高亮文件
 */

import { invoke } from '@tauri-apps/api/core';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface FileLocation {
  filePath: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface FileNavigationEvent {
  type: 'open' | 'highlight' | 'goto' | 'close';
  location: FileLocation;
  preview?: boolean; // 是否只是预览（不聚焦）
  source?: string; // 事件来源（如 'agent', 'user'）
}

export interface FileHighlight {
  filePath: string;
  startLine: number;
  endLine: number;
  className?: string;
  message?: string;
}

// 事件名称常量
export const FILE_NAVIGATION_EVENTS = {
  OPEN_FILE: 'file-navigation:open',
  HIGHLIGHT_LINE: 'file-navigation:highlight',
  GOTO_LINE: 'file-navigation:goto',
  CLOSE_FILE: 'file-navigation:close',
  FILE_OPENED: 'file-navigation:opened',
  FILE_CLOSED: 'file-navigation:closed',
  NAVIGATION_ERROR: 'file-navigation:error'
} as const;

/**
 * 文件导航服务类
 */
class FileNavigationService {
  private listeners: Map<string, UnlistenFn[]> = new Map();
  private pendingHighlights: FileHighlight[] = [];
  private isInitialized = false;

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // 设置事件监听器
    try {
      // 监听文件打开事件（用于应用高亮）
      const openedUnlisten = await listen(FILE_NAVIGATION_EVENTS.FILE_OPENED, (event) => {
        const { filePath } = event.payload as { filePath: string };
        this.applyPendingHighlights(filePath);
      });
      
      this.listeners.set('opened', [openedUnlisten]);
      this.isInitialized = true;
    } catch (error) {
      console.error('[FileNavigation] Failed to initialize:', error);
    }
  }

  /**
   * 清理服务
   */
  async cleanup(): Promise<void> {
    for (const unlisteners of this.listeners.values()) {
      for (const unlisten of unlisteners) {
        unlisten();
      }
    }
    this.listeners.clear();
    this.pendingHighlights = [];
    this.isInitialized = false;
  }

  /**
   * 打开文件
   */
  async openFile(
    filePath: string, 
    options: { 
      line?: number; 
      column?: number; 
      preview?: boolean;
      highlight?: boolean;
    } = {}
  ): Promise<boolean> {
    try {
      const event: FileNavigationEvent = {
        type: 'open',
        location: {
          filePath,
          line: options.line,
          column: options.column
        },
        preview: options.preview
      };

      // 发送事件到前端
      await emit(FILE_NAVIGATION_EVENTS.OPEN_FILE, event);

      // 如果需要高亮且有行号
      if (options.highlight && options.line) {
        this.addPendingHighlight({
          filePath,
          startLine: options.line,
          endLine: options.line,
          className: 'bg-yellow-500/20 border-l-2 border-yellow-500'
        });
      }

      // 尝试通过 Tauri 命令打开文件（如果有对应的后端命令）
      try {
        await invoke('open_file_in_editor', { 
          filePath, 
          line: options.line || 1,
          column: options.column || 1
        });
      } catch (e) {
        // 后端命令可能不存在，忽略错误
        console.debug('[FileNavigation] Backend command not available:', e);
      }

      return true;
    } catch (error) {
      console.error('[FileNavigation] Failed to open file:', error);
      await emit(FILE_NAVIGATION_EVENTS.NAVIGATION_ERROR, { 
        error: error instanceof Error ? error.message : 'Unknown error',
        filePath 
      });
      return false;
    }
  }

  /**
   * 跳转到指定行
   */
  async gotoLine(filePath: string, line: number, column?: number): Promise<boolean> {
    try {
      const event: FileNavigationEvent = {
        type: 'goto',
        location: { filePath, line, column }
      };

      await emit(FILE_NAVIGATION_EVENTS.GOTO_LINE, event);
      return true;
    } catch (error) {
      console.error('[FileNavigation] Failed to goto line:', error);
      return false;
    }
  }

  /**
   * 高亮文件中的行
   */
  async highlightLines(
    filePath: string,
    startLine: number,
    endLine?: number,
    options: {
      className?: string;
      message?: string;
      duration?: number; // 毫秒，0 表示永久
    } = {}
  ): Promise<boolean> {
    try {
      const highlight: FileHighlight = {
        filePath,
        startLine,
        endLine: endLine || startLine,
        className: options.className || 'bg-yellow-500/20',
        message: options.message
      };

      await emit(FILE_NAVIGATION_EVENTS.HIGHLIGHT_LINE, highlight);

      // 如果有持续时间，设置定时清除
      if (options.duration && options.duration > 0) {
        setTimeout(() => {
          this.clearHighlights(filePath, startLine, endLine);
        }, options.duration);
      }

      return true;
    } catch (error) {
      console.error('[FileNavigation] Failed to highlight lines:', error);
      return false;
    }
  }

  /**
   * 清除高亮
   */
  async clearHighlights(filePath?: string, startLine?: number, endLine?: number): Promise<void> {
    await emit('file-navigation:clear-highlights', { filePath, startLine, endLine });
  }

  /**
   * 关闭文件
   */
  async closeFile(filePath: string): Promise<boolean> {
    try {
      const event: FileNavigationEvent = {
        type: 'close',
        location: { filePath }
      };

      await emit(FILE_NAVIGATION_EVENTS.CLOSE_FILE, event);
      return true;
    } catch (error) {
      console.error('[FileNavigation] Failed to close file:', error);
      return false;
    }
  }

  /**
   * 导航到错误位置
   */
  async gotoError(
    filePath: string,
    line: number,
    column?: number,
    message?: string
  ): Promise<boolean> {
    // 先打开文件
    await this.openFile(filePath, { line, column });
    
    // 高亮错误行
    await this.highlightLines(filePath, line, line, {
      className: 'bg-red-500/20 border-l-2 border-red-500',
      message,
      duration: 5000 // 5秒后清除
    });

    return true;
  }

  /**
   * 从 Agent 消息中解析文件引用
   */
  parseFileReferences(text: string): FileLocation[] {
    const locations: FileLocation[] = [];
    
    // 匹配各种文件引用格式
    const patterns = [
      // 标准路径:行号:列号 格式
      /(?:^|\s)([\/\w\-\.]+\.\w+):(\d+)(?::(\d+))?/gm,
      // 反引号包围的路径
      /`([\/\w\-\.]+\.\w+)`(?:\s*(?:line|行)\s*(\d+))?/gm,
      // "在 xxx 文件" 格式
      /在\s*(?:`)?([\/\w\-\.]+\.\w+)(?:`)?\s*(?:的?\s*第?\s*(\d+)\s*行)?/gm,
      // Error at file:line 格式
      /(?:error|错误|Error)\s+(?:at|在)\s+([\/\w\-\.]+\.\w+):(\d+)/gm
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const [, filePath, line, column] = match;
        if (filePath && !filePath.startsWith('http')) {
          locations.push({
            filePath,
            line: line ? parseInt(line, 10) : undefined,
            column: column ? parseInt(column, 10) : undefined
          });
        }
      }
    }

    // 去重
    return locations.filter((loc, index, self) =>
      index === self.findIndex(l => 
        l.filePath === loc.filePath && l.line === loc.line
      )
    );
  }

  /**
   * 添加待处理的高亮
   */
  private addPendingHighlight(highlight: FileHighlight): void {
    this.pendingHighlights.push(highlight);
  }

  /**
   * 应用待处理的高亮
   */
  private async applyPendingHighlights(filePath: string): Promise<void> {
    const pending = this.pendingHighlights.filter(h => h.filePath === filePath);
    this.pendingHighlights = this.pendingHighlights.filter(h => h.filePath !== filePath);

    for (const highlight of pending) {
      await this.highlightLines(
        highlight.filePath,
        highlight.startLine,
        highlight.endLine,
        {
          className: highlight.className,
          message: highlight.message
        }
      );
    }
  }

  /**
   * 监听文件导航事件
   */
  async onFileNavigation(
    callback: (event: FileNavigationEvent) => void
  ): Promise<UnlistenFn> {
    const unlisteners: UnlistenFn[] = [];

    for (const eventName of Object.values(FILE_NAVIGATION_EVENTS)) {
      const unlisten = await listen(eventName, (event) => {
        callback(event.payload as FileNavigationEvent);
      });
      unlisteners.push(unlisten);
    }

    return () => {
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }
}

// 导出单例
export const fileNavigation = new FileNavigationService();

/**
 * React Hook: 使用文件导航
 */
export function useFileNavigation() {
  return {
    openFile: fileNavigation.openFile.bind(fileNavigation),
    gotoLine: fileNavigation.gotoLine.bind(fileNavigation),
    highlightLines: fileNavigation.highlightLines.bind(fileNavigation),
    clearHighlights: fileNavigation.clearHighlights.bind(fileNavigation),
    closeFile: fileNavigation.closeFile.bind(fileNavigation),
    gotoError: fileNavigation.gotoError.bind(fileNavigation),
    parseFileReferences: fileNavigation.parseFileReferences.bind(fileNavigation)
  };
}

export default fileNavigation;
