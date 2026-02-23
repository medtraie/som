import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/contexts/AppContext';
import { Users, Plus, DollarSign, TrendingUp, TrendingDown, ArrowUpDown, Download, Eye, Edit, CheckCircle, UserX, Package, Search, Calendar, UserPlus, Filter } from 'lucide-react';
import { AddDriverDialog } from '@/components/dialogs/AddDriverDialog';
import { RecordPaymentDialog } from '@/components/dialogs/RecordPaymentDialog';
import { Driver as DriverType } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Drivers = () => {
  const { drivers, bottleTypes, transactions, cashOperations, deleteDriver, canDeleteDriver } = useApp();
  const [selectedDriver, setSelectedDriver] = useState<DriverType | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [bottleManagementOpen, setBottleManagementOpen] = useState(false);
  const [isEditingRC, setIsEditingRC] = useState(false);
  const [editedBottles, setEditedBottles] = useState<Record<string, number>>({});
  const [lastEditDate, setLastEditDate] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<DriverType | null>(null);

  const { updateDriver } = useApp();

  const today = new Date();

  // Filter transactions for the selected driver
  const driverTransactions = useMemo(() => {
    if (!selectedDriver) return [];
    return (transactions || [])
      .filter(tx => String(tx.driverId) === String(selectedDriver.id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedDriver, transactions]);

  const findCashOperationForTx = (tx: any, driverOverride?: DriverType | null) => {
    const targetDriver = driverOverride ?? selectedDriver;
    if (!targetDriver) return null;
    const name = (targetDriver.name || '').toLowerCase();
    if (!name) return null;
    const txTime = new Date(tx?.date || 0).getTime();
    const matches = (cashOperations || []).filter(op => {
      const opName = (op?.name || '').toLowerCase();
      if (!opName.includes(name)) return false;
      const opTime = new Date(op?.date || 0).getTime();
      return Math.abs(opTime - txTime) <= 24 * 60 * 60 * 1000;
    });
    if (!matches.length) return null;
    return matches.reduce((best, op) => {
      const bestDiff = Math.abs(new Date(best.date).getTime() - txTime);
      const opDiff = Math.abs(new Date(op.date).getTime() - txTime);
      return opDiff < bestDiff ? op : best;
    }, matches[0]);
  };

  const getTransactionDescription = (tx: any) => {
    const direct = tx?.description ?? tx?.details ?? tx?.detail ?? tx?.note ?? tx?.notes ?? tx?.label ?? tx?.libelle ?? tx?.motif ?? tx?.comment ?? tx?.remarks ?? tx?.remark;
    const nestedSource = tx?.details ?? tx?.detail ?? tx?.meta ?? tx?.data;
    const nested = nestedSource && typeof nestedSource === 'object'
      ? (nestedSource as any).description ?? (nestedSource as any).details ?? (nestedSource as any).detail ?? (nestedSource as any).label ?? (nestedSource as any).libelle ?? (nestedSource as any).motif ?? (nestedSource as any).note ?? (nestedSource as any).comment
      : undefined;
    const value = direct ?? nested;
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const getTransactionAmount = (tx: any) => {
    const direct = tx?.amount ?? tx?.montant ?? tx?.value ?? tx?.totalValue ?? tx?.totalvalue ?? tx?.totalVentes ?? tx?.totalventes ?? tx?.total ?? tx?.debtChange ?? tx?.balanceChange ?? tx?.paidAmount ?? tx?.paymentAmount ?? tx?.somme ?? tx?.sum;
    const nestedSource = tx?.details ?? tx?.detail ?? tx?.meta ?? tx?.data;
    const nested = nestedSource && typeof nestedSource === 'object'
      ? (nestedSource as any).amount ?? (nestedSource as any).montant ?? (nestedSource as any).value ?? (nestedSource as any).totalValue ?? (nestedSource as any).total
      : undefined;
    const raw = direct ?? nested ?? 0;
    if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
    if (typeof raw === 'string') {
      const cleaned = raw.replace(/[^0-9.-]/g, '');
      const parsed = Number(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return Number(raw) || 0;
  };

  const getTransactionDisplay = (tx: any, driverOverride?: DriverType | null) => {
    const description = getTransactionDescription(tx);
    const amount = getTransactionAmount(tx);
    const targetDriver = driverOverride ?? selectedDriver;
    if ((description && amount !== 0) || !targetDriver) {
      return { description, amount };
    }
    if (tx?.type !== 'payment' && tx?.type !== 'credit') {
      return { description, amount };
    }
    const op = findCashOperationForTx(tx, targetDriver);
    if (!op) return { description, amount };
    return {
      description: description || op.name || '',
      amount: amount !== 0 ? amount : Number(op.amount || 0),
    };
  };

  const repaymentStats = useMemo(() => {
    if (!selectedDriver) {
      return { totalPaid: 0, totalDebt: 0, progress: 0 };
    }
    const paidTypes = new Set(['payment', 'credit']);
    const debtTypes = new Set(['debt', 'debit']);
    const totalPaid = driverTransactions
      .filter(tx => paidTypes.has(tx?.type))
      .reduce((sum, tx) => sum + Math.abs(getTransactionAmount(tx)), 0);
    const debtFromTransactions = driverTransactions
      .filter(tx => debtTypes.has(tx?.type))
      .reduce((sum, tx) => sum + Math.abs(getTransactionAmount(tx)), 0);
    const currentDebt = Math.abs(selectedDriver.debt ?? 0);
    const totalDebt = Math.max(debtFromTransactions, currentDebt + totalPaid);
    const progress = totalDebt > 0 ? Math.min((totalPaid / totalDebt) * 100, 100) : 0;
    return { totalPaid, totalDebt, progress };
  }, [driverTransactions, selectedDriver]);

  React.useEffect(() => {
    if (selectedDriver && bottleManagementOpen) {
      setEditedBottles(selectedDriver.remainingBottles || {});
      setLastEditDate(selectedDriver.lastRCUpdate || null);
    }
  }, [selectedDriver, bottleManagementOpen]);

  const handleSaveRC = () => {
    if (selectedDriver) {
      const now = new Date().toISOString();
      updateDriver(selectedDriver.id, {
        remainingBottles: { ...editedBottles, _isOverride: true } as any,
        lastRCUpdate: now
      });
      setLastEditDate(now);
      setIsEditingRC(false);
    }
  };

  const handleGenerateRCPDF = (driver: DriverType) => {
    const doc = new jsPDF();
    const now = new Date();
    const dateStr = format(now, 'dd/MM/yyyy HH:mm', { locale: fr });

    // Header with Branding
    doc.setFillColor(79, 70, 229); // indigo-600
    doc.rect(0, 0, 210, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('CAMION', 20, 28);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('SYSTÈME DE GESTION DE GAZ', 20, 35);
    
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.line(20, 38, 70, 38);

    doc.setFontSize(10);
    doc.text('Rapport R.C - État du Stock', 140, 25);
    doc.text(`Date: ${dateStr}`, 140, 32);

    // Driver Information Section
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMATIONS DU CHAUFFEUR', 20, 60);
    
    doc.setDrawColor(79, 70, 229); // indigo-600
    doc.setLineWidth(1);
    doc.line(20, 63, 40, 63);

    // Info Box
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(20, 68, 170, 25, 2, 2, 'F');
    
    doc.setTextColor(71, 85, 105); // slate-600
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Nom du Chauffeur:', 25, 78);
    doc.text('Dernière mise à jour:', 25, 85);
    
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(driver.name.toUpperCase(), 65, 78);
    
    const lastEdit = lastEditDate || driver.lastRCUpdate;
    doc.text(lastEdit ? format(new Date(lastEdit), 'dd/MM/yyyy HH:mm', { locale: fr }) : 'Aucune modification', 65, 85);

    // Current RC Stock Table
    const tableStartY = 105;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ÉTAT ACTUEL DU STOCK R.C', 20, tableStartY - 5);

    const excludedTypes = ['BNG 12KG', 'Propane 34KG', 'Détendeur Clic-On'];
    const stockData = bottleTypes
      .filter(type => !excludedTypes.includes(type.name))
      .map(type => {
        const qty = driver.remainingBottles?.[type.id] || 0;
        return [type.name, qty.toString()];
      })
      .filter(row => parseInt(row[1]) > 0);

    const totalRC = stockData.reduce((sum, row) => sum + parseInt(row[1]), 0);

    autoTable(doc, {
      startY: tableStartY,
      head: [['TYPE DE BOUTEILLE', 'QUANTITÉ EN POSSESSION']],
      body: stockData,
      theme: 'grid',
      headStyles: { 
        fillColor: [79, 70, 229], 
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'left'
      },
      bodyStyles: { 
        fontSize: 10,
        textColor: [51, 65, 85],
        cellPadding: 5
      },
      columnStyles: {
        1: { halign: 'center', fontStyle: 'bold' }
      },
      foot: [['TOTAL DES BOUTEILLES R.C', totalRC.toString()]],
      footStyles: { 
        fillColor: [241, 245, 249], 
        textColor: [79, 70, 229], 
        fontStyle: 'bold',
        fontSize: 11,
        halign: 'left'
      },
    });

    // History Table
    const historyRows: any[][] = [];
    (driver.rcHistory || [])
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach(entry => {
        entry.changes.forEach(change => {
          const typeName =
            change.bottleTypeName ||
            bottleTypes.find(bt => String(bt.id) === String(change.bottleTypeId))?.name ||
            change.bottleTypeId;
          const diffStr = change.diff >= 0 ? `+${change.diff}` : `${change.diff}`;
          historyRows.push([
            format(new Date(entry.date), 'dd/MM/yyyy HH:mm'),
            typeName,
            change.previousQty,
            change.newQty,
            diffStr
          ]);
        });
      });

    if (historyRows.length > 0) {
      const historyStartY = (doc as any).lastAutoTable.finalY + 15;
      
      // Check for page break
      if (historyStartY > 240) {
        doc.addPage();
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('HISTORIQUE DES MODIFICATIONS R.C', 20, 20);
        autoTable(doc, {
          startY: 25,
          head: [['DATE', 'TYPE', 'AVANT', 'APRÈS', 'DIFF']],
          body: historyRows,
          theme: 'striped',
          headStyles: { fillColor: [71, 85, 105] },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 4) {
              const diff = parseInt(data.cell.raw as string);
              if (diff > 0) data.cell.styles.textColor = [22, 163, 74];
              else if (diff < 0) data.cell.styles.textColor = [220, 38, 38];
            }
          }
        });
      } else {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('HISTORIQUE DES MODIFICATIONS R.C', 20, historyStartY - 5);
        
        autoTable(doc, {
          startY: historyStartY,
          head: [['DATE', 'TYPE', 'AVANT', 'APRÈS', 'DIFF']],
          body: historyRows,
          theme: 'striped',
          headStyles: { fillColor: [71, 85, 105] },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 4) {
              const diff = parseInt(data.cell.raw as string);
              if (diff > 0) data.cell.styles.textColor = [22, 163, 74];
              else if (diff < 0) data.cell.styles.textColor = [220, 38, 38];
            }
          }
        });
      }
    }

    // Signature Section
    const finalY = (doc as any).lastAutoTable.finalY || 200;
    if (finalY < 250) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Signature Chauffeur', 40, finalY + 25);
      doc.text('Signature Responsable', 130, finalY + 25);
      
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.line(30, finalY + 45, 80, finalY + 45);
      doc.line(120, finalY + 45, 170, finalY + 45);
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Document généré automatiquement par CAMION Gestion v1.0 - Page ${i} sur ${pageCount}`,
        105,
        288,
        { align: 'center' }
      );
    }

    doc.save(`RC_${driver.name.replace(/\s+/g, '_')}_${format(now, 'yyyyMMdd')}.pdf`);
  };

  const totalDebt = drivers.reduce((sum, d) => sum + Math.abs(d.debt || 0), 0);
  const totalAdvances = drivers.reduce((sum, d) => sum + (d.advances || 0), 0);
  const driversInDebt = drivers.filter(d => (d.balance || 0) < 0).length;

  const filteredDrivers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return drivers.filter((d) => {
      const nameMatch = !term || (d.name || '').toLowerCase().includes(term);
      const statusMatch =
        statusFilter === 'all' ||
        (statusFilter === 'debt' && (d.balance || 0) < 0) ||
        (statusFilter === 'credit' && (d.balance || 0) > 0) ||
        (statusFilter === 'balanced' && (d.balance || 0) === 0);
      return nameMatch && statusMatch;
    });
  }, [drivers, searchTerm, statusFilter]);

  const handleGeneratePDF = (driver: DriverType) => {
    const doc = new jsPDF();
    const now = new Date();
    const dateStr = format(now, 'dd/MM/yyyy HH:mm', { locale: fr });

    // Header with Branding
    doc.setFillColor(79, 70, 229); // indigo-600
    doc.rect(0, 0, 210, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('CAMION', 20, 28);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('SYSTÈME DE GESTION DE GAZ', 20, 35);
    
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.line(20, 38, 70, 38);

    doc.setFontSize(10);
    doc.text('Rapport Financier Chauffeur', 140, 25);
    doc.text(`Date: ${dateStr}`, 140, 32);

    // Driver Information Section
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMATIONS DU CHAUFFEUR', 20, 60);
    
    doc.setDrawColor(79, 70, 229); // indigo-600
    doc.setLineWidth(1);
    doc.line(20, 63, 40, 63);

    // Info Box
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(20, 68, 170, 25, 2, 2, 'F');
    
    doc.setTextColor(71, 85, 105); // slate-600
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Nom du Chauffeur:', 25, 78);
    doc.text('Statut Actuel:', 25, 85);
    
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(driver.name.toUpperCase(), 65, 78);
    
    const statusText = driver.balance === 0 ? 'ÉQUILIBRÉ' : driver.balance > 0 ? 'EN CRÉDIT' : 'EN DETTE';
    doc.text(statusText, 65, 85);

    // Financial Summary Section Title
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RÉSUMÉ FINANCIER', 20, 105);

    // Helper to format numbers without thousands separator
    const formatAmount = (amount: number) => Math.abs(amount).toFixed(0);

    // Financial Summary Boxes
    const boxWidth = 55;
    const startX = 20;
    const boxY = 110;

    // Dette Box
    doc.setFillColor(254, 242, 242); // red-50
    doc.setDrawColor(252, 165, 165); // red-300
    doc.setLineWidth(0.5);
    doc.roundedRect(startX, boxY, boxWidth, 30, 2, 2, 'FD');
    doc.setTextColor(153, 27, 27); // red-800
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL DETTE', startX + 5, boxY + 10);
    doc.setFontSize(16);
    doc.text(`${formatAmount(driver.debt || 0)} DH`, startX + 5, boxY + 22);

    // Avances Box
    doc.setFillColor(240, 253, 244); // green-50
    doc.setDrawColor(134, 239, 172); // green-300
    doc.roundedRect(startX + boxWidth + 2.5, boxY, boxWidth, 30, 2, 2, 'FD');
    doc.setTextColor(22, 101, 52); // green-800
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL AVANCES', startX + boxWidth + 7.5, boxY + 10);
    doc.setFontSize(16);
    doc.text(`${formatAmount(driver.advances || 0)} DH`, startX + boxWidth + 7.5, boxY + 22);

    // Balance Box
    const balanceColor = driver.balance >= 0 ? [240, 253, 244] : [254, 242, 242];
    const balanceBorder = driver.balance >= 0 ? [134, 239, 172] : [252, 165, 165];
    const balanceText = driver.balance >= 0 ? [21, 128, 61] : [185, 28, 28];

    doc.setFillColor(balanceColor[0], balanceColor[1], balanceColor[2]);
    doc.setDrawColor(balanceBorder[0], balanceBorder[1], balanceBorder[2]);
    doc.roundedRect(startX + (boxWidth + 2.5) * 2, boxY, boxWidth + 2.5, 30, 2, 2, 'FD');
    doc.setTextColor(balanceText[0], balanceText[1], balanceText[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('SOLDE FINAL', startX + (boxWidth + 2.5) * 2 + 5, boxY + 10);
    doc.setFontSize(16);
    doc.text(`${formatAmount(driver.balance || 0)} DH`, startX + (boxWidth + 2.5) * 2 + 5, boxY + 22);

    // Transactions Table
    const tableStartY = 155;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('HISTORIQUE DES RÉCENTES TRANSACTIONS', 20, tableStartY - 5);

    const txList = (transactions || [])
      .filter(tx => String(tx.driverId) === String(driver.id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50);

    const tableData = txList.map(tx => {
      const display = getTransactionDisplay(tx, driver);
      return [
        format(new Date(tx.date), 'dd/MM/yyyy HH:mm'),
        (tx.type === 'debit' || tx.type === 'debt') ? 'DETTE' : 'PAIEMENT',
        `${formatAmount(display.amount)} DH`,
        display.description || '-'
      ];
    });

    autoTable(doc, {
      startY: tableStartY,
      head: [['DATE', 'TYPE', 'MONTANT', 'DESCRIPTION']],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: { 
        fontSize: 9,
        textColor: [51, 65, 85],
        cellPadding: 4
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 30, fontStyle: 'bold' },
        2: { cellWidth: 35, fontStyle: 'bold', halign: 'right' },
        3: { cellWidth: 'auto' }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const type = data.cell.raw as string;
          if (type === 'DETTE') {
            data.cell.styles.textColor = [220, 38, 38];
          } else if (type === 'PAIEMENT') {
            data.cell.styles.textColor = [22, 163, 74];
          }
        }
      }
    });

    // Signature Section
    const finalY = (doc as any).lastAutoTable.finalY || 200;
    if (finalY < 240) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Signature Chauffeur', 40, finalY + 30);
      doc.text('Signature Responsable', 130, finalY + 30);
      
      doc.setDrawColor(203, 213, 225);
      doc.line(30, finalY + 50, 80, finalY + 50);
      doc.line(120, finalY + 50, 170, finalY + 50);
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Document généré automatiquement par CAMION Gestion v1.0 - Page ${i} sur ${pageCount}`,
        105,
        288,
        { align: 'center' }
      );
    }

    doc.save(`Rapport_${driver.name.replace(/\s+/g, '_')}_${format(now, 'yyyyMMdd')}.pdf`);
  };
  const getBalanceStatus = (balance: number) => {
    if (balance > 0) return { variant: 'default' as const, icon: TrendingUp, text: 'Crédit' };
    if (balance < 0) return { variant: 'destructive' as const, icon: TrendingDown, text: 'Dette' };
    return { variant: 'secondary' as const, icon: DollarSign, text: 'Équilibré' };
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50/30 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Calendar className="w-4 h-4" />
            <span className="text-sm font-medium capitalize">
              {format(today, 'eeee d MMMM yyyy', { locale: fr })}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gestion des Chauffeurs</h1>
          <p className="text-slate-500 mt-1">
            Suivi des dettes, avances et situation des bouteilles
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="hidden md:flex bg-white shadow-sm border-slate-200"
            onClick={() => alert("Génération du rapport global...")}
          >
            <Download className="w-4 h-4 mr-2 text-slate-500" />
            Rapport Global
          </Button>
          <AddDriverDialog trigger={
            <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all duration-200">
              <UserPlus className="w-4 h-4 mr-2" />
              Ajouter un Chauffeur
            </Button>
          } />
        </div>
      </div>

      {/* Stats Cards Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm bg-gradient-to-br from-white to-slate-50 overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Users className="w-16 h-16" />
          </div>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Chauffeurs</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-slate-900">{drivers.length}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-gradient-to-br from-white to-red-50/30 overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingDown className="w-16 h-16" />
          </div>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Dettes Totales</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-red-600">
                    {Number(totalDebt || 0).toLocaleString()}
                  </p>
                  <span className="text-sm font-semibold text-red-400">DH</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-gradient-to-br from-white to-emerald-50/30 overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp className="w-16 h-16" />
          </div>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Avances Totales</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-emerald-600">
                    {Number(totalAdvances || 0).toLocaleString()}
                  </p>
                  <span className="text-sm font-semibold text-emerald-400">DH</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-gradient-to-br from-white to-amber-50/30 overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <DollarSign className="w-16 h-16" />
          </div>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">En Dette</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-amber-600">
                    {driversInDebt}
                  </p>
                  <span className="text-sm font-medium text-amber-400">Chauffeurs</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main List Section */}
      <Card className="border-none shadow-md overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 bg-white/50 pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-xl font-bold text-slate-800">Liste des Chauffeurs</CardTitle>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <Input
                  placeholder="Rechercher un chauffeur..."
                  className="pl-10 w-full md:w-[280px] bg-slate-50 border-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-all shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-50 rounded-lg">
                  <Filter className="w-4 h-4 text-slate-500" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="debt" className="text-red-600">En dette</SelectItem>
                    <SelectItem value="credit" className="text-emerald-600">En crédit</SelectItem>
                    <SelectItem value="balanced" className="text-slate-600">Équilibré</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="py-4 pl-6 font-semibold text-slate-700">Nom du Chauffeur</TableHead>
                  <TableHead className="py-4 font-semibold text-slate-700">Dette</TableHead>
                  <TableHead className="py-4 font-semibold text-slate-700">Avances</TableHead>
                  <TableHead className="py-4 font-semibold text-slate-700">Balance</TableHead>
                  <TableHead className="py-4 font-semibold text-slate-700">Stock R.C</TableHead>
                  <TableHead className="py-4 font-semibold text-slate-700">État</TableHead>
                  <TableHead className="py-4 pr-6 text-right font-semibold text-slate-700">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrivers.length > 0 ? filteredDrivers.map((driver) => {
                  const balanceStatus = getBalanceStatus(driver.balance);
                  const totalRC = Object.values(driver.remainingBottles || {}).reduce((a, b) => a + b, 0);
                  
                  return (
                    <TableRow key={driver.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-50 last:border-0">
                      <TableCell className="py-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-sm">
                            {driver.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-900">{driver.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="text-red-600 font-bold">
                          {Math.abs(driver.debt).toLocaleString()} <span className="text-[10px] opacity-70">DH</span>
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="text-emerald-600 font-bold">
                          {Number(driver.advances || 0).toLocaleString()} <span className="text-[10px] opacity-70">DH</span>
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          driver.balance > 0 ? 'bg-emerald-100 text-emerald-700' : 
                          driver.balance < 0 ? 'bg-red-100 text-red-700' : 
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {Math.abs(driver.balance).toLocaleString()} DH
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        <Badge variant="outline" className={`font-bold px-3 py-1 ${totalRC > 0 ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                          {totalRC}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant={balanceStatus.variant} className="flex items-center gap-1.5 px-3 py-1 w-fit shadow-sm">
                          <balanceStatus.icon className="w-3.5 h-3.5" />
                          <span className="font-medium">{balanceStatus.text}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 pr-6 text-right">
                        <div className="flex justify-end items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Détails"
                            onClick={() => {
                              setSelectedDriver(driver);
                              setDetailsDialogOpen(true);
                            }}
                          >
                            <Eye className="w-4.5 h-4.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Télécharger PDF"
                            onClick={() => handleGeneratePDF(driver)}
                          >
                            <Download className="w-4.5 h-4.5" />
                          </Button>
                          
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                            title="Enregistrer un Paiement"
                            onClick={() => {
                              setSelectedDriver(driver);
                              setPaymentDialogOpen(true);
                            }}
                          >
                            <DollarSign className="w-4.5 h-4.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-purple-600 hover:bg-purple-50"
                            title="Gestion Bouteilles (R.C)"
                            onClick={() => {
                              setSelectedDriver(driver);
                              setBottleManagementOpen(true);
                            }}
                          >
                            <Package className="w-4.5 h-4.5" />
                          </Button>
                          
                          {(() => {
                            const check = canDeleteDriver(driver.id);
                            return (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title={check.allowed ? "Supprimer le Chauffeur" : `Suppression indisponible: ${check.reason}`}
                            disabled={!check.allowed}
                            onClick={() => {
                              const rule = canDeleteDriver(driver.id);
                              if (!rule.allowed) {
                                toast(`Impossible de supprimer: ${rule.reason}`);
                                return;
                              }
                              setDriverToDelete(driver);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <UserX className="w-4.5 h-4.5" />
                          </Button>
                            );
                          })()}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-20">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                          <Users className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">Aucun chauffeur trouvé</h3>
                        <p className="text-slate-500 max-w-[250px] mx-auto mt-1">
                          {searchTerm ? `Aucun résultat pour "${searchTerm}"` : "Commencez par ajouter un nouveau chauffeur à votre liste."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 border-t border-slate-100">
            <div className="text-sm text-slate-500 font-medium">
              Affichage de <span className="text-slate-900 font-bold">{filteredDrivers.length}</span> sur <span className="text-slate-900 font-bold">{drivers.length}</span> chauffeurs
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="bg-white border-slate-200 text-slate-600" disabled={true}>
                Précédent
              </Button>
              <div className="flex items-center gap-1">
                <Button size="sm" className="w-8 h-8 p-0 bg-indigo-600 hover:bg-indigo-700">1</Button>
              </div>
              <Button variant="outline" size="sm" className="bg-white border-slate-200 text-slate-600" disabled={true}>
                Suivant
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      {selectedDriver && (
        <RecordPaymentDialog
          driver={selectedDriver}
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
        />
      )}

      {/* Details Dialog */}
      {selectedDriver && (
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
            <div className="bg-indigo-600 p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-10">
                <Users className="w-48 h-48" />
              </div>
              <DialogHeader className="relative z-10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold">
                    {selectedDriver.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <DialogTitle className="text-3xl font-bold text-white">{selectedDriver.name}</DialogTitle>
                    <p className="text-indigo-100 mt-1 flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Chauffeur Actif • ID: {selectedDriver.id.substring(0, 8)}
                    </p>
                  </div>
                </div>
              </DialogHeader>
            </div>
            
            <div className="p-8">
              <Tabs defaultValue="overview" className="space-y-6">
                <TabsList className="bg-slate-100/80 p-1 w-full justify-start gap-2 h-auto">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-6 py-2">Vue d'ensemble</TabsTrigger>
                  <TabsTrigger value="transactions" className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-6 py-2">Historique Financier</TabsTrigger>
                  <TabsTrigger value="stock" className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-6 py-2">Stock R.C</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="mt-6 space-y-6 outline-none">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-none bg-slate-50 p-6 shadow-inner">
                      <p className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-wider">Dette Actuelle</p>
                      <div className="text-3xl font-bold text-red-600">
                        {Math.abs(selectedDriver.debt).toLocaleString()} <span className="text-sm">DH</span>
                      </div>
                    </Card>
                    
                    <Card className="border-none bg-slate-50 p-6 shadow-inner">
                      <p className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-wider">Total Avances</p>
                      <div className="text-3xl font-bold text-emerald-600">
                        {Number(selectedDriver.advances || 0).toLocaleString()} <span className="text-sm">DH</span>
                      </div>
                    </Card>
                    
                    <Card className={`border-none p-6 shadow-inner ${
                      selectedDriver.balance > 0 ? 'bg-emerald-50/50' : 
                      selectedDriver.balance < 0 ? 'bg-red-50/50' : 
                      'bg-slate-50'
                    }`}>
                      <p className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-wider">Balance Nette</p>
                      <div className={`text-3xl font-bold ${
                        selectedDriver.balance > 0 ? 'text-emerald-600' : 
                        selectedDriver.balance < 0 ? 'text-red-600' : 
                        'text-slate-600'
                      }`}>
                        {Math.abs(selectedDriver.balance).toLocaleString()} <span className="text-sm">DH</span>
                      </div>
                      <p className="text-xs mt-2 font-medium opacity-70">
                        {selectedDriver.balance > 0 ? 'Crédit en faveur du chauffeur' : selectedDriver.balance < 0 ? 'Reste à payer par le chauffeur' : 'Situation équilibrée'}
                      </p>
                    </Card>
                  </div>
                  
                  {selectedDriver.debt > 0 && (
                    <Card className="p-6 border-slate-100 shadow-sm">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800">Progression du Remboursement</h3>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100">
                          {repaymentStats.progress.toFixed(1)}% Complété
                        </Badge>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 mb-2">
                        <div 
                          className="bg-indigo-600 h-3 rounded-full transition-all duration-500 shadow-sm" 
                          style={{ 
                            width: `${repaymentStats.progress}%` 
                          }}
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        Basé sur le total des avances par rapport à la dette totale contractée.
                      </p>
                    </Card>
                  )}
                </TabsContent>
                
                <TabsContent value="transactions" className="mt-6 outline-none">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div>
                        <h3 className="font-bold text-slate-800">Dernières Transactions</h3>
                        <p className="text-xs text-slate-500">Historique des 50 dernières opérations</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleGeneratePDF(selectedDriver)} className="bg-white border-slate-200">
                        <Download className="w-4 h-4 mr-2 text-indigo-600" />
                        Exporter PDF
                      </Button>
                    </div>
                    
                    <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/50">
                            <TableHead className="py-4 font-semibold">Date</TableHead>
                            <TableHead className="py-4 font-semibold">Type</TableHead>
                            <TableHead className="py-4 font-semibold">Montant</TableHead>
                            <TableHead className="py-4 font-semibold">Description</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {driverTransactions && driverTransactions.length > 0 ? (
                            driverTransactions.map((tx, index) => {
                              const display = getTransactionDisplay(tx);
                              return (
                                <TableRow key={`${selectedDriver.id}-${tx.id ?? index}`} className="hover:bg-slate-50/50 border-b border-slate-50 last:border-0">
                                  <TableCell className="py-4">{new Date(tx.date).toLocaleDateString()}</TableCell>
                                  <TableCell className="py-4">
                                    <Badge variant={(tx.type === 'debit' || tx.type === 'debt') ? 'destructive' : 'default'} className={(tx.type === 'credit' || tx.type === 'payment') ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none' : ''}>
                                      {(tx.type === 'debit' || tx.type === 'debt') ? 'Dette' : 'Paiement'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-4 font-bold">
                                    {display.amount.toLocaleString()} <span className="text-[10px] opacity-70">DH</span>
                                  </TableCell>
                                  <TableCell className="py-4 text-slate-600 italic text-sm">{display.description || '-'}</TableCell>
                                </TableRow>
                              );
                            })
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-12 text-slate-400">
                                <div className="flex flex-col items-center">
                                  <DollarSign className="w-8 h-8 mb-2 opacity-20" />
                                  <p>Aucune transaction enregistrée</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="stock" className="mt-6 outline-none">
                  <div className="space-y-6">
                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div>
                        <h3 className="font-bold text-slate-800">État du Stock R.C</h3>
                        <p className="text-xs text-slate-500">Bouteilles actuellement en possession du chauffeur</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleGenerateRCPDF(selectedDriver)} className="bg-white border-slate-200">
                        <Download className="w-4 h-4 mr-2 text-purple-600" />
                        Rapport R.C
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h4 className="font-semibold text-slate-700 flex items-center gap-2 px-2">
                          <Package className="w-4 h-4 text-purple-600" />
                          Inventaire Détallé
                        </h4>
                        <div className="rounded-xl border border-slate-100 overflow-hidden bg-white shadow-sm">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50/50">
                                <TableHead className="py-3 font-semibold">Type de Bouteille</TableHead>
                                <TableHead className="py-3 text-right font-semibold">Quantité</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {bottleTypes
                                .filter(type => !['BNG 12KG', 'Propane 34KG', 'Détendeur Clic-On'].includes(type.name))
                                .map((type) => {
                                  const qty = selectedDriver.remainingBottles?.[type.id] || 0;
                                  if (qty === 0) return null;
                                  return (
                                    <TableRow key={type.id} className="hover:bg-slate-50/50 border-b border-slate-50 last:border-0">
                                      <TableCell className="py-3 font-medium">{type.name}</TableCell>
                                      <TableCell className="py-3 text-right">
                                        <Badge className="bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100 font-bold px-3">
                                          {qty}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              {(!selectedDriver.remainingBottles || Object.values(selectedDriver.remainingBottles).every(q => q === 0)) && (
                                <TableRow>
                                  <TableCell colSpan={2} className="text-center py-8 text-slate-400">
                                    Tout est retourné (Stock vide)
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-semibold text-slate-700 px-2">Résumé</h4>
                        <div className="bg-indigo-600 p-8 rounded-2xl text-white shadow-lg relative overflow-hidden group">
                          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                            <Package className="w-32 h-32" />
                          </div>
                          <p className="text-indigo-100 font-medium mb-1 uppercase tracking-widest text-xs">Total Bouteilles R.C</p>
                          <div className="text-5xl font-black mb-4">
                            {Object.values(selectedDriver.remainingBottles || {}).reduce((a, b) => a + b, 0)}
                          </div>
                          <div className="h-1 w-12 bg-white/30 rounded-full mb-4" />
                          <p className="text-indigo-100 text-sm leading-relaxed">
                            Ce nombre représente le total des bouteilles pleines ou vides que le chauffeur n'a pas encore restituées au dépôt.
                          </p>
                        </div>
                        
                        <Button 
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-6 h-auto transition-all shadow-md"
                          onClick={() => {
                            setDetailsDialogOpen(false);
                            setBottleManagementOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Ajuster manuellement le Stock R.C
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <DialogClose asChild>
                <Button variant="outline" className="px-8 border-slate-200 hover:bg-white transition-colors">Fermer</Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Bottle Management Dialog */}
      <Dialog open={bottleManagementOpen} onOpenChange={(open) => {
        setBottleManagementOpen(open);
        if (!open) setIsEditingRC(false);
      }}>
        <DialogContent className="max-w-md p-0 border-none overflow-hidden shadow-2xl">
          <div className="bg-purple-600 p-6 text-white">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold text-white">Gestion Stock R.C</DialogTitle>
                    <p className="text-purple-100 text-xs mt-0.5">{selectedDriver?.name}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                  onClick={() => selectedDriver && handleGenerateRCPDF(selectedDriver)}
                >
                  <Download className="w-5 h-5" />
                </Button>
              </div>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-6 bg-white">
            <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="font-semibold py-3">Type</TableHead>
                    <TableHead className="text-right font-semibold py-3">Quantité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedDriver && bottleTypes
                    .filter(type => !['BNG 12KG', 'Propane 34KG', 'Détendeur Clic-On'].includes(type.name))
                    .map((type) => {
                      const qty = isEditingRC 
                      ? (editedBottles[type.id] || 0)
                      : (selectedDriver.remainingBottles?.[type.id] || 0);
                    
                    if (!isEditingRC && qty === 0) return null;
                    
                    return (
                      <TableRow key={type.id} className="hover:bg-slate-50/50 border-b border-slate-50 last:border-0">
                        <TableCell className="font-medium py-3">{type.name}</TableCell>
                        <TableCell className="text-right py-3">
                          {isEditingRC ? (
                            <Input
                              type="number"
                              className="w-20 ml-auto text-right h-8 focus:ring-purple-500"
                              value={qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setEditedBottles(prev => ({ ...prev, [type.id]: val }));
                              }}
                            />
                          ) : (
                            <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-100 font-bold px-3">
                              {qty}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!selectedDriver || (!isEditingRC && (!selectedDriver.remainingBottles || Object.values(selectedDriver.remainingBottles).every(q => q === 0)))) && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-8 text-slate-400 italic">
                        Aucune bouteille en attente
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-inner">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-xs">Total R.C Actuel</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-purple-600">
                    {isEditingRC 
                      ? Object.values(editedBottles).reduce((a, b) => a + b, 0)
                      : Object.values(selectedDriver?.remainingBottles || {}).reduce((a, b) => a + b, 0)}
                  </span>
                  <span className="text-xs font-medium text-slate-400">UNITÉS</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              {!isEditingRC ? (
                <Button className="flex-1 bg-slate-900 hover:bg-slate-800" onClick={() => setIsEditingRC(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Modifier le Stock
                </Button>
              ) : (
                <Button className="flex-1 bg-purple-600 hover:bg-purple-700 shadow-md" onClick={handleSaveRC}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Sauvegarder les changements
                </Button>
              )}
              <Button variant="outline" className="flex-1 border-slate-200" onClick={() => setBottleManagementOpen(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le chauffeur</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va supprimer définitivement ce chauffeur de la liste. Les autres données ne seront pas modifiées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (driverToDelete) {
                  await deleteDriver(driverToDelete.id);
                  setDriverToDelete(null);
                }
                setDeleteDialogOpen(false);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Drivers;
