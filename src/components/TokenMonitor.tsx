/**
 * TokenMonitor - 实时 Token 与成本监控面板
 * 
 * 显示当前任务消耗的 Token 数量和预估成本
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coins,
  Activity,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Token 定价 (USD per 1M tokens) - 2024年价格
const PRICING = {
  'claude-4-opus': { input: 15, output: 75 },
  'claude-4-sonnet': { input: 3, output: 15 },
  'claude-3.5-sonnet': { input: 3, output: 15 },
  'claude-3-opus': { input: 15, output: 75 },
  'claude-3-sonnet': { input: 3, output: 15 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'sonnet': { input: 3, output: 15 },
  'opus': { input: 15, output: 75 },
  'default': { input: 3, output: 15 }
};

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface TokenMonitorProps {
  usage: TokenUsage;
  model?: string;
  isStreaming?: boolean;
  startTime?: number;
  className?: string;
  variant?: 'compact' | 'full' | 'minimal';
  budgetLimit?: number; // 预算限制 (USD)
  onBudgetExceeded?: () => void;
}

export const TokenMonitor: React.FC<TokenMonitorProps> = ({
  usage,
  model = 'sonnet',
  isStreaming = false,
  startTime,
  className,
  variant = 'compact',
  budgetLimit,
  onBudgetExceeded
}) => {
  const [isExpanded, setIsExpanded] = useState(variant === 'full');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [prevUsage, setPrevUsage] = useState<TokenUsage>(usage);
  const [tokenRate, setTokenRate] = useState(0); // tokens per second

  // 获取模型定价
  const pricing = useMemo(() => {
    const modelKey = model.toLowerCase().replace(/\s+/g, '-');
    return PRICING[modelKey as keyof typeof PRICING] || PRICING.default;
  }, [model]);

  // 计算成本
  const cost = useMemo(() => {
    const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
    const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
    // 缓存读取成本更低 (约10%)
    const cacheReadCost = ((usage.cacheReadTokens || 0) / 1_000_000) * pricing.input * 0.1;
    // 缓存写入成本与输入相同
    const cacheWriteCost = ((usage.cacheWriteTokens || 0) / 1_000_000) * pricing.input;
    return {
      input: inputCost,
      output: outputCost,
      cacheRead: cacheReadCost,
      cacheWrite: cacheWriteCost,
      total: inputCost + outputCost + cacheReadCost + cacheWriteCost
    };
  }, [usage, pricing]);

  // 更新计时器
  useEffect(() => {
    if (!isStreaming || !startTime) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [isStreaming, startTime]);

  // 计算 token 速率
  useEffect(() => {
    if (isStreaming && elapsedTime > 0) {
      const totalTokens = usage.inputTokens + usage.outputTokens;
      const prevTotal = prevUsage.inputTokens + prevUsage.outputTokens;
      const newTokens = totalTokens - prevTotal;
      if (newTokens > 0) {
        setTokenRate(Math.round((usage.outputTokens / (elapsedTime / 1000))));
      }
    }
    setPrevUsage(usage);
  }, [usage, elapsedTime, isStreaming]);

  // 检查预算
  useEffect(() => {
    if (budgetLimit && cost.total >= budgetLimit && onBudgetExceeded) {
      onBudgetExceeded();
    }
  }, [cost.total, budgetLimit, onBudgetExceeded]);

  const totalTokens = usage.inputTokens + usage.outputTokens;
  const budgetPercentage = budgetLimit ? (cost.total / budgetLimit) * 100 : 0;
  const isOverBudget = budgetLimit && cost.total >= budgetLimit;
  const isNearBudget = budgetLimit && budgetPercentage >= 80;

  // 格式化时间
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  // 格式化 token 数量
  const formatTokens = (count: number) => {
    if (count >= 1_000_000) {
      return `${(count / 1_000_000).toFixed(2)}M`;
    }
    if (count >= 1_000) {
      return `${(count / 1_000).toFixed(1)}k`;
    }
    return count.toString();
  };

  // 格式化成本
  const formatCost = (amount: number) => {
    if (amount >= 1) {
      return `$${amount.toFixed(2)}`;
    }
    if (amount >= 0.01) {
      return `$${amount.toFixed(3)}`;
    }
    return `$${amount.toFixed(4)}`;
  };

  // Minimal 视图
  if (variant === 'minimal') {
    return (
      <div className={cn("flex items-center gap-2 text-xs", className)}>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Coins className="h-3 w-3" />
          <span>{formatTokens(totalTokens)}</span>
        </div>
        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <DollarSign className="h-3 w-3" />
          <span>{formatCost(cost.total)}</span>
        </div>
        {isStreaming && (
          <div className="flex items-center gap-1 text-blue-500">
            <Activity className="h-3 w-3 animate-pulse" />
          </div>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden",
        isOverBudget && "border-red-500/50",
        isNearBudget && !isOverBudget && "border-amber-500/50",
        className
      )}
    >
      {/* 头部 - 始终显示 */}
      <div 
        className={cn(
          "flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors",
          variant === 'compact' && "py-1.5"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {/* Token 计数 */}
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "p-1 rounded-md",
              isStreaming ? "bg-blue-500/10 text-blue-500" : "bg-muted text-muted-foreground"
            )}>
              <Coins className="h-3.5 w-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium tabular-nums">
                {formatTokens(totalTokens)}
              </span>
              {variant !== 'compact' && (
                <span className="text-[10px] text-muted-foreground">tokens</span>
              )}
            </div>
          </div>

          {/* 成本 */}
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "p-1 rounded-md",
              isOverBudget ? "bg-red-500/10 text-red-500" : 
              isNearBudget ? "bg-amber-500/10 text-amber-500" : 
              "bg-green-500/10 text-green-500"
            )}>
              <DollarSign className="h-3.5 w-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium tabular-nums">
                {formatCost(cost.total)}
              </span>
              {variant !== 'compact' && (
                <span className="text-[10px] text-muted-foreground">USD</span>
              )}
            </div>
          </div>

          {/* 实时指示器 */}
          {isStreaming && (
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-md bg-blue-500/10">
                <Activity className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
              </div>
              {tokenRate > 0 && variant !== 'compact' && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  ~{tokenRate} tok/s
                </span>
              )}
            </div>
          )}

          {/* 时间 */}
          {elapsedTime > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className="tabular-nums">{formatDuration(elapsedTime)}</span>
            </div>
          )}
        </div>

        {/* 展开/收起按钮 */}
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* 展开的详细信息 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-3 border-t">
              {/* 预算进度条 */}
              {budgetLimit && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">预算使用</span>
                    <span className={cn(
                      "font-medium",
                      isOverBudget && "text-red-500",
                      isNearBudget && !isOverBudget && "text-amber-500"
                    )}>
                      {budgetPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className={cn(
                        "h-full rounded-full",
                        isOverBudget ? "bg-red-500" :
                        isNearBudget ? "bg-amber-500" :
                        "bg-green-500"
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  {isOverBudget && (
                    <div className="flex items-center gap-1 text-xs text-red-500">
                      <AlertTriangle className="h-3 w-3" />
                      <span>已超出预算限制</span>
                    </div>
                  )}
                </div>
              )}

              {/* Token 详细分解 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-md bg-muted/50 space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowDownRight className="h-3 w-3 text-blue-500" />
                    <span>输入</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-medium tabular-nums">
                      {formatTokens(usage.inputTokens)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      ({formatCost(cost.input)})
                    </span>
                  </div>
                </div>
                
                <div className="p-2 rounded-md bg-muted/50 space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowUpRight className="h-3 w-3 text-green-500" />
                    <span>输出</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-medium tabular-nums">
                      {formatTokens(usage.outputTokens)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      ({formatCost(cost.output)})
                    </span>
                  </div>
                </div>

                {(usage.cacheReadTokens || usage.cacheWriteTokens) && (
                  <>
                    {usage.cacheReadTokens && usage.cacheReadTokens > 0 && (
                      <div className="p-2 rounded-md bg-muted/50 space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Zap className="h-3 w-3 text-amber-500" />
                          <span>缓存读取</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm font-medium tabular-nums">
                            {formatTokens(usage.cacheReadTokens)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            ({formatCost(cost.cacheRead)})
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {usage.cacheWriteTokens && usage.cacheWriteTokens > 0 && (
                      <div className="p-2 rounded-md bg-muted/50 space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Zap className="h-3 w-3 text-purple-500" />
                          <span>缓存写入</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm font-medium tabular-nums">
                            {formatTokens(usage.cacheWriteTokens)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            ({formatCost(cost.cacheWrite)})
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 模型信息 */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">模型</span>
                <Badge variant="outline" className="text-[10px]">
                  {model}
                </Badge>
              </div>

              {/* 定价信息 */}
              <div className="text-[10px] text-muted-foreground/70 text-center pt-1 border-t">
                定价: ${pricing.input}/M 输入 · ${pricing.output}/M 输出
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default TokenMonitor;
