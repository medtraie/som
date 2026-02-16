import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useApp } from '@/contexts/AppContext';
import { Users, Plus, Pencil, Trash2, History, FileText, Download, CheckSquare, Square, Search, Calendar, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';

const Clients = () => {
  const { clients, addClient, updateClient, deleteClient, supplyOrders = [] } = useApp();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const [newClientName, setNewClientName] = useState('');
  const [editClientName, setEditClientName] = useState('');
  
  // History states
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const clientOrders = useMemo(() => {
    if (!selectedClient) return [];
    return supplyOrders.filter(order => order.clientId === selectedClient.id)
      .filter(order => {
        const orderDate = new Date(order.date);
        const start = dateFilter.start ? new Date(dateFilter.start) : null;
        const end = dateFilter.end ? new Date(dateFilter.end) : null;
        
        if (start && orderDate < start) return false;
        if (end) {
          const endOfDay = new Date(end);
          endOfDay.setHours(23, 59, 59, 999);
          if (orderDate > endOfDay) return false;
        }
        
        if (searchTerm && !order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedClient, supplyOrders, dateFilter, searchTerm]);

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId) 
        : [...prev, orderId]
    );
  };

  const selectAllOrders = () => {
    if (selectedOrders.length === clientOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(clientOrders.map(o => o.id));
    }
  };

  const generateInvoicePDF = () => {
    try {
      if (selectedOrders.length === 0 || !selectedClient) {
        toast.error('Veuillez sélectionner au moins un bon de sortie');
        return;
      }

      const ordersToInvoice = clientOrders.filter(o => selectedOrders.includes(o.id));
      if (ordersToInvoice.length === 0) {
        toast.error('Aucun bon de sortie trouvé');
        return;
      }

      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(41, 128, 185);
      doc.text('FACTURE - BONS DE SORTIE', 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`Date: ${format(new Date(), 'dd/MM/yyyy')}`, 105, 30, { align: 'center' });

      // Client Info
      doc.setDrawColor(200);
      doc.line(20, 40, 190, 40);
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text(`Client: ${selectedClient.name}`, 20, 50);
      doc.text(`Nombre de bons: ${ordersToInvoice.length}`, 20, 60);

      // Table
      const tableData = ordersToInvoice.map(order => [
        order.date ? format(new Date(order.date), 'dd/MM/yyyy') : 'N/A',
        order.orderNumber || 'N/A',
        (order.items || []).map((item: any) => `${item.fullQuantity || 0} x ${item.bottleTypeName || 'Produit'}`).join('\n'),
        `${(order.total || 0).toFixed(2)} DH`
      ]);

      (autoTable as any)(doc, {
        startY: 70,
        head: [['Date', 'N° B.S', 'Produits', 'Montant']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        styles: { fontSize: 10, cellPadding: 5 },
        columnStyles: {
          3: { halign: 'right' }
        }
      });

      // Get final Y position safely
      const finalY = (doc as any).lastAutoTable?.cursor?.y || 150;
      const totalAmount = ordersToInvoice.reduce((sum, o) => sum + (o.total || 0), 0);

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`TOTAL GÉNÉRAL: ${totalAmount.toFixed(2)} DH`, 190, finalY + 10, { align: 'right' });

      doc.save(`Facture_${selectedClient.name.replace(/\s+/g, '_')}_${format(new Date(), 'ddMMyyyy')}.pdf`);
      toast.success('Facture générée avec succès');
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      toast.error('Erreur lors de la génération du PDF. Veuillez réessayer.');
    }
  };

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) {
      toast.error('Veuillez entrer un nom de client');
      return;
    }
    addClient({ name: newClientName.trim() });
    toast.success('Client ajouté avec succès');
    setAddDialogOpen(false);
    setNewClientName('');
  };

  const handleEditClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !editClientName.trim()) {
      toast.error('Veuillez entrer un nom de client');
      return;
    }
    updateClient(selectedClient.id, { name: editClientName.trim() });
    toast.success('Client modifié avec succès');
    setEditDialogOpen(false);
    setSelectedClient(null);
    setEditClientName('');
  };

  const handleDeleteClient = () => {
    if (!selectedClient) return;
    deleteClient(selectedClient.id);
    toast.success('Client supprimé avec succès');
    setDeleteDialogOpen(false);
    setSelectedClient(null);
  };

  const openEditDialog = (client: { id: string; name: string }) => {
    setSelectedClient(client);
    setEditClientName(client.name);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (client: { id: string; name: string }) => {
    setSelectedClient(client);
    setDeleteDialogOpen(true);
  };

  const resetFilters = () => {
    setDateFilter({ start: '', end: '' });
    setSearchTerm('');
    setSelectedOrders([]);
  };

  const openHistoryDialog = (client: { id: string; name: string }) => {
    setSelectedClient(client);
    resetFilters();
    setHistoryDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Clients</h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos clients et visualisez leur historique de bons de sortie
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un client</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddClient} className="space-y-4">
              <div>
                <Label htmlFor="clientName">Nom du client</Label>
                <Input
                  id="clientName"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Ex: Restaurant Al Amal"
                  required
                />
              </div>
              <Button type="submit" className="w-full">Ajouter</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Clients</p>
              <p className="text-2xl font-bold">{clients.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clients List */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des clients</CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucun client enregistré</h3>
              <p className="text-muted-foreground mb-4">
                Commencez par ajouter votre premier client
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => openHistoryDialog(client)}
                      title="Historique des Bons"
                    >
                      <History className="w-4 h-4 mr-2" />
                      Historique
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(client)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => openDeleteDialog(client)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{client.name}</p>
                <p className="text-xs text-muted-foreground">
                  {supplyOrders.filter(o => o.clientId === client.id).length} Bons de sortie
                </p>
              </div>
            </div>
          </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between w-full pr-8">
              <DialogTitle>
                Historique des Bons de Sortie - {selectedClient?.name}
              </DialogTitle>
              <Button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  generateInvoicePDF();
                }} 
                disabled={selectedOrders.length === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Générer Facture PDF ({selectedOrders.length})
                {selectedOrders.length > 0 && (
                  <span className="ml-2 bg-white/20 px-2 py-0.5 rounded text-xs">
                    {clientOrders
                      .filter(o => selectedOrders.includes(o.id))
                      .reduce((sum, o) => sum + (o.total || 0), 0)
                      .toFixed(2)} DH
                  </span>
                )}
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="block">Rechercher par N° B.S</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="N° Bon de sortie..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="block">Date Début</Label>
                <Input
                  type="date"
                  value={dateFilter.start}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="block">Date Fin</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={dateFilter.end}
                    onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                  />
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={resetFilters}
                    title="Réinitialiser les filtres"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox 
                        checked={clientOrders.length > 0 && selectedOrders.length === clientOrders.length}
                        onCheckedChange={selectAllOrders}
                      />
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>N° B.S</TableHead>
                    <TableHead>Produits</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Aucun bon de sortie trouvé pour ce client
                      </TableCell>
                    </TableRow>
                  ) : (
                    clientOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-muted/30">
                        <TableCell>
                          <Checkbox 
                            checked={selectedOrders.includes(order.id)}
                            onCheckedChange={() => toggleOrderSelection(order.id)}
                          />
                        </TableCell>
                        <TableCell>{format(new Date(order.date), 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell className="font-mono">{order.orderNumber}</TableCell>
                        <TableCell>
                          <div className="text-xs">
                            {order.items.map((item, idx) => (
                              <div key={idx}>
                                {item.fullQuantity} x {item.bottleTypeName}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">{order.total.toFixed(2)} DH</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le client</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditClient} className="space-y-4">
            <div>
              <Label htmlFor="editClientName">Nom du client</Label>
              <Input
                id="editClientName"
                value={editClientName}
                onChange={(e) => setEditClientName(e.target.value)}
                placeholder="Nom du client"
                required
              />
            </div>
            <Button type="submit" className="w-full">Enregistrer</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer ce client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action ne peut pas être annulée. Cela supprimera définitivement le client.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClient} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Clients;
