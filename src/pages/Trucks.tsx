import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { useApp } from '@/contexts/AppContext';
import { AddTruckDialog } from '@/components/dialogs/AddTruckDialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Truck, Users, PauseCircle, History, Download, Printer, Play, UserX, Search, Filter, Calendar, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TrailerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block">
    <path d="M2 14.5V6C2 5.44772 2.44772 5 3 5H15V14.5H2Z" fill="#3B82F6" stroke="#1E40AF" strokeWidth="1"/>
    <path d="M15 14.5V7C15 6.44772 15.4477 6 16 6H20.5L22 9V14.5H15Z" fill="#60A5FA" stroke="#1E40AF" strokeWidth="1"/>
    <circle cx="5" cy="16" r="2.5" fill="#1F2937" stroke="white" strokeWidth="1"/>
    <circle cx="12" cy="16" r="2.5" fill="#1F2937" stroke="white" strokeWidth="1"/>
    <circle cx="19" cy="16" r="2.5" fill="#1F2937" stroke="white" strokeWidth="1"/>
    <path d="M18 9H21" stroke="white" strokeWidth="1" strokeLinecap="round"/>
    <rect x="2" y="14" width="20" height="1" fill="#1E40AF"/>
  </svg>
);

const Trucks = () => {
  const { trucks, drivers, updateTruck, deleteTruck, clearAllTrucks, bulkSetRepos, bulkReactivate, bulkDissociateDriver, driverHasActiveTruck, truckAssignments } = useApp();
  const { toast } = useToast();
  const today = new Date();

  // تأكيد تغيير سائق لصف واحد
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{ truckId: string; newDriverId: string } | null>(null);

  // بحث وفلاتر وفرز
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<{ active: boolean; inactive: boolean; noDriver: boolean }>(() => {
    const saved = localStorage.getItem('truckFilters');
    return saved ? JSON.parse(saved) : { active: true, inactive: true, noDriver: false };
  });
  const [sortBy, setSortBy] = useState<'status' | 'name' | 'updatedAt'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyTruckId, setHistoryTruckId] = useState<string>('');

  // تحديد جماعي
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelected = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const clearSelection = () => setSelected(new Set());

  // تصفية وفرز الشاحنات
  const filteredTrucks = useMemo(() => {
    return trucks
      .filter(t => {
        const driver = drivers.find(d => d.id === t.driverId);
        const matchesSearch =
          t.matricule.toLowerCase().includes(search.toLowerCase()) ||
          (driver?.name || '').toLowerCase().includes(search.toLowerCase());
        const includeByStatus =
          (filters.active && t.isActive) ||
          (filters.inactive && !t.isActive);
        const includeNoDriver = filters.noDriver ? !t.driverId : true;
        return matchesSearch && includeByStatus && includeNoDriver;
      })
      .sort((a, b) => {
        if (sortBy === 'status') {
          const cmp = a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1;
          return cmp * (sortOrder === 'asc' ? 1 : -1);
        }
        if (sortBy === 'name') {
          const an = (drivers.find(d => d.id === a.driverId)?.name || '').toLowerCase();
          const bn = (drivers.find(d => d.id === b.driverId)?.name || '').toLowerCase();
          const cmp = an.localeCompare(bn);
          return cmp * (sortOrder === 'asc' ? 1 : -1);
        }
        const ad = a.updatedAt ? Date.parse(a.updatedAt) : 0;
        const bd = b.updatedAt ? Date.parse(b.updatedAt) : 0;
        const cmp = ad - bd;
        return cmp * (sortOrder === 'asc' ? 1 : -1);
      });
  }, [trucks, drivers, search, filters, sortBy, sortOrder]);

  // يجب أن يُحسب بعد filteredTrucks
  const allSelected = selected.size > 0 && selected.size === filteredTrucks.length;

  // إحصائيات
  const totalTrucks = trucks.length;
  const totalDrivers = drivers.length;
  const inactiveTrucks = trucks.filter(t => !t.isActive).length;

  // حفظ الفلاتر
  const saveFilters = (next: typeof filters) => {
    setFilters(next);
    localStorage.setItem('truckFilters', JSON.stringify(next));
  };

  // تصدير CSV
  const exportCSV = () => {
    const rows = [
      ['Matricule', 'Chauffeur', 'Statut', 'Dernière activité', 'Repos (raison)', 'Retour prévu'],
      ...filteredTrucks.map(t => {
        const driver = drivers.find(d => d.id === t.driverId)?.name || '';
        return [
          t.matricule,
          driver,
          t.isActive ? 'Actif' : 'Inactif',
          t.updatedAt ? new Date(t.updatedAt).toLocaleString() : '',
          t.reposReason || '',
          t.nextReturnDate || ''
        ];
      })
    ];
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'camions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedHistoryTruck = useMemo(() => {
    return trucks.find(t => t.id === historyTruckId);
  }, [trucks, historyTruckId]);

  const selectedHistoryAssignments = useMemo(() => {
    const rows = (truckAssignments || []).filter(a => a?.truckId === historyTruckId);
    return rows.sort((a: any, b: any) => {
      const ad = a?.date ? Date.parse(a.date) : 0;
      const bd = b?.date ? Date.parse(b.date) : 0;
      return bd - ad;
    });
  }, [truckAssignments, historyTruckId]);

  const downloadAssignmentHistoryPDF = () => {
    if (!selectedHistoryTruck) return;

    const doc = new jsPDF();
    const now = new Date();
    const dateStr = format(now, 'dd/MM/yyyy HH:mm', { locale: fr });

    doc.setFontSize(14);
    doc.text(`Historique d'assignation - ${selectedHistoryTruck.matricule}`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Généré le: ${dateStr}`, 14, 24);

    const tableRows = selectedHistoryAssignments.map((a: any) => {
      const prevName = drivers.find(d => d.id === a?.prevDriverId)?.name || 'Non assigné';
      const nextName = drivers.find(d => d.id === a?.driverId)?.name || 'Non assigné';
      const d = a?.date ? format(new Date(a.date), 'dd/MM/yyyy HH:mm', { locale: fr }) : '';
      return [d, prevName, nextName, a?.note || ''];
    });

    autoTable(doc, {
      head: [['Date', 'Ancien chauffeur', 'Nouveau chauffeur', 'Note']],
      body: tableRows,
      startY: 32,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 50 }, 2: { cellWidth: 50 }, 3: { cellWidth: 'auto' } },
    });

    doc.save(`historique_assignation_${selectedHistoryTruck.matricule}_${format(now, 'yyyyMMdd_HHmm')}.pdf`);
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Calendar className="w-4 h-4" />
            <span className="text-sm font-medium capitalize">
              {format(today, 'eeee d MMMM yyyy', { locale: fr })}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Gestion des Camions</h1>
          <p className="text-slate-500 font-medium">
            Supervision de la flotte et assignation des chauffeurs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => window.print()} className="hidden md:flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border-slate-200">
            <Printer className="w-4 h-4" />
            Imprimer
          </Button>
          <Button
            variant="outline"
            disabled={trucks.length === 0}
            onClick={() => {
              if (window.confirm('Supprimer tous les camions ? Cette action est irréversible.')) {
                clearAllTrucks();
                clearSelection();
                toast({ title: 'Camions supprimés', description: 'Tous les camions ont été supprimés.' });
              }
            }}
            className="hidden md:flex items-center gap-2 bg-white hover:bg-red-50 text-red-600 border-red-200"
          >
            <Trash2 className="w-4 h-4" />
            Supprimer tout
          </Button>
          <AddTruckDialog />
        </div>
      </div>

      {/* Stats Cards Section */}
      <div className="grid gap-6 sm:grid-cols-3">
        <Card className="p-6 border-none shadow-md bg-gradient-to-br from-indigo-600 to-indigo-700 text-white overflow-hidden relative group">
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <Truck className="w-32 h-32" />
          </div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-indigo-100 text-sm font-semibold mb-1">Total Flotte</p>
              <div className="text-4xl font-bold">{totalTrucks}</div>
              <p className="text-indigo-200 text-xs mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Véhicules enregistrés
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md shadow-inner">
              <Truck className="h-8 w-8 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-6 border-none shadow-md bg-gradient-to-br from-emerald-600 to-emerald-700 text-white overflow-hidden relative group">
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <Users className="w-32 h-32" />
          </div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-emerald-100 text-sm font-semibold mb-1">Chauffeurs</p>
              <div className="text-4xl font-bold">{totalDrivers}</div>
              <p className="text-emerald-200 text-xs mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Membres d'équipage
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md shadow-inner">
              <Users className="h-8 w-8 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-6 border-none shadow-md bg-gradient-to-br from-amber-500 to-amber-600 text-white overflow-hidden relative group">
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <PauseCircle className="w-32 h-32" />
          </div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-amber-500 text-sm font-semibold mb-1">En Repos</p>
              <div className="text-4xl font-bold">{inactiveTrucks}</div>
              <p className="text-amber-100 text-xs mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Véhicules inactifs
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md shadow-inner">
              <PauseCircle className="h-8 w-8 text-white" />
            </div>
          </div>
        </Card>
      </div>

      {/* Controls: search, filters, sort, export/print */}
      <Card className="p-6 bg-white border-none shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par matricule ou chauffeur..."
              className="pl-10 h-11 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-indigo-600 transition-all rounded-xl"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-2 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer group">
              <Checkbox 
                id="filter-active"
                checked={filters.active} 
                onCheckedChange={(v) => saveFilters({ ...filters, active: Boolean(v) })} 
                className="data-[state=checked]:bg-emerald-600 border-slate-300"
              />
              <label htmlFor="filter-active" className="text-sm font-semibold text-slate-600 group-hover:text-slate-900 cursor-pointer">Actif</label>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer group">
              <Checkbox 
                id="filter-inactive"
                checked={filters.inactive} 
                onCheckedChange={(v) => saveFilters({ ...filters, inactive: Boolean(v) })} 
                className="data-[state=checked]:bg-amber-600 border-slate-300"
              />
              <label htmlFor="filter-inactive" className="text-sm font-semibold text-slate-600 group-hover:text-slate-900 cursor-pointer">Inactif</label>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer group">
              <Checkbox 
                id="filter-nodriver"
                checked={filters.noDriver} 
                onCheckedChange={(v) => saveFilters({ ...filters, noDriver: Boolean(v) })} 
                className="data-[state=checked]:bg-slate-600 border-slate-300"
              />
              <label htmlFor="filter-nodriver" className="text-sm font-semibold text-slate-600 group-hover:text-slate-900 cursor-pointer">Sans chauffeur</label>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={historyTruckId}
              onValueChange={(v) => {
                setHistoryTruckId(v);
                setHistoryDialogOpen(true);
              }}
            >
              <SelectTrigger className="w-[240px] h-11 bg-white border-slate-200 rounded-xl">
                <History className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Filtre: Historique camion" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                {trucks.map(truck => (
                  <SelectItem key={truck.id} value={truck.id} className="text-sm font-medium rounded-lg">
                    {truck.matricule}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[180px] h-11 bg-white border-slate-200 rounded-xl">
                <Filter className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Statut</SelectItem>
                <SelectItem value="name">Chauffeur</SelectItem>
                <SelectItem value="updatedAt">Dernière activité</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="icon"
              className="h-11 w-11 rounded-xl border-slate-200 bg-white"
              onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
            <Button variant="outline" onClick={exportCSV} className="h-11 px-4 rounded-xl border-slate-200 bg-white hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
              <Download className="w-4 h-4 mr-2" /> 
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl animate-in fade-in slide-in-from-top-2">
            <span className="text-sm font-bold text-indigo-900 ml-2">
              {selected.size} camions sélectionnés
            </span>
            <div className="h-4 w-px bg-indigo-200 mx-2" />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white" onClick={() => {
                const ids = Array.from(selected);
                bulkSetRepos(ids);
                clearSelection();
                toast({ title: 'Mis en repos', description: `${ids.length} camion(s) mis en repos` });
              }}>
                Mettre en repos
              </Button>
              <Button variant="outline" size="sm" className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white" onClick={() => {
                const ids = Array.from(selected);
                bulkReactivate(ids);
                clearSelection();
                toast({ title: 'Réactivés', description: `${ids.length} camion(s) réactivé(s)` });
              }}>
                Réactiver
              </Button>
              <Button variant="outline" size="sm" className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white" onClick={() => {
                const ids = Array.from(selected);
                bulkDissociateDriver(ids);
                clearSelection();
                toast({ title: 'Chauffeurs dissociés', description: `${ids.length} camion(s)` });
              }}>
                Dissocier
              </Button>
              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900" onClick={clearSelection}>Annuler</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Trucks Table */}
      <Card className="border-none shadow-md overflow-hidden rounded-2xl bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="w-12">
                  <Checkbox
                    checked={selected.size > 0 && allSelected}
                    onCheckedChange={(v) => {
                      if (v) setSelected(new Set(filteredTrucks.map(t => t.id)));
                      else clearSelection();
                    }}
                    className="data-[state=checked]:bg-indigo-600"
                  />
                </TableHead>
                <TableHead className="text-slate-600 font-bold">Matricule</TableHead>
                <TableHead className="text-slate-600 font-bold">Type</TableHead>
                <TableHead className="text-slate-600 font-bold">Chauffeur</TableHead>
                <TableHead className="text-slate-600 font-bold">Statut</TableHead>
                <TableHead className="text-slate-600 font-bold">Dernière activité</TableHead>
                <TableHead className="text-slate-600 font-bold text-center">Actions</TableHead>
                <TableHead className="text-slate-600 font-bold">Assignation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTrucks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Truck className="w-12 h-12 mb-2 opacity-20" />
                      <p className="text-lg font-medium">Aucun camion trouvé</p>
                      <p className="text-sm">Essayez de modifier vos critères de recherche</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTrucks.map((truck) => {
                  const currentDriver = drivers.find(d => d.id === truck.driverId);
                  const statusLabel = truck.isActive ? 'Actif' : 'Inactif';
                  
                  return (
                    <TableRow key={truck.id} className="group hover:bg-slate-50/50 transition-colors border-slate-100">
                      <TableCell>
                        <Checkbox 
                          checked={selected.has(truck.id)} 
                          onCheckedChange={() => toggleSelected(truck.id)} 
                          aria-label={`Select ${truck.matricule}`}
                          className="data-[state=checked]:bg-indigo-600"
                        />
                      </TableCell>
                      <TableCell className="font-bold text-slate-900">{truck.matricule}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-white border-slate-200 text-slate-600 font-medium px-2 py-0.5 rounded-md">
                          {truck.truckType === 'camion' ? '🚛 Camion' : 
                           truck.truckType === 'remorque' ? (
                             <span className="inline-flex items-center gap-1">
                               <TrailerIcon />
                               <span>Remorque</span>
                             </span>
                           ) : 
                           '🚚 Petit Camion'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {currentDriver ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                              {currentDriver.name.charAt(0)}
                            </div>
                            <span className="font-medium text-slate-700">{currentDriver.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-sm">Non assigné</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={`font-semibold rounded-full px-3 ${
                            truck.isActive 
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' 
                              : 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                          }`}>
                            {statusLabel}
                          </Badge>
                          {!truck.isActive && (truck.nextReturnDate || truck.reposReason) && (
                            <div className="text-[10px] text-slate-500 flex flex-col gap-0.5 leading-tight">
                              {truck.nextReturnDate && <span>📅 Reprise: {truck.nextReturnDate}</span>}
                              {truck.reposReason && <span className="max-w-[150px] truncate">📝 {truck.reposReason}</span>}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm font-medium">
                        {truck.updatedAt ? format(new Date(truck.updatedAt), 'dd/MM/yy HH:mm') : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {truck.isActive ? (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg"
                              onClick={() => updateTruck(truck.id, { isActive: false })}
                              title="Mettre en repos"
                            >
                              <PauseCircle className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                              onClick={() => updateTruck(truck.id, { isActive: true, reposReason: undefined, nextReturnDate: undefined })}
                              title="Réactiver"
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            onClick={() => updateTruck(truck.id, { driverId: '' })}
                            title="Dissocier chauffeur"
                          >
                            <UserX className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            onClick={() => {
                              if (window.confirm(`Supprimer le camion ${truck.matricule} ?`)) {
                                deleteTruck(truck.id);
                                setSelected(prev => {
                                  const next = new Set(prev);
                                  next.delete(truck.id);
                                  return next;
                                });
                                toast({ title: 'Camion supprimé', description: `${truck.matricule} a été supprimé.` });
                              }
                            }}
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                title="Historique"
                              >
                                <History className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="max-w-md p-0 border-none overflow-hidden shadow-2xl">
                              <div className="bg-indigo-600 p-6 text-white">
                                <AlertDialogHeader>
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                      <History className="w-6 h-6" />
                                    </div>
                                    <div>
                                      <AlertDialogTitle className="text-xl font-bold text-white">Historique d'assignation</AlertDialogTitle>
                                      <p className="text-indigo-100 text-xs mt-0.5">{truck.matricule}</p>
                                    </div>
                                  </div>
                                </AlertDialogHeader>
                              </div>
                              <div className="p-6 space-y-4 max-h-[50vh] overflow-auto bg-white">
                                {truckAssignments.filter(a => a.truckId === truck.id).length === 0 ? (
                                  <div className="text-center py-8 text-slate-400">
                                    <History className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    <p>Aucun historique disponible</p>
                                  </div>
                                ) : (
                                  truckAssignments.filter(a => a.truckId === truck.id).map(a => (
                                    <div key={a.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-400">
                                          {format(new Date(a.date), 'dd MMMM yyyy HH:mm', { locale: fr })}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                        <span className="text-slate-400">{(drivers.find(d => d.id === a.prevDriverId)?.name || 'N/A')}</span>
                                        <span className="text-indigo-400">→</span>
                                        <span className="text-indigo-600">{drivers.find(d => d.id === a.driverId)?.name}</span>
                                      </div>
                                      {a.note && <div className="text-xs text-slate-500 italic bg-white p-2 rounded-md border border-slate-100 mt-2">{a.note}</div>}
                                    </div>
                                  ))
                                )}
                              </div>
                              <AlertDialogFooter className="p-4 bg-slate-50 border-t border-slate-100">
                                <AlertDialogCancel className="rounded-xl border-slate-200">Fermer</AlertDialogCancel>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={truck.driverId || ''}
                          onValueChange={(value) => {
                            const conflict = driverHasActiveTruck(value);
                            if (conflict && conflict.id !== truck.id) {
                              setPendingChange({ truckId: truck.id, newDriverId: value });
                              setConfirmOpen(true);
                              return;
                            }
                            setPendingChange({ truckId: truck.id, newDriverId: value });
                            setConfirmOpen(true);
                          }}
                        >
                          <SelectTrigger className="w-[180px] h-9 bg-white border-slate-200 rounded-lg text-xs font-medium focus:ring-indigo-600">
                            <SelectValue placeholder="Changer chauffeur" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                            {drivers.map(driver => (
                              <SelectItem key={driver.id} value={driver.id} className="text-xs font-medium rounded-lg">
                                {driver.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Confirmation dialog (single row driver change) */}
      <AlertDialog
        open={historyDialogOpen}
        onOpenChange={(open) => {
          setHistoryDialogOpen(open);
          if (!open) setHistoryTruckId('');
        }}
      >
        <AlertDialogContent className="max-w-lg p-0 border-none overflow-hidden shadow-2xl">
          <div className="bg-indigo-600 p-6 text-white">
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <AlertDialogTitle className="text-xl font-bold text-white">Historique d'assignation</AlertDialogTitle>
                  <p className="text-indigo-100 text-xs mt-0.5">{selectedHistoryTruck?.matricule || ''}</p>
                </div>
              </div>
            </AlertDialogHeader>
          </div>
          <div className="p-6 space-y-4 max-h-[55vh] overflow-auto bg-white">
            {selectedHistoryAssignments.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <History className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p>Aucun historique disponible</p>
              </div>
            ) : (
              selectedHistoryAssignments.map((a: any) => (
                <div key={a.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">
                      {a?.date ? format(new Date(a.date), 'dd MMMM yyyy HH:mm', { locale: fr }) : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <span className="text-slate-400">{drivers.find(d => d.id === a?.prevDriverId)?.name || 'Non assigné'}</span>
                    <span className="text-indigo-400">→</span>
                    <span className="text-indigo-600">{drivers.find(d => d.id === a?.driverId)?.name || 'Non assigné'}</span>
                  </div>
                  {a?.note && <div className="text-xs text-slate-500 italic bg-white p-2 rounded-md border border-slate-100 mt-2">{a.note}</div>}
                </div>
              ))
            )}
          </div>
          <AlertDialogFooter className="p-4 bg-slate-50 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={downloadAssignmentHistoryPDF}
              disabled={!selectedHistoryTruck || selectedHistoryAssignments.length === 0}
              className="rounded-xl border-slate-200 bg-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Télécharger PDF
            </Button>
            <AlertDialogCancel className="rounded-xl border-slate-200">Fermer</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-md p-0 border-none overflow-hidden shadow-2xl">
          <div className="bg-amber-500 p-6 text-white">
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <AlertDialogTitle className="text-xl font-bold text-white">Confirmer le changement</AlertDialogTitle>
              </div>
            </AlertDialogHeader>
          </div>
          <div className="p-6 bg-white">
            <AlertDialogDescription className="text-slate-600 font-medium">
              Ce chauffeur est déjà assigné à un autre camion actif. Si vous confirmez, l'autre camion sera automatiquement mis en repos.
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter className="p-4 bg-slate-50 border-t border-slate-100">
            <AlertDialogCancel onClick={() => setPendingChange(null)} className="rounded-xl border-slate-200">Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-6 font-bold"
              onClick={() => {
                if (pendingChange) {
                  const { truckId, newDriverId } = pendingChange;
                  const otherTrucksWithSameDriver = trucks.filter(
                    (t) => t.driverId === newDriverId && t.id !== truckId
                  );
                  otherTrucksWithSameDriver.forEach((t) => {
                    updateTruck(t.id, { isActive: false });
                  });
                  updateTruck(truckId, { driverId: newDriverId, isActive: true });
                  setPendingChange(null);
                  setConfirmOpen(false);
                  toast({
                    title: "Chauffeur mis à jour",
                    description: "Assignation réussie. L'autre véhicule a été mis en repos.",
                  });
                }
              }}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Trucks;
