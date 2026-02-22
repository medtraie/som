import React, { useMemo, useState } from 'react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useApp } from '@/contexts/AppContext';
import OilBarrelsWidget from '@/components/dashboard/OilBarrelsWidget';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { safeDate } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { 
  Package, 
  Truck, 
  Users, 
  TrendingUp,
  AlertTriangle,
  DollarSign,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ArrowUpDown,
  Plus,
  History,
  Settings,
  Activity,
  Fuel,
  Droplets,
  Wrench,
  CreditCard,
  TrendingDown
} from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { 
    bottleTypes = [], 
    trucks = [], 
    drivers = [], 
    transactions = [],
    expenses = [],
    repairs = [],
    financialTransactions = [],
    revenues = [],
    emptyBottlesStock = [],
    cashOperations = [],
    stockHistory = []
  } = useApp();

  // Debug logging
  console.log('Dashboard Data:', { 
    bottleTypesCount: bottleTypes.length,
    emptyBottlesStockCount: emptyBottlesStock.length,
    financialTransactionsCount: financialTransactions.length,
    revenuesCount: revenues.length
  });

  const getStockMetrics = (bt: any) => {
    const totalStored = Number(bt?.totalQuantity || 0);
    const distributed = Number(bt?.distributedQuantity || 0);
    const emptyStockEntry = emptyBottlesStock.find(s => s.bottleTypeId === bt.id);
    const warehouseEmpty = Number(emptyStockEntry?.quantity || 0);
    const warehouseFull = Math.max(totalStored - distributed, 0);
    const totalAssets = totalStored > 0 ? totalStored : (warehouseFull + warehouseEmpty + distributed);
    const fullAssets = warehouseFull + distributed;
    return { warehouseFull, warehouseEmpty, distributed, fullAssets, totalAssets };
  };

  const getRemainingQuantity = (bt: any) => {
    const { warehouseFull } = getStockMetrics(bt);
    return warehouseFull;
  };

  const getTotalQuantity = (bt: any) => {
    const { totalAssets } = getStockMetrics(bt);
    return totalAssets;
  };

  const getStockStatus = (remaining: number) => {
    const r = Number(remaining || 0);
    if (r < 100) return { label: 'Critique', color: 'bg-red-500', badge: 'destructive' as const };
    if (r < 300) return { label: 'Faible', color: 'bg-orange-500', badge: 'secondary' as const };
    if (r < 600) return { label: 'Moyen', color: 'bg-yellow-500', badge: 'outline' as const };
    if (r < 1000) return { label: 'Bon', color: 'bg-green-500', badge: 'default' as const };
    return { label: 'Normal', color: 'bg-green-500', badge: 'default' as const };
  };

  // Calculate metrics
  // Stock Total represents total assets (Full + Empty + Distributed)
  const totalStock = useMemo(() => {
    return bottleTypes.reduce((sum, bt) => {
      const { totalAssets } = getStockMetrics(bt);
      return sum + totalAssets;
    }, 0);
  }, [bottleTypes, emptyBottlesStock]);
  
  const totalValue = useMemo(() => bottleTypes.reduce((sum, bt) => {
    const { warehouseFull } = getStockMetrics(bt);
    return sum + (warehouseFull * (Number(bt.unitPrice) || 0));
  }, 0), [bottleTypes, emptyBottlesStock]);

  const activeTrucks = trucks.filter(t => t.isActive).length;
  const totalDriverDebt = useMemo(() => drivers.reduce((sum, d) => sum + Math.abs(d.debt || 0), 0), [drivers]);
  
  // Use percentage < 20% for low stock alert
  // Alert based on Full Bottles availability vs Total Assets
  const lowStockBottles = bottleTypes.filter(bt => {
    const remaining = getRemainingQuantity(bt);
    const status = getStockStatus(remaining);
    return status.label === 'Critique' || status.label === 'Faible';
  });
  
  const totalExpenses = useMemo(() => 
    expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) +
    repairs.reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0),
  [expenses, repairs]);

  const { totalRevenue, netBalance } = useMemo(() => {
    // 1. Financial Transactions (New System)
    const finRevenue = financialTransactions
      .filter(t => t.type === 'encaissement' || t.type === 'versement')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      
    const finExpenses = financialTransactions
      .filter(t => t.type === 'retrait' || t.type === 'dépense' || t.type === 'réparation')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

    // 2. Driver Payments (Transactions table)
    // Include 'payment' and 'credit' types as per Drivers page logic
    const driverPayments = transactions
      .filter(t => t.type === 'payment' || t.type === 'credit')
      .reduce((sum, t) => {
        // Handle various amount fields
        const val = t.amount ?? t.montant ?? t.value ?? t.totalValue ?? 0;
        return sum + (Number(val) || 0);
      }, 0);

    // 3. Manual Revenues (Legacy)
    const legacyRevenue = revenues.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    
    // 4. Expenses (Legacy)
    const legacyExpenses = 
      expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) +
      repairs.reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0);

    // Aggregation Strategy:
    // Revenue = Driver Payments + Manual Revenues + Financial Transactions (encaissement)
    // We assume these are distinct entries. 
    // If a driver payment is manually entered in revenues, it might duplicate, but usually systems are separate.
    // Financial Transactions are likely distinct from legacy transactions.
    
    const finalRevenue = driverPayments + legacyRevenue + finRevenue;
    const finalExpenses = legacyExpenses + finExpenses;
    
    return { 
      totalRevenue: finalRevenue, 
      netBalance: finalRevenue - finalExpenses 
    };
  }, [financialTransactions, revenues, expenses, repairs, transactions]);
  
  const today = new Date().toLocaleDateString('fr-FR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const quickActions = [
    { label: 'Nouvelle Vente', icon: Plus, path: '/supply-return', color: 'bg-blue-500' },
    { label: 'Dépense', icon: CreditCard, path: '/expenses', color: 'bg-red-500' },
    { label: 'Carburant', icon: Fuel, path: '/fuel', color: 'bg-orange-500' },
    { label: 'Réparation', icon: Wrench, path: '/repairs', color: 'bg-purple-500' },
  ];

  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'critique' | 'faible' | 'moyen' | 'bon' | 'normal'>('all');
  const [stockSort, setStockSort] = useState<'remaining-asc' | 'remaining-desc'>('remaining-desc');

  const getTruckLabel = (truckId?: string) => {
    if (!truckId) return '';
    const trk: any = trucks.find(t => String(t.id) === String(truckId));
    return trk?.matricule || trk?.name || trk?.plateNumber || '';
  };
  const getDriverLabel = (driverId?: string, truckId?: string) => {
    const id = driverId || trucks.find(t => String(t.id) === String(truckId))?.driverId;
    if (!id) return '';
    return drivers.find(d => String(d.id) === String(id))?.name || '';
  };
  const sumBottleQty = (list?: Array<{ quantity?: number }>) =>
    (Array.isArray(list) ? list.reduce((s, i) => s + (Number(i.quantity) || 0), 0) : 0);
  const normalizeDate = (obj: any) =>
    safeDate(obj?.date || obj?.dateISO || obj?.createdAt);

  const recentActivities = useMemo(() => {
    const items: Array<{
      id: string;
      date: Date;
      title: string;
      subtitle?: string;
      iconBg: string;
      icon: React.ReactNode;
      amount?: number;
    }> = [];
    // Transactions
    transactions.forEach((t: any) => {
      const truck = getTruckLabel(t.truckId);
      const driver = getDriverLabel(t.driverId, t.truckId);
      const totalQty = sumBottleQty(t.bottleTypes);
      const date = normalizeDate(t);
      let title = 'Opération';
      let iconBg = 'bg-slate-100 text-slate-600';
      let icon: React.ReactNode = <Activity className="w-4 h-4" />;
      let amount = Number(t.totalValue || t.amount || t.totalVentes || 0);
      if (t.type === 'supply') {
        title = 'Alimentation Camion';
        iconBg = 'bg-blue-100 text-blue-600';
        icon = <ArrowUpRight className="w-4 h-4" />;
      } else if (t.type === 'return') {
        title = 'Retour Camion';
        iconBg = 'bg-green-100 text-green-600';
        icon = <ArrowDownRight className="w-4 h-4" />;
      } else if (t.type === 'exchange') {
        title = 'Échange Bouteilles';
        iconBg = 'bg-orange-100 text-orange-600';
        icon = <Package className="w-4 h-4" />;
      } else if (t.type === 'payment') {
        title = 'Paiement Chauffeur';
        iconBg = 'bg-emerald-100 text-emerald-600';
        icon = <DollarSign className="w-4 h-4" />;
      } else if (t.type === 'debt') {
        title = 'Dette Chauffeur';
        iconBg = 'bg-red-100 text-red-600';
        icon = <TrendingDown className="w-4 h-4" />;
      } else if (t.type === 'factory') {
        title = 'Usine';
        iconBg = 'bg-slate-100 text-slate-600';
        icon = <Droplets className="w-4 h-4" />;
      }
      const subtitle = [truck, driver, totalQty ? `${totalQty} unités` : null]
        .filter(Boolean)
        .join(' · ');
      items.push({
        id: String(t.id ?? `${title}-${date.getTime()}`),
        date,
        title,
        subtitle,
        iconBg,
        icon,
        amount: amount > 0 ? amount : undefined,
      });
    });
    // Expenses
    expenses.forEach((e: any) => {
      const date = normalizeDate(e);
      items.push({
        id: String(e.id ?? `expense-${date.getTime()}`),
        date,
        title: `Dépense: ${e.type}`,
        subtitle: String(e.paymentMethod || '').toUpperCase(),
        iconBg: 'bg-red-100 text-red-600',
        icon: <CreditCard className="w-4 h-4" />,
        amount: Number(e.amount || 0) || undefined,
      });
    });
    // Repairs
    repairs.forEach((r: any) => {
      const date = normalizeDate(r);
      const truck = getTruckLabel(r.truckId);
      items.push({
        id: String(r.id ?? `repair-${date.getTime()}`),
        date,
        title: `Réparation: ${r.type}`,
        subtitle: truck,
        iconBg: 'bg-purple-100 text-purple-600',
        icon: <Wrench className="w-4 h-4" />,
        amount: Number(r.totalCost || 0) || undefined,
      });
    });
    // Financial Transactions
    financialTransactions.forEach((f: any) => {
      const date = normalizeDate(f);
      let title = 'Transaction';
      let iconBg = 'bg-slate-100 text-slate-600';
      let icon: React.ReactNode = <BarChart3 className="w-4 h-4" />;
      if (f.type === 'encaissement' || f.type === 'versement') {
        title = f.type === 'encaissement' ? 'Encaissement' : 'Versement';
        iconBg = 'bg-green-100 text-green-600';
        icon = <DollarSign className="w-4 h-4" />;
      } else if (f.type === 'retrait') {
        title = 'Retrait';
        iconBg = 'bg-orange-100 text-orange-600';
        icon = <TrendingDown className="w-4 h-4" />;
      } else if (f.type === 'dépense' || f.type === 'réparation') {
        title = f.type === 'dépense' ? 'Dépense' : 'Réparation';
        iconBg = 'bg-red-100 text-red-600';
        icon = <CreditCard className="w-4 h-4" />;
      }
      items.push({
        id: String(f.id ?? `fin-${date.getTime()}`),
        date,
        title,
        subtitle: f.description || '',
        iconBg,
        icon,
        amount: Number(f.amount || 0) || undefined,
      });
    });
    // Revenues
    revenues.forEach((rev: any) => {
      const date = normalizeDate(rev);
      const ref = rev.relatedOrderId ? `Réf: ${String(rev.relatedOrderId).slice(-6)}` : '';
      const driver = rev.driverName || '';
      const total = Number(rev.totalAmount || rev.amount || rev.cashAmount || 0);
      items.push({
        id: String(rev.id ?? `rev-${date.getTime()}`),
        date,
        title: 'Recette',
        subtitle: [driver, ref].filter(Boolean).join(' · '),
        iconBg: 'bg-emerald-100 text-emerald-600',
        icon: <TrendingUp className="w-4 h-4" />,
        amount: total || undefined,
      });
    });
    // Cash Operations
    cashOperations.forEach((op: any) => {
      const date = normalizeDate(op);
      const isDeposit = op.type === 'versement';
      items.push({
        id: String(op.id ?? `cash-${date.getTime()}`),
        date,
        title: isDeposit ? 'Versement' : 'Retrait',
        subtitle: String(op.accountAffected || '').toUpperCase(),
        iconBg: isDeposit ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600',
        icon: isDeposit ? <DollarSign className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />,
        amount: Number(op.amount || 0) || undefined,
      });
    });
    // Stock History (Empty Bottles)
    stockHistory.forEach((h: any) => {
      const date = normalizeDate(h);
      const isAdd = h.changeType === 'add' || h.changeType === 'return';
      items.push({
        id: String(h.id ?? `stock-${date.getTime()}`),
        date,
        title: 'Stock Vides',
        subtitle: `${h.bottleTypeName || ''} · ${isAdd ? '+' : '-'}${h.quantity || 0}`,
        iconBg: isAdd ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600',
        icon: <History className="w-4 h-4" />,
      });
    });
    items.sort((a, b) => b.date.getTime() - a.date.getTime());
    return items.slice(0, 8);
  }, [transactions, expenses, repairs, financialTransactions, revenues, cashOperations, stockHistory, trucks, drivers]);

  return (
    <div className="p-6 space-y-8 bg-slate-50/50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Activity className="w-5 h-5 animate-pulse" />
            <span className="text-sm font-semibold uppercase tracking-wider">Vue d'ensemble</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">Tableau de bord</h1>
          <div className="flex items-center gap-2 text-muted-foreground mt-2">
            <Calendar className="w-4 h-4" />
            <span className="capitalize">{today}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="bg-white shadow-sm">
            <History className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
          <Button size="sm" onClick={() => navigate('/supply-return')} className="shadow-md">
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle Opération
          </Button>
        </div>
      </div>

      {/* Metrics Summary */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Stock Total"
          value={`${totalStock.toLocaleString()} unités`}
          icon={Package}
          className="border-none shadow-sm bg-gradient-to-br from-white to-blue-50/30"
          trend={{ value: 5.2, isPositive: true }}
        />
        <MetricCard
          title="Revenu Total"
          value={`${totalRevenue.toLocaleString()} DH`}
          icon={TrendingUp}
          className="border-none shadow-sm bg-gradient-to-br from-white to-green-50/30"
          valueClassName="text-green-600"
          trend={{ value: 12.5, isPositive: true }}
        />
        <MetricCard
          title="Camions Actifs"
          value={`${activeTrucks}/${trucks.length}`}
          icon={Truck}
          className="border-none shadow-sm bg-gradient-to-br from-white to-orange-50/30"
        />
        <MetricCard
          title="Dettes Chauffeurs"
          value={`${totalDriverDebt.toLocaleString()} DH`}
          icon={Users}
          className="border-none shadow-sm bg-gradient-to-br from-white to-red-50/30"
          valueClassName="text-destructive"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions - New Section */}
        <Card className="lg:col-span-3 border-none shadow-sm bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Actions Rapides
            </CardTitle>
            <CardDescription>Accédez rapidement aux fonctions essentielles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  className="h-24 flex flex-col items-center justify-center gap-3 hover:border-primary hover:bg-primary/5 transition-all group"
                  onClick={() => navigate(action.path)}
                >
                  <div className={`p-3 rounded-xl ${action.color} text-white group-hover:scale-110 transition-transform shadow-sm`}>
                    <action.icon className="w-6 h-6" />
                  </div>
                  <span className="font-semibold text-sm">{action.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stock Status - Modernized */}
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  État des Stocks
                </CardTitle>
                <CardDescription>Niveau actuel par type de bouteille</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/inventory')}>
                Gérer le stock
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <ToggleGroup type="single" value={stockStatusFilter} onValueChange={(v) => setStockStatusFilter((v as any) || 'all')} className="gap-2">
                <ToggleGroupItem value="all" className="px-2 py-1 text-xs">Tous</ToggleGroupItem>
                <ToggleGroupItem value="critique" className="px-2 py-1 text-xs">Critique</ToggleGroupItem>
                <ToggleGroupItem value="faible" className="px-2 py-1 text-xs">Faible</ToggleGroupItem>
                <ToggleGroupItem value="moyen" className="px-2 py-1 text-xs">Moyen</ToggleGroupItem>
                <ToggleGroupItem value="bon" className="px-2 py-1 text-xs">Bon</ToggleGroupItem>
                <ToggleGroupItem value="normal" className="px-2 py-1 text-xs">Normal</ToggleGroupItem>
              </ToggleGroup>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setStockSort(stockSort === 'remaining-asc' ? 'remaining-desc' : 'remaining-asc')}
                className="h-8 text-xs"
              >
                <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
                Trier par restant {stockSort === 'remaining-asc' ? '↑' : '↓'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {useMemo(() => {
                const items = bottleTypes.map((bottle) => {
                  const remaining = getRemainingQuantity(bottle);
                  const total = getTotalQuantity(bottle);
                  const percentage = Math.min(((remaining || 0) / (total || 1)) * 100, 100);
                  const status = getStockStatus(remaining);
                  const { distributed } = getStockMetrics(bottle);
                  return { bottle, remaining, total, percentage, status, distributed };
                });
                const filtered = stockStatusFilter === 'all' 
                  ? items 
                  : items.filter(i => i.status.label.toLowerCase() === stockStatusFilter);
                const sorted = [...filtered].sort((a, b) => 
                  stockSort === 'remaining-asc' ? a.remaining - b.remaining : b.remaining - a.remaining
                );
                return sorted;
              }, [bottleTypes, stockStatusFilter, stockSort, emptyBottlesStock]).map(({ bottle, remaining, total, percentage, status, distributed }) => (
                <div key={bottle.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{bottle.name}</span>
                      <Badge variant={status.badge} className="h-5 px-1.5 text-[10px]">{status.label}</Badge>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">
                      {remaining} / {total}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    Actuel: {total} | Restant: {remaining} | Distribué: {distributed}
                  </div>
                  <div className="relative h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`absolute top-0 left-0 h-full ${status.color} transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Widgets Column */}
        <div className="space-y-6">
          <OilBarrelsWidget />
          
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Performance Système
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-full text-green-600">
                    <Activity className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">Distribution</span>
                </div>
                <Badge className="bg-green-500">Optimum</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-full text-blue-600">
                    <Truck className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">Flotte</span>
                </div>
                <Badge variant="outline" className="text-blue-600 border-blue-200">{activeTrucks} En service</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-full text-orange-600">
                    <Fuel className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">Carburant</span>
                </div>
                <Badge variant="outline" className="text-orange-600 border-orange-200">Suivi actif</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Recent Activity - Improved */}
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-600" />
                Activités Récentes
              </CardTitle>
              <CardDescription>Les 8 dernières activités effectuées</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>
              Voir tout
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentActivities.map((activity) => (
                <div 
                  key={activity.id} 
                  className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-lg ${activity.iconBg} group-hover:scale-110 transition-transform`}>
                      {activity.icon}
                    </div>
                    <div>
                      <p className="text-sm font-bold leading-none mb-1">{activity.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {activity.subtitle ? `${activity.subtitle} · ` : ''}
                        {activity.date.toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${activity.amount ? 'text-slate-900' : 'text-slate-400'}`}>
                      {activity.amount ? `${activity.amount.toLocaleString()} DH` : '--'}
                    </p>
                  </div>
                </div>
              ))}
              {recentActivities.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <History className="w-12 h-12 mb-2 opacity-20" />
                  <p>Aucune activité récente</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alerts & System Summary */}
        <div className="space-y-6">
          {lowStockBottles.length > 0 && (
            <Card className="border-red-100 bg-red-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-5 h-5 animate-bounce" />
                  Alertes de Stock
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lowStockBottles.map((bottle) => (
                  <div key={bottle.id} className="flex items-center justify-between p-2 bg-white rounded-lg shadow-sm border border-red-100">
                    <span className="text-sm font-medium">{bottle.name}</span>
                    <Badge variant="destructive" className="font-bold">
                      {getRemainingQuantity(bottle)} restants
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border-none shadow-sm bg-gradient-to-br from-primary to-primary/80 text-white">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Statistiques Globales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1 opacity-80 uppercase tracking-wider font-semibold">
                  <span>Efficacité Distribution</span>
                  <span>84%</span>
                </div>
                <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white w-[84%] rounded-full" />
                </div>
              </div>
              <div className="pt-2">
                <p className="text-3xl font-bold">{netBalance.toLocaleString()} DH</p>
                <p className="text-xs opacity-70">Balance estimée (Revenus - Dépenses)</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
