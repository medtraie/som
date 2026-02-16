import React from 'react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useApp } from '@/contexts/AppContext';
import OilBarrelsWidget from '@/components/dashboard/OilBarrelsWidget';
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
  Plus,
  History,
  Settings,
  Activity,
  Fuel,
  Droplets,
  Wrench,
  CreditCard
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
    fuelManagement = []
  } = useApp();

  // Calculate metrics
  const totalStock = bottleTypes.reduce((sum, bt) => sum + (bt.remainingQuantity || 0), 0);
  const totalValue = bottleTypes.reduce((sum, bt) => sum + ((bt.remainingQuantity || 0) * (bt.unitPrice || 0)), 0);
  const activeTrucks = trucks.filter(t => t.isActive).length;
  const totalDriverDebt = drivers.reduce((sum, d) => sum + Math.abs(d.debt || 0), 0);
  const lowStockBottles = bottleTypes.filter(bt => (bt.remainingQuantity || 0) < 50);
  
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalRevenue = transactions.reduce((sum, t) => sum + (t.totalValue || t.totalVentes || 0), 0);
  
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
          <CardHeader className="flex flex-row items-center justify-between">
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
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {bottleTypes.map((bottle) => {
                const percentage = Math.min(((bottle.remainingQuantity || 0) / (bottle.totalQuantity || 1)) * 100, 100);
                let color = "bg-green-500";
                if (percentage < 20) color = "bg-red-500";
                else if (percentage < 50) color = "bg-yellow-500";

                return (
                  <div key={bottle.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{bottle.name}</span>
                        {(bottle.remainingQuantity || 0) < 50 && (
                          <Badge variant="destructive" className="h-5 px-1.5 text-[10px] animate-pulse">
                            ALERTE
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        {bottle.remainingQuantity || 0} / {bottle.totalQuantity || 0}
                      </span>
                    </div>
                    <div className="relative h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`absolute top-0 left-0 h-full ${color} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
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
              <CardDescription>Les 6 dernières opérations effectuées</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>
              Voir tout
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {[...transactions, ...expenses, ...repairs]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 6)
                .map((activity, index) => {
                  let icon = <Activity className="w-4 h-4" />;
                  let iconBg = "bg-slate-100 text-slate-600";
                  let title = "Opération";
                  let amount = 0;

                  if ('type' in activity) {
                    if (activity.type === 'supply') {
                      icon = <ArrowUpRight className="w-4 h-4" />;
                      iconBg = "bg-blue-100 text-blue-600";
                      title = "Alimentation Camion";
                      amount = activity.totalValue || 0;
                    } else if (activity.type === 'return') {
                      icon = <ArrowDownRight className="w-4 h-4" />;
                      iconBg = "bg-green-100 text-green-600";
                      title = "Retour Camion";
                      amount = activity.totalVentes || 0;
                    } else if (activity.type === 'exchange') {
                      icon = <Package className="w-4 h-4" />;
                      iconBg = "bg-orange-100 text-orange-600";
                      title = "Échange Bouteilles";
                    }
                  } else if ('amount' in activity) {
                    icon = <CreditCard className="w-4 h-4" />;
                    iconBg = "bg-red-100 text-red-600";
                    title = `Dépense: ${activity.type}`;
                    amount = activity.amount;
                  } else if ('totalCost' in activity) {
                    icon = <Wrench className="w-4 h-4" />;
                    iconBg = "bg-purple-100 text-purple-600";
                    title = `Réparation: ${activity.type}`;
                    amount = activity.totalCost;
                  }

                  return (
                    <div 
                      key={activity.id || index} 
                      className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-lg ${iconBg} group-hover:scale-110 transition-transform`}>
                          {icon}
                        </div>
                        <div>
                          <p className="text-sm font-bold leading-none mb-1">{title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(activity.date).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">
                          {amount > 0 ? `${amount.toLocaleString()} DH` : '--'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              {transactions.length === 0 && expenses.length === 0 && repairs.length === 0 && (
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
                      {bottle.remainingQuantity} restants
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
                <p className="text-3xl font-bold">{(totalRevenue - totalExpenses).toLocaleString()} DH</p>
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