import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApp } from '@/contexts/AppContext';

import { Package, FileText, Plus, Printer, Download, Search, Calendar, RotateCcw, Trash2, Edit, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, Settings, DollarSign, Calculator, ArrowUpRight, ArrowDownLeft, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SupplyOrderItem, SupplyOrder } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RecordReturnDialog } from '@/components/dialogs/RecordReturnDialog';
import { SupplyTruckDialog } from '@/components/dialogs/SupplyTruckDialog';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn, safeDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SupplyReturn = () => {
  const { bottleTypes = [], drivers = [], clients = [], trucks = [], addClient, addSupplyOrder, updateBottleType, supplyOrders = [], returnOrders = [], deleteSupplyOrder, deleteReturnOrder, addRevenue, updateDriver, updateDriverDebt } = useApp();
  console.log(supplyOrders);
  const { toast } = useToast();



  const [selectedSupplyOrder, setSelectedSupplyOrder] = useState<SupplyOrder | null>(null);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  
  // Delete confirmation dialogs
  const [deleteSupplyDialogOpen, setDeleteSupplyDialogOpen] = useState(false);
  const [deleteReturnDialogOpen, setDeleteReturnDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  
  const [selectionType, setSelectionType] = useState<'existing' | 'new-driver' | 'new-client' | 'petit-camion'>('existing');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');
  const [newDriverMatricule, setNewDriverMatricule] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [reference, setReference] = useState('');
  const [lastReference, setLastReference] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState<Date | undefined>(new Date());
  
  // Load last reference from localStorage when component mounts
  useEffect(() => {
    const savedReference = localStorage.getItem('lastSupplyReference');
    if (savedReference) {
      setLastReference(savedReference);
    }
  }, []);

  useEffect(() => {
    if (supplyOrders.length === 0) {
      setOrderNumber("BS-1");
    } else {
      const maxNum = supplyOrders.reduce((max, order) => {
        if (order.orderNumber && order.orderNumber.startsWith('BS-')) {
          const num = parseInt(order.orderNumber.split('-')[1]);
          if (!isNaN(num) && num > max) {
            return num;
          }
        }
        return max;
      }, 0);
      setOrderNumber(`BS-${maxNum + 1}`);
    }
  }, [supplyOrders]);
  
  const [items, setItems] = useState<SupplyOrderItem[]>([]);
  
  // Filters for supply orders history
  const [filterDriver, setFilterDriver] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  
  // Filters for return orders history
  const [returnStartDate, setReturnStartDate] = useState<Date | undefined>(undefined);
  const [returnEndDate, setReturnEndDate] = useState<Date | undefined>(undefined);
  const [returnSearchQuery, setReturnSearchQuery] = useState('');
  const [returnFilterDriver, setReturnFilterDriver] = useState('all');
  const [returnFilterClient, setReturnFilterClient] = useState('all');
  const [returnCurrentPage, setReturnCurrentPage] = useState(1);
  const [selectedReturnOrder, setSelectedReturnOrder] = useState<any | null>(null);
  const [returnDetailsDialogOpen, setReturnDetailsDialogOpen] = useState(false);
  
  // Payment tracking states
  const [cashAmount, setCashAmount] = useState<string>('');
  const [checkAmount, setCheckAmount] = useState<string>('');
  const [showPaymentSection, setShowPaymentSection] = useState(false);
  
  // Payment dialog states
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedReturnOrderForPayment, setSelectedReturnOrderForPayment] = useState<any | null>(null);
  const [paymentCashAmount, setPaymentCashAmount] = useState<string>('');
  const [paymentCheckAmount, setPaymentCheckAmount] = useState<string>('');
  const [paymentMygazAmount, setPaymentMygazAmount] = useState<string>('');

  // State for expense notes in return dialog
  const [expenseNotes, setExpenseNotes] = useState<{ description: string; amount: number }[]>([]);
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  const addExpenseNote = () => {
    const amount = parseFloat(expenseAmount);
    if (expenseDescription.trim() && amount > 0) {
      setExpenseNotes([...expenseNotes, { description: expenseDescription.trim(), amount }]);
      setExpenseDescription('');
      setExpenseAmount('');
    }
  };

  const removeExpenseNote = (index: number) => {
    setExpenseNotes(expenseNotes.filter((_, i) => i !== index));
  };

  const totalExpenses = useMemo(() => {
    return expenseNotes.reduce((total, note) => total + note.amount, 0);
  }, [expenseNotes]);
  
  // Supply details dialog
  const [supplyDetailsDialogOpen, setSupplyDetailsDialogOpen] = useState(false);
  const [supplyTruckDialogOpen, setSupplyTruckDialogOpen] = useState(false);
  
  // Sorting
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);

  // الطي/الإظهار لقسم Historique des Bons de Sortie (محفوظ في localStorage)
  const [supplyHistoryOpen, setSupplyHistoryOpen] = useState<boolean>(() => {
    const v = localStorage.getItem("supplyReturn.historyOpen");
    return v ? v === "true" : false; // افتراضي: مخفي إذا لا يوجد تخزين سابق
  });
  useEffect(() => {
    localStorage.setItem("supplyReturn.historyOpen", String(supplyHistoryOpen));
  }, [supplyHistoryOpen]);
  

  // Calculate total amount from products
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  
  // Calculate debt (remaining amount)
  const calculateDebt = () => {
    const cash = parseFloat(cashAmount) || 0;
    const check = parseFloat(checkAmount) || 0;
    return Math.max(0, totalAmount - (cash + check));
  };

  // Get remaining debt for payment processing
  const getRemainingDebt = () => {
    const cash = parseFloat(cashAmount) || 0;
    const check = parseFloat(checkAmount) || 0;
    const { total } = calculateTotals();
    return Math.max(0, total - (cash + check));
  };

  // Reset payment form
  const resetPaymentForm = () => {
    setCashAmount('');
    setCheckAmount('');
    setShowPaymentSection(false);
  };
  
  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const handleQuantityChange = (bottleTypeId: string, field: 'empty' | 'full', value: string) => {
    const raw = parseInt(value) || 0;
    const bottleType = bottleTypes.find(bt => bt.id === bottleTypeId);
    if (!bottleType) return;

    const safeQuantity =
      field === 'full'
        ? Math.max(0, Math.min(raw, bottleType.remainingQuantity))
        : Math.max(0, raw);

    setItems(prev => {
      const existing = prev.find(item => item.bottleTypeId === bottleTypeId);

      if (existing) {
        const updated = { ...existing };
        if (field === 'empty') updated.emptyQuantity = safeQuantity;
        if (field === 'full') updated.fullQuantity = safeQuantity;
        updated.amount = updated.fullQuantity * bottleType.unitPrice;

        return prev.map(item => item.bottleTypeId === bottleTypeId ? updated : item);
      } else {
        const newItem: SupplyOrderItem = {
          bottleTypeId: bottleType.id,
          bottleTypeName: bottleType.name,
          emptyQuantity: field === 'empty' ? safeQuantity : 0,
          fullQuantity: field === 'full' ? safeQuantity : 0,
          unitPrice: bottleType.unitPrice,
          taxLabel: `${bottleType.taxRate}%`,
          amount: (field === 'full' ? safeQuantity : 0) * bottleType.unitPrice
        };

        return [...prev, newItem];
      }
    });
  };
  
  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxRate = 10; // 10% TVA
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    
    return { subtotal, taxRate, taxAmount, total };
  };
  
  const handleSubmit = () => {
    if (items.length === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez ajouter au moins un produit",
        variant: "destructive"
      });
      return;
    }
    
    // Client is now optional, so we don't check for it
    
    if (selectionType === 'new-driver' && !newDriverMatricule.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un matricule",
        variant: "destructive"
      });
      return;
    }
    
    if (selectionType === 'new-client' && !newClientName.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un nom de client",
        variant: "destructive"
      });
      return;
    }

    if (selectionType === 'petit-camion' && (!selectedTruckId || !selectedDriverId)) {
      toast({
        title: "Sélection requise",
        description: "Veuillez sélectionner un petit camion et un chauffeur",
        variant: "destructive",
      });
      return;
    }
    
    // Update stock
    items.forEach(item => {
      const bottleType = bottleTypes.find(bt => bt.id === item.bottleTypeId);
      if (bottleType) {
        // Each full bottle counts as 1 empty + 1 full
        // So we remove fullQuantity from remainingQuantity (pleine)
        const newRemainingQuantity = bottleType.remainingQuantity - item.fullQuantity;
        const newDistributedQuantity = bottleType.distributedQuantity + item.fullQuantity;
        
        updateBottleType(item.bottleTypeId, {
          remainingQuantity: newRemainingQuantity,
          distributedQuantity: newDistributedQuantity
        });
      }
    });
    
    const { subtotal, taxRate, taxAmount, total } = calculateTotals();
    
    // Handle client
    let finalClientId: string | undefined = undefined;
    let finalClientName = '';
    
    if (selectionType === 'new-client' && newClientName.trim()) {
      const newClient = { name: newClientName.trim() };
      const clientId = addClient(newClient);
      finalClientId = clientId;
      finalClientName = newClientName.trim();
    } else if (selectedClientId) {
      const client = clients.find(c => String(c.id) === String(selectedClientId));
      if (client) {
        finalClientId = String(client.id);
        finalClientName = client.name;
      }
    }

    // Ensure client is cleared for petit-camion
    if (selectionType === 'petit-camion') {
      finalClientId = undefined;
      finalClientName = '';
    }
    
    // Handle driver
    let finalDriverId: string | undefined = undefined;
    let finalDriverName = '';

    if (selectionType === 'new-driver' && newDriverMatricule.trim()) {
      finalDriverName = newDriverMatricule.trim();
      // For new drivers, we don't have an ID yet
    } else if (selectedDriverId) {
      const driver = drivers.find(d => String(d.id) === String(selectedDriverId));
      if (driver) {
        finalDriverId = String(driver.id);
        finalDriverName = driver.name;
      }
    }

    // Special handling for petit-camion driver
    if (selectionType === 'petit-camion' && selectedDriverId) {
      const driver = drivers.find(d => String(d.id) === String(selectedDriverId));
      if (driver) {
        finalDriverId = String(driver.id);
        finalDriverName = driver.name;
      }
    }
    
    // Process payments if payment section is shown
    if (showPaymentSection) {
      const cashAmountNum = parseFloat(cashAmount) || 0;
      const checkAmountNum = parseFloat(checkAmount) || 0;
      const debtAmount = getRemainingDebt();
      
      // Add cash and check operations directly
      if (cashAmountNum > 0) {
        addCashOperation({
          date: new Date().toISOString(),
          name: `Paiement Espèce (B.S ${orderNumber})`,
          amount: cashAmountNum,
          type: 'versement',
          accountAffected: 'espece',
          status: 'validated',
        });
      }
      if (checkAmountNum > 0) {
        addCashOperation({
          date: new Date().toISOString(),
          name: `Paiement Chèque (B.S ${orderNumber})`,
          amount: checkAmountNum,
          type: 'versement',
          accountAffected: 'cheque',
          status: 'validated',
        });
      }
      
      // Update driver debt if there's remaining debt and a driver is selected
      if (debtAmount > 0 && finalDriverId) {
        updateDriver(finalDriverId, {
          debt: debtAmount
        });
      }
    }
    
    addSupplyOrder({
      // Allow AppContext to generate a unique UUID for the ID
      // id: orderNumber, 
      orderNumber: orderNumber,
      reference,
      date: orderDate ? orderDate.toISOString() : new Date().toISOString(),
      driverId: finalDriverId || undefined,
      driverName: finalDriverName || undefined,
      clientId: finalClientId || undefined,
      clientName: finalClientName || undefined,
      truckId: selectionType === 'petit-camion' ? selectedTruckId : undefined,
      items,
      subtotal,
      taxRate,
      taxAmount,
      total
    });
    setSupplyHistoryOpen(true);
    
    toast({
      title: "Bon de sortie créé",
      description: `B.S N° ${orderNumber} a été créé avec succès`,
    });
    
    // Save the last reference if it exists
    if (reference) {
      localStorage.setItem('lastSupplyReference', reference);
      setLastReference(reference);
    }
    
    // Reset form
    resetPaymentForm();
    setItems([]);
    setSelectedDriverId('');
    setSelectedClientId('');
    setSelectedTruckId('');
    setNewDriverMatricule('');
    setNewClientName('')
  };
  
  const handlePrintBS = (order: SupplyOrder) => {
    try {
      const doc = new jsPDF();
      const now = new Date();
      
      // Colors & Styles
      const primaryColor: [number, number, number] = [79, 70, 229]; // Indigo-600
      const secondaryColor = [71, 85, 105]; // Slate-600
      const accentColor = [16, 185, 129]; // Emerald-500
      const lightGray = [248, 250, 252]; // Slate-50

      // Header Background
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 45, 'F');

      // Brand & Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text('gaz maroc', 14, 25);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('SYSTÈME DE GESTION DE DISTRIBUTION', 14, 32);

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('BON DE SORTIE (B.S)', 210 - 14, 25, { align: 'right' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`N° ${order.orderNumber}`, 210 - 14, 32, { align: 'right' });

      // Info Cards Layout
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      
      // Card 1: Order Details
      doc.roundedRect(14, 55, 90, 45, 2, 2, 'FD');
      // Card 2: Driver/Client Info
      doc.roundedRect(106, 55, 90, 45, 2, 2, 'FD');

      const drawInfoLabel = (label: string, value: string, x: number, y: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(label.toUpperCase(), x, y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text(value, x, y + 6);
      };

      // Card 1 Content
      drawInfoLabel('Date d\'émission', format(new Date(order.date), 'dd MMMM yyyy HH:mm', { locale: fr }), 20, 68);
      if (order.reference) {
        drawInfoLabel('Référence', order.reference, 20, 85);
      }

      // Card 2 Content
      if (order.driverName) {
        drawInfoLabel('Chauffeur', order.driverName, 112, 68);
      } else {
        drawInfoLabel('Chauffeur', 'Non spécifié', 112, 68);
      }
      
      if (order.clientName) {
        drawInfoLabel('Client', order.clientName, 112, 85);
      } else if (order.truckId) {
        const truck = trucks.find(t => t.id === order.truckId);
        drawInfoLabel('Petit Camion', truck ? truck.matricule : 'N/A', 112, 85);
      }

      // Products Table
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Détails des Produits', 14, 115);

      const tableData = order.items.map(item => [
        item.bottleTypeName,
        item.emptyQuantity.toString(),
        item.fullQuantity.toString(),
        `${(Number(item.unitPrice) || 0).toFixed(2)} DH`,
        item.taxLabel,
        `${(Number(item.amount) || 0).toFixed(2)} DH`
      ]);

      autoTable(doc, {
        startY: 120,
        head: [['Produit', 'Vides', 'Pleines', 'P.U', 'TVA', 'Montant']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold',
          halign: 'center',
          cellPadding: 4
        },
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'right' },
          4: { halign: 'center' },
          5: { halign: 'right', fontStyle: 'bold' }
        },
        styles: {
          fontSize: 9,
          cellPadding: 5,
          lineColor: [226, 232, 240],
          lineWidth: 0.1
        },
        alternateRowStyles: {
          fillColor: [250, 251, 252]
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY || 120;

      // Summary & Totals
      const summaryY = finalY + 15;
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.roundedRect(110, summaryY, 86, 35, 2, 2, 'F');
      
      const drawSummaryRow = (label: string, value: string, y: number, color = [30, 41, 59], bold = false) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(10);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(label, 115, y);
        doc.text(value, 190, y, { align: 'right' });
      };

      drawSummaryRow('Montant HT:', `${(Number(order.subtotal) || 0).toFixed(2)} DH`, summaryY + 10);
      drawSummaryRow(`TVA (${order.taxRate}%):`, `${(Number(order.taxAmount) || 0).toFixed(2)} DH`, summaryY + 18);
      drawSummaryRow('Total TTC:', `${(Number(order.total) || 0).toFixed(2)} DH`, summaryY + 28, primaryColor, true);

      // Signature area
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Signature du Chauffeur / Client', 14, summaryY + 25);
      doc.line(14, summaryY + 27, 70, summaryY + 27);

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 275, 196, 275);
        
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Document généré automatiquement par gaz maroc le ${format(now, 'dd/MM/yyyy à HH:mm')}`,
          14,
          282
        );
        doc.text(
          `Page ${i} / ${pageCount}`,
          196,
          282,
          { align: 'right' }
        );
      }

      doc.save(`BS_${order.orderNumber}_${format(new Date(order.date), 'yyyyMMdd')}.pdf`);
    } catch (error) {
      console.error("Erreur PDF:", error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la génération du PDF",
        variant: "destructive"
      });
    }
  };

  const filteredOrders = (supplyOrders || []).filter(order => {
    const orderDate = new Date(order.date);
    if (startDate && orderDate < startDate) return false;
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      if (orderDate > endOfDay) return false;
    }
    if (filterDriver !== 'all' && order.driverId !== filterDriver) return false;
    if (filterClient !== 'all' && order.clientId !== filterClient) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        order.orderNumber.toLowerCase().includes(query) ||
        order.driverName?.toLowerCase().includes(query) ||
        order.clientName?.toLowerCase().includes(query)
      );
    }
    return true;
  }).sort((a, b) => {
    const aValue = a[sortField as keyof typeof a];
    const bValue = b[sortField as keyof typeof b];

    if (aValue < bValue) {
      return sortDirection === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const filteredReturnOrders = (returnOrders || []).filter(order => {
    const orderDate = new Date(order.date);
    if (returnStartDate && orderDate < returnStartDate) return false;
    if (returnEndDate) {
      const endOfDay = new Date(returnEndDate);
      endOfDay.setHours(23, 59, 59, 999);
      if (orderDate > endOfDay) return false;
    }
    if (returnFilterDriver !== 'all' && order.driverId !== returnFilterDriver) return false;
    if (returnFilterClient !== 'all' && order.clientId !== returnFilterClient) return false;
    if (returnSearchQuery) {
      const query = returnSearchQuery.toLowerCase();
      return (
        order.orderNumber.toLowerCase().includes(query) ||
        order.supplyOrderNumber.toLowerCase().includes(query) ||
        (order.driverName && order.driverName.toLowerCase().includes(query)) ||
        (order.clientName && order.clientName.toLowerCase().includes(query))
      );
    }
    return true;
  }).sort((a, b) => {
    const aValue = a[sortField as keyof typeof a];
    const bValue = b[sortField as keyof typeof b];

    if (aValue < bValue) {
      return sortDirection === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const handleDeleteSupplyOrder = (id: string) => {
    // Restore stock from the deleted supply order
    const order = (supplyOrders || []).find((o: any) => o.id === id);

    if (order && order.items && order.items.length > 0) {
      order.items.forEach((item: any) => {
        const bt = bottleTypes.find(b => b.id === item.bottleTypeId);
        if (!bt) return;

        const fullQty = item.fullQuantity || 0;

        // Increase available stock, decrease distributed, enforce bounds
        const maxTotal = (bt as any).totalQuantity;
        const computedRemaining = (bt.remainingQuantity || 0) + fullQty;
        const newRemaining = typeof maxTotal === 'number' ? Math.min(maxTotal, computedRemaining) : computedRemaining;
        const newDistributed = Math.max(0, (bt.distributedQuantity || 0) - fullQty);

        updateBottleType(item.bottleTypeId, {
          remainingQuantity: newRemaining,
          distributedQuantity: newDistributed,
        });
      });
    }

    deleteSupplyOrder(id);
    setDeleteSupplyDialogOpen(false);
    setOrderToDelete(null);
    toast({
      title: "Bon de sortie supprimé",
      description: "Le stock a été rétabli et le bon de sortie supprimé",
    });
  };

  const handleDeleteReturnOrder = (id: string) => {
    deleteReturnOrder(id);
    setDeleteReturnDialogOpen(false);
    setOrderToDelete(null);
    toast({
      title: "Bon d'Entrée supprimé",
      description: "Le bon d'Entrée a été supprimé avec succès",
    });
  };

  // Payment dialog functions
  const calculatePaymentTotals = () => {
    if (!selectedReturnOrderForPayment || !selectedReturnOrderForPayment.items) {
      return { subtotal: 0, taxAmount: 0, total: 0 };
    }
    
    // Find the original supply order to get unit prices
    const originalSupplyOrder = supplyOrders.find(order =>
      order.id === selectedReturnOrderForPayment.supplyOrderId
    );

    if (!originalSupplyOrder) {
      return { subtotal: 0, taxAmount: 0, total: 0 };
    }

    // رسوم الـ Consigne حسب نوع القنينة
    const CONSIGNE_FEES: Record<string, number> = {
      'Butane 12KG': 50,
      'Butane 6KG': 40,
      'Butane 3KG': 30,
    };

    const subtotal = selectedReturnOrderForPayment.items.reduce((sum: number, item: any) => {
      // Find the original item to get unit price
      const originalItem = originalSupplyOrder.items.find((origItem: any) =>
        origItem.bottleTypeId === item.bottleTypeId
      );

      if (!originalItem) return sum;

      // Calculate sold quantity based on returned empty + consigne
      const soldQuantity = (item.returnedEmptyQuantity || 0) + (item.consigneQuantity || 0);

      const amount = soldQuantity * (originalItem.unitPrice || 0);
      return sum + amount;
    }, 0);

    const taxRate = 10; // 10% TVA
    const taxAmount = subtotal * (taxRate / 100);

    // إجمالي رسوم الـ Consigne تُضاف مباشرة إلى Montant Total
    const consigneFeesTotal = selectedReturnOrderForPayment.items.reduce((sum: number, item: any) => {
      const fee = CONSIGNE_FEES[item.bottleTypeName] || 0;
      const q = item.consigneQuantity || 0;
      return sum + (q * fee);
    }, 0);

    const total = subtotal + taxAmount;

    return { subtotal, taxAmount, total, consigneFeesTotal };
  };

  const calculatePaymentDebt = () => {
    const { total } = calculatePaymentTotals();
    const cash = parseFloat(paymentCashAmount) || 0;
    const check = parseFloat(paymentCheckAmount) || 0;
    const mygaz = parseFloat(paymentMygazAmount) || 0;
    return Math.max(0, total - (cash + check + mygaz));
  };

  const calculateNetToPay = () => {
    const { total } = calculatePaymentTotals();
    const cash = parseFloat(paymentCashAmount) || 0;
    const check = parseFloat(paymentCheckAmount) || 0;
    const mygaz = parseFloat(paymentMygazAmount) || 0;
    return Math.max(0, total - (cash + check + mygaz));
  };

  const handlePaymentSubmit = () => {
    if (!selectedReturnOrderForPayment) return;

    const { total, subtotal, taxAmount } = calculatePaymentTotals();
    const cash = parseFloat(paymentCashAmount) || 0;
    const check = parseFloat(paymentCheckAmount) || 0;
    const mygaz = parseFloat(paymentMygazAmount) || 0;
    const totalPaid = cash + check + mygaz;
    const debt = calculatePaymentDebt();

    // Add revenue entry
    addRevenue({
      date: new Date().toISOString(),
      description: `Règlement B.D ${selectedReturnOrderForPayment.orderNumber}`,
      amount: totalPaid,
      paymentMethod: (cash > 0 || check > 0 || mygaz > 0) ? 'mixed' : 'cash',
      cashAmount: cash,
      checkAmount: check,
      mygazAmount: mygaz,
      relatedOrderId: selectedReturnOrderForPayment.id,
      relatedOrderType: 'return'
    });

    // Update driver debt if there's remaining debt and a driver is assigned
    // Use the exact remaining debt (Dette Restante) from the settlement
    if (debt > 0 && selectedReturnOrderForPayment.driverId) {
      updateDriverDebt(selectedReturnOrderForPayment.driverId, debt);
    }

    // Reset form and close dialog
    setPaymentCashAmount('');
    setPaymentCheckAmount('');
    setPaymentMygazAmount('');
    setPaymentDialogOpen(false);
    setSelectedReturnOrderForPayment(null);

    toast({
      title: "Règlement enregistré",
      description: `Paiement de ${(Number(cash + check + mygaz) || 0).toFixed(2)} DH enregistré avec succès${debt > 0 ? `. Dette de ${(Number(debt) || 0).toFixed(2)} DH ajoutée au chauffeur.` : '.'}`,
    });
  };

  const resetPaymentDialog = () => {
    setPaymentCashAmount('');
    setPaymentCheckAmount('');
    setPaymentMygazAmount('');
    setSelectedReturnOrderForPayment(null);
  };

  const handlePrintBD = (order: any) => {
    try {
      const doc = new jsPDF();
      const now = new Date();
      
      // Colors & Styles
      const primaryColor: [number, number, number] = [79, 70, 229]; // Indigo-600
      const secondaryColor = [71, 85, 105]; // Slate-600
      const accentColor = [16, 185, 129]; // Emerald-500
      const lightGray = [248, 250, 252]; // Slate-50

      // Header Background
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 45, 'F');

      // Brand & Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text('gaz maroc', 14, 25);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('SYSTÈME DE GESTION DE DISTRIBUTION', 14, 32);

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('BON D\'ENTRÉE (B.D)', 210 - 14, 25, { align: 'right' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`N° ${order.orderNumber}`, 210 - 14, 32, { align: 'right' });

      // Info Cards Layout
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      
      // Card 1: Order Details
      doc.roundedRect(14, 55, 90, 45, 2, 2, 'FD');
      // Card 2: Driver/Client Info
      doc.roundedRect(106, 55, 90, 45, 2, 2, 'FD');

      const drawInfoLabel = (label: string, value: string, x: number, y: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(label.toUpperCase(), x, y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text(value, x, y + 6);
      };

      // Card 1 Content
      drawInfoLabel('Date de réception', format(new Date(order.date), 'dd MMMM yyyy HH:mm', { locale: fr }), 20, 68);
      drawInfoLabel('Référence B.S', order.supplyOrderNumber, 20, 85);

      // Card 2 Content
      if (order.driverName) {
        drawInfoLabel('Chauffeur', order.driverName, 112, 68);
      } else {
        drawInfoLabel('Chauffeur', 'Non spécifié', 112, 68);
      }
      
      if (order.clientName) {
        drawInfoLabel('Client', order.clientName, 112, 85);
      } else {
        drawInfoLabel('Client', 'Non spécifié', 112, 85);
      }

      // Products Table
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Détails des Retours', 14, 115);

      const tableData = (order.items || []).map(item => [
        item.bottleTypeName,
        (item.returnedEmptyQuantity || 0).toString(),
        (item.returnedFullQuantity || 0).toString(),
        (item.foreignQuantity || 0).toString(),
        (item.defectiveQuantity || 0).toString(),
        (item.consigneQuantity || 0).toString(),
        (item.lostQuantity || 0).toString(),
        ((item.returnedEmptyQuantity || 0) + (item.consigneQuantity || 0)).toString()
      ]);

      autoTable(doc, {
        startY: 120,
        head: [['Produit', 'Vides', 'Pleines', 'Étran.', 'Défec.', 'Cons.', 'R.C', 'Ventes']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center',
          cellPadding: 2
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center' },
          6: { halign: 'center' },
          7: { halign: 'center', fontStyle: 'bold' }
        },
        styles: {
          fontSize: 8,
          cellPadding: 3,
          lineColor: [226, 232, 240],
          lineWidth: 0.1
        },
        alternateRowStyles: {
          fillColor: [250, 251, 252]
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY || 120;

      // Legend Section
      const legendY = finalY + 10;
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.text('LÉGENDE:', 14, legendY);
      
      doc.setFont('helvetica', 'normal');
      const legends = [
        'Vides: Bouteilles vides retournées',
        'Pleines: Bouteilles pleines retournées',
        'Étran.: Bouteilles d\'autres fournisseurs',
        'Défec.: Bouteilles endommagées',
        'Cons.: Bouteilles vendues sans échange',
        'R.C: Bouteilles non retournées (dette chauffeur)',
        'Ventes: Vides + Consigne'
      ];
      
      legends.forEach((text, index) => {
        doc.text(`- ${text}`, 14, legendY + 5 + (index * 4));
      });

      // Signature area
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Signature du Responsable', 140, legendY + 20);
      doc.line(140, legendY + 22, 196, legendY + 22);

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 275, 196, 275);
        
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Document généré automatiquement par gaz maroc le ${format(now, 'dd/MM/yyyy à HH:mm')}`,
          14,
          282
        );
        doc.text(
          `Page ${i} / ${pageCount}`,
          196,
          282,
          { align: 'right' }
        );
      }

      doc.save(`BD_${order.orderNumber}_${format(new Date(order.date), 'yyyyMMdd')}.pdf`);
    } catch (error) {
      console.error("Erreur PDF:", error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la génération du PDF",
        variant: "destructive"
      });
    }
  };
  
  const { subtotal, taxAmount, total } = calculateTotals();
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-8 space-y-8 bg-slate-50/50 min-h-screen"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <Package className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Bon de Sortie (B.S)</h1>
          </div>
          <p className="text-slate-500">
            Gérer la distribution et l'alimentation des camions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 border-indigo-200 text-indigo-700 bg-indigo-50">
            N° Suivant: {orderNumber}
          </Badge>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Selection & Products */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm overflow-hidden">
            <div className="h-1 bg-indigo-600" />
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                Configuration du Bon
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Type de Destinataire</Label>
                  <Select value={selectionType} onValueChange={(value: any) => setSelectionType(value)}>
                    <SelectTrigger className="border-slate-200 focus:ring-indigo-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="existing">Chauffeur / Client existant</SelectItem>
                      <SelectItem value="new-driver">Nouveau chauffeur</SelectItem>
                      <SelectItem value="new-client">Nouveau client</SelectItem>
                      <SelectItem value="petit-camion">Petit Camion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium text-right">N° Bon de Sortie</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      value={orderNumber} 
                      onChange={(e) => setOrderNumber(e.target.value)}
                      className="pl-10 border-slate-200 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Date du Bon</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full h-11 bg-white border-slate-200 rounded-xl justify-start text-left font-medium shadow-sm hover:bg-slate-50 transition-all",
                          !orderDate && "text-slate-500"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4 text-indigo-600" />
                        {orderDate ? (
                          format(orderDate, "dd MMMM yyyy", { locale: fr })
                        ) : (
                          <span>Choisir une date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none overflow-hidden" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={orderDate}
                        onSelect={(date) => date && setOrderDate(date)}
                        initialFocus
                        className="bg-white p-4"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {selectionType === 'petit-camion' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 p-5 bg-indigo-50/50 rounded-xl border border-indigo-100"
                  >
                    <div className="font-semibold text-indigo-900 flex items-center gap-2 mb-2">
                      <Truck className="w-4 h-4 text-indigo-600" />
                      Détails du Petit Camion
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="petit-camion-select">Petit Camion</Label>
                        <Select value={selectedTruckId} onValueChange={setSelectedTruckId}>
                          <SelectTrigger id="petit-camion-select" className="bg-white border-indigo-200">
                            <SelectValue placeholder="Sélectionner un camion" />
                          </SelectTrigger>
                          <SelectContent>
                            {trucks.filter(t => t.truckType === 'petit-camion').length === 0 && (
                              <SelectItem disabled value="none">Aucun petit camion disponible</SelectItem>
                            )}
                            {trucks.filter(t => t.truckType === 'petit-camion').map(truck => {
                              const driver = drivers.find(d => d.id === truck.driverId);
                              return (
                                <SelectItem key={truck.id} value={truck.id}>
                                  {truck.matricule} - {driver?.name || 'Sans chauffeur'}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="petit-camion-driver-select">Chauffeur Assigné</Label>
                        <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                          <SelectTrigger id="petit-camion-driver-select" className="bg-white border-indigo-200">
                            <SelectValue placeholder="Sélectionner un chauffeur" />
                          </SelectTrigger>
                          <SelectContent>
                            {drivers.map(driver => (
                              <SelectItem key={driver.id} value={driver.id}>
                                {driver.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="pt-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800"
                        onClick={() => {
                          if (!selectedTruckId) {
                            toast({
                              title: "Sélection requise",
                              description: "Veuillez d'abord sélectionner un camion",
                              variant: "destructive"
                            });
                            return;
                          }
                          setSupplyTruckDialogOpen(true);
                        }}
                      >
                        <Truck className="w-4 h-4 mr-2" />
                        Gérer le chargement détaillé du camion
                      </Button>
                    </div>
                  </motion.div>
                )}

                {selectionType === 'existing' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  >
                    <div className="space-y-2">
                      <Label className="text-slate-700 font-medium">Chauffeur</Label>
                      <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                        <SelectTrigger className="border-slate-200 focus:ring-indigo-500">
                          <SelectValue placeholder="Sélectionner un chauffeur" />
                        </SelectTrigger>
                        <SelectContent>
                          {drivers.map(driver => (
                            <SelectItem key={driver.id} value={driver.id}>
                              {driver.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-700 font-medium">Client</Label>
                      <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger className="border-slate-200 focus:ring-indigo-500">
                          <SelectValue placeholder="Sélectionner un client" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map(client => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </motion.div>
                )}

                {(selectionType === 'new-driver' || selectionType === 'new-client') && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label className="text-slate-700 font-medium">
                        {selectionType === 'new-driver' ? 'Matricule du Camion' : 'Nom du Client'}
                      </Label>
                      <Input
                        placeholder={selectionType === 'new-driver' ? "Ex: 12345-A-67" : "Nom du client"}
                        value={selectionType === 'new-driver' ? newDriverMatricule : newClientName}
                        onChange={(e) => selectionType === 'new-driver' ? setNewDriverMatricule(e.target.value) : setNewClientName(e.target.value)}
                        className="border-slate-200 focus:ring-indigo-500"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">Référence Interne (Optionnel)</Label>
                <div className="space-y-2">
                  <Input
                    placeholder="Référence (ex: REF-2023-001)"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="border-slate-200 focus:ring-indigo-500"
                  />
                  {lastReference && (
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-xs text-slate-500">Dernière utilisée:</span>
                      <button 
                        type="button"
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
                        onClick={() => setReference(lastReference)}
                      >
                        {lastReference}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm overflow-hidden">
            <div className="h-1 bg-emerald-500" />
            <CardHeader className="pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                Sélection des Produits
              </CardTitle>
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100">
                {items.length} types sélectionnés
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="font-semibold text-slate-700">Type de Bouteille</TableHead>
                      <TableHead className="text-center font-semibold text-slate-700">Pleines (Sortie)</TableHead>
                      <TableHead className="text-center font-semibold text-slate-700">Stock Usine</TableHead>
                      <TableHead className="text-right font-semibold text-slate-700">Prix Unitaire</TableHead>
                      <TableHead className="text-right font-semibold text-slate-700">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bottleTypes.map((bt, idx) => {
                      const currentItem = items.find(i => i.bottleTypeId === bt.id);
                      const fullQty = currentItem?.fullQuantity ?? 0;
                      const amount = currentItem?.amount ?? 0;

                      return (
                        <motion.tr 
                          key={bt.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="hover:bg-slate-50/50 transition-colors group"
                        >
                          <TableCell className="py-4">
                            <div className="font-semibold text-slate-900">{bt.name}</div>
                            <div className="text-xs text-slate-500">{bt.capacity}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="space-y-1">
                              <Input
                                type="number"
                                min={0}
                                max={bt.remainingQuantity}
                                value={fullQty}
                                onChange={(e) => handleQuantityChange(bt.id, 'full', e.target.value)}
                                className={cn(
                                  "w-20 mx-auto text-center border-slate-200 focus:ring-indigo-500 font-medium",
                                  fullQty > 0 && "text-indigo-600 border-indigo-200 bg-indigo-50/30"
                                )}
                              />
                              <div className="text-[10px] text-slate-400 font-medium">
                                Limite: {bt.remainingQuantity}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn(
                              "font-mono",
                              bt.remainingQuantity < 10 ? "text-red-600 bg-red-50 border-red-100" : "text-slate-600"
                            )}>
                              {bt.remainingQuantity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-slate-600">
                            {(Number(bt.unitPrice) || 0).toFixed(2)} DH
                          </TableCell>
                          <TableCell className="text-right font-bold text-slate-900">
                            {(Number(amount) || 0).toFixed(2)} DH
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Summary & Actions */}
        <div className="space-y-8">
          <Card className="border-none shadow-lg bg-indigo-900 text-white overflow-hidden sticky top-8">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Calculator className="w-32 h-32" />
            </div>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                Récapitulatif Financier
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-white/10">
                  <span className="text-indigo-200">Sous-total HT</span>
                  <span className="text-lg font-medium">{(Number(subtotal) || 0).toFixed(2)} DH</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-white/10">
                  <span className="text-indigo-200">TVA (10%)</span>
                  <span className="text-lg font-medium">{(Number(taxAmount) || 0).toFixed(2)} DH</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xl font-bold">Total TTC</span>
                  <span className="text-3xl font-black text-emerald-400">{(Number(total) || 0).toFixed(2)} DH</span>
                </div>
              </div>

              <div className="pt-6 space-y-4">
                <Button 
                  onClick={handleSubmit} 
                  disabled={items.length === 0}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white border-none h-12 text-lg font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Valider le Bon de Sortie
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setItems([]);
                    resetPaymentForm();
                  }}
                  className="w-full bg-white/10 hover:bg-white/20 border-white/20 text-white h-10"
                >
                  Réinitialiser
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-amber-50 border border-amber-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Détails de Session
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-xs text-amber-800">
                <span>Date de Création</span>
                <span className="font-semibold">{format(new Date(), 'dd MMMM yyyy', { locale: fr })}</span>
              </div>
              <div className="flex justify-between text-xs text-amber-800">
                <span>Heure</span>
                <span className="font-semibold">{format(new Date(), 'HH:mm')}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* History Sections */}
      <div className="space-y-8 pt-8 border-t border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 rounded-lg text-white">
            <FileText className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Gestion des Historiques</h2>
        </div>

        {/* Supply History */}
        <Card className="border-none shadow-sm overflow-hidden">
          <Collapsible open={supplyHistoryOpen} onOpenChange={setSupplyHistoryOpen}>
            <CardHeader className="bg-white border-b border-slate-100 flex flex-row items-center justify-between py-4">
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                Historique des Bons de Sortie (B.S)
                <Badge className="ml-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-indigo-100">
                  {filteredOrders.length} bons
                </Badge>
              </CardTitle>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="hover:bg-slate-100">
                  {supplyHistoryOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </Button>
              </CollapsibleTrigger>
            </CardHeader>

            <CollapsibleContent>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recherche</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="N° BS, Chauffeur..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 border-slate-200"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Période</Label>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-xs border-slate-200 h-10">
                            <Calendar className="mr-2 h-3.5 w-3.5" />
                            {startDate ? format(startDate, "dd/MM") : "Du"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent mode="single" selected={startDate} onSelect={setStartDate} />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-xs border-slate-200 h-10">
                            <Calendar className="mr-2 h-3.5 w-3.5" />
                            {endDate ? format(endDate, "dd/MM") : "Au"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent mode="single" selected={endDate} onSelect={setEndDate} />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chauffeur</Label>
                    <Select value={filterDriver} onValueChange={setFilterDriver}>
                      <SelectTrigger className="border-slate-200 h-10">
                        <SelectValue placeholder="Tous" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les chauffeurs</SelectItem>
                        {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Client</Label>
                    <Select value={filterClient} onValueChange={setFilterClient}>
                      <SelectTrigger className="border-slate-200 h-10">
                        <SelectValue placeholder="Tous" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les clients</SelectItem>
                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80">
                        <TableHead className="font-bold">N° BS</TableHead>
                        <TableHead className="font-bold">Date & Heure</TableHead>
                        <TableHead className="font-bold">Destinataire</TableHead>
                        <TableHead className="font-bold">Produits</TableHead>
                        <TableHead className="text-right font-bold">Total TTC</TableHead>
                        <TableHead className="text-center font-bold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                            <div className="flex flex-col items-center gap-2">
                              <Search className="w-8 h-8 opacity-20" />
                              Aucun bon de sortie trouvé
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOrders.map((order, idx) => (
                          <TableRow key={order.id} className="hover:bg-slate-50/50 transition-colors">
                            <TableCell>
                              <div className="font-mono font-bold text-indigo-600">{order.orderNumber}</div>
                              {order.reference && <div className="text-[10px] text-slate-400 uppercase tracking-tighter">REF: {order.reference}</div>}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-medium text-slate-700">{format(new Date(order.date), 'dd MMM yyyy', { locale: fr })}</div>
                              <div className="text-xs text-slate-400">{format(new Date(order.date), 'HH:mm')}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-900">{order.driverName || 'Sans Chauffeur'}</span>
                                {order.clientName && <span className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                                  <ChevronRight className="w-3 h-3" /> {order.clientName}
                                </span>}
                                {order.truckId && (
                                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                    <Truck className="w-3 h-3" /> {trucks.find(t => t.id === order.truckId)?.matricule}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-[10px] font-bold border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                                onClick={() => {
                                  setSelectedSupplyOrder(order);
                                  setSupplyDetailsDialogOpen(true);
                                }}
                              >
                                {order.items.length} TYPES DE GAZ
                              </Button>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="font-black text-slate-900">{(Number(order.total) || 0).toFixed(2)} DH</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1.5 justify-center">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                  onClick={() => handlePrintBS(order)}
                                  title="Imprimer"
                                >
                                  <Printer className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                                  onClick={() => {
                                    setSelectedSupplyOrder(order);
                                    setReturnDialogOpen(true);
                                  }}
                                  title="Enregistrer Retour"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => {
                                    setOrderToDelete(order.id);
                                    setDeleteSupplyDialogOpen(true);
                                  }}
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Return History */}
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-white border-b border-slate-100 flex flex-row items-center justify-between py-4">
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              Historique des Bons d'Entrée (B.D)
              <Badge className="ml-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-100">
                {filteredReturnOrders.length} retours
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs font-semibold border-slate-200">
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                Exporter
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs font-semibold border-slate-200">
                    <Settings className="w-3.5 h-3.5 mr-1.5" />
                    Options
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Affichage</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={true}>Colonnes standards</DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Pagination</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value="10">
                    <DropdownMenuRadioItem value="10">10 par page</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="20">20 par page</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recherche</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="N° BD, N° BS..."
                    value={returnSearchQuery}
                    onChange={(e) => setReturnSearchQuery(e.target.value)}
                    className="pl-10 border-slate-200"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Période</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-xs border-slate-200 h-10">
                        <Calendar className="mr-2 h-3.5 w-3.5" />
                        {returnStartDate ? format(returnStartDate, "dd/MM") : "Du"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent mode="single" selected={returnStartDate} onSelect={setReturnStartDate} />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-xs border-slate-200 h-10">
                        <Calendar className="mr-2 h-3.5 w-3.5" />
                        {returnEndDate ? format(returnEndDate, "dd/MM") : "Au"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent mode="single" selected={returnEndDate} onSelect={setReturnEndDate} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chauffeur</Label>
                <Select value={returnFilterDriver} onValueChange={setReturnFilterDriver}>
                  <SelectTrigger className="border-slate-200 h-10">
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les chauffeurs</SelectItem>
                    {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Client</Label>
                <Select value={returnFilterClient} onValueChange={setReturnFilterClient}>
                  <SelectTrigger className="border-slate-200 h-10">
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les clients</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="font-bold">N° B.D</TableHead>
                    <TableHead className="font-bold">B.S Source</TableHead>
                    <TableHead className="font-bold">Date & Heure</TableHead>
                    <TableHead className="font-bold">Chauffeur/Client</TableHead>
                    <TableHead className="text-center font-bold">État</TableHead>
                    <TableHead className="text-center font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReturnOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <RotateCcw className="w-8 h-8 opacity-20" />
                          Aucun bon d'entrée trouvé
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReturnOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell>
                          <div className="font-mono font-bold text-emerald-600">{order.orderNumber}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px] border-indigo-100 text-indigo-600 bg-indigo-50/30">
                            {order.supplyOrderNumber}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium text-slate-700">{format(new Date(order.date), 'dd MMM yyyy', { locale: fr })}</div>
                          <div className="text-xs text-slate-400">{format(new Date(order.date), 'HH:mm')}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900">{order.driverName || 'N/A'}</span>
                            {order.clientName && <span className="text-[10px] text-slate-500 uppercase tracking-tighter">{order.clientName}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {order.isPaid ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                              Réglé
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                              En attente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1.5 justify-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                              onClick={() => handlePrintBD(order)}
                              title="Imprimer"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                              onClick={() => {
                                setSelectedReturnOrder(order);
                                setReturnDetailsDialogOpen(true);
                              }}
                              title="Détails"
                            >
                              <Search className="w-4 h-4" />
                            </Button>
                            {!order.isPaid && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                onClick={() => {
                                  setSelectedReturnOrderForPayment(order);
                                  setPaymentDialogOpen(true);
                                }}
                                title="Règlement"
                              >
                                <DollarSign className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setOrderToDelete(order.id);
                                setDeleteReturnDialogOpen(true);
                              }}
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
        </CardContent>
      </Card>
      </div>

      {returnDialogOpen && selectedSupplyOrder && (
        <RecordReturnDialog
          open={returnDialogOpen}
          onOpenChange={(open) => {
            setReturnDialogOpen(open);
            if (!open) {
              setSelectedSupplyOrder(null);
            }
          }}
          supplyOrder={selectedSupplyOrder}
        />
      )}

      {supplyTruckDialogOpen && selectedTruckId && trucks.find(t => t.id === selectedTruckId) && (
        <SupplyTruckDialog
          truck={trucks.find(t => t.id === selectedTruckId)!}
          open={supplyTruckDialogOpen}
          onOpenChange={setSupplyTruckDialogOpen}
        />
      )}

      {/* Delete Supply Order Confirmation Dialog */}
      <AlertDialog open={deleteSupplyDialogOpen} onOpenChange={setDeleteSupplyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer ce bon de sortie ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action ne peut pas être annulée. Cette action supprimera définitivement le bon de sortie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => orderToDelete && handleDeleteSupplyOrder(orderToDelete)}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Return Order Confirmation Dialog */}
      <AlertDialog open={deleteReturnDialogOpen} onOpenChange={setDeleteReturnDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer ce bon de retour ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action ne peut pas être annulée. Cette action supprimera définitivement le bon de retour.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => orderToDelete && handleDeleteReturnOrder(orderToDelete)}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Supply Order Details Dialog */}
      <Dialog open={supplyDetailsDialogOpen} onOpenChange={setSupplyDetailsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Détails du Bon de Sortie N°{selectedSupplyOrder?.orderNumber}</DialogTitle>
            <DialogDescription>
              {selectedSupplyOrder && (
                <>
                  Date: {format(new Date(selectedSupplyOrder.date), 'dd/MM/yyyy HH:mm')}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedSupplyOrder && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {selectedSupplyOrder.driverName && (
                  <div>
                    <p className="text-sm text-muted-foreground">Chauffeur</p>
                    <p className="font-medium">{selectedSupplyOrder.driverName}</p>
                  </div>
                )}
                {selectedSupplyOrder.clientName && (
                  <div>
                    <p className="text-sm text-muted-foreground">Client</p>
                    <p className="font-medium">{selectedSupplyOrder.clientName}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Montant Total</p>
                  <p className="font-medium">{(Number(selectedSupplyOrder.total) || 0).toFixed(2)} DH</p>
                </div>
              </div>
              
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>Quantité Vides</TableHead>
                      <TableHead>Quantité Pleines</TableHead>
                      <TableHead>Prix Unitaire</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSupplyOrder.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.bottleTypeName}</TableCell>
                        <TableCell>{item.emptyQuantity}</TableCell>
                        <TableCell>{item.fullQuantity}</TableCell>
                        <TableCell>{(Number(item.unitPrice) || 0).toFixed(2)} DH</TableCell>
                        <TableCell className="text-right">{(Number(item.amount) || 0).toFixed(2)} DH</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => handlePrintBS(selectedSupplyOrder)}>
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger PDF
                </Button>
                <Button onClick={() => setSupplyDetailsDialogOpen(false)}>
                  Fermer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Return Order Details Dialog */}
      <Dialog open={returnDetailsDialogOpen} onOpenChange={setReturnDetailsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Détails du Bon d'Entrée</DialogTitle>
            <DialogDescription>
              Bon d'Entrée N° {selectedReturnOrder?.orderNumber ?? ''} - {selectedReturnOrder ? format(safeDate(selectedReturnOrder.date), 'dd/MM/yyyy HH:mm') : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedReturnOrder && (
            <>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Référence B.S</p>
                  <p className="font-medium">{selectedReturnOrder.supplyOrderNumber}</p>
                </div>
                {selectedReturnOrder.driverName && (
                  <div>
                    <p className="text-sm text-muted-foreground">Chauffeur</p>
                    <p className="font-medium">{selectedReturnOrder.driverName}</p>
                  </div>
                )}
                {selectedReturnOrder.clientName && (
                  <div>
                    <p className="text-sm text-muted-foreground">Client</p>
                    <p className="font-medium">{selectedReturnOrder.clientName}</p>
                  </div>
                )}
              </div>

              <div className="border rounded-lg overflow-x-auto">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Produit</TableHead>
                      <TableHead className="whitespace-nowrap">Vides</TableHead>
                      <TableHead className="whitespace-nowrap">Pleines</TableHead>
                      <TableHead className="whitespace-nowrap">Étrangères</TableHead>
                      <TableHead className="whitespace-nowrap">Défectueuses</TableHead>
                      <TableHead className="whitespace-nowrap">Consigne</TableHead>
                      <TableHead className="whitespace-nowrap">R.C</TableHead>
                      <TableHead className="whitespace-nowrap">Ventes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedReturnOrder.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium whitespace-nowrap">{item.bottleTypeName}</TableCell>
                        <TableCell>{item.returnedEmptyQuantity}</TableCell>
                        <TableCell>{item.returnedFullQuantity}</TableCell>
                        <TableCell>{item.foreignQuantity}</TableCell>
                        <TableCell>{item.defectiveQuantity}</TableCell>
                        <TableCell>{item.consigneQuantity || 0}</TableCell>
                        <TableCell>{item.lostQuantity}</TableCell>
                        <TableCell>{(item.returnedEmptyQuantity || 0) + (item.consigneQuantity || 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Payment Info Section if available in note */}
              {(() => {
                try {
                  const paymentInfo = JSON.parse(selectedReturnOrder.note);
                  if (paymentInfo && (paymentInfo.cash || paymentInfo.check || paymentInfo.mygaz || paymentInfo.debt)) {
                    return (
                      <div className="mt-6 p-4 bg-muted/30 rounded-lg border">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          Détails du Règlement
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-2 bg-background rounded border">
                            <p className="text-xs text-muted-foreground">Espèces</p>
                            <p className="font-bold text-green-600">{(Number(paymentInfo.cash) || 0).toFixed(2)} DH</p>
                          </div>
                          <div className="p-2 bg-background rounded border">
                            <p className="text-xs text-muted-foreground">Chèque</p>
                            <p className="font-bold text-blue-600">{(Number(paymentInfo.check) || 0).toFixed(2)} DH</p>
                          </div>
                          <div className="p-2 bg-background rounded border">
                            <p className="text-xs text-muted-foreground">MYGAZ</p>
                            <p className="font-bold text-blue-800">{(Number(paymentInfo.mygaz) || 0).toFixed(2)} DH</p>
                          </div>
                          <div className="p-2 bg-background rounded border">
                            <p className="text-xs text-muted-foreground">Dette Restante</p>
                            <p className="font-bold text-red-600">{(Number(paymentInfo.debt) || 0).toFixed(2)} DH</p>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t flex justify-between items-center">
                          <span className="text-sm font-medium">Montant Total du Bon:</span>
                          <span className="text-lg font-bold">{(Number(paymentInfo.total) || 0).toFixed(2)} DH</span>
                        </div>
                      </div>
                    );
                  }
                } catch (e) {
                  return null;
                }
                return null;
              })()}

              <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div className="font-semibold">Légende:</div><div></div>
                <div><span className="font-medium">Vides:</span> Bouteilles vides retournées</div>
                <div><span className="font-medium">Pleines:</span> Bouteilles pleines retournées</div>
                <div><span className="font-medium">Étrangères:</span> Bouteilles d'autres fournisseurs</div>
                <div><span className="font-medium">Défectueuses:</span> Bouteilles endommagées</div>
                <div><span className="font-medium">Perdues:</span> Bouteilles non retournées</div>
                <div><span className="font-medium">Vendues:</span> Bouteilles vendues au client</div>
              </div>

              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setReturnDetailsDialogOpen(false)}>Fermer</Button>
                <Button onClick={() => handlePrintBD(selectedReturnOrder)}>
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger PDF
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={(open) => {
        setPaymentDialogOpen(open);
        if (!open) resetPaymentDialog();
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Règlement - B.D {selectedReturnOrderForPayment?.orderNumber}
            </DialogTitle>
            <DialogDescription>
              Enregistrer le paiement pour ce bon d'entrée
            </DialogDescription>
          </DialogHeader>

          {selectedReturnOrderForPayment && (
            <>
              {/* Order Information */}
              <div className="bg-muted/50 p-4 rounded-lg mb-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Date:</span> {format(new Date(selectedReturnOrderForPayment.date), 'dd/MM/yyyy HH:mm')}
                  </div>
                  <div>
                    <span className="font-medium">B.S Référence:</span> {selectedReturnOrderForPayment.supplyOrderNumber}
                  </div>
                  <div>
                    <span className="font-medium">Chauffeur:</span> {selectedReturnOrderForPayment.driverName || '-'}
                  </div>
                  <div>
                    <span className="font-medium">Client:</span> {selectedReturnOrderForPayment.clientName || '-'}
                  </div>
                </div>
              </div>

              {/* Products Summary */}
              <div className="mb-6">
                <h4 className="font-medium mb-3">Produits retournés:</h4>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead className="text-center">Quantité</TableHead>
                        <TableHead className="text-right">Prix Unitaire</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReturnOrderForPayment.items.map((item: any, idx: number) => {
                        // Find the original supply order to get prices
                        const originalSupplyOrder = supplyOrders.find(order => 
                          order.id === selectedReturnOrderForPayment.supplyOrderId
                        );
                        const originalItem = originalSupplyOrder?.items.find((origItem: any) => 
                          origItem.bottleTypeId === item.bottleTypeId
                        );

                        // Calculate sold quantity based on returned empty + consigne
                        const soldQuantity = (item.returnedEmptyQuantity || 0) + (item.consigneQuantity || 0);

                        const unitPrice = originalItem?.unitPrice || 0;
                        const amount = soldQuantity * unitPrice;

                        // Only show items that have been sold
                        if (soldQuantity === 0) return null;

                        return (
                          <TableRow key={idx}>
                            <TableCell>{item.bottleTypeName}</TableCell>
                            <TableCell className="text-center">{soldQuantity}</TableCell>
                            <TableCell className="text-right">{(Number(unitPrice) || 0).toFixed(2)} DH</TableCell>
                            <TableCell className="text-right font-medium">{(Number(amount) || 0).toFixed(2)} DH</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Payment Summary Section - French Version */}
              <Card className="border-2 border-primary/20 mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Total des Montants et Méthodes de Paiement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Total Amount Display */}
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-medium">Total TTC net à payer:</span>
                        <span className="text-2xl font-bold text-primary">{(Number(calculateNetToPay()) || 0).toFixed(2)} DH</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {(() => {
                          let soldItemsCount = 0;
                          selectedReturnOrderForPayment.items.forEach((item: any) => {
                            const soldQuantity = (item.returnedEmptyQuantity || 0) + (item.consigneQuantity || 0);
                            if (soldQuantity > 0) soldItemsCount++;
                          });
                          return `Produits vendus: ${soldItemsCount} article${soldItemsCount > 1 ? 's' : ''}`;
                        })()}
                      </div>
                    </div>

                    {/* Payment Methods */}
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="payment-cash-amount">Montant payé en Espèces</Label>
                        <Input
                          id="payment-cash-amount"
                          type="number"
                          step="0.01"
                          min="0"
                          max={calculatePaymentTotals().total}
                          value={paymentCashAmount}
                          onChange={(e) => setPaymentCashAmount(e.target.value)}
                          placeholder="0.00"
                          className="text-lg"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="payment-check-amount">Montant payé par Chèque</Label>
                        <Input
                          id="payment-check-amount"
                          type="number"
                          step="0.01"
                          min="0"
                          max={calculatePaymentTotals().total}
                          value={paymentCheckAmount}
                          onChange={(e) => setPaymentCheckAmount(e.target.value)}
                          placeholder="0.00"
                          className="text-lg"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="payment-mygaz-amount" className="text-blue-600 font-semibold">Montant MYGAZ</Label>
                        <Input
                          id="payment-mygaz-amount"
                          type="number"
                          step="0.01"
                          min="0"
                          value={paymentMygazAmount}
                          onChange={(e) => setPaymentMygazAmount(e.target.value)}
                          placeholder="0.00"
                          className="text-lg border-blue-200 focus:border-blue-400"
                        />
                      </div>
                    </div>

                    {/* Debt Calculation */}
                    {(paymentCashAmount || paymentCheckAmount || paymentMygazAmount) && (
                      <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-lg font-medium text-orange-800">Dette Chauffeur (Gaz):</span>
                          <span className="text-2xl font-bold text-orange-600">{(Number(calculatePaymentDebt()) || 0).toFixed(2)} DH</span>
                        </div>
                        <div className="text-sm text-orange-700">
                          Calcul: ({(Number(calculatePaymentTotals().total) || 0).toFixed(2)}) - ({(parseFloat(paymentCashAmount) || 0).toFixed(2)} + {(parseFloat(paymentCheckAmount) || 0).toFixed(2)} + {(parseFloat(paymentMygazAmount) || 0).toFixed(2)}) = {(Number(calculatePaymentDebt()) || 0).toFixed(2)} DH
                        </div>
                        {calculatePaymentDebt() > 0 && selectedReturnOrderForPayment.driverId && (
                          <div className="mt-2 p-2 bg-orange-100 rounded text-sm text-orange-800">
                            ⚠️ Ce montant sera enregistré comme dette du chauffeur sélectionné
                          </div>
                        )}
                      </div>
                    )}

                    {/* Payment Summary */}
                    {(paymentCashAmount || paymentCheckAmount || paymentMygazAmount) && (
                      <div className="grid md:grid-cols-4 gap-4 pt-4 border-t">
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-sm text-green-600">Espèces</div>
                          <div className="text-lg font-bold text-green-700">{(parseFloat(paymentCashAmount) || 0).toFixed(2)} DH</div>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-sm text-blue-600">Chèque</div>
                          <div className="text-lg font-bold text-blue-700">{(parseFloat(paymentCheckAmount) || 0).toFixed(2)} DH</div>
                        </div>
                        <div className="text-center p-3 bg-blue-100 rounded-lg">
                          <div className="text-sm text-blue-800">MYGAZ</div>
                          <div className="text-lg font-bold text-blue-900">{(parseFloat(paymentMygazAmount) || 0).toFixed(2)} DH</div>
                        </div>
                        <div className="text-center p-3 bg-red-50 rounded-lg">
                          <div className="text-sm text-red-600">Dette (Gaz)</div>
                          <div className="text-lg font-bold text-red-700">{(Number(calculatePaymentDebt()) || 0).toFixed(2)} DH</div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Résumé et Paiement Section */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Résumé et Paiement
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Totals Summary */}
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Montant HT</p>
                        <p className="font-bold text-lg">{(Number(calculatePaymentTotals().subtotal) || 0).toFixed(2)} DH</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">TVA (10%)</p>
                        <p className="font-bold text-lg">{(Number(calculatePaymentTotals().taxAmount) || 0).toFixed(2)} DH</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total TTC</p>
                        <p className="font-bold text-xl text-primary">{(Number(calculatePaymentTotals().total) || 0).toFixed(2)} DH</p>
                      </div>
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Montant en Espèces</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={paymentCashAmount}
                        onChange={(e) => setPaymentCashAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Montant par Chèque</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={paymentCheckAmount}
                        onChange={(e) => setPaymentCheckAmount(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <DialogFooter>
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                  Annuler
                </Button>
                <Button 
                  onClick={handlePaymentSubmit}
                  disabled={!paymentCashAmount && !paymentCheckAmount}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Enregistrer le règlement
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default SupplyReturn;
