// Top-level imports
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Repair } from '@/types';
import { Wrench, Plus, Search, Filter, Calendar, DollarSign, FileText, Truck, FileDown, Play, Pencil, Trash2, AlertCircle, CheckCircle2, History, CreditCard, Banknote } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Repairs = () => {
  const { trucks, drivers, repairs, addRepair, updateRepair, deleteRepair, updateTruck, addExpense, deleteExpense } = useApp();
  const { toast } = useToast();

  const handleDownloadPDF = (repair: Repair) => {
    const doc = new jsPDF();
    const truck = trucks.find(t => t.id === repair.truckId);
    const typeLabel = repair.type === 'mecanique' ? 'Mécanique' : repair.type === 'electrique' ? 'Électrique' : 'Garage';
    const paymentMethodMap: { [key: string]: string } = { especes: 'Espèces', cheque: 'Chèque', virement: 'Virement' };

    // Header styling
    doc.setFillColor(249, 115, 22); // orange-500
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("BON DE RÉPARATION", 105, 25, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Date: ${format(new Date(repair.date), 'dd MMMM yyyy', { locale: fr })}`, 14, 50);
    doc.text(`Référence: REP-${repair.id.slice(0, 8).toUpperCase()}`, 14, 58);

    autoTable(doc, {
      startY: 70,
      head: [['Désignation', 'Détails']],
      body: [
        ['Véhicule', truck?.matricule || 'N/A'],
        ['Type de Réparation', typeLabel],
        ['Description', repair.remarks],
        ['Mode de Paiement', paymentMethodMap[repair.paymentMethod] || repair.paymentMethod],
        ['Statut', repair.debtAmount > 0 ? 'Partiellement Payé' : 'Payé'],
      ],
      headStyles: { fillColor: [249, 115, 22] },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFontSize(14);
    doc.text("Récapitulatif Financier", 14, finalY);
    
    autoTable(doc, {
      startY: finalY + 5,
      body: [
        ['Coût Total', `${repair.totalCost.toFixed(2)} MAD`],
        ['Montant Payé', `${repair.paidAmount.toFixed(2)} MAD`],
        ['Reste à Payer (Dette)', `${repair.debtAmount.toFixed(2)} MAD`],
      ],
      styles: { fontSize: 11 },
      columnStyles: { 0: { fontStyle: 'bold' } },
    });

    doc.save(`reparation-${truck?.matricule || 'vehicule'}-${format(new Date(repair.date), 'dd-MM-yyyy')}.pdf`);
  };

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingRepair, setEditingRepair] = useState<Repair | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    truckId: '',
    type: 'mecanique' as 'mecanique' | 'electrique' | 'garage',
    totalCost: '',
    paidAmount: '',
    paymentMethod: 'especes' as 'especes' | 'cheque' | 'virement',
    date: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('tous');
  const [periodFilter, setPeriodFilter] = useState('toutes');

  // Stats calculation
  const stats = useMemo(() => {
    const total = repairs.reduce((acc, r) => acc + r.totalCost, 0);
    const paid = repairs.reduce((acc, r) => acc + r.paidAmount, 0);
    const debt = repairs.reduce((acc, r) => acc + r.debtAmount, 0);
    return { total, paid, debt, count: repairs.length };
  }, [repairs]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.truckId || !formData.totalCost || !formData.paidAmount || !formData.remarks) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive"
      });
      return;
    }

    const totalCost = parseFloat(formData.totalCost);
    const paidAmount = parseFloat(formData.paidAmount);

    if (paidAmount > totalCost) {
      toast({
        title: "Erreur",
        description: "Le montant payé ne peut pas être supérieur au coût total",
        variant: "destructive"
      });
      return;
    }

    if (isEditing && editingRepair) {
      const updatedRepair: Repair = {
        ...editingRepair,
        date: formData.date,
        truckId: formData.truckId,
        type: formData.type,
        totalCost,
        paidAmount,
        debtAmount: totalCost - paidAmount,
        paymentMethod: formData.paymentMethod,
        remarks: formData.remarks
      };
      updateRepair(updatedRepair);
    } else {
      const newRepair: Repair = {
        id: (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
        date: formData.date,
        truckId: formData.truckId,
        type: formData.type,
        totalCost,
        paidAmount,
        debtAmount: totalCost - paidAmount,
        paymentMethod: formData.paymentMethod,
        remarks: formData.remarks
      };
      addRepair(newRepair);

      if (newRepair.type === 'garage' && newRepair.truckId) {
        updateTruck(newRepair.truckId, { isActive: false, reposReason: 'Garage' });
      }
    }

    setDialogOpen(false);
    setIsEditing(false);
    setEditingRepair(null);

    toast({
      title: "Succès",
      description: isEditing ? "Réparation mise à jour avec succès" : "Réparation ajoutée avec succès"
    });
  };

  // Filter repairs based on search and filters
  const filteredRepairs = repairs.filter(repair => {
    const truck = trucks.find(t => t.id === repair.truckId);
    const truckMatricule = truck?.matricule || '';
    
    const matchesSearch = truckMatricule.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         repair.remarks.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'tous' || repair.type === typeFilter;
    
    let matchesPeriod = true;
    if (periodFilter !== 'toutes') {
      const repairDate = new Date(repair.date);
      const now = new Date();
      
      switch (periodFilter) {
        case '7jours':
          matchesPeriod = (now.getTime() - repairDate.getTime()) <= 7 * 24 * 60 * 60 * 1000;
          break;
        case '30jours':
          matchesPeriod = (now.getTime() - repairDate.getTime()) <= 30 * 24 * 60 * 60 * 1000;
          break;
        case '90jours':
          matchesPeriod = (now.getTime() - repairDate.getTime()) <= 90 * 24 * 60 * 60 * 1000;
          break;
      }
    }
    
    return matchesSearch && matchesType && matchesPeriod;
  });

  const selectedTruck = trucks.find(t => String(t.id) === formData.truckId);

  return (
    <div className="p-4 md:p-8 space-y-8 bg-slate-50/50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Wrench className="h-8 w-8 text-orange-600" />
            </div>
            Gestion des Réparations
          </h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
          </p>
        </div>
        <Button 
          onClick={() => {
            setIsEditing(false);
            setEditingRepair(null);
            setFormData({
              truckId: '',
              type: 'mecanique',
              totalCost: '',
              paidAmount: '',
              paymentMethod: 'especes',
              date: new Date().toISOString().split('T')[0],
              remarks: ''
            });
            setDialogOpen(true);
          }}
          className="bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-200 transition-all active:scale-95"
        >
          <Plus className="mr-2 h-5 w-5" /> Nouvelle Réparation
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-md bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center justify-between">
              Nombre de Réparations
              <History className="h-4 w-4 text-orange-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{stats.count}</div>
            <p className="text-xs text-slate-400 mt-1">Opérations enregistrées</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-100 flex items-center justify-between">
              Coût Total
              <Wrench className="h-4 w-4 opacity-70" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total.toLocaleString('fr-MA')} MAD</div>
            <p className="text-xs text-orange-100 mt-1">Cumul total des coûts</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-100 flex items-center justify-between">
              Montant Réglé
              <CheckCircle2 className="h-4 w-4 opacity-70" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.paid.toLocaleString('fr-MA')} MAD</div>
            <p className="text-xs text-emerald-100 mt-1">Montant total payé</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-gradient-to-br from-rose-500 to-rose-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-rose-100 flex items-center justify-between">
              Dettes Restantes
              <AlertCircle className="h-4 w-4 opacity-70" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.debt.toLocaleString('fr-MA')} MAD</div>
            <p className="text-xs text-rose-100 mt-1">Montant à régulariser</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card className="border-none shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Rechercher par véhicule ou remarque..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-200 focus:ring-orange-500"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="border-slate-200">
                <Filter className="mr-2 h-4 w-4 text-slate-400" />
                <SelectValue placeholder="Type de réparation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les types</SelectItem>
                <SelectItem value="mecanique">Mécanique</SelectItem>
                <SelectItem value="electrique">Électrique</SelectItem>
                <SelectItem value="garage">Garage</SelectItem>
              </SelectContent>
            </Select>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="border-slate-200">
                <Calendar className="mr-2 h-4 w-4 text-slate-400" />
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes les périodes</SelectItem>
                <SelectItem value="7jours">7 derniers jours</SelectItem>
                <SelectItem value="30jours">30 derniers jours</SelectItem>
                <SelectItem value="90jours">90 derniers jours</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center justify-end">
              <p className="text-sm text-slate-500 font-medium">
                {filteredRepairs.length} résultat{filteredRepairs.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Repairs Table */}
      <Card className="border-none shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-semibold text-slate-700">Date</TableHead>
              <TableHead className="font-semibold text-slate-700">Véhicule</TableHead>
              <TableHead className="font-semibold text-slate-700">Type</TableHead>
              <TableHead className="font-semibold text-slate-700">Coût Total</TableHead>
              <TableHead className="font-semibold text-slate-700">Payé</TableHead>
              <TableHead className="font-semibold text-slate-700">Dette</TableHead>
              <TableHead className="font-semibold text-slate-700">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRepairs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Wrench className="h-8 w-8 text-slate-300" />
                    <p>Aucune réparation trouvée</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredRepairs.map((repair) => {
                const truck = trucks.find(t => t.id === repair.truckId);
                return (
                  <TableRow key={repair.id} className="hover:bg-slate-50/50 transition-colors group">
                    <TableCell className="font-medium text-slate-600">
                      {format(new Date(repair.date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-slate-100 rounded text-slate-600">
                          <Truck className="h-4 w-4" />
                        </div>
                        <span className="font-semibold text-slate-900">{truck?.matricule || 'Inconnu'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`
                        ${repair.type === 'mecanique' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                          repair.type === 'electrique' ? 'bg-purple-50 text-purple-700 border-purple-100' : 
                          'bg-orange-50 text-orange-700 border-orange-100'}
                        border font-medium
                      `}>
                        {repair.type === 'mecanique' ? 'Mécanique' : 
                         repair.type === 'electrique' ? 'Électrique' : 'Garage'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-slate-900">
                      {repair.totalCost.toLocaleString('fr-MA')} MAD
                    </TableCell>
                    <TableCell className="text-emerald-600 font-medium">
                      {repair.paidAmount.toLocaleString('fr-MA')} MAD
                    </TableCell>
                    <TableCell>
                      {repair.debtAmount > 0 ? (
                        <span className="text-rose-600 font-bold px-2 py-1 bg-rose-50 rounded text-xs">
                          {repair.debtAmount.toLocaleString('fr-MA')} MAD
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                          Réglé
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownloadPDF(repair)}
                          className="h-8 w-8 text-slate-400 hover:text-orange-600 hover:bg-orange-50"
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingRepair(repair);
                            setIsEditing(true);
                            setFormData({
                              truckId: repair.truckId,
                              type: repair.type,
                              totalCost: repair.totalCost.toString(),
                              paidAmount: repair.paidAmount.toString(),
                              paymentMethod: repair.paymentMethod,
                              date: repair.date.split('T')[0],
                              remarks: repair.remarks
                            });
                            setDialogOpen(true);
                          }}
                          className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Voulez-vous vraiment supprimer cette réparation ?')) {
                              deleteRepair(repair.id);
                              toast({
                                title: "Réparation supprimée",
                                description: "La réparation a été supprimée avec succès.",
                              });
                            }
                          }}
                          className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Modernized Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Wrench className="h-6 w-6" />
                </div>
                {isEditing ? 'Modifier la Réparation' : 'Nouvelle Réparation'}
              </DialogTitle>
              <p className="text-orange-100 mt-1">
                {isEditing ? 'Mettre à jour les détails de l\'opération' : 'Enregistrer une nouvelle opération de maintenance'}
              </p>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">Véhicule</Label>
                <Select value={formData.truckId} onValueChange={(value) => setFormData(prev => ({ ...prev, truckId: value }))}>
                  <SelectTrigger className="border-slate-200 focus:ring-orange-500">
                    <SelectValue placeholder="Sélectionner un véhicule" />
                  </SelectTrigger>
                  <SelectContent>
                    {trucks.map(truck => (
                      <SelectItem key={truck.id} value={truck.id}>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-slate-400" />
                          {truck.matricule}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">Type de Réparation</Label>
                <Select value={formData.type} onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}>
                  <SelectTrigger className="border-slate-200 focus:ring-orange-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mecanique">🔧 Mécanique</SelectItem>
                    <SelectItem value="electrique">⚡ Électrique</SelectItem>
                    <SelectItem value="garage">🏪 Garage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">Date</Label>
                <Input 
                  type="date" 
                  value={formData.date} 
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="border-slate-200 focus:ring-orange-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">Mode de Paiement</Label>
                <Select value={formData.paymentMethod} onValueChange={(value: any) => setFormData(prev => ({ ...prev, paymentMethod: value }))}>
                  <SelectTrigger className="border-slate-200 focus:ring-orange-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="especes">
                      <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-emerald-500" />
                        Espèces
                      </div>
                    </SelectItem>
                    <SelectItem value="cheque">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-blue-500" />
                        Chèque
                      </div>
                    </SelectItem>
                    <SelectItem value="virement">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-purple-500" />
                        Virement
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="space-y-2">
                <Label className="text-slate-700 font-bold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-orange-500" />
                  Coût Total (MAD)
                </Label>
                <Input 
                  type="number" 
                  step="0.01"
                  value={formData.totalCost} 
                  onChange={e => setFormData({ ...formData, totalCost: e.target.value })}
                  className="bg-white border-slate-200 focus:ring-orange-500 font-bold text-lg"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Montant Payé (MAD)
                </Label>
                <Input 
                  type="number" 
                  step="0.01"
                  value={formData.paidAmount} 
                  onChange={e => setFormData({ ...formData, paidAmount: e.target.value })}
                  className="bg-white border-slate-200 focus:ring-emerald-500 font-bold text-lg text-emerald-600"
                  placeholder="0.00"
                />
              </div>
              {formData.totalCost && formData.paidAmount && (
                <div className="md:col-span-2 pt-2 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-500">Reste à payer (Dette) :</span>
                  <span className={`text-lg font-bold ${(parseFloat(formData.totalCost) - parseFloat(formData.paidAmount)) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {(parseFloat(formData.totalCost) - parseFloat(formData.paidAmount)).toLocaleString('fr-MA')} MAD
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold">Description / Remarques</Label>
              <Textarea 
                placeholder="Détails de la réparation, pièces changées..."
                value={formData.remarks}
                onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                className="min-h-[100px] border-slate-200 focus:ring-orange-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="text-slate-500 hover:bg-slate-100">
                Annuler
              </Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white px-8 shadow-lg shadow-orange-100">
                {isEditing ? 'Enregistrer les modifications' : 'Ajouter la réparation'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Repairs;