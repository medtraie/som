import { 
  MapPin,
  BarChart3, 
  Package, 
  Truck, 
  Users, 
  ArrowRightLeft, 
  Factory,
  FileText,
  Home,
  PackagePlus,
  UserCircle,
  AlertTriangle,
  Receipt,
  DollarSign,
  Droplet,
  Wrench,
  Settings
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useApp } from "@/contexts/AppContext";
import type { PermissionKey } from "@/contexts/AppContext";

type MenuItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  permission: PermissionKey;
};

const menuItems: MenuItem[] = [
  { title: "Tableau de bord", url: "/", icon: Home, permission: "dashboard" },
  { title: "Inventaire", url: "/inventory", icon: Package, permission: "inventory" },
  { title: "Chauffeurs", url: "/drivers", icon: Users, permission: "drivers" },
  { title: "Clients", url: "/clients", icon: UserCircle, permission: "clients" },
  { title: "Camions", url: "/trucks", icon: Truck, permission: "trucks" },
  { title: "Usine", url: "/factory", icon: Factory, permission: "factory" },
  { title: "Alimenter et Retour", url: "/supply-return", icon: PackagePlus, permission: "supply-return" },
  { title: "Petit Camion", url: "/petit-camion", icon: Truck, permission: "petit-camion" },
  { title: "Échanges", url: "/exchanges", icon: ArrowRightLeft, permission: "exchanges" },
  { title: "Stock Défectueux", url: "/defective-stock", icon: AlertTriangle, permission: "defective-stock" },
  { title: "Gestion Carburant & Huile", url: "/fuel-management", icon: Droplet, permission: "fuel-management" },
  { title: "Gestion des Réparations", url: "/repairs", icon: Wrench, permission: "repairs" },
  { title: "Dépenses Diverses", url: "/expenses", icon: DollarSign, permission: "expenses" },
  { title: "Carte Live", url: "/live-map", icon: MapPin, permission: "live-map" },
  { title: "Recette", url: "/revenue", icon: Receipt, permission: "revenue" },
  { title: "Rapports", url: "/reports", icon: FileText, permission: "reports" },
  { title: "Paramètres", url: "/settings", icon: Settings, permission: "settings" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { hasPermission } = useApp();
  const visibleItems = menuItems.filter(item => hasPermission(item.permission));

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center w-full ${isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`;

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent>
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="font-bold text-lg text-primary uppercase tracking-tight">gaz maroc</h1>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Gestion de distribution</p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span className="ml-3">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
