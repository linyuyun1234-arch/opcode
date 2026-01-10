import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { api, type MCPServer } from "@/lib/api";
import { MCPServerList } from "./MCPServerList";
import { MCPAddServer } from "./MCPAddServer";
import { MCPImportExport } from "./MCPImportExport";
import { Download, Server, Store, Code } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MCPManagerProps {
  onBack: () => void;
  className?: string;
  initialTab?: string;
}

export const MCPManager: React.FC<MCPManagerProps> = ({
  className: _className,
  initialTab = "servers"
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  
  // Plugin/Skill states
  const [installingPlugin, setInstallingPlugin] = useState<string | null>(null);
  
  // Marketplace State
  const [marketplaceCategory, setMarketplaceCategory] = useState<"all" | "skill" | "mcp" | "lsp">("all");
  const [marketplaceItems, setMarketplaceItems] = useState<{
      id: string;
      name: string; 
      description: string; 
      type: "skill" | "mcp" | "lsp";
      author?: string;
      installed?: boolean;
  }[]>([]);
  
  const [loadingMarketplace, setLoadingMarketplace] = useState(false);


  // Load servers on mount
  useEffect(() => {
    loadServers();
    fetchMarketplaceParams();
  }, []);
  
  const loadServers = async () => {
    try {
      if (servers.length === 0) setLoading(true);
      const list = await api.mcpList();
      setServers(list);
    } catch (err) {
      console.error("Failed to load MCP servers:", err);
      setError("Failed to load MCP configuration.");
    } finally {
      setLoading(false);
    }
  };
  
  const fetchMarketplaceParams = async () => {
      try {
          setError(null);
          setLoadingMarketplace(true);
          
          // 1. Fetch Skills (Actual)
          const skillsRaw = await api.fetchAvailableSkills();
          const skills = skillsRaw.map((s: any) => ({
              id: `skill-${s.name}`,
              name: s.name,
              description: s.description,
              type: "skill" as const,
              author: "Anthropic",
              installed: false // logic to check if installed later
          }));

          // 2. Fetch MCP Servers (Real)
          const mcpRaw = await api.fetchMcpMarketplace();
          const mcpServers = mcpRaw.map((s: any) => ({
              id: `mcp-${s.name}`,
              name: s.name,
              description: s.description || `Official MCP Server: ${s.name}`,
              type: "mcp" as const,
              author: "ModelContextProtocol",
              installed: false
          }));


          // 3. Mock LSPs (Future)
          const lsps = [
              { id: "lsp-python", name: "Python (Pyright)", description: "Python language server for type checking.", type: "lsp" as const, author: "Microsoft" },
              { id: "lsp-ts", name: "TypeScript", description: "TypeScript language server.", type: "lsp" as const, author: "Microsoft" },
          ];

          setMarketplaceItems([...skills, ...mcpServers, ...lsps]);

      } catch(err) {
          console.error("Failed to fetch marketplace:", err);
      } finally {
          setLoadingMarketplace(false);
      }
  }
  
  const handleInstallItem = async (item: typeof marketplaceItems[0]) => {
      try {
          setInstallingPlugin(item.id);
          
          if (item.type === "skill") {
              await api.installSkill(".", item.name); 
              setToast({ message: `Skill ${item.name} installed! Check configuration.`, type: "success" });
          } else if (item.type === "mcp") {
              // Placeholder for MCP Install
              setToast({ message: `MCP Server ${item.name} installation is coming soon.`, type: "success" }); // Temporary
          } else {
               setToast({ message: `LSP Support for ${item.name} is coming soon.`, type: "success" });
          }

          setTimeout(loadServers, 2000);
      } catch (err) {
          setToast({ message: `Failed to install ${item.name}: ${err}`, type: "error" });
      } finally {
          setInstallingPlugin(null);
      }
  }

  const handleServerAdded = () => {
    loadServers();
    setToast({ message: "Server added successfully", type: "success" });
    setActiveTab("servers");
  };

  const handleServerRemoved = (name: string) => {
    setServers(prev => prev.filter(s => s.name !== name));
    setToast({ message: `Server ${name} removed`, type: "success" });
  };

  const handleImportCompleted = () => {
    loadServers();
    setToast({ message: "Configuration imported successfully", type: "success" });
    setActiveTab("servers");
  };
  
  const filteredItems = marketplaceItems.filter(item => 
    marketplaceCategory === "all" ? true : item.type === marketplaceCategory
  );

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto flex flex-col h-full p-8 space-y-8">
        {/* Simple Clean Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
                Extension Hub
              </h1>
              <p className="text-muted-foreground max-w-2xl text-sm">
                Discover and manage capabilities for your Agent.
              </p>
            </div>
            
            {/* Simple Stats */}
            <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="font-medium">{servers.length} Installed</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="font-medium">{marketplaceItems.length} Available</span>
                </div>
            </div>
        </div>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 flex items-center gap-3 text-destructive"
            >
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Tabs */}
        <div className="flex-1">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
              <div className="pb-2">
                  <TabsList className="bg-muted/20 w-fit h-auto p-1 space-x-1 rounded-lg border">
                    <TabsTrigger 
                        value="marketplace" 
                        className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm px-4 py-2 rounded-md transition-all flex items-center gap-2"
                    >
                        <Store className="w-4 h-4" />
                        Marketplace
                    </TabsTrigger>
                    <TabsTrigger 
                        value="servers" 
                        className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm px-4 py-2 rounded-md transition-all flex items-center gap-2"
                    >
                        <Server className="w-4 h-4" />
                        Installed
                    </TabsTrigger>
                    <TabsTrigger 
                        value="add" 
                        className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm px-4 py-2 rounded-md transition-all"
                    >
                       Add Custom
                    </TabsTrigger>
                    <TabsTrigger 
                        value="import" 
                        className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm px-4 py-2 rounded-md transition-all"
                    >
                       Import/Export
                    </TabsTrigger>
                  </TabsList>
              </div>

              {/* MARKETPLACE Tab */}
              <TabsContent value="marketplace" className="outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-6">
                    {/* Category Filter */}
                    <div className="flex items-center gap-2 pb-2">
                        {(["all", "skill", "mcp", "lsp"] as const).map(cat => (
                            <button
                                key={cat}
                                onClick={() => setMarketplaceCategory(cat)}
                                className={cn(
                                    "px-3 py-1 text-xs font-medium rounded-full border transition-all uppercase tracking-wide",
                                    marketplaceCategory === cat 
                                        ? "bg-primary text-primary-foreground border-primary" 
                                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                                )}
                            >
                                {cat === "all" ? "All" : cat === "mcp" ? "MCP Servers" : cat === "lsp" ? "LSP" : "Skills"}
                            </button>
                        ))}
                    </div>

                    {loadingMarketplace ? (
                         <div className="flex flex-col items-center justify-center py-24 gap-4">
                             <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                             <p className="text-muted-foreground font-medium">Loading catalog...</p>
                         </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredItems.map((item) => (
                                <Card key={item.id} className="flex flex-col border bg-card hover:border-primary/50 transition-all hover:shadow-md">
                                    <div className="p-5 flex-1 flex flex-col gap-3">
                                        <div className="flex items-start justify-between">
                                            <div className={cn("p-2 rounded-md", 
                                                item.type === 'skill' ? "bg-purple-500/10 text-purple-600" :
                                                item.type === 'mcp' ? "bg-blue-500/10 text-blue-600" :
                                                "bg-orange-500/10 text-orange-600"
                                            )}>
                                                {item.type === 'skill' ? <Store className="w-5 h-5" /> : 
                                                 item.type === 'mcp' ? <Server className="w-5 h-5" /> :
                                                 <Code className="w-5 h-5" />}
                                            </div>
                                            <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground">
                                                {item.type}
                                            </Badge>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-base">{item.name}</h4>
                                            <p className="text-xs text-muted-foreground mt-1 mb-2">{item.author}</p>
                                            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2" title={item.description}>
                                                {item.description}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="px-5 py-4 border-t bg-muted/5 flex items-center justify-between">
                                        <div className="text-xs text-muted-foreground">
                                           Version 1.0
                                        </div>
                                        <Button 
                                            size="sm" 
                                            variant={installingPlugin === item.id ? "ghost" : "default"}
                                            disabled={installingPlugin === item.id}
                                            onClick={() => handleInstallItem(item)}
                                            className="h-8 gap-2"
                                        >
                                            {installingPlugin === item.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <Download className="w-3 h-3"/>}
                                            {installingPlugin === item.id ? "Installing" : "Install"}
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                    
                    {!loadingMarketplace && filteredItems.length === 0 && (
                        <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                            No items found in this category.
                        </div>
                    )}
                </div>
              </TabsContent>

              {/* Servers Tab */}
              <TabsContent value="servers" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="border-none shadow-none bg-transparent">
                  <MCPServerList
                    servers={servers}
                    loading={loading}
                    onServerRemoved={handleServerRemoved}
                    onRefresh={loadServers}
                  />
                </Card>
              </TabsContent>
              
              {/* Add Server Tab */}
              <TabsContent value="add" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="bg-card/50 backdrop-blur-sm border-muted">
                  <MCPAddServer
                    onServerAdded={handleServerAdded}
                    onError={(message: string) => setToast({ message, type: "error" })}
                  />
                </Card>
              </TabsContent>

              {/* Import/Export Tab */}
              <TabsContent value="import" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="bg-card/50 backdrop-blur-sm border-muted overflow-hidden">
                  <MCPImportExport
                    onImportCompleted={handleImportCompleted}
                    onError={(message: string) => setToast({ message, type: "error" })}
                  />
                </Card>
              </TabsContent>
            </Tabs>
        </div>
      </div>

      {/* Toast Notifications */}
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