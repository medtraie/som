import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { 
  FileText, 
  Download, 
  Filter, 
  Calendar,
  BarChart3,
  PieChart,
  TrendingUp,
  Package,
  Truck,
  Users,
  ArrowRightLeft,
  AlertTriangle,
  Activity,
  ThumbsUp,
  ThumbsDown,
  Info
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Revenue } from '@/types';

const Reports = () => {
  const { transactions, bottleTypes, trucks, drivers, exchanges, expenses, revenues, returnOrders, supplyOrders, repairs } = useApp();
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  });
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedTruck, setSelectedTruck] = useState('all');
  const [selectedDriver, setSelectedDriver] = useState('all');
  const [dailyReportDate, setDailyReportDate] = useState(new Date());
  const [dailyReportDriver, setDailyReportDriver] = useState('all');
  const [stockSearch, setStockSearch] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const [transactionSearch, setTransactionSearch] = useState('');
  const [analysisSearch, setAnalysisSearch] = useState('');
  const [showTransactions, setShowTransactions] = useState(true);
  const [transactionsSort, setTransactionsSort] = useState<'date_desc' | 'date_asc' | 'value_desc' | 'value_asc'>('date_desc');
  const [transactionsLimit, setTransactionsLimit] = useState<'25' | '50' | '100' | 'all'>('50');
  const [expandedTransactionId, setExpandedTransactionId] = useState<string | null>(null);

  // Filter transactions based on selected criteria
  const filteredTransactions = transactions.filter(transaction => {
    const transactionDate = new Date(transaction.date);
    const startDate = dateFilter.startDate ? new Date(dateFilter.startDate) : null;
    const endDate = dateFilter.endDate ? new Date(dateFilter.endDate) : null;

    if (startDate && transactionDate < startDate) return false;
    if (endDate && transactionDate > endDate) return false;
    if (selectedFilter !== 'all' && transaction.type !== selectedFilter) return false;
    if (selectedTruck !== 'all' && transaction.truckId !== selectedTruck) return false;
    if (selectedDriver !== 'all' && transaction.driverId !== selectedDriver) return false;

    if (transactionSearch) {
      const search = transactionSearch.toLowerCase();
      const dName = drivers.find((d) => d.id === transaction.driverId)?.name?.toLowerCase() || '';
      const trk = trucks.find((tr) => tr.id === transaction.truckId) as any;
      const tName = (trk?.name || trk?.plateNumber || trk?.registration || '')?.toLowerCase() || '';
      
      let cName = '';
      if (transaction.type === 'supply') {
        const order = supplyOrders.find(o => o.id === transaction.relatedOrderId || o.orderNumber === transaction.relatedOrderId);
        cName = order?.clientName?.toLowerCase() || '';
      } else if (transaction.type === 'return') {
        const order = returnOrders.find(o => o.id === transaction.relatedOrderId);
        cName = order?.clientName?.toLowerCase() || '';
      }

      return (
        dName.includes(search) ||
        tName.includes(search) ||
        cName.includes(search) ||
        transaction.type.toLowerCase().includes(search)
      );
    }

    return true;
  });

  // Calculate metrics
  const totalValue = filteredTransactions.reduce((sum, t) => sum + (t.totalValue || 0), 0);
  const transactionsByType = {
    supply: filteredTransactions.filter(t => t.type === 'supply').length,
    return: filteredTransactions.filter(t => t.type === 'return').length,
    exchange: filteredTransactions.filter(t => t.type === 'exchange').length,
    factory: filteredTransactions.filter(t => t.type === 'factory').length,
  };

  const sortedTransactions = React.useMemo(() => {
    const list = [...filteredTransactions] as any[];
    const getTime = (t: any) => new Date(t?.date || 0).getTime();
    const getValue = (t: any) => Number(t?.totalValue || 0);
    list.sort((a, b) => {
      if (transactionsSort === 'date_desc') return getTime(b) - getTime(a);
      if (transactionsSort === 'date_asc') return getTime(a) - getTime(b);
      if (transactionsSort === 'value_desc') return getValue(b) - getValue(a);
      return getValue(a) - getValue(b);
    });
    return list;
  }, [filteredTransactions, transactionsSort]);

  const visibleTransactions = React.useMemo(() => {
    if (transactionsLimit === 'all') return sortedTransactions;
    const limit = Number(transactionsLimit);
    return sortedTransactions.slice(0, limit);
  }, [sortedTransactions, transactionsLimit]);

  // Stock analysis
  const stockAnalysis = bottleTypes.map(bt => {
    const total = bt.totalQuantity || 0;
    const distributed = bt.distributedQuantity || 0;
    const remaining = bt.remainingQuantity || 0;
    const distributionRate = total > 0 ? (distributed / total) * 100 : 0;
    const value = remaining * (bt.unitPrice || 0);
    
    // Determine stock status
    let status = 'Sain';
    let statusColor = 'text-green-600';
    if (remaining === 0) {
      status = 'Épuisé';
      statusColor = 'text-red-600';
    } else if (remaining < 10) {
      status = 'Critique';
      statusColor = 'text-orange-600';
    } else if (remaining < 50) {
      status = 'Faible';
      statusColor = 'text-yellow-600';
    }

    return {
      name: bt.name,
      total,
      distributed,
      remaining,
      value,
      distributionRate,
      status,
      statusColor
    };
  });

  // Driver debt analysis
  const driverAnalysis = drivers.map(d => {
    const debt = d.debt || 0;
    const advances = d.advances || 0;
    const balance = d.balance || 0;
    
    // Status logic
    let status = 'Équilibré';
    let statusVariant: 'default' | 'destructive' | 'secondary' | 'outline' = 'secondary';
    
    if (balance < 0) {
      status = 'Dette';
      statusVariant = 'destructive';
    } else if (balance > 0) {
      status = 'Crédit';
      statusVariant = 'default';
    }

    return {
      id: d.id,
      name: d.name,
      debt,
      advances,
      balance,
      status,
      statusVariant
    };
  });

  const exportToPDF = () => {
    // Placeholder for PDF export functionality
    alert('Export PDF en cours de développement');
  };

  const exportToExcel = () => {
    // Placeholder for Excel export functionality
    alert('Export Excel en cours de développement');
  };


  const generateDailyExpenseReport = (currentExpenses: any[]) => {
    const reportDate = dailyReportDate.toISOString().slice(0, 10);
    const doc = new jsPDF();
    const generatedAt = new Date().toLocaleString('fr-FR');

    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 38, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Rapport Journalier des Notes de Frais', 14, 22);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date du rapport: ${reportDate}`, 14, 30);
    doc.text(`Généré le: ${generatedAt}`, 14, 35);

    const dailyExpenses = currentExpenses.filter(expense => 
      expense.date.slice(0, 10) === reportDate && expense.type === 'note de frais'
    );
    if (dailyExpenses.length === 0) {
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.text("Aucune note de frais pour cette sélection.", 14, 52);
      doc.save(`rapport_frais_${reportDate}.pdf`);
      return;
    }

    const expensesByDriver: Record<string, { driverName: string; expenses: any[] }> = {};
    const companyExpenses = {
        driverName: "Dette de l'entreprise",
        expenses: []
    };

    dailyExpenses.forEach(expense => {
      let processed = false;
      if (expense.returnOrderId) {
        const returnOrder = returnOrders.find(ro => ro.id === expense.returnOrderId);
        if (returnOrder) {
          const driver = drivers.find(d => d.id === returnOrder.driverId);
          if (driver) {
            if (!expensesByDriver[driver.id]) {
              expensesByDriver[driver.id] = {
                driverName: driver.name,
                expenses: []
              };
            }
            expensesByDriver[driver.id].expenses.push(expense);
            processed = true;
          }
        }
      }
      
      if (!processed) {
        companyExpenses.expenses.push(expense);
      }
    });

    const paymentTotals = dailyExpenses.reduce<Record<string, number>>((acc, exp) => {
      const key = String(exp.paymentMethod || 'inconnu');
      acc[key] = (acc[key] || 0) + (exp.amount || 0);
      return acc;
    }, {});

    const grandTotal = dailyExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const allGroupedExpenses: Array<{ driverName: string; expenses: any[] }> = [
      ...Object.values(expensesByDriver),
      ...(companyExpenses.expenses.length > 0 ? [companyExpenses] : []),
    ];

    const sortedGroups = allGroupedExpenses
      .map(g => ({
        ...g,
        expenses: [...g.expenses].sort((a, b) => (b.amount || 0) - (a.amount || 0)),
        total: g.expenses.reduce((s, e: any) => s + (e.amount || 0), 0),
      }))
      .sort((a, b) => (b.total || 0) - (a.total || 0));

    const tableColumn = ["Heure", "Référence", "Note", "Mode", "Montant (DH)"];
    const tableRows: any[] = [];

    sortedGroups.forEach((group) => {
      tableRows.push([
        { content: group.driverName, colSpan: 5, styles: { fillColor: [248, 250, 252], textColor: [30, 41, 59], fontStyle: 'bold' } }
      ]);

      group.expenses.forEach((expense: any) => {
        const timeStr = expense?.date ? new Date(expense.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
        const source = expense?.returnOrderId ? 'B.D' : '';
        const ref = expense?.returnOrderId ? `${source} ${String(expense.returnOrderId).slice(-6)}` : '';
        tableRows.push([
          timeStr,
          ref,
          expense?.note || '-',
          String(expense?.paymentMethod || '-'),
          (expense?.amount || 0).toFixed(2),
        ]);
      });

      tableRows.push([
        { content: 'Total', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: group.total.toFixed(2), styles: { halign: 'right', fontStyle: 'bold' } }
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 46,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 16 },
        1: { cellWidth: 28 },
        3: { cellWidth: 24 },
        4: { halign: 'right', cellWidth: 28, fontStyle: 'bold' }
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 46;
    const summaryY = finalY + 10;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, summaryY, 182, 22, 2, 2, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Total: ${grandTotal.toFixed(2)} DH`, 20, summaryY + 8);
    doc.setFont('helvetica', 'normal');
    const paymentSummary = Object.entries(paymentTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v.toFixed(2)} DH`)
      .join(' | ');
    doc.text(paymentSummary, 20, summaryY + 15, { maxWidth: 170 });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${i} / ${pageCount}`, 196, 290, { align: 'right' });
    }

    doc.save(`rapport_frais_${reportDate}.pdf`);
  };

  const generateDriverDebtReport = () => {
    const reportDate = dailyReportDate.toISOString().slice(0, 10);
    const doc = new jsPDF();
    const generatedAt = new Date().toLocaleString('fr-FR');

    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 38, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Rapport des Dettes des Chauffeurs', 14, 22);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date du rapport: ${reportDate}`, 14, 30);
    doc.text(`Généré le: ${generatedAt}`, 14, 35);

    const driversWithDebt = drivers.filter(driver => driver.debt > 0);

    if (driversWithDebt.length === 0) {
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.text("Aucun chauffeur avec des dettes.", 14, 52);
      doc.save(`rapport_dettes_${reportDate}.pdf`);
      return;
    }

    const sortedDrivers = [...driversWithDebt].sort((a, b) => (b.debt || 0) - (a.debt || 0));
    const totalDebt = sortedDrivers.reduce((sum, driver) => sum + (driver.debt || 0), 0);
    const avgDebt = totalDebt / Math.max(1, sortedDrivers.length);

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Chauffeurs en dette: ${sortedDrivers.length}`, 14, 50);
    doc.text(`Total: ${totalDebt.toFixed(2)} DH`, 110, 50);

    const tableColumn = ["#", "Chauffeur", "Dette (DH)", "Cumul (DH)", "Part"];
    const tableRows: any[] = [];

    let runningTotal = 0;
    sortedDrivers.forEach((driver, idx) => {
      const debt = driver.debt || 0;
      runningTotal += debt;
      const part = totalDebt > 0 ? `${((debt / totalDebt) * 100).toFixed(1)}%` : '0%';
      tableRows.push([
        String(idx + 1),
        driver.name || '-',
        debt.toFixed(2),
        runningTotal.toFixed(2),
        part,
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 56,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { cellWidth: 16, halign: 'right' },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY;
    const summaryY = finalY + 10;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, summaryY, 182, 18, 2, 2, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Total des dettes: ${totalDebt.toFixed(2)} DH`, 20, summaryY + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Moyenne: ${avgDebt.toFixed(2)} DH`, 20, summaryY + 13);

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${i} / ${pageCount}`, 196, 290, { align: 'right' });
    }


    doc.save(`rapport_dettes_${reportDate}.pdf`);
  };

  const generateMiscellaneousExpensesReport = () => {
    const reportDate = dailyReportDate.toISOString().slice(0, 10);
    const doc = new jsPDF();
    const generatedAt = new Date().toLocaleString('fr-FR');

    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 38, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Rapport des Dépenses Diverses', 14, 22);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date du rapport: ${reportDate}`, 14, 30);
    doc.text(`Généré le: ${generatedAt}`, 14, 35);

    const dailyExpenses = expenses.filter(expense => 
      expense.date.slice(0, 10) === reportDate && !expense.returnOrderId
    );

    if (dailyExpenses.length === 0) {
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.text("Aucune dépense diverse pour aujourd'hui.", 14, 52);
      doc.save(`rapport_depenses_diverses_${reportDate}.pdf`);
      return;
    }

    const sortedExpenses = [...dailyExpenses].sort((a, b) => (b.amount || 0) - (a.amount || 0));
    const paymentTotals = sortedExpenses.reduce<Record<string, number>>((acc, exp) => {
      const key = String(exp.paymentMethod || 'inconnu');
      acc[key] = (acc[key] || 0) + (exp.amount || 0);
      return acc;
    }, {});

    const totalAmount = sortedExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);

    const tableColumn = ["#", "Heure", "Type", "Mode", "Note", "Montant (DH)"];
    const tableRows: any[] = [];

    sortedExpenses.forEach((expense, idx) => {
      const timeStr = expense?.date ? new Date(expense.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
      tableRows.push([
        String(idx + 1),
        timeStr,
        expense.type || '-',
        String(expense.paymentMethod || '-'),
        expense.note || '-',
        (expense.amount || 0).toFixed(2),
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 46,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'right' },
        1: { cellWidth: 16 },
        5: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 46;
    const summaryY = finalY + 10;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, summaryY, 182, 22, 2, 2, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Total des dépenses: ${totalAmount.toFixed(2)} DH`, 20, summaryY + 8);
    doc.setFont('helvetica', 'normal');
    const paymentSummary = Object.entries(paymentTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v.toFixed(2)} DH`)
      .join(' | ');
    doc.text(paymentSummary, 20, summaryY + 15, { maxWidth: 170 });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${i} / ${pageCount}`, 196, 290, { align: 'right' });
    }

    doc.save(`rapport_depenses_diverses_${reportDate}.pdf`);
  };

  const generateTransportReport = () => {
    const reportDate = dailyReportDate.toISOString().slice(0, 10);
    const doc = new jsPDF();
    const generatedAt = new Date().toLocaleString('fr-FR');

    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 38, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Rapport Journalier des Dépenses de Transport', 14, 22);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date du rapport: ${reportDate}`, 14, 30);
    doc.text(`Généré le: ${generatedAt}`, 14, 35);

    // مقارنة التاريخ باليوم المحلي لمنع مشكلات المنطقة الزمنية
    const isSameDay = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
  
    // تضمين كل مصاريف النوع "transport" (من "Dépenses Diverses" ومن B.D) لليوم المختار
    const transportExpenses = expenses.filter(expense => {
      const expDate = new Date(expense.date);
      const type = (expense.type || '').toLowerCase().trim();
      return isSameDay(expDate, dailyReportDate) && type === 'transport';
    });
  
    if (transportExpenses.length === 0) {
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.text("Aucune dépense de transport pour aujourd'hui.", 14, 52);
      doc.save(`rapport_transport_${reportDate}.pdf`);
      return;
    }

    const sortedTransport = [...transportExpenses].sort((a, b) => {
      const ad = a?.date ? Date.parse(a.date) : 0;
      const bd = b?.date ? Date.parse(b.date) : 0;
      return ad - bd;
    });
    const paymentTotals = sortedTransport.reduce<Record<string, number>>((acc, exp) => {
      const key = String(exp.paymentMethod || 'inconnu');
      acc[key] = (acc[key] || 0) + (exp.amount || 0);
      return acc;
    }, {});
    const sourceTotals = sortedTransport.reduce<Record<string, number>>((acc, exp) => {
      const key = exp?.returnOrderId ? 'B.D' : 'Diverses';
      acc[key] = (acc[key] || 0) + (exp.amount || 0);
      return acc;
    }, {});
    const totalAmount = sortedTransport.reduce((sum, expense) => sum + (expense.amount || 0), 0);

    const tableColumn = ["#", "Heure", "Source", "Note", "Mode", "Montant (DH)"];
    const tableRows: any[] = [];
  
    sortedTransport.forEach((expense, idx) => {
      const timeStr = expense?.date ? new Date(expense.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
      const source = expense?.returnOrderId ? 'B.D' : 'Diverses';
      tableRows.push([
        String(idx + 1),
        timeStr,
        source,
        expense.note || '-',
        String(expense.paymentMethod || '-'),
        (expense.amount || 0).toFixed(2)
      ]);
    });
  
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 46,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'right' },
        1: { cellWidth: 16 },
        2: { cellWidth: 18 },
        4: { cellWidth: 22 },
        5: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 46;
    const summaryY = finalY + 10;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, summaryY, 182, 30, 2, 2, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Total transport: ${totalAmount.toFixed(2)} DH`, 20, summaryY + 8);
    doc.setFont('helvetica', 'normal');
    const sourceSummary = Object.entries(sourceTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v.toFixed(2)} DH`)
      .join(' | ');
    doc.text(sourceSummary, 20, summaryY + 15, { maxWidth: 170 });
    const paymentSummary = Object.entries(paymentTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v.toFixed(2)} DH`)
      .join(' | ');
    doc.text(paymentSummary, 20, summaryY + 22, { maxWidth: 170 });
  
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${i} / ${pageCount}`, 196, 290, { align: 'right' });
    }
  
    doc.save(`rapport_transport_${reportDate}.pdf`);
  };

  const generateGeneralReport = () => {
    const reportDate = dailyReportDate.toISOString().slice(0, 10);
    const doc = new jsPDF();
    let currentY = 20;

    // Title
    doc.setFontSize(18);
    doc.text(`Rapport Général Journalier`, 14, currentY);
    currentY += 10;
    doc.setFontSize(12);
    doc.text(`Date: ${reportDate}`, 14, currentY);
    currentY += 15;

    const isSameDay = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    // 1. Dépenses Diverses Total
    const dailyMiscExpenses = expenses.filter(expense => 
      expense.date.slice(0, 10) === reportDate && !expense.returnOrderId
    );
    const totalMisc = dailyMiscExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // 2. Transport Total
    const transportExpenses = expenses.filter(expense => {
      const expDate = new Date(expense.date);
      const type = (expense.type || '').toLowerCase().trim();
      return isSameDay(expDate, dailyReportDate) && type === 'transport';
    });
    const totalTransport = transportExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // 3. Dettes Chauffeurs Total
    const totalDebt = drivers.reduce((sum, driver) => sum + (driver.debt || 0), 0);

    // 4. Notes de Frais Total
    const dailyNotesExpenses = expenses.filter(expense => 
      expense.date.slice(0, 10) === reportDate && expense.type === 'note de frais'
    );
    const totalNotes = dailyNotesExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // 5. Paiements MYGAZ Total
    let totalMygaz = 0;
    const processedOrderIds = new Set<string>();
    drivers.forEach((driver) => {
      const driverReturnOrders = (returnOrders || []).filter((o: any) => {
        if (!o || !o.date) return false;
        const d = (o.date || '').slice(0, 10);
        return o.driverId === driver.id && d === reportDate;
      });

      driverReturnOrders.forEach((order: any) => {
        if (processedOrderIds.has(order.id)) return;
        processedOrderIds.add(order.id);

        const relatedRevenues = (revenues || []).filter((r: Revenue) => {
          if (r.relatedOrderId !== order.id || r.relatedOrderType !== 'return') return false;
          const rDate = (r.date || '').slice(0, 10);
          return rDate === reportDate;
        });
        
        if (relatedRevenues.length > 0) {
          const latestRevenue = [...relatedRevenues].sort(
            (a: Revenue, b: Revenue) => new Date(a.date).getTime() - new Date(b.date).getTime()
          )[relatedRevenues.length - 1];
          totalMygaz += (latestRevenue?.mygazAmount || 0);
        } else {
          totalMygaz += (order.paymentMygaz || 0);
        }
      });
    });

    const grandTotal = totalMisc + totalTransport + totalDebt + totalNotes + totalMygaz;

    const tableColumn = ["Désignation", "Montant (MAD)"];
    const tableRows = [
      ["Dépenses Diverses", totalMisc.toFixed(2)],
      ["Transport", totalTransport.toFixed(2)],
      ["Dettes Chauffeurs", totalDebt.toFixed(2)],
      ["Notes de Frais", totalNotes.toFixed(2)],
      ["Paiements MYGAZ", totalMygaz.toFixed(2)],
      [{ content: 'TOTAL', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, 
       { content: grandTotal.toFixed(2), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }]
    ];

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: currentY,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: {
        1: { halign: 'right' }
      },
      styles: { fontSize: 10, cellPadding: 5 }
    });

    doc.save(`rapport_general_${reportDate}.pdf`);
  };

  const generateDiversesReport = () => {
    const selectedDate = dailyReportDate.toISOString().split('T')[0];
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(`Rapport Ventes Diverses`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Date: ${selectedDate}`, 14, 22);

    const CONSIGNE_FEES: Record<string, number> = {
      'Butane 12KG': 50,
      'Butane 6KG': 40,
      'Butane 3KG': 30,
    };

    const tableColumn = ['Chauffeur', 'N° Bon', 'Produit', 'Quantité Consigne', 'Prix Unitaire', 'Total (MAD)'];
    const tableRows: any[] = [];
    let totalConsigneAmount = 0;

    const driversToReport =
      dailyReportDriver === 'all' ? drivers : drivers.filter((d) => d.id === dailyReportDriver);

    driversToReport.forEach((driver) => {
      const driverReturnOrders = (returnOrders || []).filter((o: any) => {
        const d = (o.date || '').slice(0, 10);
        return o.driverId === driver.id && d === selectedDate;
      });

      driverReturnOrders.forEach((order: any) => {
        (order.items || []).forEach((item: any) => {
          if ((item.consigneQuantity || 0) > 0) {
            const unitPrice = item.consignePrice || CONSIGNE_FEES[item.bottleTypeName] || 0;
            const total = item.consigneQuantity * unitPrice;
            tableRows.push([
              driver.name,
              order.orderNumber,
              item.bottleTypeName,
              item.consigneQuantity,
              unitPrice.toFixed(2),
              total.toFixed(2)
            ]);
            totalConsigneAmount += total;
          }
        });
      });
    });

    if (tableRows.length > 0) {
      tableRows.push([
        { content: 'TOTAL CONSIGNE (DÉPÔT)', colSpan: 5, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
        { content: totalConsigneAmount.toFixed(2), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 30,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 8 },
        columnStyles: {
          5: { halign: 'right' }
        }
      });
    } else {
      doc.text("Aucune vente de consigne trouvée pour cette sélection.", 14, 40);
    }

    doc.save(`rapport_diverses_${selectedDate}.pdf`);
  };

  const generateRepairsReport = () => {
    const selectedDate = dailyReportDate.toISOString().split('T')[0];
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(`Rapport des Réparations`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Date: ${selectedDate}`, 14, 22);

    const tableColumn = ['Véhicule', 'Type', 'Coût Total', 'Payé', 'Dette', 'Remarque'];
    const tableRows: any[] = [];
    
    let totalCostSum = 0;
    let totalPaidSum = 0;
    let totalDebtSum = 0;

    const dailyRepairs = (repairs || []).filter(r => r.date.slice(0, 10) === selectedDate);

    dailyRepairs.forEach(repair => {
      const truck = trucks.find(t => t.id === repair.truckId);
      const typeLabel = repair.type === 'mecanique' ? 'Mécanique' : repair.type === 'electrique' ? 'Électrique' : 'Garage';
      
      tableRows.push([
        truck?.matricule || 'N/A',
        typeLabel,
        repair.totalCost.toFixed(2),
        repair.paidAmount.toFixed(2),
        repair.debtAmount.toFixed(2),
        repair.remarks
      ]);

      totalCostSum += repair.totalCost;
      totalPaidSum += repair.paidAmount;
      totalDebtSum += repair.debtAmount;
    });

    if (tableRows.length > 0) {
      tableRows.push([
        { content: 'TOTAL', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
        { content: totalCostSum.toFixed(2), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
        { content: totalPaidSum.toFixed(2), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
        { content: totalDebtSum.toFixed(2), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
        ''
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 30,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 8 },
      });
    } else {
      doc.text("Aucune réparation trouvée pour cette date.", 14, 40);
    }

    doc.save(`rapport_reparations_${selectedDate}.pdf`);
  };

  const truckHealthAnalysis = trucks.map(truck => {
    const truckRepairs = (repairs || []).filter(r => r.truckId === truck.id);
    const totalRepairCost = truckRepairs.reduce((sum, r) => sum + r.totalCost, 0);
    const repairCount = truckRepairs.length;
    
    // Simple logic for health score (0-100)
    // Factors: repair frequency and cost
    let score = 100;
    if (repairCount > 5) score -= 20;
    if (repairCount > 10) score -= 30;
    if (totalRepairCost > 10000) score -= 20;
    if (totalRepairCost > 25000) score -= 30;
    
    score = Math.max(0, score);
    
    let status = 'Bonne';
    let color = 'text-green-600';
    let recommendation = 'Continuer l\'entretien régulier';
    
    if (score < 70) {
      status = 'Moyenne';
      color = 'text-yellow-600';
      recommendation = 'Surveiller les prochaines réparations';
    }
    if (score < 40) {
      status = 'Critique';
      color = 'text-red-600';
      recommendation = 'Envisager la vente ou le remplacement';
    }

    return {
      ...truck,
      totalRepairCost,
      repairCount,
      score,
      status,
      color,
      recommendation
    };
  }).sort((a, b) => a.score - b.score);

  const generateFleetHealthReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Analyse de Santé du Parc Automobile`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Date de génération: ${new Date().toLocaleDateString()}`, 14, 22);

    const tableColumn = ['Matricule', 'Réparations', 'Coût Total', 'Score', 'État', 'Recommandation'];
    const tableRows = truckHealthAnalysis.map(t => [
      t.matricule,
      t.repairCount,
      `${t.totalRepairCost.toFixed(2)} MAD`,
      `${t.score}/100`,
      t.status,
      t.recommendation
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 8 },
    });

    doc.save(`analyse_sante_flotte_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const pdfHeaderColor = [79, 70, 229] as const;
  const pdfTextColor = [30, 41, 59] as const;
  const pdfMutedTextColor = [148, 163, 184] as const;

  const addPdfHeader = (
    doc: jsPDF,
    title: string,
    lines: string[],
    fillColor: readonly [number, number, number] = pdfHeaderColor
  ) => {
    const pageWidth = (doc as any).internal.pageSize.getWidth();
    doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
    doc.rect(0, 0, pageWidth, 38, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(title, 14, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const baseY = 30;
    lines.slice(0, 2).forEach((line, idx) => {
      doc.text(line, 14, baseY + idx * 5);
    });
    doc.setTextColor(pdfTextColor[0], pdfTextColor[1], pdfTextColor[2]);
  };

  const addPdfPageNumbers = (doc: jsPDF) => {
    const pageCount = (doc as any).internal.getNumberOfPages();
    const pageWidth = (doc as any).internal.pageSize.getWidth();
    const pageHeight = (doc as any).internal.pageSize.getHeight();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(pdfMutedTextColor[0], pdfMutedTextColor[1], pdfMutedTextColor[2]);
      doc.text(`Page ${i} / ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
    }
    doc.setTextColor(pdfTextColor[0], pdfTextColor[1], pdfTextColor[2]);
  };

  const generateCombinedDriversReport = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const selectedDate = dailyReportDate.toISOString().split('T')[0];
    const driverName =
      dailyReportDriver === 'all'
        ? 'Tous'
        : drivers.find((d) => d.id === dailyReportDriver)?.name || 'Inconnu';

    const generatedAt = new Date().toLocaleString('fr-FR');
    addPdfHeader(doc, `Rapport Journalier des Chauffeurs`, [
      `Date du rapport: ${selectedDate}`,
      `Chauffeur: ${driverName} | Généré le: ${generatedAt}`,
    ]);

    const mapBottleKey = (name?: string) => {
      const n = (name || '').toLowerCase().replace(/\s+/g, '');
      if (n.includes('bng')) return 'bng';
      if (/(^|[^0-9])3kg($|[^0-9])/.test(n) || /3\s*kg/.test((name || '').toLowerCase())) return '3kg';
      if (/(^|[^0-9])6kg($|[^0-9])/.test(n) || /6\s*kg/.test((name || '').toLowerCase())) return '6kg';
      if (/(^|[^0-9])12kg($|[^0-9])/.test(n) || /12\s*kg/.test((name || '').toLowerCase())) return '12kg';
      if (/(^|[^0-9])34kg($|[^0-9])/.test(n) || /34\s*kg/.test((name || '').toLowerCase())) return '34kg';
      return '';
    };

    const tableColumn = ['Chauffeur', 'Type', '3kg', '6kg', '12kg', '34kg', 'BNG', 'Total unités', 'Chèque (DH)', 'Espèce (DH)'];
    const rowsForTable: {
      driverName: string;
      typeLabel: string;
      q3: number;
      q6: number;
      q12: number;
      q34: number;
      bng: number;
      totalUnits: number;
      cheque: number;
      espece: number;
      totalAmount: number;
    }[] = [];

    const driversToReport =
      dailyReportDriver === 'all' ? drivers : drivers.filter((d) => d.id === dailyReportDriver);

    driversToReport.forEach((driver) => {
      // 1. Petit Camion Data (All return orders for this driver today)
      const driverReturnOrders = (returnOrders || []).filter((o: any) => {
        if (!o || !o.date) return false;
        const d = (o.date || '').slice(0, 10);
        return o.driverId === driver.id && d === selectedDate;
      });

      const driverRevenues = (revenues || []).filter((r: any) => {
        const rDate = (r.date || '').slice(0, 10);
        if (rDate !== selectedDate) return false;
        if (r.relatedOrderType !== 'return' || !r.relatedOrderId) return false;
        const ro = (returnOrders || []).find((o: any) => o.id === r.relatedOrderId);
        return ro?.driverId === driver.id;
      });

      const quantities = { '3kg': 0, '6kg': 0, '12kg': 0, '34kg': 0, 'bng': 0 };

      driverReturnOrders.forEach((o: any) => {
        (o.items || []).forEach((item: any) => {
          const bt = bottleTypes.find((b) => b.id === item.bottleTypeId);
          const name = bt?.name || item.bottleTypeName || '';
          const key = mapBottleKey(name);
          const sold = (item.returnedEmptyQuantity || 0) + (item.consigneQuantity || 0);
          
          if (key && key in quantities) {
            quantities[key as keyof typeof quantities] += sold;
          }
        });
      });

      let cheque = 0;
      let espece = 0;

      if (driverRevenues.length > 0) {
        cheque = driverRevenues.reduce((sum: number, r: any) => sum + (r.checkAmount || r.totalCheque || 0), 0);
        espece = driverRevenues.reduce((sum: number, r: any) => sum + (r.cashAmount || r.totalCash || 0), 0);
      } else {
        cheque = driverReturnOrders.reduce((sum: number, o: any) => sum + (o.paymentCheque || 0), 0);
        espece = driverReturnOrders.reduce((sum: number, o: any) => sum + (o.paymentCash || 0), 0);
      }

      // 2. Identify if this is a "Camion" or "Petit Camion" row
      const isCamion = trucks.some(t => t.driverId === driver.id && t.truckType === 'camion');
      const typeLabel = isCamion ? 'Camion' : 'Petit Camion';
      const totalUnits = quantities['3kg'] + quantities['6kg'] + quantities['12kg'] + quantities['34kg'] + quantities['bng'];
      const totalAmount = cheque + espece;

      // Add row if data exists
      if (driverReturnOrders.length > 0 || totalAmount > 0 || totalUnits > 0) {
        rowsForTable.push({
          driverName: driver.name,
          typeLabel,
          q3: quantities['3kg'],
          q6: quantities['6kg'],
          q12: quantities['12kg'],
          q34: quantities['34kg'],
          bng: quantities['bng'],
          totalUnits,
          cheque,
          espece,
          totalAmount,
        });
      }
    });

    if (rowsForTable.length > 0) {
      const totals = rowsForTable.reduce(
        (acc, r) => {
          acc.sum3kg += r.q3;
          acc.sum6kg += r.q6;
          acc.sum12kg += r.q12;
          acc.sum34kg += r.q34;
          acc.sumBNG += r.bng;
          acc.sumUnits += r.totalUnits;
          acc.sumCheque += r.cheque;
          acc.sumEspece += r.espece;
          acc.sumAmount += r.totalAmount;
          return acc;
        },
        { sum3kg: 0, sum6kg: 0, sum12kg: 0, sum34kg: 0, sumBNG: 0, sumUnits: 0, sumCheque: 0, sumEspece: 0, sumAmount: 0 }
      );

      const sorted = [...rowsForTable].sort((a, b) => {
        if (b.totalUnits !== a.totalUnits) return b.totalUnits - a.totalUnits;
        return b.totalAmount - a.totalAmount;
      });

      const tableRows: any[] = sorted.map((r) => {
        return [
          r.driverName,
          r.typeLabel,
          r.q3,
          r.q6,
          r.q12,
          r.q34,
          r.bng,
          r.totalUnits,
          r.cheque.toFixed(2),
          r.espece.toFixed(2),
        ];
      });

      tableRows.push([
        'TOTAL',
        '',
        totals.sum3kg,
        totals.sum6kg,
        totals.sum12kg,
        totals.sum34kg,
        totals.sumBNG,
        totals.sumUnits,
        totals.sumCheque.toFixed(2),
        totals.sumEspece.toFixed(2),
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 46,
        theme: 'grid',
        headStyles: { fillColor: pdfHeaderColor as any, textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right', fontStyle: 'bold' },
          8: { halign: 'right' },
          9: { halign: 'right' },
        },
      });
      addPdfPageNumbers(doc);
    } else {
      doc.setFontSize(12);
      doc.text("Aucune donnée pour cette sélection.", 14, 52);
    }

    doc.save(`rapport_journalier_chauffeurs_${selectedDate}.pdf`);
  };

  const generateDailyPetitCamionReport = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const selectedDate = dailyReportDate.toISOString().split('T')[0];
    const driverName =
      dailyReportDriver === 'all'
        ? 'Tous'
        : drivers.find((d) => d.id === dailyReportDriver)?.name || 'Inconnu';
    const generatedAt = new Date().toLocaleString('fr-FR');
    addPdfHeader(doc, `Rapport Journalier Petit Camion - Bons d'Entrée (B.D)`, [
      `Date du rapport: ${selectedDate}`,
      `Chauffeur: ${driverName} | Généré le: ${generatedAt}`,
    ]);
  
    const tableColumn = ['Chauffeur', '3kg', '6kg', '12kg', '34kg', 'BNG', 'Total unités', 'Chèque (DH)', 'Espèce (DH)'];
    const rowsForTable: {
      driverName: string;
      q3: number;
      q6: number;
      q12: number;
      q34: number;
      bng: number;
      totalUnits: number;
      cheque: number;
      espece: number;
      totalAmount: number;
    }[] = [];
  
    const driversToReport =
      dailyReportDriver === 'all' ? drivers : drivers.filter((d) => d.id === dailyReportDriver);
  
    const mapBottleKey = (name: string) => {
      const n = (name || '').toLowerCase().replace(/\s+/g, '');
      if (n.includes('bng')) return 'bng';
      if (/(^|[^0-9])3kg($|[^0-9])/.test(n) || /3\s*kg/.test(name.toLowerCase())) return '3kg';
      if (/(^|[^0-9])6kg($|[^0-9])/.test(n) || /6\s*kg/.test(name.toLowerCase())) return '6kg';
      if (/(^|[^0-9])12kg($|[^0-9])/.test(n) || /12\s*kg/.test(name.toLowerCase())) return '12kg';
      if (/(^|[^0-9])34kg($|[^0-9])/.test(n) || /34\s*kg/.test(name.toLowerCase())) return '34kg';
      return '';
    };
  
    driversToReport.forEach((driver) => {
      const driverReturnOrders = (returnOrders || []).filter((o: any) => {
        if (!o || !o.date) return false;
        const d = new Date(o.date);
        return o.driverId === driver.id && d.toDateString() === dailyReportDate.toDateString();
      });
  
      const dailyDateString = selectedDate;
      const driverRevenues = (revenues || []).filter((r: any) => {
        const rDate = (r.date || '').slice(0, 10);
        if (rDate !== dailyDateString) return false;
        if (r.relatedOrderType !== 'return' || !r.relatedOrderId) return false;
        const ro = (returnOrders || []).find((o: any) => o.id === r.relatedOrderId);
        return ro?.driverId === driver.id;
      });
  
      const quantities = { '3kg': 0, '6kg': 0, '12kg': 0, '34kg': 0, 'bng': 0 };
  
      driverReturnOrders.forEach((o: any) => {
        (o.items || []).forEach((item: any) => {
          const bt = bottleTypes.find((b) => b.id === item.bottleTypeId);
          if (!bt) return;
          const key = mapBottleKey(bt.name);
          const sold = (item.returnedEmptyQuantity || 0) + (item.consigneQuantity || 0);
          if (key && key in quantities) {
            quantities[key as keyof typeof quantities] += sold;
          }
        });
      });
  
      let cheque = 0;
      let espece = 0;
  
      if (driverRevenues.length > 0) {
        cheque = driverRevenues.reduce((sum: number, r: any) => sum + (r.checkAmount || r.totalCheque || 0), 0);
        espece = driverRevenues.reduce((sum: number, r: any) => sum + (r.cashAmount || r.totalCash || 0), 0);
      } else {
        cheque = driverReturnOrders.reduce((sum: number, o: any) => sum + (o.paymentCheque || 0), 0);
        espece = driverReturnOrders.reduce((sum: number, o: any) => sum + (o.paymentCash || 0), 0);
      }
      const totalUnits = quantities['3kg'] + quantities['6kg'] + quantities['12kg'] + quantities['34kg'] + quantities['bng'];
      const totalAmount = cheque + espece;
  
      if (driverReturnOrders.length > 0 || totalAmount > 0 || totalUnits > 0) {
        rowsForTable.push({
          driverName: driver.name,
          q3: quantities['3kg'],
          q6: quantities['6kg'],
          q12: quantities['12kg'],
          q34: quantities['34kg'],
          bng: quantities['bng'],
          totalUnits,
          cheque,
          espece,
          totalAmount,
        });
      }
    });
    if (rowsForTable.length === 0) {
      doc.setFontSize(12);
      doc.text("Aucune donnée pour cette sélection.", 14, 52);
      doc.save(`rapport_petit_camion_${selectedDate}.pdf`);
      return;
    }

    const totals = rowsForTable.reduce(
      (acc, r) => {
        acc.sum3kg += r.q3;
        acc.sum6kg += r.q6;
        acc.sum12kg += r.q12;
        acc.sum34kg += r.q34;
        acc.sumBNG += r.bng;
        acc.sumUnits += r.totalUnits;
        acc.sumCheque += r.cheque;
        acc.sumEspece += r.espece;
        acc.sumAmount += r.totalAmount;
        return acc;
      },
      { sum3kg: 0, sum6kg: 0, sum12kg: 0, sum34kg: 0, sumBNG: 0, sumUnits: 0, sumCheque: 0, sumEspece: 0, sumAmount: 0 }
    );

    const sorted = [...rowsForTable].sort((a, b) => {
      if (b.totalUnits !== a.totalUnits) return b.totalUnits - a.totalUnits;
      return b.totalAmount - a.totalAmount;
    });

    const tableRows: any[] = sorted.map((r) => {
      return [
        r.driverName,
        r.q3,
        r.q6,
        r.q12,
        r.q34,
        r.bng,
        r.totalUnits,
        r.cheque.toFixed(2),
        r.espece.toFixed(2),
      ];
    });

    tableRows.push([
      'TOTAL',
      totals.sum3kg,
      totals.sum6kg,
      totals.sum12kg,
      totals.sum34kg,
      totals.sumBNG,
      totals.sumUnits,
      totals.sumCheque.toFixed(2),
      totals.sumEspece.toFixed(2),
    ]);
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 46,
      theme: 'grid',
      headStyles: { fillColor: pdfHeaderColor as any, textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right', fontStyle: 'bold' },
        7: { halign: 'right' },
        8: { halign: 'right' },
      },
    });
    addPdfPageNumbers(doc);

    doc.save(`rapport_petit_camion_${selectedDate}.pdf`);
  };

  // 1. Analysis of Foreign Bottles by Driver
  const foreignBottlesAnalysis = drivers.map(driver => {
    const driverReturnOrders = (returnOrders || []).filter(o => o.driverId === driver.id);
    const foreignData = {
      total: 0,
      byType: {} as Record<string, number>,
      history: [] as { date: string, orderNumber: string, quantity: number, bottleType: string }[]
    };

    driverReturnOrders.forEach(order => {
      (order.items || []).forEach(item => {
        if ((item.foreignQuantity || 0) > 0) {
          foreignData.total += item.foreignQuantity;
          foreignData.byType[item.bottleTypeName] = (foreignData.byType[item.bottleTypeName] || 0) + item.foreignQuantity;
          foreignData.history.push({
            date: order.date,
            orderNumber: order.orderNumber,
            quantity: item.foreignQuantity,
            bottleType: item.bottleTypeName
          });
        }
      });
    });

    return {
      driverId: driver.id,
      driverName: driver.name,
      ...foreignData
    };
  }).filter(d => d.total > 0);

  // 2. Analysis of Remaining Bottles (R.C / Lost) by Driver
  const rcBottlesAnalysis = drivers.map(driver => {
    const driverReturnOrders = (returnOrders || []).filter(o => o.driverId === driver.id);
    const rcData = {
      total: 0,
      byType: {} as Record<string, number>,
      history: [] as { date: string, orderNumber: string, quantity: number, bottleType: string }[]
    };

    driverReturnOrders.forEach(order => {
      (order.items || []).forEach(item => {
        if ((item.lostQuantity || 0) > 0) {
          rcData.total += item.lostQuantity;
          rcData.byType[item.bottleTypeName] = (rcData.byType[item.bottleTypeName] || 0) + item.lostQuantity;
          rcData.history.push({
            date: order.date,
            orderNumber: order.orderNumber,
            quantity: item.lostQuantity,
            bottleType: item.bottleTypeName
          });
        }
      });
    });

    return {
      driverId: driver.id,
      driverName: driver.name,
      ...rcData
    };
  }).filter(d => d.total > 0);

  const generateForeignBottlesReport = () => {
    const doc = new jsPDF();
    const generatedAt = new Date().toLocaleString('fr-FR');
    const filterLabel = analysisSearch.trim() ? analysisSearch.trim() : 'Aucun';
    const filtered = foreignBottlesAnalysis
      .filter(d => d.driverName.toLowerCase().includes(analysisSearch.toLowerCase()))
      .sort((a, b) => (b.total || 0) - (a.total || 0));

    addPdfHeader(doc, `Rapport des Bouteilles Étrangères par Chauffeur`, [
      `Généré le: ${generatedAt}`,
      `Filtre chauffeur: ${filterLabel}`,
    ]);

    if (filtered.length === 0) {
      doc.setFontSize(12);
      doc.text("Aucune bouteille étrangère détectée pour cette sélection.", 14, 52);
      doc.save(`rapport_bouteilles_etrangeres_${new Date().toISOString().slice(0, 10)}.pdf`);
      return;
    }

    const totalForeign = filtered.reduce((sum, d) => sum + (d.total || 0), 0);
    const topDriver = filtered[0]?.driverName || '-';
    const topDriverTotal = filtered[0]?.total || 0;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Total étrangers: ${totalForeign}`, 14, 48);
    doc.text(`Chauffeurs impactés: ${filtered.length}`, 80, 48);
    doc.text(`Top: ${topDriver} (${topDriverTotal})`, 150, 48);
    doc.setFont('helvetica', 'normal');

    const overviewRows: any[] = filtered.map((d) => {
      const pct = totalForeign > 0 ? ((d.total || 0) / totalForeign) * 100 : 0;
      const typesStr = Object.entries(d.byType || {})
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
        .slice(0, 4)
        .map(([type, qty]) => `${qty} ${type}`)
        .join(' | ');
      return [
        d.driverName,
        d.total || 0,
        `${pct.toFixed(1)}%`,
        typesStr || '-',
      ];
    });

    autoTable(doc, {
      head: [['Chauffeur', 'Total', '%', 'Top types']],
      body: overviewRows,
      startY: 54,
      theme: 'grid',
      headStyles: { fillColor: pdfHeaderColor as any, textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        1: { halign: 'right', fontStyle: 'bold' },
        2: { halign: 'right' },
      },
    });

    const afterOverviewY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 120;

    const detailsRows: any[] = [];
    filtered.forEach((d) => {
      detailsRows.push([
        { content: `${d.driverName} — Total: ${d.total}`, colSpan: 3, styles: { fillColor: [248, 250, 252], textColor: pdfTextColor as any, fontStyle: 'bold' } },
      ]);
      const types = Object.entries(d.byType || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0));
      types.forEach(([type, qty]) => {
        detailsRows.push([type, qty, '']);
      });
      if (types.length === 0) {
        detailsRows.push(['-', 0, '']);
      }
    });

    autoTable(doc, {
      head: [['Type', 'Qté', '']],
      body: detailsRows,
      startY: afterOverviewY,
      theme: 'grid',
      headStyles: { fillColor: [241, 245, 249], textColor: pdfTextColor as any, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    });

    const history = filtered
      .flatMap((d) =>
        (d.history || []).map((h) => ({
          driverName: d.driverName,
          date: h.date,
          orderNumber: h.orderNumber,
          bottleType: h.bottleType,
          quantity: h.quantity,
        }))
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (history.length > 0) {
      doc.addPage();
      addPdfHeader(doc, `Historique — Bouteilles Étrangères`, [
        `Généré le: ${generatedAt}`,
        `Filtre chauffeur: ${filterLabel}`,
      ]);

      const historyRows = history.map((h) => ([
        new Date(h.date).toLocaleDateString('fr-FR'),
        h.driverName,
        h.orderNumber,
        h.bottleType,
        Number(h.quantity || 0),
      ]));

      autoTable(doc, {
        head: [['Date', 'Chauffeur', 'N° Bon', 'Type', 'Qté']],
        body: historyRows,
        startY: 46,
        theme: 'grid',
        headStyles: { fillColor: pdfHeaderColor as any, textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } },
      });
    }

    addPdfPageNumbers(doc);
    doc.save(`rapport_bouteilles_etrangeres_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const generateRCReport = () => {
    const doc = new jsPDF();
    const generatedAt = new Date().toLocaleString('fr-FR');
    const filterLabel = analysisSearch.trim() ? analysisSearch.trim() : 'Aucun';
    const filtered = rcBottlesAnalysis
      .filter(d => d.driverName.toLowerCase().includes(analysisSearch.toLowerCase()))
      .sort((a, b) => (b.total || 0) - (a.total || 0));

    addPdfHeader(
      doc,
      `Rapport des Bouteilles Restantes (R.C) par Chauffeur`,
      [`Généré le: ${generatedAt}`, `Filtre chauffeur: ${filterLabel}`],
      [231, 76, 60]
    );

    if (filtered.length === 0) {
      doc.setFontSize(12);
      doc.text("Aucun R.C (perte) détecté pour cette sélection.", 14, 52);
      doc.save(`rapport_rc_bouteilles_${new Date().toISOString().slice(0, 10)}.pdf`);
      return;
    }

    const totalRC = filtered.reduce((sum, d) => sum + (d.total || 0), 0);
    const topDriver = filtered[0]?.driverName || '-';
    const topDriverTotal = filtered[0]?.total || 0;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Total R.C: ${totalRC}`, 14, 48);
    doc.text(`Chauffeurs impactés: ${filtered.length}`, 80, 48);
    doc.text(`Top: ${topDriver} (${topDriverTotal})`, 150, 48);
    doc.setFont('helvetica', 'normal');

    const overviewRows: any[] = filtered.map((d) => {
      const pct = totalRC > 0 ? ((d.total || 0) / totalRC) * 100 : 0;
      const typesStr = Object.entries(d.byType || {})
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
        .slice(0, 4)
        .map(([type, qty]) => `${qty} ${type}`)
        .join(' | ');
      return [
        d.driverName,
        d.total || 0,
        `${pct.toFixed(1)}%`,
        typesStr || '-',
      ];
    });

    autoTable(doc, {
      head: [['Chauffeur', 'Total', '%', 'Top types']],
      body: overviewRows,
      startY: 54,
      theme: 'grid',
      headStyles: { fillColor: [231, 76, 60], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        1: { halign: 'right', fontStyle: 'bold' },
        2: { halign: 'right' },
      },
    });

    const afterOverviewY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 120;

    const detailsRows: any[] = [];
    filtered.forEach((d) => {
      detailsRows.push([
        { content: `${d.driverName} — Total: ${d.total}`, colSpan: 3, styles: { fillColor: [254, 242, 242], textColor: pdfTextColor as any, fontStyle: 'bold' } },
      ]);
      const types = Object.entries(d.byType || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0));
      types.forEach(([type, qty]) => {
        detailsRows.push([type, qty, '']);
      });
      if (types.length === 0) {
        detailsRows.push(['-', 0, '']);
      }
    });

    autoTable(doc, {
      head: [['Type', 'Qté', '']],
      body: detailsRows,
      startY: afterOverviewY,
      theme: 'grid',
      headStyles: { fillColor: [254, 226, 226], textColor: pdfTextColor as any, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    });

    const history = filtered
      .flatMap((d) =>
        (d.history || []).map((h) => ({
          driverName: d.driverName,
          date: h.date,
          orderNumber: h.orderNumber,
          bottleType: h.bottleType,
          quantity: h.quantity,
        }))
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (history.length > 0) {
      doc.addPage();
      addPdfHeader(
        doc,
        `Historique — Bouteilles Restantes (R.C)`,
        [`Généré le: ${generatedAt}`, `Filtre chauffeur: ${filterLabel}`],
        [231, 76, 60]
      );

      const historyRows = history.map((h) => ([
        new Date(h.date).toLocaleDateString('fr-FR'),
        h.driverName,
        h.orderNumber,
        h.bottleType,
        Number(h.quantity || 0),
      ]));

      autoTable(doc, {
        head: [['Date', 'Chauffeur', 'N° Bon', 'Type', 'Qté']],
        body: historyRows,
        startY: 46,
        theme: 'grid',
        headStyles: { fillColor: [231, 76, 60], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } },
      });
    }

    addPdfPageNumbers(doc);
    doc.save(`rapport_rc_bouteilles_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const renderAnalysisSection = () => {
    const totalForeign = foreignBottlesAnalysis.reduce((sum, d) => sum + d.total, 0);
    const totalRC = rcBottlesAnalysis.reduce((sum, d) => sum + d.total, 0);

    return (
      <div className="space-y-6">
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <Package className="w-6 h-6 text-orange-600" />
                Suivi d'impact du stock
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Analyse des pertes (R.C) et des bouteilles étrangères par chauffeur</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Filter className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrer par chauffeur..."
                  className="pl-8 h-9"
                  value={analysisSearch}
                  onChange={(e) => setAnalysisSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-center gap-4">
                <div className="bg-orange-500 p-3 rounded-lg text-white">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-orange-800 text-xs font-bold uppercase tracking-wider">Impact Global</div>
                  <div className="text-2xl font-black text-orange-900">{totalForeign + totalRC}</div>
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center gap-4">
                <div className="bg-blue-500 p-3 rounded-lg text-white">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-blue-800 text-xs font-bold uppercase tracking-wider">Étrangères Total</div>
                  <div className="text-2xl font-black text-blue-900">{totalForeign}</div>
                </div>
              </div>
              <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center gap-4">
                <div className="bg-red-500 p-3 rounded-lg text-white">
                  <ArrowRightLeft className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-red-800 text-xs font-bold uppercase tracking-wider">R.C (Pertes) Total</div>
                  <div className="text-2xl font-black text-red-900">{totalRC}</div>
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center gap-4">
                <div className="bg-green-500 p-3 rounded-lg text-white">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-green-800 text-xs font-bold uppercase tracking-wider">Chauffeurs Impactés</div>
                  <div className="text-2xl font-black text-green-900">
                    {new Set([...foreignBottlesAnalysis.map(d => d.driverId), ...rcBottlesAnalysis.map(d => d.driverId)]).size}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Foreign Bottles Analysis */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-blue-700">
                    <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
                    Bouteilles Étrangères
                  </h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={generateForeignBottlesReport}
                    disabled={foreignBottlesAnalysis.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {foreignBottlesAnalysis
                    .filter(d => d.driverName.toLowerCase().includes(analysisSearch.toLowerCase()))
                    .map(d => (
                      <div key={d.driverId} className="group p-4 bg-white border rounded-xl hover:shadow-md transition-all border-blue-100 hover:border-blue-300">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{d.driverName}</span>
                            <div className="flex gap-1 mt-1">
                              {Object.entries(d.byType).map(([type, qty]) => (
                                <Badge key={type} variant="secondary" className="text-[10px] py-0 bg-blue-50 text-blue-700 border-blue-100">
                                  {qty} {type}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-black text-blue-600">{d.total}</span>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Unités</p>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-blue-500 h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, (d.total / totalForeign) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  {foreignBottlesAnalysis.length === 0 && (
                    <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed">
                      <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Aucune bouteille étrangère détectée.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* R.C Bottles Analysis */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-red-700">
                    <div className="w-2 h-6 bg-red-500 rounded-full"></div>
                    Suivi des Restants (R.C)
                  </h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={generateRCReport}
                    disabled={rcBottlesAnalysis.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {rcBottlesAnalysis
                    .filter(d => d.driverName.toLowerCase().includes(analysisSearch.toLowerCase()))
                    .map(d => (
                      <div key={d.driverId} className="group p-4 bg-white border rounded-xl hover:shadow-md transition-all border-red-100 hover:border-red-300">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-sm font-bold text-gray-900 group-hover:text-red-700 transition-colors">{d.driverName}</span>
                            <div className="flex gap-1 mt-1">
                              {Object.entries(d.byType).map(([type, qty]) => (
                                <Badge key={type} variant="secondary" className="text-[10px] py-0 bg-red-50 text-red-700 border-red-100">
                                  {qty} {type}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-black text-red-600">{d.total}</span>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Unités</p>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-red-500 h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, (d.total / totalRC) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  {rcBottlesAnalysis.length === 0 && (
                    <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed">
                      <ArrowRightLeft className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Aucun R.C (perte) détecté.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const generateMygazReport = () => {
    const doc = new jsPDF();
    const selectedDate = dailyReportDate.toISOString().split('T')[0];
    const driverName =
      dailyReportDriver === 'all'
        ? 'Tous'
        : drivers.find((d) => d.id === dailyReportDriver)?.name || 'Inconnu';

    const generatedAt = new Date().toLocaleString('fr-FR');
    addPdfHeader(doc, `Rapport des Paiements MYGAZ`, [
      `Date du rapport: ${selectedDate}`,
      `Chauffeur: ${driverName} | Généré le: ${generatedAt}`,
    ]);

    const tableColumn = ['Chauffeur', 'N° Bon', 'Total Bon', 'Montant MYGAZ', 'Autre (Esp/Chq)', 'Dette'];
    const tableRows: any[] = [];

    let totalMygaz = 0;
    let totalBons = 0;
    let totalAutre = 0;
    let totalDette = 0;

    const driversToReport =
      dailyReportDriver === 'all' ? drivers : drivers.filter((d) => d.id === dailyReportDriver);

    const processedOrderIds = new Set<string>();

    driversToReport.forEach((driver) => {
      const driverReturnOrders = (returnOrders || []).filter((o: any) => {
        if (!o || !o.date) return false;
        const d = (o.date || '').slice(0, 10);
        return o.driverId === driver.id && d === selectedDate;
      });

      driverReturnOrders.forEach((order: any) => {
        if (processedOrderIds.has(order.id)) return;
        processedOrderIds.add(order.id);

        const relatedRevenues = (revenues || []).filter((r: Revenue) => {
          if (r.relatedOrderId !== order.id || r.relatedOrderType !== 'return') return false;
          const rDate = (r.date || '').slice(0, 10);
          return rDate === selectedDate;
        });
        
        let mygaz = 0;
        let cash = 0;
        let check = 0;
        const debt = order.paymentDebt || 0;
        const total = order.paymentTotal || 0;

        if (relatedRevenues.length > 0) {
          const latestRevenue = [...relatedRevenues].sort(
            (a: Revenue, b: Revenue) => new Date(a.date).getTime() - new Date(b.date).getTime()
          )[relatedRevenues.length - 1];
          mygaz = (latestRevenue?.mygazAmount || 0);
          cash = (latestRevenue?.cashAmount || latestRevenue?.totalCash || 0);
          check = (latestRevenue?.checkAmount || latestRevenue?.totalCheque || 0);
        } else {
          mygaz = order.paymentMygaz || 0;
          cash = order.paymentCash || 0;
          check = order.paymentCheque || 0;
        }

        if (mygaz > 0) {
          tableRows.push([
            driver.name,
            order.orderNumber,
            total.toFixed(2),
            mygaz.toFixed(2),
            (cash + check).toFixed(2),
            debt.toFixed(2)
          ]);
          totalMygaz += mygaz;
          totalBons += total;
          totalAutre += (cash + check);
          totalDette += debt;
        }
      });
    });

    if (tableRows.length > 0) {
      tableRows.sort((a, b) => {
        const mygazA = Number(a[3] || 0);
        const mygazB = Number(b[3] || 0);
        if (mygazB !== mygazA) return mygazB - mygazA;
        const totalA = Number(a[2] || 0);
        const totalB = Number(b[2] || 0);
        return totalB - totalA;
      });
      tableRows.push([
        'TOTAL',
        '',
        totalBons.toFixed(2),
        totalMygaz.toFixed(2),
        totalAutre.toFixed(2),
        totalDette.toFixed(2)
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 46,
        theme: 'grid',
        headStyles: { fillColor: pdfHeaderColor as any, textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          2: { halign: 'right', fontStyle: 'bold' },
          3: { halign: 'right', fontStyle: 'bold' },
          4: { halign: 'right' },
          5: { halign: 'right' },
        },
      });
      addPdfPageNumbers(doc);
    } else {
      doc.setFontSize(12);
      doc.text("Aucun paiement MYGAZ trouvé pour cette sélection.", 14, 52);
    }

    doc.save(`rapport_mygaz_${selectedDate}.pdf`);
  };

  const generateDriversSupplyReturnReport = () => {
    const selectedDate = dailyReportDate.toISOString().split('T')[0];
    const doc = new jsPDF({ orientation: 'landscape' });
    const driverFilterLabel = dailyReportDriver === 'all' ? 'Tous' : (drivers.find(d => d.id === dailyReportDriver)?.name || 'Inconnu');
    const generatedAt = new Date().toLocaleString('fr-FR');
    addPdfHeader(doc, `Historique des Bons d'Entrée (B.D) — Camions`, [
      `Date du rapport: ${selectedDate}`,
      `Filtre chauffeur: ${driverFilterLabel} | Généré le: ${generatedAt}`,
    ]);

    const hasCamion = (driverId: string) => trucks.some(t => t.driverId === driverId && t.truckType === 'camion');
    const driversToReport =
      dailyReportDriver === 'all'
        ? drivers.filter(d => hasCamion(d.id))
        : drivers.filter(d => d.id === dailyReportDriver && hasCamion(d.id));

    const mapBottleKey = (name?: string) => {
      const n = (name || '').toLowerCase().replace(/\s+/g, '');
      if (n.includes('bng')) return 'bng';
      if (/(^|[^0-9])3kg($|[^0-9])/.test(n) || /3\s*kg/.test(name.toLowerCase())) return '3kg';
      if (/(^|[^0-9])6kg($|[^0-9])/.test(n) || /6\s*kg/.test(name.toLowerCase())) return '6kg';
      if (/(^|[^0-9])12kg($|[^0-9])/.test(n) || /12\s*kg/.test(name.toLowerCase())) return '12kg';
      if (/(^|[^0-9])34kg($|[^0-9])/.test(n) || /34\s*kg/.test(name.toLowerCase())) return '34kg';
      return '';
    };

    const tableColumn = ['Chauffeur', 'N° Bon', 'Client', '3kg', '6kg', '12kg', '34kg', 'BNG', 'Total unités', 'Chèque (DH)', 'Espèce (DH)', 'Dette (DH)'];
    const tableRows: any[] = [];

    let sum3kg = 0, sum6kg = 0, sum12kg = 0, sum34kg = 0, sumBNG = 0, sumUnits = 0;
    let sumCheque = 0, sumEspece = 0, sumDette = 0;

    driversToReport.forEach(driver => {
      const roForDriver = (returnOrders || []).filter((o: any) => {
        const d = (o.date || '').slice(0, 10);
        return d === selectedDate && o.driverId === driver.id;
      });

      roForDriver.forEach((order: any) => {
        const quantities: Record<'3kg' | '6kg' | '12kg' | '34kg' | 'bng', number> = {
          '3kg': 0, '6kg': 0, '12kg': 0, '34kg': 0, 'bng': 0
        };

        (order.items || []).forEach((item: any) => {
          const name =
            item.bottleTypeName ||
            bottleTypes.find((b: any) => b.id === item.bottleTypeId)?.name ||
            '';
          const key = mapBottleKey(name);
          const sold = (item.returnedEmptyQuantity || 0) + (item.consigneQuantity || 0);
          if (key && quantities[key as keyof typeof quantities] !== undefined) {
            quantities[key as keyof typeof quantities] += sold;
          }
        });

        const relatedRevenues = (revenues || []).filter((r: any) => {
          const rDate = (r.date || '').slice(0, 10);
          if (rDate !== selectedDate) return false;
          return r.relatedOrderType === 'return' && r.relatedOrderId === order.id;
        });

        let cheque = 0;
        let espece = 0;
        if (relatedRevenues.length > 0) {
          cheque = relatedRevenues.reduce((sum: number, r: any) => sum + (r.checkAmount || r.totalCheque || 0), 0);
          espece = relatedRevenues.reduce((sum: number, r: any) => sum + (r.cashAmount || r.totalCash || 0), 0);
        } else {
          cheque = order.paymentCheque || 0;
          espece = order.paymentCash || 0;
        }

        const debt = order.paymentDebt || 0;
        const totalUnits = quantities['3kg'] + quantities['6kg'] + quantities['12kg'] + quantities['34kg'] + quantities['bng'];

        tableRows.push([
          driver.name,
          order.orderNumber || '',
          order.clientName || '-',
          quantities['3kg'],
          quantities['6kg'],
          quantities['12kg'],
          quantities['34kg'],
          quantities['bng'],
          totalUnits,
          cheque.toFixed(2),
          espece.toFixed(2),
          debt.toFixed(2),
        ]);

        sum3kg += quantities['3kg'];
        sum6kg += quantities['6kg'];
        sum12kg += quantities['12kg'];
        sum34kg += quantities['34kg'];
        sumBNG += quantities['bng'];
        sumUnits += totalUnits;
        sumCheque += cheque;
        sumEspece += espece;
        sumDette += debt;
      });
    });

    if (tableRows.length === 0) {
      doc.setFontSize(12);
      doc.text("Aucune donnée B.D pour la sélection.", 14, 52);
      doc.save(`historique_bd_camions_${selectedDate}.pdf`);
      return;
    }

    tableRows.sort((a, b) => {
      const driverA = String(a[0] || '');
      const driverB = String(b[0] || '');
      if (driverA !== driverB) return driverA.localeCompare(driverB, 'fr');
      return String(a[1] || '').localeCompare(String(b[1] || ''), 'fr');
    });

    tableRows.push([
      'TOTAL',
      '',
      '',
      sum3kg,
      sum6kg,
      sum12kg,
      sum34kg,
      sumBNG,
      sumUnits,
      sumCheque.toFixed(2),
      sumEspece.toFixed(2),
      sumDette.toFixed(2),
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 46,
      theme: 'grid',
      headStyles: { fillColor: pdfHeaderColor as any, textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right', fontStyle: 'bold' },
        9: { halign: 'right' },
        10: { halign: 'right' },
        11: { halign: 'right' },
      },
    });
    addPdfPageNumbers(doc);

    doc.save(`historique_bd_camions_${selectedDate}.pdf`);
  };
  // عادة بناء واجهة صفحة التقارير داخل return
  return (
      <div className="space-y-6">
          {/* فلاتر عامة */}
          <Card>
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                      <Filter className="w-5 h-5" />
                      Filtres
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="grid md:grid-cols-5 gap-4">
                      <div>
                          <Label>Début</Label>
                          <Input
                              type="date"
                              value={dateFilter.startDate}
                              onChange={(e) =>
                                  setDateFilter((prev) => ({ ...prev, startDate: e.target.value }))
                              }
                          />
                      </div>
                      <div>
                          <Label>Fin</Label>
                          <Input
                              type="date"
                              value={dateFilter.endDate}
                              onChange={(e) =>
                                  setDateFilter((prev) => ({ ...prev, endDate: e.target.value }))
                              }
                          />
                      </div>
                      <div>
                          <Label>Type</Label>
                          <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                              <SelectTrigger>
                                  <SelectValue placeholder="Tous" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="all">Tous</SelectItem>
                                  <SelectItem value="supply">Alimentation</SelectItem>
                                  <SelectItem value="return">Retour</SelectItem>
                                  <SelectItem value="exchange">Échange</SelectItem>
                                  <SelectItem value="factory">Usine</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      <div>
                          <Label>Camion</Label>
                          <Select value={selectedTruck} onValueChange={setSelectedTruck}>
                              <SelectTrigger>
                                  <SelectValue placeholder="Tous" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="all">Tous</SelectItem>
                                  {trucks.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                      {(t as any).name || (t as any).plateNumber || (t as any).registration || t.id}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </div>
                      <div>
                          <Label>Chauffeur</Label>
                          <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                              <SelectTrigger>
                                  <SelectValue placeholder="Tous" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="all">Tous</SelectItem>
                                  {drivers.map((d) => (
                                    <SelectItem key={d.id} value={d.id}>
                                      {d.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </div>
                  </div>
              </CardContent>
          </Card>
  
          {/* Analyse des Bouteilles Étrangères et R.C */}
          {renderAnalysisSection()}

          {/* Analyse de Santé de la Flotte */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Analyse Intelligente de la Flotte
              </CardTitle>
              <Button onClick={generateFleetHealthReport} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Rapport Santé PDF
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-2 text-blue-800 font-semibold mb-1">
                    <Truck className="w-4 h-4" />
                    Total Véhicules
                  </div>
                  <div className="text-2xl font-bold text-blue-900">{trucks.length}</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                  <div className="flex items-center gap-2 text-red-800 font-semibold mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    Véhicules Critiques
                  </div>
                  <div className="text-2xl font-bold text-red-900">
                    {truckHealthAnalysis.filter(t => t.score < 40).length}
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <div className="flex items-center gap-2 text-green-800 font-semibold mb-1">
                    <ThumbsUp className="w-4 h-4" />
                    Véhicules en Bon État
                  </div>
                  <div className="text-2xl font-bold text-green-900">
                    {truckHealthAnalysis.filter(t => t.score >= 70).length}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b bg-gray-50">
                      <th className="p-2">Véhicule</th>
                      <th className="p-2">Nb Réparations</th>
                      <th className="p-2">Coût Total</th>
                      <th className="p-2">Santé</th>
                      <th className="p-2">État</th>
                      <th className="p-2">Conseil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {truckHealthAnalysis.map((t) => (
                      <tr key={t.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-2 font-medium">{t.matricule}</td>
                        <td className="p-2">{t.repairCount}</td>
                        <td className="p-2">{t.totalRepairCost.toFixed(2)} DH</td>
                        <td className="p-2">
                          <div className="w-full bg-gray-200 rounded-full h-2 max-w-[100px]">
                            <div 
                              className={`h-2 rounded-full ${
                                t.score >= 70 ? 'bg-green-500' : t.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${t.score}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className={`p-2 font-bold ${t.color}`}>
                          {t.status === 'Critique' && <ThumbsDown className="w-4 h-4 inline mr-1" />}
                          {t.status === 'Bonne' && <ThumbsUp className="w-4 h-4 inline mr-1" />}
                          {t.status}
                        </td>
                        <td className="p-2">
                          <Badge variant={t.score < 40 ? 'destructive' : t.score < 70 ? 'default' : 'secondary'}>
                            {t.recommendation}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 p-4 bg-gray-50 rounded-lg flex items-start gap-3 border border-gray-200">
                <Info className="w-5 h-5 text-gray-500 mt-0.5" />
                <div className="text-xs text-gray-600">
                  <p className="font-bold mb-1">Comment fonctionne l'analyse ?</p>
                  L'algorithme calcule un score de santé basé sur la fréquence des pannes et les coûts cumulés. 
                  Un score inférieur à 40 indique une machine coûteuse qui devrait être remplacée pour optimiser la rentabilité.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ملخصات سريعة */}
          <div className="grid md:grid-cols-4 gap-4">
              <Card>
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="w-5 h-5" />
                          Valeur totale
                      </CardTitle>
                  </CardHeader>
                  <CardContent>
                      <Badge variant="secondary">{totalValue.toFixed(2)} MAD</Badge>
                  </CardContent>
              </Card>
              <Card>
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                          <Package className="w-5 h-5" />
                          Alimentation
                      </CardTitle>
                  </CardHeader>
                  <CardContent>
                      <Badge>{transactionsByType.supply}</Badge>
                  </CardContent>
              </Card>
              <Card>
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                          <ArrowRightLeft className="w-5 h-5" />
                          Retour
                      </CardTitle>
                  </CardHeader>
                  <CardContent>
                      <Badge>{transactionsByType.return}</Badge>
                  </CardContent>
              </Card>
              <Card>
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                          <BarChart3 className="w-5 h-5" />
                          Échange / Usine
                      </CardTitle>
                  </CardHeader>
                  <CardContent>
                      <Badge>Éch: {transactionsByType.exchange} — Usine: {transactionsByType.factory}</Badge>
                  </CardContent>
              </Card>
          </div>
  
          {/* تحليل المخزون */}
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-purple-600" />
                      Analyse du stock
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative w-48">
                      <Filter className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher..."
                        className="pl-8 h-9"
                        value={stockSearch}
                        onChange={(e) => setStockSearch(e.target.value)}
                      />
                    </div>
                  </div>
              </CardHeader>
              <CardContent>
                  <div className="grid md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                      <div className="text-purple-800 text-sm font-semibold mb-1">Valeur Stock Restant</div>
                      <div className="text-2xl font-bold text-purple-900">
                        {stockAnalysis.reduce((sum, s) => sum + s.value, 0).toFixed(2)} MAD
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                      <div className="text-green-800 text-sm font-semibold mb-1">Total Unités</div>
                      <div className="text-2xl font-bold text-green-900">
                        {stockAnalysis.reduce((sum, s) => sum + s.total, 0)}
                      </div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <div className="text-blue-800 text-sm font-semibold mb-1">Unités Distribuées</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {stockAnalysis.reduce((sum, s) => sum + s.distributed, 0)}
                      </div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                      <div className="text-orange-800 text-sm font-semibold mb-1">Taux de Distribution Moyen</div>
                      <div className="text-2xl font-bold text-orange-900">
                        {(stockAnalysis.reduce((sum, s) => sum + s.distributionRate, 0) / (stockAnalysis.length || 1)).toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                          <thead>
                              <tr className="text-left border-b bg-gray-50">
                                  <th className="p-3">Type de Bouteille</th>
                                  <th className="p-3 text-center">Total</th>
                                  <th className="p-3 text-center">Distribué</th>
                                  <th className="p-3 text-center">Restant</th>
                                  <th className="p-3 text-right">Valeur</th>
                                  <th className="p-3">Taux de Distribution</th>
                                  <th className="p-3">État</th>
                              </tr>
                          </thead>
                          <tbody>
                              {stockAnalysis
                                .filter(s => s.name.toLowerCase().includes(stockSearch.toLowerCase()))
                                .map((s) => (
                                  <tr key={s.name} className="border-b hover:bg-gray-50 transition-colors">
                                      <td className="p-3 font-medium">{s.name}</td>
                                      <td className="p-3 text-center">{s.total}</td>
                                      <td className="p-3 text-center text-blue-600 font-semibold">{s.distributed}</td>
                                      <td className="p-3 text-center text-green-600 font-semibold">{s.remaining}</td>
                                      <td className="p-3 text-right font-mono">{s.value.toFixed(2)}</td>
                                      <td className="p-3">
                                        <div className="flex items-center gap-2">
                                          <div className="w-full bg-gray-200 rounded-full h-2 min-w-[100px]">
                                            <div 
                                              className="bg-blue-600 h-2 rounded-full transition-all"
                                              style={{ width: `${Math.min(100, s.distributionRate)}%` }}
                                            ></div>
                                          </div>
                                          <span className="text-xs font-semibold">{s.distributionRate.toFixed(1)}%</span>
                                        </div>
                                      </td>
                                      <td className="p-3">
                                        <Badge className={`${s.statusColor} bg-white border`}>
                                          {s.status}
                                        </Badge>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </CardContent>
          </Card>
  
          {/* تحليل السائقين */}
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      Analyse des chauffeurs
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative w-48">
                      <Filter className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher..."
                        className="pl-8 h-9"
                        value={driverSearch}
                        onChange={(e) => setDriverSearch(e.target.value)}
                      />
                    </div>
                  </div>
              </CardHeader>
              <CardContent>
                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                      <div className="text-red-800 text-sm font-semibold mb-1">Total Dettes</div>
                      <div className="text-2xl font-bold text-red-900">
                        {driverAnalysis.reduce((sum, d) => sum + d.debt, 0).toFixed(2)} MAD
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                      <div className="text-green-800 text-sm font-semibold mb-1">Total Acomptes</div>
                      <div className="text-2xl font-bold text-green-900">
                        {driverAnalysis.reduce((sum, d) => sum + d.advances, 0).toFixed(2)} MAD
                      </div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <div className="text-blue-800 text-sm font-semibold mb-1">Solde Net Global</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {driverAnalysis.reduce((sum, d) => sum + d.balance, 0).toFixed(2)} MAD
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                          <thead>
                              <tr className="text-left border-b bg-gray-50">
                                  <th className="p-3">Chauffeur</th>
                                  <th className="p-3 text-right">Dette (Cumulée)</th>
                                  <th className="p-3 text-right">Acomptes</th>
                                  <th className="p-3 text-right">Solde Actuel</th>
                                  <th className="p-3 text-center">Statut</th>
                                  <th className="p-3">Progression</th>
                              </tr>
                          </thead>
                          <tbody>
                              {driverAnalysis
                                .filter(d => d.name.toLowerCase().includes(driverSearch.toLowerCase()))
                                .map((d) => (
                                  <tr key={d.id} className="border-b hover:bg-gray-50 transition-colors">
                                      <td className="p-3 font-medium">{d.name}</td>
                                      <td className="p-3 text-right text-red-600 font-mono">{d.debt.toFixed(2)}</td>
                                      <td className="p-3 text-right text-green-600 font-mono">{d.advances.toFixed(2)}</td>
                                      <td className={`p-3 text-right font-bold font-mono ${d.balance < 0 ? 'text-red-600' : d.balance > 0 ? 'text-green-600' : ''}`}>
                                        {d.balance.toFixed(2)}
                                      </td>
                                      <td className="p-3 text-center">
                                          <Badge variant={d.statusVariant}>
                                            {d.status}
                                          </Badge>
                                      </td>
                                      <td className="p-3">
                                        <div className="w-full bg-gray-200 rounded-full h-1.5 max-w-[100px]">
                                          <div 
                                            className={`h-1.5 rounded-full ${d.balance < 0 ? 'bg-red-500' : 'bg-green-500'}`}
                                            style={{ 
                                              width: `${Math.min(100, Math.abs(d.balance) / 100)}%` 
                                            }}
                                          ></div>
                                        </div>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </CardContent>
          </Card>
  
          {/* تاريخ العمليات حسب الفلاتر */}
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      Historique des transactions
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowTransactions((v) => !v);
                        setExpandedTransactionId(null);
                      }}
                    >
                      {showTransactions ? 'Masquer' : 'Afficher'}
                    </Button>
                    <Select value={transactionsSort} onValueChange={(v) => setTransactionsSort(v as any)}>
                      <SelectTrigger className="h-9 w-[170px]">
                        <SelectValue placeholder="Tri" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date_desc">Date ↓</SelectItem>
                        <SelectItem value="date_asc">Date ↑</SelectItem>
                        <SelectItem value="value_desc">Valeur ↓</SelectItem>
                        <SelectItem value="value_asc">Valeur ↑</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={transactionsLimit} onValueChange={(v) => setTransactionsLimit(v as any)}>
                      <SelectTrigger className="h-9 w-[140px]">
                        <SelectValue placeholder="Limiter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25 lignes</SelectItem>
                        <SelectItem value="50">50 lignes</SelectItem>
                        <SelectItem value="100">100 lignes</SelectItem>
                        <SelectItem value="all">Tout</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="relative w-64">
                      <Filter className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Chercher (Chauffeur, Client, Camion...)"
                        className="pl-8 h-9"
                        value={transactionSearch}
                        onChange={(e) => setTransactionSearch(e.target.value)}
                      />
                    </div>
                  </div>
              </CardHeader>
              <CardContent>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{filteredTransactions.length} opérations</Badge>
                      <Badge variant="secondary">{totalValue.toFixed(2)} MAD</Badge>
                      <Badge variant="outline">
                        Alim: {transactionsByType.supply} | Ret: {transactionsByType.return} | Éch: {transactionsByType.exchange} | Usine: {transactionsByType.factory}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Affiché: {visibleTransactions.length}/{filteredTransactions.length}
                      </span>
                    </div>
                  </div>

                  {!showTransactions ? (
                    <div className="text-sm text-muted-foreground py-6 text-center border rounded-lg bg-gray-50">
                      Historique masqué.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left border-b bg-gray-50">
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Type</th>
                                        <th className="p-3">Chauffeur</th>
                                        <th className="p-3">Client</th>
                                        <th className="p-3">Référence</th>
                                        <th className="p-3">Camion</th>
                                        <th className="p-3 text-right">Valeur (MAD)</th>
                                        <th className="p-3 text-center">Détails</th>
                                    </tr>
                            </thead>
                            <tbody>
                                {visibleTransactions.map((t: any) => {
                                    const dName = drivers.find((d) => d.id === t.driverId)?.name || '-';
                                    const trk = trucks.find((tr) => tr.id === t.truckId) as any;
                                    const tName = (trk?.name || trk?.plateNumber || trk?.registration || '-') as string;

                                    const supplyOrder = t.type === 'supply'
                                      ? supplyOrders.find((o: any) => o.id === t.relatedOrderId || o.orderNumber === t.relatedOrderId)
                                      : undefined;
                                    const returnOrder = t.type === 'return'
                                      ? returnOrders.find((o: any) => o.id === t.relatedOrderId || o.orderNumber === t.relatedOrderId)
                                      : undefined;

                                    let cName = '-';
                                    if (supplyOrder) cName = supplyOrder.clientName || '-';
                                    if (returnOrder) cName = returnOrder.clientName || '-';

                                    const rawRef = String(
                                      supplyOrder?.orderNumber ||
                                      returnOrder?.orderNumber ||
                                      t.relatedOrderId ||
                                      t.id ||
                                      ''
                                    );
                                    const ref = rawRef ? rawRef : '-';
                                    const dateLabel = t?.date
                                      ? new Date(t.date).toLocaleString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                                      : '-';

                                    const isExpanded = expandedTransactionId === t.id;
                                    const bottleBreakdown = (t.bottleTypes || []).map((bt: any) => {
                                      const name = bottleTypes.find((b) => b.id === bt.bottleTypeId)?.name || bt.bottleTypeName || bt.bottleTypeId || '-';
                                      return {
                                        key: `${t.id}-${bt.bottleTypeId}-${bt.status || 'na'}`,
                                        name,
                                        quantity: Number(bt.quantity || 0),
                                        status: bt.status ? String(bt.status) : '',
                                      };
                                    });

                                    return (
                                      <React.Fragment key={t.id}>
                                        <tr className="border-b hover:bg-gray-50 transition-colors">
                                          <td className="p-3">{dateLabel}</td>
                                          <td className="p-3">
                                            <Badge variant="outline" className={
                                              t.type === 'supply' ? 'bg-blue-50 text-blue-700' : 
                                              t.type === 'return' ? 'bg-green-50 text-green-700' :
                                              t.type === 'exchange' ? 'bg-orange-50 text-orange-700' : 'bg-gray-50'
                                            }>
                                              {t.type === 'supply' ? 'Alimentation' : 
                                              t.type === 'return' ? 'Retour' :
                                              t.type === 'exchange' ? 'Échange' : 'Usine'}
                                            </Badge>
                                          </td>
                                          <td className="p-3 font-medium">{dName}</td>
                                          <td className="p-3">{cName}</td>
                                          <td className="p-3 font-mono text-xs">{ref}</td>
                                          <td className="p-3">{tName}</td>
                                          <td className="p-3 text-right font-bold">{(t.totalValue || 0).toFixed(2)}</td>
                                          <td className="p-3 text-center">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0"
                                              onClick={() => setExpandedTransactionId((prev) => (prev === t.id ? null : t.id))}
                                            >
                                              <Info className="h-4 w-4 text-blue-600" />
                                            </Button>
                                          </td>
                                        </tr>
                                        {isExpanded && (
                                          <tr className="border-b bg-white">
                                            <td className="p-3" colSpan={8}>
                                              <div className="grid md:grid-cols-3 gap-3">
                                                <div className="text-sm">
                                                  <div className="text-xs text-muted-foreground">Identifiant</div>
                                                  <div className="font-mono text-xs">{String(t.id || '-')}</div>
                                                </div>
                                                <div className="text-sm">
                                                  <div className="text-xs text-muted-foreground">Total</div>
                                                  <div className="font-bold">{(t.totalValue || 0).toFixed(2)} MAD</div>
                                                </div>
                                                <div className="text-sm">
                                                  <div className="text-xs text-muted-foreground">Bouteilles</div>
                                                  <div className="flex flex-wrap gap-2 mt-1">
                                                    {bottleBreakdown.length === 0 ? (
                                                      <span className="text-xs text-muted-foreground">—</span>
                                                    ) : (
                                                      bottleBreakdown.map((b: any) => (
                                                        <Badge key={b.key} variant="secondary" className="text-xs">
                                                          {b.quantity} {b.name}{b.status ? ` (${b.status})` : ''}
                                                        </Badge>
                                                      ))
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    );
                                })}
                                {visibleTransactions.length === 0 && (
                                  <tr>
                                    <td className="p-4 text-center text-sm text-muted-foreground" colSpan={8}>
                                      Aucune transaction pour ces filtres.
                                    </td>
                                  </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                  )}
              </CardContent>
          </Card>
  
          {/* تقارير يومية للسائقين (B.D و غيرها) */}
          <Card>
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                      <Truck className="w-5 h-5" />
                      Rapport Journalier des Chauffeurs
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                      <div>
                          <Label>Date</Label>
                          <Input
                              type="date"
                              value={dailyReportDate.toISOString().slice(0, 10)}
                              onChange={(e) => setDailyReportDate(new Date(e.target.value))}
                          />
                      </div>
                      <div>
                          <Label>Chauffeur</Label>
                          <Select value={dailyReportDriver} onValueChange={setDailyReportDriver}>
                              <SelectTrigger>
                                  <SelectValue placeholder="Tous" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="all">Tous</SelectItem>
                                  {drivers.map((d) => (
                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </div>
                  </div>
  
                  <div className="grid md:grid-cols-3 gap-4">
                      <Button onClick={generateCombinedDriversReport} className="w-full">
                          <Download className="w-4 h-4 mr-2" />
                          Rapport Journalier des Chauffeurs
                      </Button>
                      <Button onClick={generateDailyPetitCamionReport} className="w-full" variant="outline">
                          <Download className="w-4 h-4 mr-2" />
                          Rapport Petit Camion (B.D)
                      </Button>
                      <Button onClick={generateMygazReport} className="w-full" variant="secondary">
                          <Download className="w-4 h-4 mr-2" />
                          Rapport MYGAZ
                      </Button>
                      <Button onClick={generateDriversSupplyReturnReport} className="w-full" variant="outline">
                          <Download className="w-4 h-4 mr-2" />
                          Historique B.D — Camions
                      </Button>
                      <Button onClick={generateDriverDebtReport} className="w-full" variant="outline">
                          <Download className="w-4 h-4 mr-2" />
                          Dettes Chauffeurs
                      </Button>
                      <Button onClick={() => generateDailyExpenseReport(expenses)} className="w-full" variant="outline">
                          <Download className="w-4 h-4 mr-2" />
                          Notes de Frais
                      </Button>
                      <Button onClick={generateMiscellaneousExpensesReport} className="w-full" variant="outline">
                          <Download className="w-4 h-4 mr-2" />
                          Dépenses Diverses
                      </Button>
                      <Button onClick={generateTransportReport} className="w-full" variant="outline">
                          <Download className="w-4 h-4 mr-2" />
                          Transport
                      </Button>
                      <Button onClick={generateGeneralReport} className="w-full bg-green-600 hover:bg-green-700 text-white">
                          <Download className="w-4 h-4 mr-2" />
                          Rapport Général PDF
                      </Button>
                      <Button onClick={generateDiversesReport} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                          <Download className="w-4 h-4 mr-2" />
                          Rapport Diverses PDF
                      </Button>
                      <Button onClick={generateRepairsReport} className="w-full bg-orange-600 hover:bg-orange-700 text-white">
                          <Download className="w-4 h-4 mr-2" />
                          Rapport Réparations PDF
                      </Button>
                  </div>
              </CardContent>
          </Card>
      </div>
  );
}

// Add the missing default export
export default Reports;
