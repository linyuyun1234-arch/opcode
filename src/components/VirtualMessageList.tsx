/**
 * VirtualMessageList - 虚拟滚动消息列表组件
 * 
 * 使用 @tanstack/react-virtual 实现高性能的消息列表渲染
 * 只渲染屏幕内可见的消息，让性能与消息数量无关
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, ChevronDown, Search, X, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { StreamMessage } from './StreamMessage';
import { ErrorBoundary } from './ErrorBoundary';
import type { ClaudeStreamMessage } from './AgentExecution';

export interface VirtualMessageListProps {
  messages: ClaudeStreamMessage[];
  toolResults: Map<string, any>;
  className?: string;
  isStreaming?: boolean;
  onMessageEdit?: (messageText: string) => void;
  estimateSize?: number;
  overscan?: number;
  searchEnabled?: boolean;
}

export const VirtualMessageList: React.FC<VirtualMessageListProps> = ({
  messages,
  toolResults,
  className,
  isStreaming = false,
  onMessageEdit,
  estimateSize = 150,
  overscan = 5,
  searchEnabled = true
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [hasUserScrolled, setHasUserScrolled] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const prevMessagesLengthRef = useRef(messages.length);
  
  // 搜索状态
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

  // 过滤和搜索消息
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    
    const lowerQuery = searchQuery.toLowerCase();
    const results: number[] = [];
    
    const filtered = messages.filter((msg, index) => {
      let matches = false;
      
      // 搜索文本内容
      if (msg.type === 'assistant' || msg.type === 'user') {
        const content = msg.message?.content;
        if (Array.isArray(content)) {
          matches = content.some(c => {
            if (c.type === 'text') {
              return c.text?.toLowerCase().includes(lowerQuery);
            }
            if (c.type === 'tool_use') {
              return c.name?.toLowerCase().includes(lowerQuery) || 
                     JSON.stringify(c.input).toLowerCase().includes(lowerQuery);
            }
            if (c.type === 'tool_result') {
              const resultContent = typeof c.content === 'string' ? c.content : JSON.stringify(c.content);
              return resultContent.toLowerCase().includes(lowerQuery);
            }
            return false;
          });
        }
      }
      
      // 搜索结果消息
      if (msg.type === 'result') {
        matches = msg.result?.toLowerCase().includes(lowerQuery) || 
                  msg.error?.toLowerCase().includes(lowerQuery);
      }
      
      if (matches) {
        results.push(index);
      }
      
      return matches;
    });
    
    setSearchResults(results);
    return filtered;
  }, [messages, searchQuery]);

  // 虚拟化配置
  const virtualizer = useVirtualizer({
    count: filteredMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    // 启用动态高度测量
    measureElement: (element) => element.getBoundingClientRect().height,
  });

  // 智能自动滚动逻辑
  useEffect(() => {
    const newLength = messages.length;
    const prevLength = prevMessagesLengthRef.current;
    
    if (newLength > prevLength) {
      // 有新消息
      if (!hasUserScrolled) {
        // 用户没有向上滚动，自动滚动到底部
        virtualizer.scrollToIndex(filteredMessages.length - 1, { align: 'end', behavior: 'smooth' });
      } else {
        // 用户已向上滚动，累计新消息计数
        setNewMessagesCount(prev => prev + (newLength - prevLength));
      }
    }
    
    prevMessagesLengthRef.current = newLength;
  }, [messages.length, filteredMessages.length, hasUserScrolled, virtualizer]);

  // 处理滚动事件
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = target;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    // 如果距离底部超过 100px，认为用户主动向上滚动
    const isScrolledUp = distanceFromBottom > 100;
    setHasUserScrolled(isScrolledUp);
    setShowScrollButton(isScrolledUp);
    
    // 如果滚动到底部，清除新消息计数
    if (!isScrolledUp) {
      setNewMessagesCount(0);
    }
  }, []);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    virtualizer.scrollToIndex(filteredMessages.length - 1, { align: 'end', behavior: 'smooth' });
    setHasUserScrolled(false);
    setShowScrollButton(false);
    setNewMessagesCount(0);
  }, [virtualizer, filteredMessages.length]);

  // 导航搜索结果
  const navigateSearch = useCallback((direction: 'prev' | 'next') => {
    if (searchResults.length === 0) return;
    
    let newIndex: number;
    if (direction === 'next') {
      newIndex = (currentSearchIndex + 1) % searchResults.length;
    } else {
      newIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    }
    
    setCurrentSearchIndex(newIndex);
    virtualizer.scrollToIndex(newIndex, { align: 'center', behavior: 'smooth' });
  }, [searchResults.length, currentSearchIndex, virtualizer]);

  // 关闭搜索
  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setCurrentSearchIndex(0);
  }, []);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + F 打开搜索
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && searchEnabled) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      // Escape 关闭搜索
      if (e.key === 'Escape' && isSearchOpen) {
        closeSearch();
      }
      // Enter 跳转下一个搜索结果
      if (e.key === 'Enter' && isSearchOpen && searchResults.length > 0) {
        e.preventDefault();
        navigateSearch(e.shiftKey ? 'prev' : 'next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchEnabled, isSearchOpen, searchResults.length, navigateSearch, closeSearch]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className={cn("relative h-full flex flex-col", className)}>
      {/* 搜索栏 */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-b bg-background/95 backdrop-blur-sm z-10"
          >
            <div className="flex items-center gap-2 p-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索消息内容..."
                  className="pl-8 pr-8 h-8"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              
              {/* 搜索结果导航 */}
              {searchResults.length > 0 && (
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs tabular-nums">
                    {currentSearchIndex + 1} / {searchResults.length}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => navigateSearch('prev')}
                    disabled={searchResults.length <= 1}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => navigateSearch('next')}
                    disabled={searchResults.length <= 1}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              {searchQuery && searchResults.length === 0 && (
                <span className="text-xs text-muted-foreground">无结果</span>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={closeSearch}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 搜索按钮 (当搜索未打开时) */}
      {searchEnabled && !isSearchOpen && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 z-10 h-8 px-2 bg-background/80 backdrop-blur-sm"
          onClick={() => setIsSearchOpen(true)}
        >
          <Search className="h-4 w-4 mr-1" />
          <span className="text-xs">搜索</span>
        </Button>
      )}

      {/* 虚拟滚动容器 */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualItem) => {
            const message = filteredMessages[virtualItem.index];
            const isSearchMatch = searchResults.includes(virtualItem.index);
            const isCurrentSearchMatch = isSearchMatch && virtualItem.index === searchResults[currentSearchIndex];
            
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                className={cn(
                  "absolute top-0 left-0 w-full px-4 py-2",
                  isCurrentSearchMatch && "bg-yellow-500/20 ring-2 ring-yellow-500/50 ring-inset rounded-lg",
                  isSearchMatch && !isCurrentSearchMatch && "bg-yellow-500/10"
                )}
                style={{
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <ErrorBoundary>
                  <StreamMessage
                    message={message}
                    toolResults={toolResults}
                    onEditMessage={onMessageEdit}
                  />
                </ErrorBoundary>
              </div>
            );
          })}
        </div>
      </div>

      {/* 滚动到底部按钮 */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-6 right-6 z-20"
          >
            <Button
              onClick={scrollToBottom}
              className={cn(
                "rounded-full shadow-lg gap-2 pr-4",
                "bg-primary/90 hover:bg-primary",
                "text-primary-foreground"
              )}
              size="sm"
            >
              <ArrowDown className="h-4 w-4" />
              {newMessagesCount > 0 ? (
                <span>
                  {newMessagesCount} 条新消息
                </span>
              ) : (
                <span>滚动到底部</span>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 流式传输指示器 */}
      {isStreaming && !hasUserScrolled && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs">
            <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
            <span>正在接收消息...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtualMessageList;
