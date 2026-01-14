import React, { useState, useEffect } from "react";
import MDEditor from "@uiw/react-md-editor";
import { motion } from "framer-motion";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
  /**
   * Callback to go back to the main view
   */
  onBack: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * MarkdownEditor component for editing the CLAUDE.md system prompt
 * 
 * @example
 * <MarkdownEditor onBack={() => setView('main')} />
 */
export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  className,
}) => {
  const [content, setContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [activeTab, setActiveTab] = useState("edit");
  
  const hasChanges = content !== originalContent;
  
  // Load the system prompt on mount
  useEffect(() => {
    loadSystemPrompt();
  }, []);
  
  const loadSystemPrompt = async () => {
    try {
      setLoading(true);
      setError(null);
      const prompt = await api.getSystemPrompt();
      setContent(prompt);
      setOriginalContent(prompt);
    } catch (err) {
      console.error("Failed to load system prompt:", err);
      setError("Failed to load CLAUDE.md file");
    } finally {
      setLoading(false);
    }
  };
  
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setToast(null);
      await api.saveSystemPrompt(content);
      setOriginalContent(content);
      setToast({ message: "CLAUDE.md saved successfully", type: "success" });
    } catch (err) {
      console.error("Failed to save system prompt:", err);
      setError("Failed to save CLAUDE.md file");
      setToast({ message: "Failed to save CLAUDE.md", type: "error" });
    } finally {
      setSaving(false);
    }
  };
  
  
  return (
    <div className={cn("h-full overflow-y-auto", className)}>
      <div className="max-w-6xl mx-auto flex flex-col h-full">
        {/* Header */}
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">CLAUDE.md</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Edit your Claude Code system prompt
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              size="default"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* Error display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-6 mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/50 text-sm text-destructive"
          >
            {error}
          </motion.div>
        )}
        
        {/* Content */}
        <div className="flex-1 overflow-hidden p-6 flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <TabsList>
                  <TabsTrigger value="edit">Edit</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                <div className="text-xs text-muted-foreground mr-2">
                  {content.length} characters
                </div>
              </div>
              
              <TabsContent value="edit" className="flex-1 mt-0 h-full overflow-hidden border rounded-md border-input bg-transparent ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <textarea
                  className="w-full h-full p-4 resize-none bg-transparent font-mono text-sm focus:outline-none"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter your system prompt here..."
                  spellCheck={false}
                />
              </TabsContent>
              
              <TabsContent value="preview" className="flex-1 mt-0 h-full overflow-y-auto border rounded-md border-border bg-muted/30 p-4">
                <div data-color-mode="dark">
                  <MDEditor.Markdown 
                    source={content} 
                    style={{ background: 'transparent' }}
                  />
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
      
      {/* Toast Notification */}
      <ToastContainer>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </ToastContainer>
    </div>
  );
}; 