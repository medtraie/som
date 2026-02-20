import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { Supplier } from '@/types';
import { 
  Factory as FactoryIcon, 
  Plus, 
  Truck, 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  Download, 
  Eye, 
  ArrowUpDown,
  History,
  Calendar,
  Search,
  ArrowRight,
  ArrowLeft,
  Settings2,
  UserPlus,
  Users,
  Edit2,
  Trash2
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { supabaseService } from '@/lib/supabaseService';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1
  }
};

interface FactoryOperation {
  id: string;
  truckId: string;
  supplierId?: string;
  driverName: string;
  sentBottles: Array<{
    bottleTypeId: string;
    quantity: number;
    status: 'empty' | 'defective';
  }>;
  receivedBottles: Array<{
    bottleTypeId: string;
    quantity: number;
  }>;
  date: string;
  receivedDate?: string;
  debtChange: number; // positive = debt to supplier, negative = debt reduction
  blReference?: string;
}

interface Invoice {
  id: string;
  supplierId: string;
  date: string;
  blReferences: string[];
  totalSent: number;
  totalReceived: number;
  totalAmount: number;
  status: 'pending' | 'paid';
}

interface SupplierDebt {
  bottleTypeId: string;
  emptyDebt: number; // Positive = supplier owes us empty bottles
  defectiveDebt: number; // Positive = supplier owes us compensation for defective bottles
}

interface DebtSettlement {
  id: string;
  date: string;
  supplierId: string;
  bottleTypeId: string;
  type: 'empty' | 'defective';
  quantity: number;
  description: string;
}

const Factory = () => {
  const { 
    trucks, 
    bottleTypes, 
    drivers, 
    updateBottleType, 
    addTransaction,
    emptyBottlesStock,
    defectiveBottles,
    updateEmptyBottlesStockByBottleType,
    updateDefectiveBottlesStock,
    suppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    addCashOperation
  } = useApp();
  const safeSuppliers = suppliers || [];

  const handleDownloadInvoicePDF = (invoice: Invoice) => {
    try {
      const doc = new jsPDF();
      const now = new Date();
      const supplier = safeSuppliers.find(s => s.id === invoice.supplierId);
      
      // Colors & Styles
      const primaryColor = [79, 70, 229]; // Indigo-600
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
      doc.text('FACTURE FOURNISSEUR', 210 - 14, 25, { align: 'right' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`N°: ${invoice.id}`, 210 - 14, 32, { align: 'right' });

      // Info Cards Layout
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 55, 90, 45, 2, 2, 'FD');
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

      // Left Card Content (Invoice Info)
      drawInfoLabel('Date de Facturation', format(new Date(invoice.date), 'dd MMMM yyyy', { locale: fr }), 20, 68);
      
      const statusLabel = invoice.status === 'paid' ? 'PAYÉE' : 'EN ATTENTE';
      const statusColor = invoice.status === 'paid' ? accentColor : [245, 158, 11]; // Amber-500
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('STATUT DU PAIEMENT', 20, 85);
      
      doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.roundedRect(20, 88, 30, 5, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text(statusLabel, 35, 91.5, { align: 'center' });

      // Right Card Content (Supplier Info)
      drawInfoLabel('Fournisseur', supplier?.name || 'N/A', 112, 68);
      drawInfoLabel('Nombre de BL', invoice.blReferences.length.toString(), 112, 85);

      // Movements Table
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Détails des Bons de Livraison (BL)', 14, 115);

      const tableData = invoice.blReferences.map(ref => {
        const op = factoryOperations.find(o => o.blReference === ref);
        const sent = op ? (op.sentBottles || []).reduce((s, b) => s + b.quantity, 0) : 0;
        const received = op ? (op.receivedBottles || []).reduce((s, b) => s + b.quantity, 0) : 0;
        return [
          ref,
          op ? format(new Date(op.date), 'dd/MM/yyyy') : 'N/A',
          sent.toString(),
          received.toString(),
          (sent - received).toString()
        ];
      });

      autoTable(doc, {
        startY: 120,
        head: [['Référence BL', 'Date', 'Qté Envoyée', 'Qté Reçue', 'Différence']],
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
          0: { halign: 'center' },
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' }
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

      let finalY = (doc as any).lastAutoTable.finalY || 120;

      // Recap by Bottle Type
      const bottleTypeSummary: Record<string, { name: string, sent: number, received: number, price: number, amount: number }> = {};
      
      invoice.blReferences.forEach(ref => {
        const op = factoryOperations.find(o => o.blReference === ref);
        if (op) {
          (op.sentBottles || []).forEach(b => {
            if (!bottleTypeSummary[b.bottleTypeId]) {
              const bt = bottleTypes.find(t => t.id === b.bottleTypeId);
              bottleTypeSummary[b.bottleTypeId] = { name: bt?.name || 'Inconnu', sent: 0, received: 0, price: bt?.purchasePrice || 0, amount: 0 };
            }
            bottleTypeSummary[b.bottleTypeId].sent += b.quantity;
          });
          (op.receivedBottles || []).forEach(b => {
            if (!bottleTypeSummary[b.bottleTypeId]) {
              const bt = bottleTypes.find(t => t.id === b.bottleTypeId);
              bottleTypeSummary[b.bottleTypeId] = { name: bt?.name || 'Inconnu', sent: 0, received: 0, price: bt?.purchasePrice || 0, amount: 0 };
            }
            bottleTypeSummary[b.bottleTypeId].received += b.quantity;
            const bt = bottleTypes.find(t => t.id === b.bottleTypeId);
            const price = bt?.purchasePrice || 0;
            bottleTypeSummary[b.bottleTypeId].amount += price * b.quantity;
          });
        }
      });

      if (Object.keys(bottleTypeSummary).length > 0) {
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Récapitulatif par Type de Bouteille', 14, finalY + 15);

        const summaryTableData = Object.values(bottleTypeSummary).map(item => [
          item.name,
          item.sent.toString(),
          item.received.toString(),
          (item.sent - item.received).toString(),
            Number(item.price).toFixed(3),
            Number(item.amount).toFixed(3)
        ]);

        autoTable(doc, {
          startY: finalY + 20,
          head: [['Type de Bouteille', 'Total Envoyé', 'Total Reçu', 'Différence', 'Prix Unitaire', 'Montant']],
          body: summaryTableData,
          theme: 'striped',
          headStyles: {
            fillColor: secondaryColor,
            textColor: [255, 255, 255],
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center'
          },
          columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' }
          },
          styles: { fontSize: 8, cellPadding: 4 }
        });

        finalY = (doc as any).lastAutoTable.finalY || finalY + 40;
      }

      // Summary & Totals
      const summaryY = finalY + 15;
      
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.roundedRect(110, summaryY, 86, 30, 2, 2, 'F');
      
      const drawSummaryRow = (label: string, value: string, y: number, color = [30, 41, 59], bold = false) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(10);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(label, 115, y);
        doc.text(value, 190, y, { align: 'right' });
      };

      drawSummaryRow('Total Général Envoyé:', `${invoice.totalSent}`, summaryY + 10);
      drawSummaryRow('Total Général Reçu:', `${invoice.totalReceived}`, summaryY + 20, [30, 41, 59], true);
      drawSummaryRow('Montant Total:', `${Number(invoice.totalAmount || 0).toFixed(3)}`, summaryY + 30, accentColor, true);

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 275, 196, 275);
        
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Facture générée par gaz maroc le ${format(now, 'dd/MM/yyyy à HH:mm')}`,
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

      doc.save(`Facture_${invoice.id}_${format(new Date(invoice.date), 'yyyyMMdd')}.pdf`);
    } catch (error) {
      console.error("Erreur lors de la génération de la facture PDF:", error);
      alert(`Erreur lors de la création de la facture PDF. Veuillez réessayer.`);
    }
  };

  const handleDownloadPDF = (operation: FactoryOperation) => {
    try {
      const doc = new jsPDF();
      const now = new Date();
      const truck = trucks.find(t => t.id === operation.truckId);
      const totalSent = (operation.sentBottles || []).reduce((sum, bottle) => sum + bottle.quantity, 0);
      const totalReceived = (operation.receivedBottles || []).reduce((sum, bottle) => sum + bottle.quantity, 0);
      const totalAmount = (operation.receivedBottles || []).reduce((sum, bottle) => {
        const bt = bottleTypes.find(bt_ => bt_.id === bottle.bottleTypeId);
        const price = bt?.purchasePrice || 0;
        return sum + price * bottle.quantity;
      }, 0);
      const isFinished = (operation.receivedBottles || []).length > 0;

      // Colors & Styles
      const primaryColor = [79, 70, 229]; // Indigo-600
      const secondaryColor = [71, 85, 105]; // Slate-600
      const accentColor = [16, 185, 129]; // Emerald-500
      const dangerColor = [220, 38, 38]; // Red-600
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
      doc.text('RAPPORT D\'OPÉRATION', 210 - 14, 25, { align: 'right' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const reportRef = operation.blReference || `OP-${operation.id}`;
      doc.text(reportRef, 210 - 14, 32, { align: 'right' });

      // Info Cards Layout
      // Left Card: Operation Details
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 55, 90, 45, 2, 2, 'FD');

      // Right Card: Truck & Driver
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

      // Left Card Content
      drawInfoLabel('Date de l\'opération', format(new Date(operation.date), 'dd MMMM yyyy', { locale: fr }), 20, 68);
      
      const statusLabel = isFinished ? 'TERMINÉE' : 'EN ATTENTE';
      const statusColor = isFinished ? accentColor : [245, 158, 11]; // Amber-500
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('STATUT', 20, 85);
      
      doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.roundedRect(20, 88, 25, 5, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text(statusLabel, 32.5, 91.5, { align: 'center' });

      // Right Card Content
      const truckLabel = truck?.matricule || truck?.plateNumber || truck?.name || operation.truckId || 'N/A';
      drawInfoLabel('Chauffeur', operation.driverName, 112, 68);
      drawInfoLabel('Camion / Matricule', truckLabel, 112, 85);

      // Movements Table
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Détails des Mouvements', 14, 115);

      const tableData = [
        ...(operation.sentBottles || []).map(b => {
          const bt = bottleTypes.find(bt_ => bt_.id === b.bottleTypeId);
          return [
            { content: 'SORTIE', styles: { textColor: dangerColor, fontStyle: 'bold' } },
            bt?.name || 'N/A',
            b.status === 'empty' ? 'Vide' : 'Défectueux',
            b.quantity.toString(),
            '',
            ''
          ];
        }),
        ...(operation.receivedBottles || []).map(b => {
          const bt = bottleTypes.find(bt_ => bt_.id === b.bottleTypeId);
          const price = bt?.purchasePrice || 0;
          return [
            { content: 'ENTRÉE', styles: { textColor: accentColor, fontStyle: 'bold' } },
            bt?.name || 'N/A',
            'Plein',
            b.quantity.toString(),
            Number(price).toFixed(3),
            Number(price * b.quantity).toFixed(3)
          ];
        }),
      ];

      autoTable(doc, {
        startY: 120,
        head: [['Direction', 'Type de Bouteille', 'État', 'Quantité', 'Prix Unitaire', 'Montant']],
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
          0: { halign: 'center', cellWidth: 30 },
          2: { halign: 'center', cellWidth: 40 },
          3: { halign: 'right', cellWidth: 30, fontStyle: 'bold' },
          4: { halign: 'right', cellWidth: 30 },
          5: { halign: 'right', cellWidth: 30 }
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
      if (finalY < 230) {
        const summaryY = finalY + 15;
        
        // Totals Box
        doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
        doc.roundedRect(110, summaryY, 86, 40, 2, 2, 'F');
        
        const drawSummaryRow = (label: string, value: string, y: number, color = [30, 41, 59], bold = false) => {
          doc.setFont('helvetica', bold ? 'bold' : 'normal');
          doc.setFontSize(10);
          doc.setTextColor(color[0], color[1], color[2]);
          doc.text(label, 115, y);
          doc.text(value, 190, y, { align: 'right' });
        };

        drawSummaryRow('Total Bouteilles Envoyées:', `${totalSent}`, summaryY + 12);
        drawSummaryRow('Total Bouteilles Reçues:', `${totalReceived}`, summaryY + 22);
        drawSummaryRow('Montant Total:', `${Number(totalAmount).toFixed(3)}`, summaryY + 32);
        
        if (operation.debtChange !== 0) {
          const label = operation.debtChange > 0 ? 'Dette Fournisseur:' : 'Réduction Dette:';
          const value = `${Math.abs(operation.debtChange)} unités`;
          const color = operation.debtChange > 0 ? dangerColor : accentColor;
          drawSummaryRow(label, value, summaryY + 42, color, true);
        }

        // Signature area
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('Signature du Responsable', 14, summaryY + 30);
        doc.line(14, summaryY + 32, 60, summaryY + 32);
      }

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

      doc.save(`Rapport_Usine_${operation.id}_${format(new Date(operation.date), 'yyyyMMdd')}.pdf`);
    } catch (error) {
      console.error("Erreur lors de la génération du PDF:", error);
      alert(`Erreur lors de la création du fichier PDF. Veuillez réessayer.`);
    }
  };

  // Nouveau: Export PDF pour toutes les opérations
  const exportOperationsPDF = () => {
    try {
      const doc = new jsPDF();
      const now = new Date();
      const primaryColor = [79, 70, 229]; // Indigo-600
      const secondaryColor = [71, 85, 105]; // Slate-600
      const accentColor = [16, 185, 129]; // Emerald-500
      const dangerColor = [220, 38, 38]; // Red-600

      // Header
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('gaz maroc', 14, 25);
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('HISTORIQUE DES OPÉRATIONS USINE', 210 - 14, 25, { align: 'right' });

      // Stats Summary before table
      const totalOps = factoryOperations.length;
      const finishedOps = factoryOperations.filter(op => (op.receivedBottles || []).length > 0).length;
      const totalSent_ = factoryOperations.reduce((sum, op) => sum + (op.sentBottles || []).reduce((s, b) => s + b.quantity, 0), 0);
      const totalReceived_ = factoryOperations.reduce((sum, op) => sum + (op.receivedBottles || []).reduce((s, b) => s + b.quantity, 0), 0);

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 45, 182, 20, 1, 1, 'F');
      
      const drawStat = (label: string, value: string, x: number) => {
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(label, x, 53);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(value, x, 60);
        doc.setFont('helvetica', 'normal');
      };

      drawStat('Total Opérations', totalOps.toString(), 20);
      drawStat('Terminées', finishedOps.toString(), 65);
      drawStat('Total Envoyé', totalSent_.toString(), 110);
      drawStat('Total Reçu', totalReceived_.toString(), 155);

      autoTable(doc, {
        startY: 75,
        head: [['Date', 'Chauffeur', 'Envoyé', 'Reçu', 'Montant', 'Statut', 'Dette/Diff.']],
        body: factoryOperations.map(op => {
          const sent = (op.sentBottles || []).reduce((s, b) => s + b.quantity, 0);
          const received = (op.receivedBottles || []).reduce((s, b) => s + b.quantity, 0);
          const isFinished = (op.receivedBottles || []).length > 0;
          const amount = (op.receivedBottles || []).reduce((s, b) => {
            const bt = bottleTypes.find(t => t.id === b.bottleTypeId);
            const price = bt?.purchasePrice || 0;
            return s + price * b.quantity;
          }, 0);
          
          return [
            format(new Date(op.date), 'dd/MM/yyyy'),
            op.driverName,
            sent.toString(),
            received.toString(),
            Number(amount).toFixed(3),
            { 
              content: isFinished ? 'TERMINÉE' : 'EN ATTENTE',
              styles: { textColor: isFinished ? accentColor : [245, 158, 11], fontStyle: 'bold' }
            },
            { 
              content: op.debtChange === 0 ? '0' : (op.debtChange > 0 ? `+${op.debtChange}` : op.debtChange.toString()),
              styles: { 
                textColor: op.debtChange > 0 ? dangerColor : op.debtChange < 0 ? accentColor : [30, 41, 59],
                fontStyle: op.debtChange !== 0 ? 'bold' : 'normal'
              }
            }
          ];
        }),
        theme: 'striped',
        headStyles: { 
          fillColor: primaryColor, 
          textColor: [255, 255, 255], 
          fontStyle: 'bold',
          halign: 'center'
        },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 25 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'right', cellWidth: 25 },
          5: { halign: 'center', cellWidth: 30 },
          6: { halign: 'right', cellWidth: 25 }
        },
        alternateRowStyles: {
          fillColor: [250, 251, 252]
        }
      });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 275, 196, 275);
        
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Exporté le ${format(now, 'dd/MM/yyyy HH:mm')} - gaz maroc v1.0`,
          14,
          282
        );
        doc.text(
          `Page ${i} sur ${pageCount}`,
          196,
          282,
          { align: 'right' }
        );
      }

      doc.save(`Historique_Usine_${format(now, 'yyyyMMdd_HHmm')}.pdf`);
    } catch (error) {
      console.error("Erreur lors de la génération du PDF:", error);
      alert(`Erreur lors de la création du fichier PDF. Veuillez réessayer.`);
    }
  };

  const [factoryOperations, setFactoryOperations] = useState<FactoryOperation[]>([]);
  const [debtSettlements, setDebtSettlements] = useState<DebtSettlement[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Statuts d'affichage des formulaires
  const [showSendForm, setShowSendForm] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [showSupplierManagement, setShowSupplierManagement] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [selectedSupplierForInvoice, setSelectedSupplierForInvoice] = useState<string | null>(null);
  const [selectedBLsForInvoice, setSelectedBLsForInvoice] = useState<string[]>([]);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [originalInvoiceId, setOriginalInvoiceId] = useState<string | null>(null);
  const [showEditInvoice, setShowEditInvoice] = useState(false);

  // Opération actuelle
  const [currentOperation, setCurrentOperation] = useState<Partial<FactoryOperation>>({});
  const [historyTab, setHistoryTab] = useState<'operations' | 'settlements' | 'invoices'>('operations');

  useEffect(() => {
    (async () => {
      const [ops, settlements, invs] = await Promise.all([
        supabaseService.getAll<FactoryOperation>('factory_operations'),
        supabaseService.getAll<DebtSettlement>('debt_settlements'),
        supabaseService.getAll<Invoice>('factory_invoices'),
      ]);
      setFactoryOperations(ops);
      setDebtSettlements(settlements);
      setInvoices(invs);
    })();
  }, []);

  // Formulaire d'envoi au fournisseur
  const [sendForm, setSendForm] = useState({
    date: new Date(),
    truckId: '',
    supplierId: '',
    blReference: '',
    bottles: bottleTypes
      .filter(bt => !bt.name.includes('Détendeur'))
      .map(bt => ({
        bottleTypeId: bt.id,
        emptyQuantity: 0,
        defectiveQuantity: 0
      }))
  });

  // Effect to auto-generate BL Reference
  React.useEffect(() => {
    if (showSendForm) {
      const lastOpWithBL = [...factoryOperations]
        .filter(op => op.blReference && op.blReference.startsWith('BL-'))
        .sort((a, b) => (b.blReference || '').localeCompare(a.blReference || ''))[0];
      
      let nextNumber = 1;
      if (lastOpWithBL && lastOpWithBL.blReference) {
        const match = lastOpWithBL.blReference.match(/BL-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      
      const nextBL = `BL-${nextNumber.toString().padStart(5, '0')}`;
      setSendForm(prev => ({ ...prev, blReference: nextBL }));
    }
  }, [showSendForm, factoryOperations]);
 
  useEffect(() => {
    bottleTypes.forEach((bt) => {
      let price = 0;
      if (bt.capacity === '12KG') price = 41.76;
      else if (bt.capacity === '6KG') price = 20.88;
      else if (bt.capacity === '3KG') price = 10.15;
      if (price > 0 && (!bt.purchasePrice || bt.purchasePrice === 0)) {
        updateBottleType(bt.id, { purchasePrice: price });
      }
    });
  }, [bottleTypes]);

  // Formulaire de réception
  const [returnForm, setReturnForm] = useState({
    date: new Date(),
    operationId: '',
    receivedBottles: bottleTypes.map(bt => ({
      bottleTypeId: bt.id,
      quantity: 0
    }))
  });

  // Formulaire de règlement
  const [settlementForm, setSettlementForm] = useState({
    supplierId: '',
    bottleTypeId: '',
    type: 'empty' as 'empty' | 'defective',
    quantity: 0,
    description: ''
  });

  const supplierDebt = factoryOperations.reduce((sum, op) => sum + op.debtChange, 0);
  const totalSent = factoryOperations.reduce((sum, op) => 
    sum + (op.sentBottles || []).reduce((s, b) => s + b.quantity, 0), 0
  );
  const totalReceived = factoryOperations.reduce((sum, op) => 
    sum + (op.receivedBottles || []).reduce((s, b) => s + b.quantity, 0), 0
  );

  const getEmptyStock = (bottleTypeId: string): number => {
    const stock = emptyBottlesStock.find(s => s.bottleTypeId === bottleTypeId);
    return stock?.quantity || 0;
  };

  const getDefectiveStock = (bottleTypeId: string): number => {
    return defectiveBottles
      .filter(b => b.bottleTypeId === bottleTypeId)
      .reduce((sum, b) => sum + b.quantity, 0);
  };

  const getSupplierDebt = (supplierId: string, bottleTypeId: string): { emptyDebt: number; defectiveDebt: number } => {
    const supplier = safeSuppliers.find(s => s.id === supplierId);
    if (!supplier) return { emptyDebt: 0, defectiveDebt: 0 };
    return supplier.debts?.find(d => d.bottleTypeId === bottleTypeId) || {
      bottleTypeId,
      emptyDebt: 0,
      defectiveDebt: 0
    };
  };
  
  // Gérer le règlement de la dette avec le fournisseur
  const handleDebtSettlement = async () => {
    if (!settlementForm.supplierId || !settlementForm.bottleTypeId || settlementForm.quantity <= 0) {
      alert('Veuillez choisir le fournisseur, le type de bouteille et saisir une quantité valide');
      return;
    }
    
    // Update supplier debts (negative change to reduce debt)
    if (settlementForm.type === 'empty') {
      updateSupplierDebt(settlementForm.supplierId, settlementForm.bottleTypeId, -settlementForm.quantity, 0);
      // Also update our empty stock
      updateEmptyBottlesStockByBottleType(
        settlementForm.bottleTypeId, 
        settlementForm.quantity,
        'factory',
        `Règlement dette - ${safeSuppliers.find(s => s.id === settlementForm.supplierId)?.name || 'Fournisseur inconnu'}`,
        {
          supplierId: settlementForm.supplierId
        }
      );
    } else {
      updateSupplierDebt(settlementForm.supplierId, settlementForm.bottleTypeId, 0, -settlementForm.quantity);
      // Also update our defective stock
      updateDefectiveBottlesStock(settlementForm.bottleTypeId, settlementForm.quantity);
    }
    
    // Add to settlements history
    const newSettlement: DebtSettlement = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      supplierId: settlementForm.supplierId,
      bottleTypeId: settlementForm.bottleTypeId,
      type: settlementForm.type,
      quantity: settlementForm.quantity,
      description: settlementForm.description || `Règlement de dette ${settlementForm.type === 'empty' ? 'vides' : 'défectueux'}`
    };
    
    const created = await supabaseService.create<DebtSettlement>('debt_settlements', newSettlement);
    const nextSettlement = created || newSettlement;
    setDebtSettlements(prev => [nextSettlement, ...prev]);

    // Add to global transactions
    addTransaction({
      type: 'factory_settlement',
      date: newSettlement.date,
      supplierId: newSettlement.supplierId,
      bottleTypeId: newSettlement.bottleTypeId,
      settlementType: newSettlement.type,
      quantity: newSettlement.quantity,
      description: newSettlement.description
    });
    
    // Reset form and close
    setSettlementForm({
      supplierId: '',
      bottleTypeId: '',
      type: 'empty',
      quantity: 0,
      description: ''
    });
    setShowSettlementForm(false);
  };

  // Update supplier debt
  const updateSupplierDebt = (supplierId: string, bottleTypeId: string, emptyChange: number, defectiveChange: number) => {
    const supplier = safeSuppliers.find(s => s.id === supplierId);
    if (!supplier) return;

    const updatedDebts = [...(supplier.debts || [])];
    const debtIndex = updatedDebts.findIndex(d => d.bottleTypeId === bottleTypeId);

    if (debtIndex >= 0) {
      updatedDebts[debtIndex] = {
        ...updatedDebts[debtIndex],
        emptyDebt: updatedDebts[debtIndex].emptyDebt + emptyChange,
        defectiveDebt: updatedDebts[debtIndex].defectiveDebt + defectiveChange
      };
    } else {
      updatedDebts.push({
        bottleTypeId,
        emptyDebt: emptyChange,
        defectiveDebt: defectiveChange
      });
    }

    updateSupplier(supplierId, { debts: updatedDebts });
  };

  const handleAddSupplier = () => {
    if (!newSupplierName.trim()) return;
    
    if (editingSupplier) {
      updateSupplier(editingSupplier.id, { name: newSupplierName });
    } else {
      addSupplier({
        id: Date.now().toString(),
        name: newSupplierName,
        debts: bottleTypes.map(bt => ({
          bottleTypeId: bt.id,
          emptyDebt: 0,
          defectiveDebt: 0
        })),
        transactionCount: 0
      });
    }
    
    setNewSupplierName('');
    setEditingSupplier(null);
    setShowAddSupplier(false);
  };

  const deleteFactoryOperation = async (operationId: string | number) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette opération ?")) return;
    const ok = await supabaseService.delete('factory_operations', operationId);
    if (ok) {
      setFactoryOperations(prev => prev.filter(op => String(op.id) !== String(operationId)));
    }
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setNewSupplierName(supplier.name);
    setShowAddSupplier(true);
  };

  const handleSendToFactory = async () => {
    const truck = trucks.find(t => t.id === sendForm.truckId);
    if (!truck) return;
    
    const driver = drivers.find(d => d.id === truck.driverId);

    // Validate stock availability - Removed validation to allow sending "REMOQUE" even if stock is 0
    /*
    for (const bottle of sendForm.bottles) {
      const emptyStock = getEmptyStock(bottle.bottleTypeId);
      const defectiveStock = getDefectiveStock(bottle.bottleTypeId);
      
      if (bottle.emptyQuantity > emptyStock) {
        alert(`Stock insuffisant de bouteilles vides pour ${bottleTypes.find(bt => bt.id === bottle.bottleTypeId)?.name}`);
        return;
      }
      
      if (bottle.defectiveQuantity > defectiveStock) {
        alert(`Stock insuffisant de bouteilles défectueuses pour ${bottleTypes.find(bt => bt.id === bottle.bottleTypeId)?.name}`);
        return;
      }
    }
    */

    const sentBottles = sendForm.bottles
      .filter(b => b.emptyQuantity > 0 || b.defectiveQuantity > 0)
      .flatMap(b => [
        ...(b.emptyQuantity > 0 ? [{
          bottleTypeId: b.bottleTypeId,
          quantity: b.emptyQuantity,
          status: 'empty' as const
        }] : []),
        ...(b.defectiveQuantity > 0 ? [{
          bottleTypeId: b.bottleTypeId,
          quantity: b.defectiveQuantity,
          status: 'defective' as const
        }] : [])
      ]);

    // Update stocks and supplier debts
    sendForm.bottles.forEach(bottle => {
      if (bottle.emptyQuantity > 0) {
        updateEmptyBottlesStockByBottleType(
          bottle.bottleTypeId, 
          -bottle.emptyQuantity,
          'factory',
          `Envoi usine - ${truck.name} - ${safeSuppliers.find(s => s.id === sendForm.supplierId)?.name || 'Fournisseur inconnu'}`,
          {
            truckId: sendForm.truckId,
            supplierId: sendForm.supplierId,
            blReference: sendForm.blReference,
            driverName: driver?.name
          }
        );
        // Supplier owes us empty bottles in return
        if (sendForm.supplierId) {
          updateSupplierDebt(sendForm.supplierId, bottle.bottleTypeId, bottle.emptyQuantity, 0);
        }
      }
      if (bottle.defectiveQuantity > 0) {
        updateDefectiveBottlesStock(bottle.bottleTypeId, -bottle.defectiveQuantity);
        // Supplier owes us compensation for defective bottles
        if (sendForm.supplierId) {
          updateSupplierDebt(sendForm.supplierId, bottle.bottleTypeId, 0, bottle.defectiveQuantity);
        }
      }
    });

    const operation: FactoryOperation = {
      id: Date.now().toString(),
      truckId: sendForm.truckId,
      supplierId: sendForm.supplierId,
      driverName: driver?.name || 'N/A',
      sentBottles,
      receivedBottles: [],
      date: sendForm.date ? sendForm.date.toISOString() : new Date().toISOString(),
      debtChange: 0,
      blReference: sendForm.blReference
    };

    const created = await supabaseService.create<FactoryOperation>('factory_operations', operation);
    const nextOperation = created || operation;
    setFactoryOperations(prev => [...prev, nextOperation]);
    setCurrentOperation(nextOperation);
    setSendForm({
      date: new Date(),
      truckId: '',
      supplierId: '',
      blReference: '',
      bottles: bottleTypes
        .filter(bt => !bt.name.includes('Détendeur'))
        .map(bt => ({
          bottleTypeId: bt.id,
          emptyQuantity: 0,
          defectiveQuantity: 0
        }))
    });
    setShowSendForm(false);

    // Add transaction
    await addTransaction({
      type: 'factory',
      date: sendForm.date ? sendForm.date.toISOString() : new Date().toISOString(),
      truckId: sendForm.truckId,
      supplierId: sendForm.supplierId,
      bottleTypes: sentBottles.map(b => ({
        bottleTypeId: b.bottleTypeId,
        quantity: b.quantity
      })),
      totalValue: 0
    });
  };

  const handleReturnFromFactory = async () => {
    const operationId = returnForm.operationId;
    const operation = factoryOperations.find(op => String(op.id) === String(operationId));
    if (!operation) return;

    const receivedBottles = returnForm.receivedBottles.filter(b => b && b.quantity > 0);
    
    // Track bottles by type for debt calculation
    const sentByType: Record<string, { empty: number; defective: number }> = {};
    (operation.sentBottles || []).forEach(sentBottle => {
      if (!sentByType[sentBottle.bottleTypeId]) {
        sentByType[sentBottle.bottleTypeId] = {
          empty: 0,
          defective: 0
        };
      }
      
      if (sentBottle.status === 'empty') {
        sentByType[sentBottle.bottleTypeId].empty += sentBottle.quantity;
      } else if (sentBottle.status === 'defective') {
        sentByType[sentBottle.bottleTypeId].defective += sentBottle.quantity;
      }
    });
    
    // Calculate debt changes for each bottle type
    receivedBottles.forEach(receivedBottle => {
      const bottleTypeId = receivedBottle.bottleTypeId;
      const receivedQuantity = receivedBottle.quantity;
      const sent = sentByType[bottleTypeId] || { empty: 0, defective: 0 };
      
      // Always prioritize compensating empty bottles first, then defective bottles
      let remainingReceived = receivedQuantity;
      
      // First, compensate for empty bottles (reduce debt)
      const emptyCompensation = Math.min(remainingReceived, sent.empty);
      if (emptyCompensation > 0 && operation.supplierId) {
        updateSupplierDebt(operation.supplierId, bottleTypeId, -emptyCompensation, 0);
        remainingReceived -= emptyCompensation;
      }
      
      // Then, compensate for defective bottles (reduce debt)
      const defectiveCompensation = Math.min(remainingReceived, sent.defective);
      if (defectiveCompensation > 0 && operation.supplierId) {
        updateSupplierDebt(operation.supplierId, bottleTypeId, 0, -defectiveCompensation);
        remainingReceived -= defectiveCompensation;
      }
      
      // If we still have excess bottles received (unlikely but possible), it becomes a negative debt
      if (remainingReceived > 0 && operation.supplierId) {
        updateSupplierDebt(operation.supplierId, bottleTypeId, -remainingReceived, 0);
      }
    });

    // Calculate net debt change for the operation summary
    const totalSent = (operation.sentBottles || []).reduce((sum, b) => sum + b.quantity, 0);
    const totalReceivedQty = (receivedBottles || []).reduce((sum, b) => sum + b.quantity, 0);
    const debtChange = totalReceivedQty - totalSent;

    // Update operation
    const updated = await supabaseService.update<FactoryOperation>('factory_operations', operation.id, {
      receivedBottles,
      debtChange,
      receivedDate: returnForm.date ? returnForm.date.toISOString() : new Date().toISOString(),
    });
    if (updated) {
      setFactoryOperations(prev => prev.map(op => (String(op.id) === String(operation.id) ? updated : op)));
    }

    // Update stock with received bottles (full bottles go to inventory)
    receivedBottles.forEach(bottle => {
      const currentBT = bottleTypes.find(bt => bt.id === bottle.bottleTypeId);
      if (currentBT) {
        const currentRemaining = Number(currentBT.remainingQuantity || 0);
        const qty = Number(bottle.quantity || 0);
        updateBottleType(bottle.bottleTypeId, {
          remainingQuantity: currentRemaining + qty
        });
        
        // Also update empty stock as requested by user
        updateEmptyBottlesStockByBottleType(
          bottle.bottleTypeId, 
          bottle.quantity,
          'factory',
          `Retour usine - ${operation.blReference || 'BL Inconnu'} - ${safeSuppliers.find(s => s.id === operation.supplierId)?.name || 'Fournisseur inconnu'}`,
          {
            truckId: operation.truckId,
            supplierId: operation.supplierId,
            blReference: operation.blReference,
            operationId: String(operation.id)
          }
        );
      }
    });

    setReturnForm({
      date: new Date(),
      operationId: '',
      receivedBottles: bottleTypes.map(bt => ({
        bottleTypeId: bt.id,
        quantity: 0
      }))
    });
    setShowReturnForm(false);
  };

  const deleteInvoice = async (invoiceId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette facture ?')) {
      const ok = await supabaseService.delete('factory_invoices', invoiceId);
      if (ok) {
        setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
      }
    }
  };

  const handleUpdateInvoice = async () => {
    if (!editingInvoice || !originalInvoiceId) return;
    const updated = await supabaseService.update<Invoice>('factory_invoices', originalInvoiceId, editingInvoice);
    if (updated) {
      setInvoices(prev => prev.map(inv => inv.id === originalInvoiceId ? updated : inv));
    }
    setShowEditInvoice(false);
    setEditingInvoice(null);
    setOriginalInvoiceId(null);
    alert('Facture mise à jour avec succès !');
  };

  const handleCreateInvoice = async () => {
    if (!selectedSupplierForInvoice || selectedBLsForInvoice.length === 0) {
      alert('Veuillez sélectionner un fournisseur et au moins un BL');
      return;
    }

    const selectedOps = factoryOperations.filter(op => 
      op.blReference && selectedBLsForInvoice.includes(op.blReference)
    );

    const totalSent = selectedOps.reduce((sum, op) => 
      sum + (op.sentBottles || []).reduce((s, b) => s + b.quantity, 0), 0
    );

    const totalReceived = selectedOps.reduce((sum, op) => 
      sum + (op.receivedBottles || []).reduce((s, b) => s + b.quantity, 0), 0
    );
    
    const totalAmount = selectedOps.reduce((sum, op) => {
      const amountOp = (op.receivedBottles || []).reduce((s, b) => {
        const bt = bottleTypes.find(t => t.id === b.bottleTypeId);
        const price = bt?.purchasePrice || 0;
        return s + price * b.quantity;
      }, 0);
      return sum + amountOp;
    }, 0);

    const newInvoice: Invoice = {
      id: `INV-${Date.now()}`,
      supplierId: selectedSupplierForInvoice,
      date: new Date().toISOString(),
      blReferences: selectedBLsForInvoice,
      totalSent,
      totalReceived,
      totalAmount,
      status: 'pending'
    };

    const created = await supabaseService.create<Invoice>('factory_invoices', newInvoice);
    if (created) {
      setInvoices(prev => [created, ...prev]);
    }
    setShowInvoiceForm(false);
    setSelectedBLsForInvoice([]);
    setSelectedSupplierForInvoice(null);
    setHistoryTab('invoices');
    alert('Facture créée avec succès !');
  };
  
  const handleToggleInvoicePaid = async (invoice: Invoice) => {
    if (invoice.status === 'pending') {
      const amount = invoice.totalAmount || 0;
      if (amount > 0) {
        await addCashOperation({
          date: new Date().toISOString(),
          name: `Paiement Facture ${invoice.id}`,
          amount,
          type: 'retrait',
          accountAffected: 'banque',
          status: 'validated',
        });
      }
      const updated = await supabaseService.update<Invoice>('factory_invoices', invoice.id, { status: 'paid' });
      if (updated) {
        setInvoices(prev => prev.map(inv => inv.id === invoice.id ? updated : inv));
      }
    } else {
      const amount = invoice.totalAmount || 0;
      if (amount > 0) {
        await addCashOperation({
          date: new Date().toISOString(),
          name: `Annulation Paiement Facture ${invoice.id}`,
          amount,
          type: 'versement',
          accountAffected: 'banque',
          status: 'validated',
        });
      }
      const updated = await supabaseService.update<Invoice>('factory_invoices', invoice.id, { status: 'pending' });
      if (updated) {
        setInvoices(prev => prev.map(inv => inv.id === invoice.id ? updated : inv));
      }
    }
  };

  const pendingOperations = factoryOperations.filter(op => (op.receivedBottles || []).length === 0);

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-4 md:p-8 space-y-8 bg-slate-50/30 min-h-screen"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-4 mb-2">
            <motion.div 
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.8 }}
              className="p-3 bg-slate-900 rounded-2xl shadow-xl shadow-slate-200"
            >
              <FactoryIcon className="w-7 h-7 text-white" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Gestion de l'Usine</h1>
              <p className="text-slate-500 font-medium">Suivi des envois et réceptions de bouteilles du fournisseur</p>
            </div>
          </div>
        </motion.div>
        
        <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-3">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button 
              variant="outline" 
              onClick={() => setShowSupplierManagement(true)}
              className="border-slate-200 hover:bg-white hover:border-indigo-300 text-slate-600 rounded-xl h-12 px-6 transition-all shadow-sm"
            >
              <CreditCard className="w-5 h-5 mr-2 text-indigo-500" />
              Gestion Fournisseurs
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button 
              variant="outline"
              onClick={() => setShowReturnForm(true)}
              className="border-slate-200 hover:bg-white hover:border-emerald-300 text-emerald-600 rounded-xl h-12 px-6 transition-all shadow-sm"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Réception Usine
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button 
              onClick={() => setShowSendForm(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-200 rounded-xl h-12 px-8 font-bold transition-all"
            >
              <ArrowRight className="w-5 h-5 mr-2" />
              Envoi Usine
            </Button>
          </motion.div>
        </motion.div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {[
          { label: 'Total Envoyé', value: totalSent, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Reçu', value: totalReceived, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Opérations en attente', value: pendingOperations.length, icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Dette Fournisseur (V)', value: safeSuppliers.reduce((s, sup) => s + (sup.debts?.reduce((acc, d) => acc + d.emptyDebt, 0) || 0), 0), icon: Package, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Défectueux en attente', value: safeSuppliers.reduce((s, sup) => s + (sup.debts?.reduce((acc, d) => acc + d.defectiveDebt, 0) || 0), 0), icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' }
        ].map((stat, idx) => (
          <motion.div 
            key={idx} 
            variants={itemVariants}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="relative group"
          >
            <Card className="border-0 shadow-sm overflow-hidden group hover:shadow-md transition-all duration-300 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-4 ${stat.bg} rounded-2xl group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                  <h3 className={`text-2xl font-black ${stat.color}`}>{stat.value}</h3>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Send Form Dialog */}
      <Dialog open={showSendForm} onOpenChange={setShowSendForm}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
          <div className="bg-slate-900 p-8 text-white">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-2xl">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <div className="">
                  <DialogTitle className="text-2xl font-black">Envoi à l'Usine</DialogTitle>
                  <DialogDescription className="text-slate-400 mt-1">
                    Enregistrer un nouvel envoi de bouteilles vides ou défectueuses au fournisseur
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-8 bg-white max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Label className="text-sm font-bold text-slate-700">Référence BL (Bon de Livraison)</Label>
                <div className="relative">
                  <Input
                    value={sendForm.blReference}
                    onChange={(e) => setSendForm({...sendForm, blReference: e.target.value})}
                    placeholder="BL-00000"
                    className="h-12 border-slate-200 rounded-xl bg-slate-50 pl-10 font-bold"
                  />
                  <History className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-bold text-slate-700">Choisir le camion (remorque)</Label>
                <Select 
                  value={sendForm.truckId} 
                  onValueChange={(value) => setSendForm({...sendForm, truckId: value})}
                >
                  <SelectTrigger className="h-12 border-slate-200 rounded-xl bg-slate-50 flex-row">
                    <SelectValue placeholder="Choisir le camion..." />
                  </SelectTrigger>
                  <SelectContent>
                    {trucks.filter(truck => truck.truckType === 'remorque').map(truck => {
                      const driver = drivers.find(d => d.id === truck.driverId);
                      return (
                        <SelectItem key={truck.id} value={truck.id}>
                          {truck.matricule} - {driver?.name || 'N/A'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-bold text-slate-700">Date de l'opération</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full h-12 bg-white border-slate-200 rounded-xl justify-start text-left font-medium shadow-sm hover:bg-slate-50 transition-all",
                        !sendForm.date && "text-slate-500"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4 text-indigo-600" />
                      {sendForm.date ? (
                        format(sendForm.date, "dd MMMM yyyy", { locale: fr })
                      ) : (
                        <span>Choisir une date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none overflow-hidden" align="end">
                    <CalendarComponent
                      mode="single"
                      selected={sendForm.date || undefined}
                      onSelect={(date) => date && setSendForm({ ...sendForm, date })}
                      initialFocus
                      className="bg-white p-4"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-sm font-bold text-slate-700">Choisir fournisseur</Label>
              <Select 
                value={sendForm.supplierId} 
                onValueChange={(value) => setSendForm({...sendForm, supplierId: value})}
              >
                <SelectTrigger className="h-12 border-slate-200 rounded-xl bg-slate-50 flex-row">
                  <SelectValue placeholder="Choisir le fournisseur..." />
                </SelectTrigger>
              <SelectContent>
                {safeSuppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-6">
              <h4 className="text-lg font-black text-slate-900 border-b pb-2">Bouteilles à envoyer</h4>
              <div className="grid gap-4">
                {bottleTypes
                  .filter(bt => !bt.name.includes('Détendeur'))
                  .map((bt) => {
                    const emptyStock = getEmptyStock(bt.id);
                    const defectiveStock = getDefectiveStock(bt.id);
                    const bottleIndex = sendForm.bottles.findIndex(b => b.bottleTypeId === bt.id);
                    const bottleEntry = sendForm.bottles[bottleIndex];
                    
                    return (
                      <div key={bt.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all group">
                        <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                              <Package className="w-5 h-5 text-slate-900" />
                            </div>
                            <span className="font-bold text-slate-900 text-lg">{bt.name}</span>
                          </div>

                          <div className="flex flex-1 gap-6">
                            <div className="flex-1 space-y-2">
                              <Label className="text-xs font-bold text-slate-500 uppercase">
                                Vide <span className="text-blue-600 font-black">(Disponible: {emptyStock})</span>
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                value={bottleEntry?.emptyQuantity || 0}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  const newBottles = [...sendForm.bottles];
                                  if (bottleIndex !== -1) {
                                    newBottles[bottleIndex] = {
                                      ...newBottles[bottleIndex],
                                      emptyQuantity: value
                                    };
                                  } else {
                                    newBottles.push({
                                      bottleTypeId: bt.id,
                                      emptyQuantity: value,
                                      defectiveQuantity: 0
                                    });
                                  }
                                  setSendForm({...sendForm, bottles: newBottles});
                                }}
                                className="h-11 border-none bg-white rounded-xl font-bold focus:ring-2 focus:ring-blue-500/20"
                              />
                            </div>
                            <div className="flex-1 space-y-2">
                              <Label className="text-xs font-bold text-slate-500 uppercase">
                                Défectueux <span className="text-rose-600 font-black">(Disponible: {defectiveStock})</span>
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                value={bottleEntry?.defectiveQuantity || 0}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  const newBottles = [...sendForm.bottles];
                                  if (bottleIndex !== -1) {
                                    newBottles[bottleIndex] = {
                                      ...newBottles[bottleIndex],
                                      defectiveQuantity: value
                                    };
                                  } else {
                                    newBottles.push({
                                      bottleTypeId: bt.id,
                                      emptyQuantity: 0,
                                      defectiveQuantity: value
                                    });
                                  }
                                  setSendForm({...sendForm, bottles: newBottles});
                                }}
                                className="h-11 border-none bg-white rounded-xl font-bold focus:ring-2 focus:ring-rose-500/20"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
            <Button 
              onClick={handleSendToFactory}
              className="bg-slate-900 hover:bg-slate-800 text-white h-12 px-8 rounded-xl font-bold transition-all shadow-lg shadow-slate-200"
            >
              Confirmer l'envoi
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowSendForm(false)}
              className="h-12 px-6 border-slate-200 hover:bg-white text-slate-600 rounded-xl font-bold transition-all"
            >
              Annuler
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Supplier Dialog */}
      <Dialog open={showAddSupplier} onOpenChange={setShowAddSupplier}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
          <div className="bg-slate-900 p-8 text-white">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-2xl">
                  <UserPlus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black">
                    {editingSupplier ? 'Modifier le Fournisseur' : 'Nouveau Fournisseur'}
                  </DialogTitle>
                </div>
              </div>
            </DialogHeader>
          </div>
          <div className="p-8 space-y-6 bg-white">
            <div className="space-y-4">
              <Label className="text-sm font-bold text-slate-700">Nom du Fournisseur</Label>
              <Input 
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="Entrez le nom du fournisseur..."
                className="h-12 border-slate-200 bg-slate-50 rounded-xl"
              />
            </div>
          </div>
          <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddSupplier(false);
                setEditingSupplier(null);
                setNewSupplierName('');
              }}
              className="flex-1 h-12 rounded-xl font-bold"
            >
              Annuler
            </Button>
            <Button 
              onClick={handleAddSupplier}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white h-12 rounded-xl font-bold"
            >
              {editingSupplier ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Supplier Management Dialog */}
      <Dialog open={showSupplierManagement} onOpenChange={setShowSupplierManagement}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
          <div className="bg-slate-900 p-8 text-white">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl">
                    <CreditCard className="w-6 h-6 text-white" />
                  </div>
                  <div className="">
                    <DialogTitle className="text-2xl font-black">Gestion Fournisseurs</DialogTitle>
                    <DialogDescription className="text-slate-400 mt-1">
                      Suivi des fournisseurs, transactions et dettes par type
                    </DialogDescription>
                  </div>
                </div>
                <Button 
                  onClick={() => setShowAddSupplier(true)}
                  className="bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-bold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau Fournisseur
                </Button>
              </div>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-6 bg-white max-h-[70vh] overflow-y-auto">
            {safeSuppliers.length === 0 ? (
              <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <div className="p-4 bg-white rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Users className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">Aucun fournisseur</h3>
                <p className="text-slate-500 max-w-xs mx-auto mb-6">Commencez par ajouter votre premier fournisseur pour suivre ses transactions.</p>
                <Button 
                  onClick={() => setShowAddSupplier(true)}
                  className="bg-slate-900 text-white hover:bg-slate-800 rounded-xl px-8"
                >
                  Ajouter un fournisseur
                </Button>
              </div>
            ) : (
              <div className="grid gap-6">
                {safeSuppliers.map(supplier => (
                  <div key={supplier.id} className="p-6 rounded-3xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-slate-200">
                          {supplier.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-slate-900">{supplier.name}</h4>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-white px-2 py-1 rounded-md border border-slate-100">
                              {supplier.transactionCount} Transaction(s)
                            </span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-white px-2 py-1 rounded-md border border-slate-100">
                              {factoryOperations.filter(op => op.supplierId === supplier.id && op.blReference).length} BL(s)
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedSupplierForInvoice(supplier.id);
                            setShowInvoiceForm(true);
                          }}
                          className="rounded-xl border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Créer Facture
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSettlementForm({ ...settlementForm, supplierId: supplier.id });
                            setShowSettlementForm(true);
                          }}
                          className="rounded-xl border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-300"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Régler Dette
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditSupplier(supplier)}
                          className="rounded-xl border-slate-200 hover:bg-white hover:text-blue-600 hover:border-blue-200"
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Modifier
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => deleteSupplier(supplier.id)}
                          className="rounded-xl border-slate-200 hover:bg-white hover:text-rose-600 hover:border-rose-200"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </Button>
                      </div>
                    </div>

                    {/* BL References List */}
                    <div className="mb-6">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Derniers Bons de Livraison (BL)</p>
                      <div className="flex flex-wrap gap-2">
                        {factoryOperations
                          .filter(op => op.supplierId === supplier.id && op.blReference)
                          .slice(-5)
                          .reverse()
                          .map(op => (
                            <Badge key={op.id} variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold py-1 px-3 rounded-lg">
                              {op.blReference}
                            </Badge>
                          ))}
                        {factoryOperations.filter(op => op.supplierId === supplier.id && op.blReference).length === 0 && (
                          <span className="text-xs text-slate-400 italic">Aucun BL enregistré</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {bottleTypes
                        .filter(bt => !bt.name.includes('Détendeur'))
                        .map(bt => {
                          const debt = supplier.debts?.find(d => d.bottleTypeId === bt.id) || { emptyDebt: 0, defectiveDebt: 0 };
                          return (
                            <div key={bt.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 border-b pb-2">{bt.name}</p>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-slate-500">Dette Vides:</span>
                                  <Badge className={`${debt.emptyDebt > 0 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'} border-none font-black`}>
                                    {debt.emptyDebt}
                                  </Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-slate-500">Défectueux:</span>
                                  <Badge className={`${debt.defectiveDebt > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'} border-none font-black`}>
                                    {debt.defectiveDebt}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
            <Button 
              variant="outline" 
              onClick={() => setShowSupplierManagement(false)}
              className="h-12 px-8 border-slate-200 hover:bg-white text-slate-600 rounded-xl font-bold transition-all"
            >
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Creation Dialog */}
      <Dialog open={showInvoiceForm} onOpenChange={setShowInvoiceForm}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
          <div className="bg-indigo-600 p-8 text-white">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <DialogTitle className="text-2xl font-black">Créer une Facture (Groupement BL)</DialogTitle>
                  <DialogDescription className="text-indigo-100 mt-1">
                    Sélectionnez les bons de livraison à regrouper dans cette facture
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-6 bg-white max-h-[60vh] overflow-y-auto">
            <div className="space-y-4">
              <Label className="text-sm font-bold text-slate-700">Fournisseur</Label>
              <Input 
                value={safeSuppliers.find(s => s.id === selectedSupplierForInvoice)?.name || ''} 
                disabled 
                className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-bold text-slate-700">Sélectionner les BL</Label>
                <span className="text-xs font-bold text-indigo-600">{selectedBLsForInvoice.length} sélectionné(s)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {factoryOperations
                  .filter(op => op.supplierId === selectedSupplierForInvoice && op.blReference)
                  .map(op => {
                    const isSelected = selectedBLsForInvoice.includes(op.blReference!);
                    const isAlreadyInvoiced = invoices.some(inv => inv.blReferences.includes(op.blReference!));
                    
                    return (
                      <button
                        key={op.id}
                        disabled={isAlreadyInvoiced}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedBLsForInvoice(prev => prev.filter(ref => ref !== op.blReference));
                          } else {
                            setSelectedBLsForInvoice(prev => [...prev, op.blReference!]);
                          }
                        }}
                        className={`flex flex-col p-4 rounded-2xl border-2 transition-all text-left ${
                          isSelected 
                            ? 'border-indigo-600 bg-indigo-50 shadow-md shadow-indigo-100' 
                            : isAlreadyInvoiced
                              ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                              : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-black text-slate-900">{op.blReference}</span>
                          {isSelected && <CheckCircle className="w-4 h-4 text-indigo-600" />}
                          {isAlreadyInvoiced && <Badge variant="outline" className="text-[8px] py-0">Facturé</Badge>}
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                          {new Date(op.date).toLocaleDateString('fr-FR')}
                        </span>
                        <span className="text-xs font-bold text-slate-600 mt-1">
                          {(op.sentBottles || []).reduce((s, b) => s + b.quantity, 0)} bouteilles
                        </span>
                      </button>
                    );
                  })}
              </div>
              {factoryOperations.filter(op => op.supplierId === selectedSupplierForInvoice && op.blReference).length === 0 && (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <p className="text-slate-400 font-bold">Aucun BL disponible pour ce fournisseur</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowInvoiceForm(false);
                setSelectedBLsForInvoice([]);
              }}
              className="h-12 px-6 border-slate-200 hover:bg-white text-slate-600 rounded-xl font-bold transition-all"
            >
              Annuler
            </Button>
            <Button 
              onClick={handleCreateInvoice}
              disabled={selectedBLsForInvoice.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-12 px-8 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              Créer la facture
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Invoice Dialog */}
      <Dialog open={showEditInvoice} onOpenChange={setShowEditInvoice}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
          <div className="bg-indigo-600 p-8 text-white">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Edit2 className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <DialogTitle className="text-2xl font-black">Modifier la facture</DialogTitle>
                  <DialogDescription className="text-indigo-100 mt-1">
                    Modifier les détails de la facture {editingInvoice?.id}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-6 bg-white">
            <div className="space-y-4 text-left">
              <Label className="text-sm font-bold text-slate-700">N° Facture</Label>
              <Input 
                value={editingInvoice?.id || ''} 
                onChange={(e) => setEditingInvoice(prev => prev ? {...prev, id: e.target.value} : null)}
                className="h-12 border-slate-200 rounded-xl bg-slate-50"
              />
            </div>
            <div className="space-y-4 text-left">
              <Label className="text-sm font-bold text-slate-700">Date</Label>
              <Input 
                type="date"
                value={editingInvoice?.date ? editingInvoice.date.slice(0, 10) : ''} 
                onChange={(e) => setEditingInvoice(prev => prev ? {...prev, date: new Date(e.target.value).toISOString()} : null)}
                className="h-12 border-slate-200 rounded-xl bg-slate-50"
              />
            </div>
            <div className="space-y-4 text-left">
              <Label className="text-sm font-bold text-slate-700">Statut</Label>
              <Select 
                value={editingInvoice?.status} 
                onValueChange={(value: 'pending' | 'paid') => setEditingInvoice(prev => prev ? {...prev, status: value} : null)}
              >
                <SelectTrigger className="h-12 border-slate-200 rounded-xl bg-slate-50">
                  <SelectValue placeholder="Choisir le statut..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="paid">Payée</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
            <Button 
              variant="outline" 
              onClick={() => setShowEditInvoice(false)}
              className="h-12 px-6 border-slate-200 hover:bg-white text-slate-600 rounded-xl font-bold transition-all"
            >
              Annuler
            </Button>
            <Button 
              onClick={handleUpdateInvoice}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-12 px-8 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200"
            >
              Enregistrer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settlement Form Dialog */}
      <Dialog open={showSettlementForm} onOpenChange={setShowSettlementForm}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
          <div className="bg-emerald-600 p-8 text-white">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <DialogTitle className="text-2xl font-black">Nouveau règlement de dette</DialogTitle>
                  <DialogDescription className="text-emerald-100 mt-1">
                    Enregistrer la réception de bouteilles du fournisseur pour régler les dettes
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-6 bg-white max-h-[70vh] overflow-y-auto">
            <div className="space-y-4 text-left">
              <Label className="text-sm font-bold text-slate-700">Fournisseur</Label>
              <Select 
                value={settlementForm.supplierId} 
                onValueChange={(value) => setSettlementForm({...settlementForm, supplierId: value})}
              >
                <SelectTrigger className="h-12 border-slate-200 rounded-xl bg-slate-50 text-left flex-row">
                  <SelectValue placeholder="Choisir le fournisseur..." />
                </SelectTrigger>
              <SelectContent className="text-left">
                {safeSuppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 text-left">
              <Label className="text-sm font-bold text-slate-700">Type de bouteille</Label>
              <Select 
                value={settlementForm.bottleTypeId} 
                onValueChange={(value) => setSettlementForm({...settlementForm, bottleTypeId: value})}
                disabled={!settlementForm.supplierId}
              >
                <SelectTrigger className="h-12 border-slate-200 rounded-xl bg-slate-50 text-left flex-row">
                  <SelectValue placeholder={settlementForm.supplierId ? "Choisir le type..." : "Sélectionnez d'abord un fournisseur"} />
                </SelectTrigger>
                <SelectContent className="text-left">
                  {bottleTypes
                    .filter(bt => !bt.name.includes('Détendeur'))
                    .map(bt => {
                      const debt = settlementForm.supplierId ? getSupplierDebt(settlementForm.supplierId, bt.id) : null;
                      const debtText = debt 
                        ? ` (Vides: ${debt.emptyDebt}, Déf: ${debt.defectiveDebt})` 
                        : '';
                      return (
                        <SelectItem key={bt.id} value={bt.id}>
                          {bt.name}{debtText}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
              {settlementForm.bottleTypeId && settlementForm.supplierId && (
                <div className="flex gap-4 mt-2">
                  {(() => {
                    const debt = getSupplierDebt(settlementForm.supplierId, settlementForm.bottleTypeId);
                    return (
                      <>
                        <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Dette Vides</p>
                          <p className={`text-lg font-black ${debt.emptyDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {debt.emptyDebt}
                          </p>
                        </div>
                        <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Dette Défectueux</p>
                          <p className={`text-lg font-black ${debt.defectiveDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {debt.defectiveDebt}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="space-y-4 text-left">
              <Label className="text-sm font-bold text-slate-700">Type de règlement</Label>
              <Select 
                value={settlementForm.type} 
                onValueChange={(value: 'empty' | 'defective') => setSettlementForm({...settlementForm, type: value})}
              >
                <SelectTrigger className="h-12 border-slate-200 rounded-xl bg-slate-50 text-left">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-left">
                  <SelectItem value="empty">Règlement vide</SelectItem>
                  <SelectItem value="defective">Règlement défectueux</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 text-left">
              <Label className="text-sm font-bold text-slate-700">Quantité reçue</Label>
              <Input
                type="number"
                min="1"
                value={settlementForm.quantity}
                onChange={(e) => setSettlementForm({...settlementForm, quantity: parseInt(e.target.value) || 0})}
                className="h-12 border-slate-200 bg-slate-50 rounded-xl text-left font-black text-lg focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="space-y-4 text-left">
              <Label className="text-sm font-bold text-slate-700">Notes (Optionnel)</Label>
              <Input
                value={settlementForm.description}
                onChange={(e) => setSettlementForm({...settlementForm, description: e.target.value})}
                placeholder="Ex: Compensation en espèces, échange..."
                className="h-12 border-slate-200 bg-slate-50 rounded-xl text-left focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
            <Button 
              variant="outline" 
              onClick={() => setShowSettlementForm(false)}
              className="h-12 px-6 border-slate-200 hover:bg-white text-slate-600 rounded-xl font-bold transition-all"
            >
              Annuler
            </Button>
            <Button 
              onClick={handleDebtSettlement}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 px-8 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 flex-1"
            >
              Enregistrer le règlement
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return Form Dialog */}
      <Dialog open={showReturnForm} onOpenChange={setShowReturnForm}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
          <div className="bg-slate-900 p-8 text-white">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-2xl">
                  <ArrowLeft className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <DialogTitle className="text-2xl font-black">Réception de l'Usine</DialogTitle>
                  <DialogDescription className="text-slate-400 mt-1">
                    Enregistrer le retour du camion et la réception des bouteilles pleines
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-8 bg-white max-h-[70vh] overflow-y-auto">
            <div className="space-y-4 text-left">
              <Label className="text-sm font-bold text-slate-700">Choisir l'opération (Chargement en attente)</Label>
              <Select 
                value={returnForm.operationId} 
                onValueChange={(value) => setReturnForm({...returnForm, operationId: value})}
              >
                <SelectTrigger className="h-12 border-slate-200 rounded-xl bg-slate-50 text-left">
                  <SelectValue placeholder="Choisir l'opération..." />
                </SelectTrigger>
                <SelectContent className="text-left">
                  {pendingOperations.map(op => (
                    <SelectItem key={op.id} value={String(op.id)}>
                      {op.driverName} - {new Date(op.date).toLocaleDateString('fr-FR')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="space-y-4 mt-4">
                <Label className="text-sm font-bold text-slate-700">Date de réception</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full h-12 bg-white border-slate-200 rounded-xl justify-start text-left font-medium shadow-sm hover:bg-slate-50 transition-all",
                        !returnForm.date && "text-slate-500"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4 text-emerald-600" />
                      {returnForm.date ? (
                        format(returnForm.date, "dd MMMM yyyy", { locale: fr })
                      ) : (
                        <span>Choisir une date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none overflow-hidden" align="end">
                    <CalendarComponent
                      mode="single"
                      selected={returnForm.date || undefined}
                      onSelect={(date) => date && setReturnForm({ ...returnForm, date })}
                      initialFocus
                      className="bg-white p-4"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {returnForm.operationId && (
              <div className="space-y-6">
                <h4 className="text-lg font-black text-slate-900 text-left border-b pb-2">Bouteilles reçues</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  {bottleTypes.map((bt, index) => {
                    const receivedEntry = returnForm.receivedBottles[index] || { bottleTypeId: bt.id, quantity: 0 };
                    return (
                    <div key={bt.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-xl shadow-sm">
                          <Package className="w-5 h-5 text-slate-900" />
                        </div>
                        <span className="font-bold text-slate-900">{bt.name}</span>
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <div className="text-left space-y-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase">Quantité</Label>
                          <Input
                            type="number"
                            value={receivedEntry.quantity}
                            onChange={(e) => {
                              const newBottles = [...returnForm.receivedBottles];
                              const nextQuantity = parseInt(e.target.value) || 0;
                              if (newBottles[index]) {
                                newBottles[index] = { ...newBottles[index], quantity: nextQuantity };
                              } else {
                                newBottles[index] = { bottleTypeId: bt.id, quantity: nextQuantity };
                              }
                              setReturnForm({...returnForm, receivedBottles: newBottles});
                            }}
                            className="h-11 border-none bg-white rounded-xl text-left font-bold focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>
                        <div className="text-left space-y-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase">Prix d'achat</Label>
                          {bt.capacity === '34KG' ? (
                            <Input
                              type="number"
                              value={String(bt.purchasePrice ?? 0)}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                updateBottleType(bt.id, { purchasePrice: val });
                              }}
                              className="h-11 border-none bg-white rounded-xl text-left font-bold focus:ring-2 focus:ring-emerald-500/20"
                            />
                          ) : (
                            <div className="h-11 bg-white rounded-xl flex items-center px-3 font-bold text-slate-700">
                              {Number(bt.purchasePrice ?? 0).toFixed(3)}
                            </div>
                          )}
                          <div className="text-xs text-slate-500">
                            Montant: {Number((bt.purchasePrice ?? 0) * (receivedEntry.quantity || 0)).toFixed(3)}
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
            <Button 
              variant="outline" 
              onClick={() => setShowReturnForm(false)}
              className="h-12 px-6 border-slate-200 hover:bg-white text-slate-600 rounded-xl font-bold transition-all"
            >
              Annuler
            </Button>
            <Button 
              onClick={handleReturnFromFactory}
              className="bg-slate-900 hover:bg-slate-800 text-white h-12 px-8 rounded-xl font-bold transition-all shadow-lg shadow-slate-200"
            >
              Confirmer la réception
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Section */}
      <motion.div variants={itemVariants} layout>
        <Card className="border-none shadow-xl shadow-slate-200/50 bg-white/90 backdrop-blur-md rounded-3xl overflow-hidden text-left">
          <CardHeader className="border-b border-slate-100 p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-900 rounded-xl">
                  <History className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-xl font-bold text-slate-900">Journal des opérations</CardTitle>
                  <p className="text-slate-400 text-xs mt-1">Historique des chargements et des règlements de dettes</p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
                  <Button
                    variant={historyTab === 'operations' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setHistoryTab('operations')}
                    className={`h-9 px-4 rounded-lg font-bold transition-all ${historyTab === 'operations' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                  >
                    Chargements
                  </Button>
                  <Button
                    variant={historyTab === 'settlements' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setHistoryTab('settlements')}
                    className={`h-9 px-4 rounded-lg font-bold transition-all ${historyTab === 'settlements' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                  >
                    Règlements
                  </Button>
                  <Button
                    variant={historyTab === 'invoices' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setHistoryTab('invoices')}
                    className={`h-9 px-4 rounded-lg font-bold transition-all ${historyTab === 'invoices' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                  >
                    Factures
                  </Button>
                </div>
                <div className="relative group min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                  <Input 
                    placeholder="Rechercher une opération..." 
                    className="pl-10 h-11 bg-slate-50 border-none rounded-xl focus-visible:ring-2 focus-visible:ring-slate-900/10 transition-all text-left"
                  />
                </div>
                <Button 
                  variant="outline" 
                  onClick={exportOperationsPDF}
                  className="h-11 px-5 border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold transition-all"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exporter PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {historyTab === 'operations' ? (
                <Table>
                  <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
                    <TableHead className="py-5 font-bold text-slate-600 text-left px-8">Date</TableHead>
                    <TableHead className="py-5 font-bold text-slate-600 text-left">Date réception</TableHead>
                    <TableHead className="py-5 font-bold text-slate-600 text-left">Chauffeur</TableHead>
                    <TableHead className="py-5 font-bold text-slate-600 text-left">Statut</TableHead>
                    <TableHead className="py-5 font-bold text-slate-600 text-left">Envoyé</TableHead>
                    <TableHead className="py-5 font-bold text-slate-600 text-left">Reçu</TableHead>
                    <TableHead className="py-5 font-bold text-slate-600 text-left">Prix</TableHead>
                    <TableHead className="py-5 font-bold text-slate-600 text-left">Montant</TableHead>
                    <TableHead className="py-5 font-bold text-slate-600 text-left">Dette/Diff</TableHead>
                    <TableHead className="py-5 text-right font-bold text-slate-600 px-8">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {factoryOperations.length > 0 ? (
                      factoryOperations.slice().reverse().map((operation, idx) => {
                        const totalSentOp = (operation.sentBottles || []).reduce((sum, bottle) => sum + bottle.quantity, 0);
                        const totalReceivedOp = (operation.receivedBottles || []).reduce((sum, bottle) => sum + bottle.quantity, 0);
                        const isPending = (operation.receivedBottles || []).length === 0;
                        const totalAmountOp = (operation.receivedBottles || []).reduce((s, b) => {
                          const bt = bottleTypes.find(t => t.id === b.bottleTypeId);
                          const price = bt?.purchasePrice || 0;
                          return s + price * b.quantity;
                        }, 0);
                        const uniquePrices = Array.from(new Set((operation.receivedBottles || []).map(b => {
                          const bt = bottleTypes.find(t => t.id === b.bottleTypeId);
                          return bt?.purchasePrice || 0;
                        })).values()).filter(p => p > 0);

                        return (
                          <motion.tr
                            key={operation.id}
                            variants={itemVariants}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            layout
                            transition={{ 
                              delay: idx * 0.03,
                              layout: { duration: 0.2 }
                            }}
                            whileHover={{ x: 5, backgroundColor: "rgba(248, 250, 252, 1)" }}
                            className="group hover:bg-slate-50/80 transition-colors border-b border-slate-50 last:border-0 border-l-2 border-transparent hover:border-indigo-500"
                          >
                            <TableCell className="py-5 font-medium text-slate-600 text-left px-8">
                              {new Date(operation.date).toLocaleDateString('fr-FR', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </TableCell>
                            <TableCell className="py-5 text-left">
                              {operation.receivedDate
                                ? format(new Date(operation.receivedDate), 'dd/MM/yyyy', { locale: fr })
                                : <span className="text-slate-300">-</span>}
                            </TableCell>
                            <TableCell className="py-5 text-left">
                              <div className="flex items-center gap-3 justify-start">
                                <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold group-hover:bg-slate-900 group-hover:text-white transition-all duration-300">
                                  {(operation.driverName || 'N/A').charAt(0)}
                                </div>
                                <span className="font-bold text-slate-700">{operation.driverName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-5 text-left">
                              <Badge 
                                variant={isPending ? "outline" : "default"}
                                className={`rounded-lg px-3 py-1 font-bold text-[10px] border-none shadow-sm ${
                                  isPending 
                                    ? 'bg-amber-100 text-amber-700' 
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {isPending ? "En attente" : "Terminée"}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-5 text-left">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                                {totalSentOp} bouteilles
                              </span>
                            </TableCell>
                            <TableCell className="py-5 text-left">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                                {totalReceivedOp} bouteilles
                              </span>
                            </TableCell>
                            <TableCell className="py-5 text-left">
                              {uniquePrices.length === 1 ? Number(uniquePrices[0]).toFixed(3) : <span className="text-slate-400">Multiple</span>}
                            </TableCell>
                            <TableCell className="py-5 text-left">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-50 text-violet-700">
                                {Number(totalAmountOp).toFixed(3)}
                              </span>
                            </TableCell>
                            <TableCell className="py-5 text-left">
                              {operation.debtChange !== 0 ? (
                                <div className={`flex items-center gap-1 font-bold justify-start ${
                                  operation.debtChange > 0 ? 'text-rose-600' : 'text-emerald-600'
                                }`}>
                                  {operation.debtChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  {Math.abs(operation.debtChange)}
                                </div>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </TableCell>
                            <TableCell className="py-5 text-right px-8">
                              <div className="flex items-center gap-2 justify-end">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => handleDownloadPDF(operation)}
                                  className="w-9 h-9 rounded-xl hover:bg-white hover:text-indigo-600 hover:shadow-sm transition-all"
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => deleteFactoryOperation(operation.id)}
                                  className="w-9 h-9 rounded-xl text-rose-600 hover:bg-rose-50 transition-all"
                                  title="Supprimer l'opération"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-slate-900 hover:bg-white shadow-sm rounded-lg transition-all">
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
                                    <div className="bg-slate-900 p-8 text-white text-left">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                          <div className="p-3 bg-white/10 rounded-2xl">
                                            <Package className="w-6 h-6 text-white" />
                                          </div>
                                          <div className="text-left">
                                            <DialogTitle className="text-2xl font-black">Détails de l'opération</DialogTitle>
                                            <p className="text-slate-400 text-sm mt-1">
                                              {operation.driverName} • {format(new Date(operation.date), 'dd/MM/yyyy', { locale: fr })}
                                              {(operation.receivedBottles || []).length > 0 && operation.receivedDate ? 
                                                ` • Réception: ${format(new Date(operation.receivedDate), 'dd/MM/yyyy', { locale: fr })}` 
                                                : ''
                                              }
                                            </p>
                                          </div>
                                        </div>
                                        <Badge className={isPending ? "bg-amber-500" : "bg-emerald-500"}>
                                          {isPending ? "En attente" : "Terminée"}
                                        </Badge>
                                      </div>
                                    </div>
                                    
                                    <div className="p-8 grid md:grid-cols-2 gap-8 bg-white">
                                      <div className="space-y-4 text-left">
                                        <h4 className="font-black text-slate-900 flex items-center gap-2">
                                          <TrendingUp className="w-4 h-4 text-blue-600" />
                                          Quantités envoyées
                                        </h4>
                                        <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                                          {(operation.sentBottles || []).map((bottle, bidx) => {
                                            const bt = bottleTypes.find(b => b.id === bottle.bottleTypeId);
                                            return (
                                              <div key={bidx} className="flex justify-between items-center text-sm">
                                                <span className="font-bold text-slate-600">{bt?.name}</span>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-slate-400">({bottle.status === 'empty' ? 'Vide' : 'Défectueux'})</span>
                                                  <span className="font-black text-slate-900">{bottle.quantity}</span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      <div className="space-y-4 text-left">
                                        <h4 className="font-black text-slate-900 flex items-center gap-2">
                                          <TrendingDown className="w-4 h-4 text-emerald-600" />
                                          Quantités reçues
                                        </h4>
                                        {(operation.receivedBottles || []).length > 0 ? (
                                          <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                                            {(operation.receivedBottles || []).map((bottle, bidx) => {
                                              const bt = bottleTypes.find(b => b.id === bottle.bottleTypeId);
                                              return (
                                                <div key={bidx} className="flex justify-between items-center text-sm">
                                                  <span className="font-bold text-slate-600">{bt?.name}</span>
                                                  <span className="font-black text-slate-900">{bottle.quantity}</span>
                                                </div>
                                              );
                                            })}
                                            {operation.debtChange !== 0 && (
                                              <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-center">
                                                <span className="font-bold text-slate-900">Différence de dette</span>
                                                <span className={`font-black ${operation.debtChange > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                  {operation.debtChange > 0 ? '+' : ''}{operation.debtChange} bouteilles
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="bg-amber-50 rounded-2xl p-8 text-center">
                                            <Truck className="w-8 h-8 text-amber-400 mx-auto mb-2 animate-bounce" />
                                            <p className="text-amber-700 font-bold text-sm">En attente du retour de l'usine</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                                      <Button variant="outline" onClick={() => handleDownloadPDF(operation)} className="rounded-xl font-bold border-slate-200">
                                        <Download className="w-4 h-4 mr-2" />
                                        Télécharger le rapport
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleDownloadPDF(operation)}
                                  className="h-9 w-9 text-slate-400 hover:text-slate-900 hover:bg-white shadow-sm rounded-lg transition-all"
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </motion.tr>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={10} className="py-20 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="p-4 bg-slate-50 rounded-full">
                              <History className="w-8 h-8 text-slate-200" />
                            </div>
                            <p className="text-slate-400 font-medium">Aucune opération enregistrée pour le moment</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </AnimatePresence>
                </TableBody>
              </Table>
              ) : historyTab === 'settlements' ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
                      <TableHead className="py-5 font-bold text-slate-600 text-left px-8">Date</TableHead>
                      <TableHead className="py-5 font-bold text-slate-600 text-left">Fournisseur</TableHead>
                      <TableHead className="py-5 font-bold text-slate-600 text-left">Type de bouteille</TableHead>
                      <TableHead className="py-5 font-bold text-slate-600 text-left">Type de règlement</TableHead>
                      <TableHead className="py-5 font-bold text-slate-600 text-left">Quantité</TableHead>
                      <TableHead className="py-5 font-bold text-slate-600 text-left px-8">Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {debtSettlements.length > 0 ? (
                        debtSettlements.map((settlement, idx) => {
                          const supplier = safeSuppliers.find(s => s.id === settlement.supplierId);
                          const bottleType = bottleTypes.find(bt => bt.id === settlement.bottleTypeId);

                          return (
                            <motion.tr
                              key={settlement.id}
                              variants={itemVariants}
                              initial="hidden"
                              animate="visible"
                              exit="hidden"
                              layout
                              transition={{ 
                                delay: idx * 0.03,
                                layout: { duration: 0.2 }
                              }}
                              whileHover={{ x: 5, backgroundColor: "rgba(248, 250, 252, 1)" }}
                              className="group hover:bg-slate-50/80 transition-colors border-b border-slate-50 last:border-0 border-l-2 border-transparent hover:border-emerald-500"
                            >
                              <TableCell className="py-5 px-8 font-medium text-slate-600 text-left">
                                {new Date(settlement.date).toLocaleDateString('fr-FR', { 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </TableCell>
                              <TableCell className="py-5 font-black text-slate-900 text-left">
                                {supplier?.name || 'Inconnu'}
                              </TableCell>
                              <TableCell className="py-5 font-bold text-slate-700 text-left">
                                {bottleType?.name || 'Inconnu'}
                              </TableCell>
                              <TableCell className="py-5 text-left">
                                <Badge variant="outline" className={`font-bold px-3 py-1 rounded-lg border-none shadow-sm ${
                                  settlement.type === 'empty' 
                                    ? 'bg-blue-100 text-blue-700' 
                                    : 'bg-rose-100 text-rose-700'
                                }`}>
                                  {settlement.type === 'empty' ? 'Vide' : 'Défectueux'}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-5 font-black text-emerald-600 text-left">
                                {settlement.quantity} btl
                              </TableCell>
                              <TableCell className="py-5 px-8 text-slate-500 text-sm italic text-left">
                                {settlement.description}
                              </TableCell>
                            </motion.tr>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="py-20 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="p-4 bg-slate-50 rounded-full">
                                <History className="w-8 h-8 text-slate-200" />
                              </div>
                              <p className="text-slate-400 font-medium">Aucun règlement enregistré</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
                      <TableHead className="py-5 font-bold text-slate-600 text-left px-8">N° Facture</TableHead>
                      <TableHead className="py-5 font-bold text-slate-600 text-left">Date</TableHead>
                      <TableHead className="py-5 font-bold text-slate-600 text-left">Fournisseur</TableHead>
                      <TableHead className="py-5 font-bold text-slate-600 text-left">BLs Groupés</TableHead>
                      <TableHead className="py-5 font-bold text-slate-600 text-left">Total (Env/Rec)</TableHead>
                      <TableHead className="py-5 font-bold text-slate-600 text-left">Montant</TableHead>
                      <TableHead className="py-5 font-bold text-slate-600 text-left">Statut</TableHead>
                      <TableHead className="py-5 text-right font-bold text-slate-600 px-8">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {invoices.length > 0 ? (
                        invoices.map((invoice, idx) => {
                          const supplier = safeSuppliers.find(s => s.id === invoice.supplierId);
                          return (
                            <motion.tr
                              key={invoice.id}
                              variants={itemVariants}
                              initial="hidden"
                              animate="visible"
                              className="group hover:bg-slate-50/80 transition-colors border-b border-slate-50"
                            >
                              <TableCell className="py-5 font-black text-slate-900 px-8">{invoice.id}</TableCell>
                              <TableCell className="py-5 text-slate-600">
                                {new Date(invoice.date).toLocaleDateString('fr-FR')}
                              </TableCell>
                              <TableCell className="py-5">
                                <span className="font-bold text-slate-700">{supplier?.name || 'N/A'}</span>
                              </TableCell>
                              <TableCell className="py-5">
                                <div className="flex flex-wrap gap-1">
                                  {invoice.blReferences.map(ref => (
                                    <Badge key={ref} variant="outline" className="text-[10px] bg-white">
                                      {ref}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="py-5">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-900">{invoice.totalSent} envoyées</span>
                                  <span className="text-xs text-slate-500">{invoice.totalReceived} reçues</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-5">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-900">{Number(invoice.totalAmount || 0).toFixed(3)}</span>
                                  <span className="text-xs text-slate-500">Montant</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-5">
                                <Badge className={invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                                  {invoice.status === 'paid' ? 'Payée' : 'En attente'}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-5 text-right px-8">
                                <div className="flex items-center gap-2 justify-end">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handleDownloadInvoicePDF(invoice)}
                                    className="w-9 h-9 rounded-xl text-emerald-600 hover:bg-emerald-50 transition-all"
                                    title="Télécharger PDF"
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handleToggleInvoicePaid(invoice)}
                                    title={invoice.status === 'paid' ? 'Marquer comme en attente' : 'Marquer comme payée'}
                                    className={`w-9 h-9 rounded-xl transition-all ${invoice.status === 'paid' ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                                  >
                                    {invoice.status === 'paid' ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => {
                                      setEditingInvoice(invoice);
                                      setOriginalInvoiceId(invoice.id);
                                      setShowEditInvoice(true);
                                    }}
                                    className="w-9 h-9 rounded-xl text-blue-600 hover:bg-blue-50 transition-all"
                                    title="Modifier la facture"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => deleteInvoice(invoice.id)}
                                    className="w-9 h-9 rounded-xl text-rose-600 hover:bg-rose-50 transition-all"
                                    title="Supprimer la facture"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </motion.tr>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="py-20 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="p-4 bg-slate-50 rounded-full">
                                <History className="w-8 h-8 text-slate-200" />
                              </div>
                              <p className="text-slate-400 font-medium">Aucune facture générée</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
          <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total {historyTab === 'operations' ? 'opérations' : historyTab === 'settlements' ? 'règlements' : 'factures'}: {historyTab === 'operations' ? factoryOperations.length : historyTab === 'settlements' ? debtSettlements.length : invoices.length}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled className="h-9 rounded-lg border-slate-200 text-slate-400">Précédent</Button>
              <Button variant="outline" size="sm" className="h-9 w-9 rounded-lg bg-slate-900 text-white border-none shadow-md">1</Button>
              <Button variant="outline" size="sm" disabled className="h-9 rounded-lg border-slate-200 text-slate-400">Suivant</Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default Factory;
