import React from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Menu } from "lucide-react";
import { Outlet } from "react-router-dom";

export const Layout: React.FC = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-16 border-b bg-card flex items-center px-6 gap-4">
            <SidebarTrigger className="p-2 hover:bg-accent rounded-md">
              <Menu className="w-4 h-4" />
            </SidebarTrigger>
            
            <div className="flex items-center justify-between w-full">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Système de Distribution de Gaz
                </h2>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  {new Date().toLocaleDateString('fr-FR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
