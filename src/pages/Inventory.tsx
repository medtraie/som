import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { Package, Edit, TrendingDown, TrendingUp, Eye, EyeOff, Archive, Truck, PackageCheck, AlertTriangle, Plus, Package2, ChevronDown, ChevronUp, History, Trash2 } from 'lucide-react';
import { AddBottleTypeDialog } from '@/components/dialogs/AddBottleTypeDialog';
import { EditBottleTypeDialog } from '@/components/dialogs/EditBottleTypeDialog';
import { BottleHistoryDialog } from '@/components/dialogs/BottleHistoryDialog';
import { BottleType } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AddEmptyStockDialog } from '@/components/dialogs/AddEmptyStockDialog';
import { AddDefectiveStockDialog } from '@/components/dialogs/AddDefectiveStockDialog';
import { format } from 'date-fns';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { safeDate } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const Inventory = () => {
  const { bottleTypes, emptyBottlesStock = [], defectiveBottles = [], transactions = [], returnOrders = [], foreignBottles = [], trucks = [], drivers = [], supplyOrders = [], stockHistory = [], clearAllInventory } = useApp();
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const selectedBottle = React.useMemo(() => 
    bottleTypes.find(b => b.id === selectedBottleId) || null,
    [bottleTypes, selectedBottleId]
  );
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [showTotalValue, setShowTotalValue] = useState(false);
  const [selectedEmptyBottleType, setSelectedEmptyBottleType] = useState<BottleType | null>(null);
  const [selectedDefectiveBottleType, setSelectedDefectiveBottleType] = useState<BottleType | null>(null);
  const [emptyStockDialogOpen, setEmptyStockDialogOpen] = useState(false);
  const [defectiveStockDialogOpen, setDefectiveStockDialogOpen] = useState(false);
  const [impactPanelVisible, setImpactPanelVisible] = useState(true);
  const [impactView, setImpactView] = useState<'today' | 'last7days'>('today');
  const [showEmpty, setShowEmpty] = useState(true);
  const [showDefective, setShowDefective] = useState(true);
  const [confirmClearDialogOpen, setConfirmClearDialogOpen] = useState(false);
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [bottleToDelete, setBottleToDelete] = useState<BottleType | null>(null);

  const { deleteBottleType } = useApp();

  const handleDelete = async () => {
    if (bottleToDelete) {
      await deleteBottleType(bottleToDelete.id);
      setDeleteConfirmDialogOpen(false);
      setBottleToDelete(null);
    }
  };

  // Stock history dialog state
  const [stockHistoryDialogOpen, setStockHistoryDialogOpen] = useState(false);
  const [historyBottle, setHistoryBottle] = useState<{ bottle: BottleType; type: 'empty' | 'defective' } | null>(null);

  const filteredStockHistory = React.useMemo(() => {
    if (!historyBottle) return [];
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
    const aliases = historyBottle.type === 'empty'
      ? ['empty', 'emptystock', 'emptybottles', 'emptybottlesstock', 'vide', 'vides', 'stockvide', 'stockvides']
      : ['defective', 'defectivestock', 'defectivebottles', 'defectivebottlesstock', 'defectueux', 'defectueuse', 'stockdefectueux', 'stockdefectueuses'];
    const bottleId = String(historyBottle.bottle.id);
    const bottleName = String(historyBottle.bottle.name || '');
    const normalizedBottleName = normalize(bottleName);
    const base = stockHistory.filter(h => {
      const idMatch = String(h.bottleTypeId ?? '') === bottleId;
      const entryName = String(h.bottleTypeName ?? '');
      const normalizedEntryName = normalize(entryName);
      const nameMatch = normalizedBottleName && normalizedEntryName === normalizedBottleName;
      const fuzzyNameMatch = normalizedBottleName && (
        normalizedEntryName.includes(normalizedBottleName) ||
        normalizedBottleName.includes(normalizedEntryName)
      );
      const noteMatch = normalizedBottleName && normalize(String((h as any).note ?? '')).includes(normalizedBottleName);
      return idMatch || nameMatch || fuzzyNameMatch || noteMatch;
    });
    const typed = base.filter(h => {
      const st = normalize(String(h.stockType ?? ''));
      return !st || aliases.includes(st);
    });
    const list = typed.length ? typed : base;
    return [...list].sort((a, b) => safeDate(b.date).getTime() - safeDate(a.date).getTime());
  }, [stockHistory, historyBottle]);

  const getStockStatus = (remaining: number, total: number) => {
    if (!total || isNaN(remaining) || isNaN(total)) return { status: 'Normal', variant: 'default' as const, icon: TrendingUp };
    const percentage = (remaining / total) * 100;
    if (percentage < 20) return { status: 'Critique', variant: 'destructive' as const, icon: TrendingDown };
    if (percentage < 50) return { status: 'Faible', variant: 'secondary' as const, icon: TrendingDown };
    return { status: 'Normal', variant: 'default' as const, icon: TrendingUp };
  };

  const availableBottleTypes = bottleTypes;

  const getEmptyQuantity = (id: string) =>
    emptyBottlesStock.find(s => s.bottleTypeId === id)?.quantity || 0;

  const getDefectiveQuantity = (id: string) =>
    defectiveBottles.filter(b => b.bottleTypeId === id).reduce((sum, b) => sum + b.quantity, 0);

  const simpleStatus = (qty: number) => {
    if (qty === 0) return { status: 'Vide', variant: 'destructive' as const, icon: TrendingDown };
    if (qty < 50) return { status: 'Faible', variant: 'secondary' as const, icon: TrendingDown };
    return { status: 'Normal', variant: 'default' as const, icon: TrendingUp };
  };

  interface InventoryImpactEvent {
    id: string;
    date: string;
    source: 'supply' | 'return' | 'foreign_add';
    label: string;
    driverName?: string;
    bottleTypeName: string;
    emptyDelta: number;
    fullDelta: number;
    defectiveDelta: number;
    foreignDelta: number;
  }

  const getDriverNameByTruckId = (truckId?: string) => {
    if (!truckId) return undefined;
    const truck = trucks.find(t => t.id === truckId);
    const driver = drivers.find(d => String(d.id) === String(truck?.driverId));
    return driver?.name;
  };

  const getDriverNameForReturn = (ro: any) => {
    if (ro?.driverName) return ro.driverName;
    const so = supplyOrders.find((s: any) => String(s.id) === String(ro?.supplyOrderId));
    if (so?.driverName) return so.driverName;
    const driver = drivers.find(d => String(d.id) === String(ro?.driverId));
    return driver?.name;
  };

  const impactEvents = React.useMemo<InventoryImpactEvent[]>(() => {
    const events: InventoryImpactEvent[] = [];

    // Alimentation camion — Réduit les Pleins
    transactions
      .filter(t => t.type === 'supply')
      .forEach(tx => {
        (tx.bottleTypes || []).forEach((bt: any) => {
          const bottleName = bottleTypes.find(b => b.id === bt.bottleTypeId)?.name || 'Inconnu';
          events.push({
            id: `supply-${tx.id || `${tx.date}-${bt.bottleTypeId}`}`,
            date: tx.date,
            source: 'supply',
            label: 'Alimentation camion',
            driverName: getDriverNameByTruckId(tx.truckId),
            bottleTypeName: bottleName,
            emptyDelta: 0,
            fullDelta: -Number(bt.quantity || 0),
            defectiveDelta: 0,
            foreignDelta: 0,
          });
        });
      });

    // B.D Retour — Impact détaillé
    (returnOrders || []).forEach((ro: any) => {
      (ro.items || []).forEach((item: any) => {
        const emptyDelta =
          (Number(item.returnedEmptyQuantity || 0)) -
          (Number(item.consigneQuantity || 0)) -
          (Number(item.lostQuantity || 0)) -
          (Number(item.foreignQuantity || 0));

        events.push({
          id: `return-${ro.id}-${item.bottleTypeId}`,
          date: ro.date,
          source: 'return',
          label: `B.D - Retour B.S ${ro.supplyOrderNumber || ''}`,
          driverName: getDriverNameForReturn(ro),
          bottleTypeName: item.bottleTypeName,
          emptyDelta,
          fullDelta: Number(item.returnedFullQuantity || 0),
          defectiveDelta: Number(item.defectiveQuantity || 0),
          foreignDelta: Number(item.foreignQuantity || 0),
        });
      });
    });

    // Étrangères directes
    (foreignBottles || [])
      .filter((fb: any) => !fb.returnOrderId || fb.returnOrderId === 'direct')
      .forEach((fb: any) => {
        events.push({
          id: `foreign-${fb.id}`,
          date: fb.date,
          source: 'foreign_add',
          label: `Ajout étrangère (${fb.companyName})`,
          driverName: undefined,
          bottleTypeName: fb.bottleType,
          emptyDelta: -Number(fb.quantity || 0),
          fullDelta: 0,
          defectiveDelta: 0,
          foreignDelta: Number(fb.quantity || 0),
        });
      });

    return events.sort((a, b) => safeDate(b.date).getTime() - safeDate(a.date).getTime());
  }, [transactions, returnOrders, foreignBottles, bottleTypes, trucks, drivers, supplyOrders]);

  const { filteredImpactEvents, summaryTotals, summaryTitle } = React.useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const filtered = impactEvents.filter(event => {
      const eventDate = safeDate(event.date);
      if (impactView === 'today') {
        return eventDate >= today;
      }
      if (impactView === 'last7days') {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6);
        return eventDate >= sevenDaysAgo;
      }
      return false;
    });

    const totals = filtered.reduce(
      (acc, event) => {
        acc.empty += event.emptyDelta;
        acc.full += event.fullDelta;
        acc.defective += event.defectiveDelta;
        acc.foreign += event.foreignDelta;
        return acc;
      },
      { empty: 0, full: 0, defective: 0, foreign: 0 }
    );

    const title = impactView === 'today' ? "Résumé du jour" : "Résumé des 7 derniers jours";

    return { filteredImpactEvents: filtered, summaryTotals: totals, summaryTitle: title };
  }, [impactEvents, impactView]);

  const last7DaysEvents = React.useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return impactEvents.filter(e => safeDate(e.date) >= cutoff);
  }, [impactEvents]);

  const totalsLast7 = React.useMemo(() => {
    return last7DaysEvents.reduce(
      (acc, e) => {
        acc.empty += e.emptyDelta;
        acc.full += e.fullDelta;
        acc.defective += e.defectiveDelta;
        acc.foreign += e.foreignDelta;
        return acc;
      },
      { empty: 0, full: 0, defective: 0, foreign: 0 }
    );
  }, [last7DaysEvents]);

  const eventsToday = React.useMemo(() => {
    const today = new Date();
    return impactEvents.filter((e) => {
      const d = safeDate(e.date);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    });
  }, [impactEvents]);

  const totalsToday = React.useMemo(() => {
    return eventsToday.reduce(
      (acc, e) => {
        acc.empty += e.emptyDelta;
        acc.full += e.fullDelta;
        acc.defective += e.defectiveDelta;
        acc.foreign += e.foreignDelta;
        return acc;
      },
      { empty: 0, full: 0, defective: 0, foreign: 0 }
    );
  }, [eventsToday]);

  const fmtDelta = (n: number) => (n > 0 ? `+${n}` : `${n}`);

  const totalEmpty = emptyBottlesStock.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
  const totalDefective = defectiveBottles.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);

  return (
    <div className="p-6 space-y-8 bg-slate-50/30 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Inventaire</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Gestion globale des stocks et suivi des bouteilles
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="destructive" 
            size="sm"
            className="flex items-center gap-2"
            onClick={() => setConfirmClearDialogOpen(true)}
          >
            <Trash2 className="w-4 h-4" />
            Réinitialiser tout le stock
          </Button>
          <AddBottleTypeDialog />
        </div>
      </div>

      {/* Inventory Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {availableBottleTypes.map((bottle) => {
          const computedTotal = (bottle.totalQuantity ?? ((bottle.remainingQuantity || 0) + (bottle.distributedQuantity || 0)));
          const stockInfo = getStockStatus(bottle.remainingQuantity || 0, computedTotal || 0);
          const totalQty = computedTotal || 0;
          const distQty = bottle.distributedQuantity || 0;
          const distributionRate = totalQty > 0 ? (distQty / totalQty) * 100 : 0;
          
          return (
            <Card key={bottle.id} className="hover:shadow-lg transition-shadow border-slate-200">
              <CardHeader className="pb-3 bg-slate-50/50 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Package2 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <CardTitle className="text-lg font-bold text-slate-800">{bottle.name}</CardTitle>
                  </div>
                  <Badge variant={stockInfo.variant} className="flex items-center gap-1 px-2 py-1">
                    <stockInfo.icon className="w-3 h-3" />
                    {stockInfo.status}
                  </Badge>
                </div>
                <p className="text-sm text-slate-500 font-medium mt-1">{bottle.capacity}</p>
              </CardHeader>
              
              <CardContent className="space-y-4 pt-4">
                {/* Stock Overview */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-slate-600">Stock plein restant</span>
                    <span className="text-slate-900">{bottle.remainingQuantity} unités</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                      style={{ 
                        width: `${totalQty > 0 ? Math.min(((bottle.remainingQuantity || 0) / totalQty) * 100, 100) : 0}%` 
                      }}
                    />
                  </div>
                </div>

                {/* Stock Details */}
                <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Capacité Totale</p>
                    <p className="text-lg font-bold text-slate-900">{computedTotal}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">En Circulation</p>
                    <p className="text-lg font-bold text-indigo-600">{bottle.distributedQuantity}</p>
                  </div>
                </div>

                {/* Distribution Rate */}
                <div className="pt-2">
                  <div className="flex justify-between text-sm mb-2 font-medium">
                    <span className="text-slate-600">Taux de distribution</span>
                    <span className="text-indigo-600">{distributionRate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-indigo-400 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(distributionRate, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold"
                    onClick={() => {
                      setSelectedBottleId(bottle.id);
                      setEditDialogOpen(true);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Modifier
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold"
                    onClick={() => {
                      setSelectedBottleId(bottle.id);
                      setHistoryDialogOpen(true);
                    }}
                  >
                    <History className="w-4 h-4 mr-2" />
                    Historique
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-500"
                    onClick={() => {
                      setBottleToDelete(bottle);
                      setDeleteConfirmDialogOpen(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary Card */}
      <Card className="border-slate-200 overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100">
          <CardTitle className="text-xl font-bold text-slate-800">Résumé de l'inventaire</CardTitle>
        </CardHeader>
        <CardContent className="pt-8 pb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Archive className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="text-3xl font-black text-slate-900">
                {availableBottleTypes.reduce((sum, bt) => sum + bt.totalQuantity, 0)}
              </div>
              <div className="text-sm font-bold text-slate-500 uppercase tracking-wide">Total général</div>
            </div>
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Truck className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-3xl font-black text-blue-600">
                {availableBottleTypes.reduce((sum, bt) => sum + bt.distributedQuantity, 0)}
              </div>
              <div className="text-sm font-bold text-slate-500 uppercase tracking-wide">Distribuées</div>
            </div>
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <PackageCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-emerald-600">
                {availableBottleTypes.reduce((sum, bt) => sum + bt.remainingQuantity, 0)}
              </div>
              <div className="text-sm font-bold text-slate-500 uppercase tracking-wide">Restantes</div>
            </div>
            <div className="text-center space-y-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowTotalValue(!showTotalValue)} 
                className="w-12 h-12 rounded-full hover:bg-slate-100 mx-auto mb-2"
              >
                {showTotalValue ? <EyeOff className="w-6 h-6 text-slate-600" /> : <Eye className="w-6 h-6 text-slate-600" />}
              </Button>
              {showTotalValue ? (
                <div className="text-3xl font-black text-indigo-600">
                  {availableBottleTypes.reduce((sum, bt) => sum + (bt.remainingQuantity * bt.unitPrice), 0).toLocaleString()} DH
                </div>
              ) : (
                <div className="text-3xl font-black text-slate-300">••••••</div>
              )}
              <div className="text-sm font-bold text-slate-500 uppercase tracking-wide">Valeur totale</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <CardTitle className="text-xl font-bold text-slate-800">Suivi d'impact du stock</CardTitle>
            <p className="text-sm text-slate-500 font-medium">Résumé et dernières modifications</p>
          </div>
      
          <div className="flex items-center gap-3">
            <ToggleGroup
              type="single"
              value={impactView}
              onValueChange={(v) => v && setImpactView(v as 'today' | 'last7days')}
              className="bg-white border border-slate-200 p-1 rounded-lg"
            >
              <ToggleGroupItem value="today" className="px-3 py-1 text-sm font-semibold data-[state=on]:bg-indigo-600 data-[state=on]:text-white rounded-md transition-all">
                Aujourd'hui
              </ToggleGroupItem>
              <ToggleGroupItem value="last7days" className="px-3 py-1 text-sm font-semibold data-[state=on]:bg-indigo-600 data-[state=on]:text-white rounded-md transition-all">
                7 derniers jours
              </ToggleGroupItem>
            </ToggleGroup>
      
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setImpactPanelVisible((p) => !p)}
              className="text-slate-600 hover:text-indigo-600 font-bold"
            >
              {impactPanelVisible ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
              {impactPanelVisible ? 'Masquer' : 'Afficher'}
            </Button>
          </div>
        </CardHeader>
      
        {impactPanelVisible && (
          <CardContent className="space-y-8 pt-6">
            {/* Résumé Impact */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Δ Vides</div>
                <div className={`text-2xl font-black ${summaryTotals.empty >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {fmtDelta(summaryTotals.empty)}
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Δ Pleins</div>
                <div className={`text-2xl font-black ${summaryTotals.full >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {fmtDelta(summaryTotals.full)}
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Δ Défectueuses</div>
                <div className={`text-2xl font-black ${summaryTotals.defective >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {fmtDelta(summaryTotals.defective)}
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Δ Étrangères</div>
                <div className={`text-2xl font-black ${summaryTotals.foreign >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {fmtDelta(summaryTotals.foreign)}
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-slate-800">Transactions récentes</h4>
                <Badge variant="outline" className="text-slate-500 font-bold border-slate-200">
                  {filteredImpactEvents.length} opérations
                </Badge>
              </div>
              
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold text-slate-700">Date</TableHead>
                      <TableHead className="font-bold text-slate-700">Opération</TableHead>
                      <TableHead className="font-bold text-slate-700">Chauffeur</TableHead>
                      <TableHead className="font-bold text-slate-700">Type de bouteille</TableHead>
                      <TableHead className="text-right font-bold text-slate-700">Variation</TableHead>
                    </TableRow>
                  </TableHeader>
                
                  <TableBody>
                    {filteredImpactEvents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-400 font-medium italic">
                          Aucune transaction enregistrée pour cette période
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredImpactEvents.map((e) => {
                        const primary =
                          e.emptyDelta !== 0
                            ? { kind: 'Vides', qty: e.emptyDelta }
                            : e.fullDelta !== 0
                            ? { kind: 'Pleins', qty: e.fullDelta }
                            : e.defectiveDelta !== 0
                            ? { kind: 'Défectueuses', qty: e.defectiveDelta }
                            : { kind: 'Étrangères', qty: e.foreignDelta };

                        return (
                          <TableRow key={e.id} className="hover:bg-slate-50/50 transition-colors">
                            <TableCell className="font-medium text-slate-600">
                              {format(safeDate(e.date), 'dd/MM HH:mm')}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800">{e.label}</span>
                                <span className="text-xs text-slate-500">{e.source}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {e.driverName ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-600">
                                    {e.driverName.charAt(0)}
                                  </div>
                                  <span className="text-sm font-semibold text-slate-700">{e.driverName}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="font-bold text-slate-700">
                              {e.bottleTypeName}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge 
                                variant={primary.qty > 0 ? 'default' : 'destructive'}
                                className={`font-black ${primary.qty > 0 ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'} border-none`}
                              >
                                {fmtDelta(primary.qty)} {primary.kind}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Empty & Defective Stock inside Inventory */}
      <div className="space-y-8">
        {/* Empty bottles section */}
        <div>
          <h2 className="text-xl font-semibold">Stock Vides</h2>
          <p className="text-muted-foreground mb-4">Gestion des stocks de bouteilles vides</p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {availableBottleTypes.map((bottle) => {
              const qty = getEmptyQuantity(bottle.id);
              const info = simpleStatus(qty);
              return (
                <Card key={bottle.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{bottle.name}</CardTitle>
                      <Badge variant={info.variant} className="flex items-center gap-1">
                        <info.icon className="w-3 h-3" />
                        {info.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{bottle.capacity}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex flex-col">
                        <span>Bouteilles vides</span>
                        <span className="font-medium text-2xl">{qty}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-purple-50 hover:text-purple-600"
                        onClick={() => {
                          setHistoryBottle({ bottle, type: 'empty' });
                          setStockHistoryDialogOpen(true);
                        }}
                      >
                        <History className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => { setSelectedEmptyBottleType(bottle); setEmptyStockDialogOpen(true); }}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Ajouter Stock
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Defective bottles section */}
        <div>
          <h2 className="text-xl font-semibold">Stock de Bouteilles Défectueuses</h2>
          <p className="text-muted-foreground mb-4">Gestion des stocks de bouteilles défectueuses</p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {availableBottleTypes.map((bottle) => {
              const qty = getDefectiveQuantity(bottle.id);
              const info = simpleStatus(qty);
              return (
                <Card key={bottle.id} className="hover:shadow-lg transition-shadow border-destructive/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{bottle.name}</CardTitle>
                      <Badge variant={info.variant} className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {info.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{bottle.capacity}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex flex-col">
                        <span>Bouteilles défectueuses</span>
                        <span className="font-medium text-2xl text-destructive">{qty}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                        onClick={() => {
                          setHistoryBottle({ bottle, type: 'defective' });
                          setStockHistoryDialogOpen(true);
                        }}
                      >
                        <History className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-destructive/40 hover:bg-destructive/10"
                      onClick={() => { setSelectedDefectiveBottleType(bottle); setDefectiveStockDialogOpen(true); }}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Ajouter Stock
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

      {/* Empty & Defective Stock Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Empty bottles table */}
        <Card className="shadow-md border-none overflow-hidden">
          <CardHeader className="bg-white border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Package2 className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">Stock Vides</CardTitle>
                  <div className="text-2xl font-black text-purple-700 mt-1">
                    {totalEmpty} <span className="text-sm font-medium text-slate-400 uppercase tracking-wider ml-1">Bouteilles</span>
                  </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowEmpty(!showEmpty)}
                className="hover:bg-slate-100"
              >
                {showEmpty ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </Button>
            </div>
          </CardHeader>
          {showEmpty && (
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="font-bold text-slate-700 py-4">Produit</TableHead>
                      <TableHead className="text-center font-bold text-slate-700 py-4">Quantité</TableHead>
                      <TableHead className="text-right font-bold text-slate-700 py-4">Dernière Mise à Jour</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emptyBottlesStock
                      .filter(s => s.quantity > 0 && s.bottleTypeName)
                      .map((stock) => (
                      <TableRow key={stock.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                        <TableCell className="font-semibold text-slate-900 py-4">{stock.bottleTypeName}</TableCell>
                        <TableCell className="text-center py-4">
                          <Badge variant="outline" className="font-bold px-3 py-1 bg-purple-50 text-purple-700 border-purple-100">
                            {stock.quantity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-slate-500 text-sm py-4 font-mono">
                          {format(safeDate(stock.lastUpdated), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                    {emptyBottlesStock.filter(s => s.quantity > 0 && s.bottleTypeName).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-12 text-slate-400 italic">
                          Aucune bouteille vide en stock
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Defective bottles table */}
        <Card className="shadow-md border-none overflow-hidden">
          <CardHeader className="bg-white border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">Stock Défectueuses</CardTitle>
                  <div className="text-2xl font-black text-red-700 mt-1">
                    {totalDefective} <span className="text-sm font-medium text-slate-400 uppercase tracking-wider ml-1">Bouteilles</span>
                  </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowDefective(!showDefective)}
                className="hover:bg-slate-100"
              >
                {showDefective ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </Button>
            </div>
          </CardHeader>
          {showDefective && (
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="font-bold text-slate-700 py-4">Produit</TableHead>
                      <TableHead className="text-center font-bold text-slate-700 py-4">Quantité</TableHead>
                      <TableHead className="text-right font-bold text-slate-700 py-4">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {defectiveBottles
                      .filter(d => d.quantity > 0 && d.bottleTypeName)
                      .map((defective) => (
                      <TableRow key={defective.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                        <TableCell className="font-semibold text-slate-900 py-4">{defective.bottleTypeName}</TableCell>
                        <TableCell className="text-center py-4">
                          <Badge variant="outline" className="font-bold px-3 py-1 bg-red-50 text-red-700 border-red-100">
                            {defective.quantity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-slate-500 text-sm py-4 font-mono">
                          {format(safeDate(defective.date), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                    {defectiveBottles.filter(d => d.quantity > 0 && d.bottleTypeName).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-12 text-slate-400 italic">
                          Aucune bouteille défectueuse en stock
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
      </div>

      {/* Dialogs */}
      {selectedBottle && (
        <>
          <EditBottleTypeDialog
            bottle={selectedBottle}
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
              if (!open) setSelectedBottleId(null);
            }}
          />
          <BottleHistoryDialog
            bottle={selectedBottle}
            open={historyDialogOpen}
            onOpenChange={(open) => {
              setHistoryDialogOpen(open);
              if (!open) setSelectedBottleId(null);
            }}
          />
        </>
      )}
      {selectedEmptyBottleType && (
        <AddEmptyStockDialog
          bottleType={selectedEmptyBottleType}
          open={emptyStockDialogOpen}
          onOpenChange={setEmptyStockDialogOpen}
        />
      )}
      {selectedDefectiveBottleType && (
        <AddDefectiveStockDialog
          bottleType={selectedDefectiveBottleType}
          open={defectiveStockDialogOpen}
          onOpenChange={setDefectiveStockDialogOpen}
        />
      )}

      {/* Stock History Dialog */}
      <Dialog open={stockHistoryDialogOpen} onOpenChange={setStockHistoryDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 border-none shadow-2xl">
          {historyBottle && (
            <>
              <div className={`p-6 ${historyBottle.type === 'empty' ? 'bg-purple-600' : 'bg-red-600'} text-white`}>
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-white">
                        <History className="w-6 h-6" />
                        Historique des mouvements
                      </DialogTitle>
                      <DialogDescription className="text-white/80 text-base">
                        {historyBottle.bottle.name} • {historyBottle.type === 'empty' ? 'Stock Vides' : 'Stock Défectueux'}
                      </DialogDescription>
                    </div>
                    <div className="hidden md:flex flex-col items-end">
                      <span className="text-xs uppercase tracking-wider text-white/60">Stock Actuel</span>
                      <span className="text-3xl font-black">
                        {historyBottle.type === 'empty' 
                          ? getEmptyQuantity(historyBottle.bottle.id) 
                          : getDefectiveQuantity(historyBottle.bottle.id)}
                      </span>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50/80 sticky top-0 z-10">
                      <TableRow className="hover:bg-transparent border-b border-slate-200">
                        <TableHead className="w-[180px] font-bold text-slate-600 py-4">Date & Heure</TableHead>
                        <TableHead className="font-bold text-slate-600 py-4">Type d'opération</TableHead>
                        <TableHead className="text-center font-bold text-slate-600 py-4">Quantité</TableHead>
                        <TableHead className="text-right font-bold text-slate-600 py-4">Évolution Stock</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStockHistory.map((entry) => {
                          const isAdd = entry.changeType === 'add' || 
                            entry.changeType === 'return' || 
                            (entry.changeType === 'factory' && entry.newQuantity > entry.previousQuantity);
                          
                          let label = entry.changeType;
                          if (entry.changeType === 'add') label = 'Ajout Manuel';
                          else if (entry.changeType === 'return') label = 'Retour B.D';
                          else if (entry.changeType === 'remove') label = 'Sortie Stock';
                          else if (entry.changeType === 'factory') {
                            label = entry.newQuantity > entry.previousQuantity ? 'Retour Usine' : 'Envoi Usine';
                          }

                          return (
                            <TableRow key={entry.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                              <TableCell className="py-4">
                                <div className="flex flex-col">
                                  <span className="text-sm font-semibold text-slate-900">
                                    {format(safeDate(entry.date), 'dd MMMM yyyy')}
                                  </span>
                                  <span className="text-xs text-slate-500 font-mono">
                                    {format(safeDate(entry.date), 'HH:mm:ss')}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-4">
                                <div className="flex items-center gap-3">
                                  <div className={`p-1.5 rounded-lg ${isAdd ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {isAdd ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className={`text-sm font-bold uppercase tracking-tight ${isAdd ? 'text-green-700' : 'text-red-700'}`}>
                                      {label}
                                    </span>
                                    {entry.note && (
                                      <span className="text-[11px] text-slate-500 line-clamp-1 italic max-w-[200px]" title={entry.note}>
                                        {entry.note}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center py-4">
                                <Badge 
                                  variant="outline" 
                                  className={`font-black px-2.5 py-0.5 border-none ${
                                    isAdd ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {isAdd ? '+' : '-'}{entry.quantity}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right py-4">
                                <div className="flex items-center justify-end gap-2 text-sm">
                                  <span className="text-slate-400 line-through decoration-slate-300">{entry.previousQuantity}</span>
                                  <div className="w-3 h-[1px] bg-slate-300"></div>
                                  <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                                    {entry.newQuantity}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      {filteredStockHistory.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="py-20 text-center">
                            <div className="flex flex-col items-center justify-center space-y-3">
                              <div className="p-4 bg-slate-100 rounded-full">
                                <Archive className="w-8 h-8 text-slate-400" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-slate-900 font-bold">Aucun historique</p>
                                <p className="text-slate-500 text-sm">Les mouvements de stock apparaîtront ici.</p>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
                <Button 
                  onClick={() => setStockHistoryDialogOpen(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-8"
                >
                  Fermer
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* Confirm Clear All Inventory Dialog */}
      {/* Confirmation Clear Dialog */}
      <Dialog open={confirmClearDialogOpen} onOpenChange={setConfirmClearDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl border-none shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="h-6 w-6 text-rose-600" />
            </div>
            <DialogTitle className="text-2xl font-bold text-center text-slate-900">
              Réinitialisation complète
            </DialogTitle>
            <DialogDescription className="text-center text-slate-500 text-base leading-relaxed pt-2">
              Êtes-vous sûr de vouloir réinitialiser tout le stock ?
              <br />
              <span className="font-bold text-slate-700">
                Cette action remettra toutes les quantités à zéro mais conservera les types de bouteilles standards.
              </span>
              <br />
              <span className="text-rose-600 font-black mt-2 block">Cette action est irréversible.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setConfirmClearDialogOpen(false)}
              className="flex-1 h-12 rounded-xl border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                clearAllInventory();
                setConfirmClearDialogOpen(false);
              }}
              className="flex-1 h-12 rounded-xl bg-rose-600 hover:bg-rose-700 font-bold shadow-lg shadow-rose-200"
            >
              Confirmer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Bottle Type Confirmation Dialog */}
      <Dialog open={deleteConfirmDialogOpen} onOpenChange={setDeleteConfirmDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl border-none shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Trash2 className="h-6 w-6 text-rose-600" />
            </div>
            <DialogTitle className="text-2xl font-bold text-center text-slate-900">
              Supprimer {bottleToDelete?.name}
            </DialogTitle>
            <DialogDescription className="text-center text-slate-500 text-base leading-relaxed pt-2">
              Êtes-vous sûr de vouloir supprimer ce type de bouteille ?
              <br />
              <span className="font-bold text-slate-700">
                Toutes les données associées à ce type seront définitivement supprimées.
              </span>
              <br />
              <span className="text-rose-600 font-black mt-2 block">Cette action est irréversible.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-6">
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteConfirmDialogOpen(false);
                setBottleToDelete(null);
              }}
              className="flex-1 h-12 rounded-xl border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              className="flex-1 h-12 rounded-xl bg-rose-600 hover:bg-rose-700 font-bold shadow-lg shadow-rose-200"
            >
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;
