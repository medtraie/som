

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';
import { 
  Download, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  Filter, 
  ArrowRightLeft, 
  Wallet, 
  History, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Landmark, 
  Coins, 
  Receipt, 
  CreditCard,
  Calendar,
  Search,
  ChevronDown,
  ArrowUpRight,
  ArrowDownLeft,
  Banknote,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { BankTransfer, CashOperation, FinancialTransaction } from '@/types';

const fmtMAD = (n: number) =>
  n.toLocaleString('fr-MA', { style: 'currency', currency: 'MAD', minimumFractionDigits: 2 });

const formatAccountName = (acc: string) => {
  switch (acc?.toLowerCase()) {
    case 'espece': return 'Espèce';
    case 'cheque': return 'Chèque';
    case 'banque': return 'Banque';
    case 'autre': return 'Autre';
    default: return acc || '-';
  }
};

const fmtDate = (iso: string) => {
  try {
    return format(new Date(iso), 'dd/MM/yyyy', { locale: fr });
  } catch {
    return iso;
  }
};

type OpRow =
  | {
      kind: 'transfert';
      id: string;
      date: string;
      typeLabel: string;
      description: string;
      amount: number;
      sourceAccount: 'espece' | 'cheque' | 'banque';
      destinationAccount: 'espece' | 'cheque' | 'banque';
      status: 'pending' | 'validated';
    }
  | {
      kind: 'operation';
      id: string;
      date: string;
      typeLabel: 'versement' | 'retrait';
      description: string;
      amount: number;
      accountAffected: 'espece' | 'banque' | 'cheque' | 'autre';
      accountDetails?: string;
      status: 'pending' | 'validated';
    };

function Revenue() {
  const {
    revenues,
    expenses,
    repairs,
    bankTransfers,
    cashOperations,
    financialTransactions,
    addBankTransfer,
    updateBankTransfer,
    validateBankTransfer,
    deleteBankTransfer,
    addCashOperation,
    updateCashOperation,
    validateCashOperation,
    deleteCashOperation,
    addFinancialTransaction,
    deleteFinancialTransaction,
    getAccountBalance,
  } = useApp();

  // Summary cards
  const soldeEspece = getAccountBalance('espece');
  const soldeCheque = getAccountBalance('cheque');
  const soldeBanque = getAccountBalance('banque');
  const totalDebt = useMemo(() => revenues.reduce((sum, r) => sum + (r.totalDebt || 0), 0), [revenues]);
  const totalExpenses = useMemo(() => {
    const expTotal = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const repairTotal = repairs.reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0);
    return expTotal + repairTotal;
  }, [expenses, repairs]);
  const montantTotal = useMemo(() => {
    const totalIn = financialTransactions
      .filter(t => t.type === 'encaissement' || t.type === 'versement')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    
    const totalOut = financialTransactions
      .filter(t => t.type === 'retrait' || t.type === 'dépense' || t.type === 'réparation')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

    return totalIn - totalOut;
  }, [financialTransactions]);

  // Transfer modal state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferType, setTransferType] = useState<'versement_espece' | 'remise_cheques' | 'retrait_bancaire'>(
    'versement_espece'
  );
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferDescription, setTransferDescription] = useState<string>('');
  const [transferDate, setTransferDate] = useState<string>(() => new Date().toISOString());

  // Cash operation modal state
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [cashName, setCashName] = useState('');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [cashType, setCashType] = useState<'versement' | 'retrait'>('versement');
  const [cashAccount, setCashAccount] = useState<'espece' | 'banque' | 'cheque' | 'autre'>('espece');
  const [cashAccountDetails, setCashAccountDetails] = useState('');
  const [cashDate, setCashDate] = useState<string>(() => new Date().toISOString());

  // Edit dialogs
  const [editTransferOpen, setEditTransferOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<BankTransfer | null>(null);

  const [editCashOpen, setEditCashOpen] = useState(false);
  const [editingCash, setEditingCash] = useState<CashOperation | null>(null);

  // Filters (shared)
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all'); // 'all' | 'encaissement' | 'transfert' | 'versement' | 'retrait'
  const [filterAccount, setFilterAccount] = useState<string>('all'); // 'all' | 'espece' | 'banque' | 'cheque' | 'autre'
  const [filterAmountMin, setFilterAmountMin] = useState<string>('');
  const [filterAmountMax, setFilterAmountMax] = useState<string>('');

  // Normalize operations for "Gestion de Transfert"
  const opRows: OpRow[] = useMemo(() => {
    return financialTransactions.map((t) => {
      if (t.type === 'transfert') {
        const bt = bankTransfers.find(b => b.id === t.id);
        return {
          kind: 'transfert',
          id: t.id || Math.random().toString(),
          date: t.date,
          typeLabel: 'Transfert',
          description: t.description,
          amount: t.amount,
          sourceAccount: t.sourceAccount as any,
          destinationAccount: t.destinationAccount as any,
          status: bt?.status || 'validated',
        };
      }
      
      const op = cashOperations.find(o => o.id === t.id);
      return {
          kind: 'operation',
          id: t.id || Math.random().toString(),
          date: t.date,
          typeLabel: t.type === 'versement' || t.type === 'encaissement' ? 'versement' : 
                     t.type === 'retrait' || t.type === 'dépense' || t.type === 'réparation' ? 'retrait' : 'versement',
          description: t.description,
          amount: Math.abs(t.amount),
          accountAffected: (t.amount >= 0 ? t.destinationAccount : t.sourceAccount) as any,
          accountDetails: t.accountDetails,
          status: op?.status || 'validated',
        };
    }).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [financialTransactions, cashOperations, bankTransfers]);

  const passesDate = (iso: string) => {
    const d = new Date(iso);
    if (filterStartDate && d < new Date(filterStartDate)) return false;
    if (filterEndDate && d > new Date(filterEndDate)) return false;
    return true;
  };
  const passesType = (row: OpRow) => {
    if (filterType === 'all') return true;
    if (filterType === 'transfert') return row.kind === 'transfert';
    if (filterType === 'versement') return row.kind === 'operation' && row.typeLabel === 'versement';
    if (filterType === 'retrait') return row.kind === 'operation' && row.typeLabel === 'retrait';
    if (filterType === 'dépense') return row.kind === 'operation' && row.typeLabel === 'dépense';
    return true;
  };
  const passesAccount = (row: OpRow) => {
    if (filterAccount === 'all') return true;
    if (row.kind === 'transfert') {
      return row.sourceAccount === filterAccount || row.destinationAccount === filterAccount;
    }
    if (row.kind === 'operation') {
      return row.accountAffected === filterAccount;
    }
    return true;
  };
  const passesAmount = (amount: number) => {
    const min = filterAmountMin ? parseFloat(filterAmountMin) : null;
    const max = filterAmountMax ? parseFloat(filterAmountMax) : null;
    if (min !== null && amount < min) return false;
    if (max !== null && amount > max) return false;
    return true;
  };

  const filteredOps = useMemo(
    () => opRows.filter((r) => passesDate(r.date) && passesType(r) && passesAccount(r) && passesAmount(r.amount)),
    [opRows, filterStartDate, filterEndDate, filterType, filterAccount, filterAmountMin, filterAmountMax]
  );

  const filteredHistory = useMemo(() => {
    const rows = financialTransactions
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return rows.filter((r) => {
      // Type
      if (filterType !== 'all') {
        if (filterType === 'dépense') {
          if (r.type !== 'dépense' && r.type !== 'réparation') return false;
        } else if (filterType === 'versement') {
          // Group 'versement' and 'encaissement' as they are both incoming money
          if (r.type !== 'versement' && r.type !== 'encaissement') return false;
        } else {
          if (r.type !== filterType) return false;
        }
      }

      // Date
      if (!passesDate(r.date)) return false;

      // Account
      if (filterAccount !== 'all') {
        const affected = [r.sourceAccount, r.destinationAccount].filter(Boolean);
        if (affected.length > 0 && !affected.includes(filterAccount)) return false;
      }

      // Amount
      return passesAmount(r.amount);
    });
  }, [financialTransactions, filterType, filterStartDate, filterEndDate, filterAccount, filterAmountMin, filterAmountMax]);

  // Submit transfer
  const handleSubmitTransfer = () => {
    const amount = parseFloat(transferAmount);
    if (!amount || amount <= 0) {
      toast.error('Veuillez saisir un montant valide');
      return;
    }
    let source: BankTransfer['sourceAccount'] = 'espece';
    let dest: BankTransfer['destinationAccount'] = 'banque';
    if (transferType === 'versement_espece') {
      source = 'espece';
      dest = 'banque';
    } else if (transferType === 'remise_cheques') {
      source = 'cheque';
      dest = 'banque';
    } else {
      source = 'banque';
      dest = 'espece';
    }

    const id = (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    addBankTransfer({
      id,
      date: transferDate,
      type: transferType,
      sourceAccount: source,
      destinationAccount: dest,
      amount,
      description: transferDescription || '',
      status: 'pending',
    });
    // Validation immédiate pour mettre à jour les cartes et appliquer les effets
    validateBankTransfer(id);

    toast.success('Transfert enregistré et validé');
    setTransferDialogOpen(false);
    setTransferAmount('');
    setTransferDescription('');
    setTransferDate(new Date().toISOString());
    setTransferType('versement_espece');
  };

  // Submit cash operation
  const handleSubmitCash = () => {
    const amount = parseFloat(cashAmount);
    if (!cashName.trim() || !amount || amount <= 0) {
      toast.error('Veuillez renseigner le libellé et un montant valide');
      return;
    }

    addCashOperation({
      date: cashDate,
      name: cashName.trim(),
      amount,
      type: cashType,
      accountAffected: cashAccount,
      accountDetails: cashAccountDetails.trim() || undefined,
      status: 'pending',
    });

    toast.success('Opération de caisse enregistrée (en attente de validation)');
    setCashDialogOpen(false);
    setCashName('');
    setCashAmount('');
    setCashType('versement');
    setCashAccount('espece');
    setCashAccountDetails('');
    setCashDate(new Date().toISOString());
  };

  // Edit transfer
  const openEditTransfer = (t: BankTransfer) => {
    setEditingTransfer(t);
    setEditTransferOpen(true);
  };
  const handleUpdateTransfer = () => {
    if (!editingTransfer) return;
    if (editingTransfer.amount <= 0) {
      toast.error('Montant invalide');
      return;
    }
    // Ensure source/destination reflect type
    let source: BankTransfer['sourceAccount'] = 'espece';
    let dest: BankTransfer['destinationAccount'] = 'banque';
    if (editingTransfer.type === 'versement_espece') {
      source = 'espece';
      dest = 'banque';
    } else if (editingTransfer.type === 'remise_cheques') {
      source = 'cheque';
      dest = 'banque';
    } else {
      source = 'banque';
      dest = 'espece';
    }

    updateBankTransfer(editingTransfer.id, {
      type: editingTransfer.type,
      amount: editingTransfer.amount,
      description: editingTransfer.description,
      date: editingTransfer.date,
      sourceAccount: source,
      destinationAccount: dest,
    });
    setEditTransferOpen(false);
    setEditingTransfer(null);
    toast.success('Transfert mis à jour');
  };

  // Edit cash op
  const openEditCash = (o: CashOperation) => {
    setEditingCash(o);
    setEditCashOpen(true);
  };
  const handleUpdateCash = () => {
    if (!editingCash) return;
    if (editingCash.amount <= 0 || !editingCash.name.trim()) {
      toast.error('Libellé ou montant invalide');
      return;
    }
    updateCashOperation(editingCash.id, {
      name: editingCash.name,
      amount: editingCash.amount,
      type: editingCash.type,
      date: editingCash.date,
      accountAffected: editingCash.accountAffected,
      accountDetails: editingCash.accountDetails,
    });
    setEditCashOpen(false);
    setEditingCash(null);
    toast.success('Opération mise à jour');
  };

  // Validate logic
  const handleValidateTransfer = (t: BankTransfer) => {
    validateBankTransfer(t.id);

    if (t.type === 'remise_cheques') {
      // Historiser la régularisation de remise de chèques
      addFinancialTransaction({
        date: new Date().toISOString(),
        type: 'transfert',
        description: 'Régularisation: chèques déposés à la banque',
        amount: t.amount,
        sourceAccount: 'cheque',
        destinationAccount: 'banque',
        status: 'completed',
        createdAt: new Date().toISOString(),
      });
    }

    toast.success('Transfert validé');
  };

  const handleValidateCash = (o: CashOperation) => {
    validateCashOperation(o.id);
    toast.success('Opération validée');
  };

  // Delete
  const handleDeleteOperation = (id: string) => {
    deleteFinancialTransaction(id);
    toast.success('Opération supprimée');
  };

  const exportOpsToPDF = () => {
    // Ouvre une fenêtre imprimable; l’utilisateur peut enregistrer en PDF
    const w = window.open('', '_blank');
    if (!w) return;
    const rowsHtml = filteredOps
      .map((r) => {
        if (r.kind === 'transfert') {
          return `<tr>
            <td>${fmtDate(r.date)}</td>
            <td>${r.typeLabel}</td>
            <td>${r.description || ''}</td>
            <td>${fmtMAD(r.amount)}</td>
            <td>${formatAccountName(r.sourceAccount)} → ${formatAccountName(r.destinationAccount)}</td>
            <td>${r.status}</td>
          </tr>`;
        }
        return `<tr>
          <td>${fmtDate(r.date)}</td>
          <td>${r.typeLabel}</td>
          <td>${r.description || ''}</td>
          <td>${fmtMAD(r.amount)}</td>
          <td>${r.accountAffected === 'autre' && r.accountDetails ? `Autre (${r.accountDetails})` : formatAccountName(r.accountAffected)}</td>
          <td>${r.status}</td>
        </tr>`;
      })
      .join('');
    w.document.write(`
      <html>
        <head>
          <title>Export - Gestion de Transfert</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { font-size: 18px; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #888; padding: 6px 8px; font-size: 12px; }
            th { background: #f0f0f0; text-align: left; }
          </style>
        </head>
        <body>
          <h1>Gestion de Transfert - Export (filtres appliqués)</h1>
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Type</th><th>Description</th><th>Montant</th><th>Compte(s)</th><th>Statut</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  const exportHistoryToPDF = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const rowsHtml = filteredHistory
      .map(
        (r) => {
          const source = r.sourceAccount === 'autre' && r.accountDetails ? `Autre (${r.accountDetails})` : formatAccountName(r.sourceAccount || '');
          const dest = r.destinationAccount === 'autre' && r.accountDetails ? `Autre (${r.accountDetails})` : formatAccountName(r.destinationAccount || '');
          const accounts = [source, dest].filter(Boolean).join(' → ') || '-';
          
          return `<tr>
            <td>${fmtDate(r.date)}</td>
            <td>${r.type}</td>
            <td>${r.description || ''}</td>
            <td>${fmtMAD(r.amount)}</td>
            <td>${accounts}</td>
            <td>${r.status}</td>
          </tr>`;
        }
      )
      .join('');
    w.document.write(`
      <html>
        <head>
          <title>Export - Historique Financier</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { font-size: 18px; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #888; padding: 6px 8px; font-size: 12px; }
            th { background: #f0f0f0; text-align: left; }
          </style>
        </head>
        <body>
          <h1>Historique Financier - Export (filtres appliqués)</h1>
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Type</th><th>Description</th><th>Montant</th><th>Compte(s)</th><th>Statut</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 bg-slate-50/30">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Landmark className="h-6 w-6 text-white" />
            </div>
            Gestion Financière
          </h2>
          <p className="text-slate-500 mt-1">
            Suivi des flux de trésorerie, transferts bancaires et opérations de caisse.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all flex items-center gap-2"
            onClick={() => setTransferDialogOpen(true)}
          >
            <ArrowRightLeft className="h-4 w-4" />
            Transfert Bancaire
          </Button>
          <Button 
            variant="outline" 
            className="border-blue-200 hover:bg-blue-50 text-blue-700 shadow-sm transition-all flex items-center gap-2"
            onClick={() => setCashDialogOpen(true)}
          >
            <Wallet className="h-4 w-4" />
            Opération de Caisse
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Espèce</CardTitle>
            <div className="p-2 bg-emerald-50 rounded-full group-hover:bg-emerald-100 transition-colors">
              <Coins className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{fmtMAD(soldeEspece)}</div>
            <div className="flex items-center mt-1 text-xs text-emerald-600 font-medium">
              <ArrowDownLeft className="h-3 w-3 mr-1" />
              Disponible en caisse
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Banque</CardTitle>
            <div className="p-2 bg-blue-50 rounded-full group-hover:bg-blue-100 transition-colors">
              <Landmark className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{fmtMAD(soldeBanque)}</div>
            <div className="flex items-center mt-1 text-xs text-blue-600 font-medium">
              <Check className="h-3 w-3 mr-1" />
              Solde bancaire actuel
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Chèque</CardTitle>
            <div className="p-2 bg-indigo-50 rounded-full group-hover:bg-indigo-100 transition-colors">
              <CreditCard className="h-4 w-4 text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{fmtMAD(soldeCheque)}</div>
            <div className="flex items-center mt-1 text-xs text-indigo-600 font-medium">
              <History className="h-3 w-3 mr-1" />
              Chèques en attente
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Dettes</CardTitle>
            <div className="p-2 bg-amber-50 rounded-full group-hover:bg-amber-100 transition-colors">
              <Receipt className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{fmtMAD(totalDebt)}</div>
            <div className="flex items-center mt-1 text-xs text-amber-600 font-medium">
              <TrendingUp className="h-3 w-3 mr-1" />
              Total des créances
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Dépenses</CardTitle>
            <div className="p-2 bg-rose-50 rounded-full group-hover:bg-rose-100 transition-colors">
              <TrendingDown className="h-4 w-4 text-rose-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{fmtMAD(totalExpenses)}</div>
            <div className="flex items-center mt-1 text-xs text-rose-600 font-medium">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              Cumul des sorties
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Solde Net</CardTitle>
            <div className="p-2 bg-violet-50 rounded-full group-hover:bg-violet-100 transition-colors">
              <Wallet className="h-4 w-4 text-violet-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{fmtMAD(montantTotal)}</div>
            <div className="flex items-center mt-1 text-xs text-violet-600 font-medium">
              <Coins className="h-3 w-3 mr-1" />
              Balance globale
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="gestion" className="w-full space-y-4">
        <TabsList className="bg-white border p-1 shadow-sm">
          <TabsTrigger value="gestion" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Gestion des Flux
          </TabsTrigger>
          <TabsTrigger value="historique" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <History className="mr-2 h-4 w-4" />
            Historique Complet
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gestion" className="space-y-4">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-white border-b py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-800">Transferts & Opérations</CardTitle>
                  <p className="text-sm text-slate-500">Gérez les mouvements entre vos comptes et les opérations de caisse.</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={exportOpsToPDF}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Exporter PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Filters Section */}
              <div className="p-4 bg-slate-50/50 border-b grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Période</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="date" 
                      className="h-9 text-sm"
                      value={filterStartDate} 
                      onChange={(e) => setFilterStartDate(e.target.value)} 
                    />
                    <span className="text-slate-400">à</span>
                    <Input 
                      type="date" 
                      className="h-9 text-sm"
                      value={filterEndDate} 
                      onChange={(e) => setFilterEndDate(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Type d'opération</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Tous les types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les types</SelectItem>
                      <SelectItem value="transfert">Transfert Bancaire</SelectItem>
                      <SelectItem value="versement">Versement / Règlement</SelectItem>
                      <SelectItem value="retrait">Retrait Caisse</SelectItem>
                      <SelectItem value="dépense">Dépense / Réparation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Compte</Label>
                  <Select value={filterAccount} onValueChange={setFilterAccount}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Tous les comptes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les comptes</SelectItem>
                      <SelectItem value="espece">Espèce</SelectItem>
                      <SelectItem value="cheque">Chèque</SelectItem>
                      <SelectItem value="banque">Banque</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 lg:col-span-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Plage de Montant</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Min</span>
                      <Input 
                        className="h-9 pl-10 text-sm"
                        placeholder="0.00"
                        value={filterAmountMin} 
                        onChange={(e) => setFilterAmountMin(e.target.value)} 
                      />
                    </div>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Max</span>
                      <Input 
                        className="h-9 pl-10 text-sm"
                        placeholder="999..."
                        value={filterAmountMax} 
                        onChange={(e) => setFilterAmountMax(e.target.value)} 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Table Section */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-semibold text-slate-700">Date</TableHead>
                      <TableHead className="font-semibold text-slate-700">Opération</TableHead>
                      <TableHead className="font-semibold text-slate-700">Détails</TableHead>
                      <TableHead className="font-semibold text-slate-700">Montant</TableHead>
                      <TableHead className="font-semibold text-slate-700">Flux / Compte</TableHead>
                      <TableHead className="font-semibold text-slate-700">Statut</TableHead>
                      <TableHead className="text-right font-semibold text-slate-700">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOps.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center">
                            <Filter className="h-8 w-8 text-slate-300 mb-2" />
                            <p>Aucun mouvement trouvé pour ces filtres</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOps.map((r) => (
                        <TableRow key={`${r.kind}-${r.id}`} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="font-medium text-slate-700">{fmtDate(r.date)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {r.kind === 'transfert' ? (
                                <div className="p-1.5 bg-blue-50 rounded text-blue-600">
                                  <ArrowRightLeft className="h-3.5 w-3.5" />
                                </div>
                              ) : (
                                <div className={`p-1.5 rounded ${r.typeLabel === 'versement' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                  {r.typeLabel === 'versement' ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                                </div>
                              )}
                              <span className="text-sm font-medium">
                                {r.kind === 'transfert' ? r.typeLabel : (r.typeLabel.charAt(0).toUpperCase() + r.typeLabel.slice(1))}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-slate-600 text-sm">
                            {r.description || '-'}
                          </TableCell>
                          <TableCell className={`font-bold ${r.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {fmtMAD(Number(r.amount) || 0)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                              {r.kind === 'transfert' ? (
                                <>
                                  <Badge variant="outline" className="border-slate-200">{formatAccountName(r.sourceAccount)}</Badge>
                                  <ArrowRightLeft className="h-3 w-3 text-slate-400" />
                                  <Badge variant="outline" className="border-slate-200 bg-slate-50">{formatAccountName(r.destinationAccount)}</Badge>
                                </>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  {/* Determine if it's an entry or exit to show the flow correctly */}
                                  {r.typeLabel === 'versement' ? (
                                    <>
                                      <Badge variant="outline" className="border-slate-200 bg-slate-50/50">
                                        {r.accountDetails ? `Autre (${r.accountDetails})` : 'Autre'}
                                      </Badge>
                                      <ArrowRightLeft className="h-3 w-3 text-slate-400" />
                                      <Badge variant="outline" className="border-slate-200 font-bold">
                                        {formatAccountName(r.accountAffected)}
                                      </Badge>
                                    </>
                                  ) : (
                                    <>
                                      <Badge variant="outline" className="border-slate-200 font-bold">
                                        {formatAccountName(r.accountAffected)}
                                      </Badge>
                                      <ArrowRightLeft className="h-3 w-3 text-slate-400" />
                                      <Badge variant="outline" className="border-slate-200 bg-slate-50/50">
                                        {r.accountDetails ? `Autre (${r.accountDetails})` : 'Autre'}
                                      </Badge>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={r.status === 'validated' ? 'bg-emerald-100 text-emerald-700 border-none' : 'bg-amber-100 text-amber-700 border-none'}>
                              {r.status === 'validated' ? 'Validé' : 'En attente'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {r.status === 'pending' ? (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                                    onClick={() => {
                                      if (r.kind === 'transfert') {
                                        openEditTransfer(bankTransfers.find((t) => t.id === r.id)!);
                                      } else {
                                        openEditCash(cashOperations.find((o) => o.id === r.id)!);
                                      }
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-emerald-600 hover:bg-emerald-50"
                                    onClick={() => {
                                      if (r.kind === 'transfert') {
                                        handleValidateTransfer(bankTransfers.find((t) => t.id === r.id)!);
                                      } else {
                                        handleValidateCash(cashOperations.find((o) => o.id === r.id)!);
                                      }
                                    }}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-rose-600 hover:bg-rose-50"
                                    onClick={() => handleDeleteOperation(r.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-rose-600 hover:bg-rose-50"
                                  onClick={() => handleDeleteOperation(r.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
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
        </TabsContent>

        <TabsContent value="historique" className="space-y-4">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-white border-b py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-800">Historique Financier Global</CardTitle>
                  <p className="text-sm text-slate-500">Vue détaillée de toutes les transactions financières validées.</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={exportHistoryToPDF}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Exporter Historique
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Filters for History */}
              <div className="p-4 bg-slate-50/50 border-b grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Période</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="date" 
                      className="h-9 text-sm"
                      value={filterStartDate} 
                      onChange={(e) => setFilterStartDate(e.target.value)} 
                    />
                    <span className="text-slate-400 text-xs">au</span>
                    <Input 
                      type="date" 
                      className="h-9 text-sm"
                      value={filterEndDate} 
                      onChange={(e) => setFilterEndDate(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Toutes les transactions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les transactions</SelectItem>
                      <SelectItem value="versement">Versements / Règlements</SelectItem>
                      <SelectItem value="transfert">Transferts</SelectItem>
                      <SelectItem value="retrait">Retraits</SelectItem>
                      <SelectItem value="dépense">Dépenses / Réparations</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Compte Impacté</Label>
                  <Select value={filterAccount} onValueChange={setFilterAccount}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Tous les comptes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les comptes</SelectItem>
                      <SelectItem value="espece">Espèce</SelectItem>
                      <SelectItem value="cheque">Chèque</SelectItem>
                      <SelectItem value="banque">Banque</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 lg:col-span-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Montant</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      className="h-9 text-sm"
                      placeholder="Min"
                      value={filterAmountMin} 
                      onChange={(e) => setFilterAmountMin(e.target.value)} 
                    />
                    <Input 
                      className="h-9 text-sm"
                      placeholder="Max"
                      value={filterAmountMax} 
                      onChange={(e) => setFilterAmountMax(e.target.value)} 
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-semibold text-slate-700">Date</TableHead>
                      <TableHead className="font-semibold text-slate-700">Type</TableHead>
                      <TableHead className="font-semibold text-slate-700">Description</TableHead>
                      <TableHead className="font-semibold text-slate-700">Montant</TableHead>
                      <TableHead className="font-semibold text-slate-700">Comptes</TableHead>
                      <TableHead className="font-semibold text-slate-700 text-right">Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                          Aucune transaction trouvée
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHistory.map((r: FinancialTransaction) => (
                        <TableRow key={r.id} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="text-slate-700 font-medium">{fmtDate(r.date)}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`capitalize ${
                                r.type === 'réparation' || r.type === 'dépense' 
                                  ? 'border-rose-200 text-rose-700 bg-rose-50' 
                                  : 'border-emerald-200 text-emerald-700 bg-emerald-50'
                              }`}
                            >
                              {r.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600 text-sm max-w-[250px] truncate">{r.description || '-'}</TableCell>
                          <TableCell className={`font-bold ${r.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {fmtMAD(r.amount)}
                          </TableCell>
          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                              <span>
                                {r.sourceAccount === 'autre' && r.accountDetails ? `Autre (${r.accountDetails})` : formatAccountName(r.sourceAccount || '')}
                              </span>
                              {r.destinationAccount && (
                                <>
                                  <ArrowRightLeft className="h-3 w-3" />
                                  <span>
                                    {r.destinationAccount === 'autre' && r.accountDetails ? `Autre (${r.accountDetails})` : formatAccountName(r.destinationAccount || '')}
                                  </span>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-blue-100 text-blue-700 border-none capitalize">{r.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals - Modernized */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-blue-600 p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-blue-200" />
                Nouveau Transfert Bancaire
              </DialogTitle>
              <p className="text-blue-100 text-sm mt-1">Déplacez des fonds entre vos différents comptes.</p>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-4 bg-white">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">Type de transfert</Label>
                <Select value={transferType} onValueChange={(v) => setTransferType(v as any)}>
                  <SelectTrigger className="border-slate-200 focus:ring-blue-500">
                    <SelectValue placeholder="Choisir un type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="versement_espece">Versement Espèce (Espèce → Banque)</SelectItem>
                    <SelectItem value="remise_cheques">Remise de Chèques (Chèque → Banque)</SelectItem>
                    <SelectItem value="retrait_bancaire">Retrait Bancaire (Banque → Espèce)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Montant (MAD)</Label>
                  <Input 
                    type="number"
                    value={transferAmount} 
                    onChange={(e) => setTransferAmount(e.target.value)} 
                    placeholder="0.00"
                    className="border-slate-200 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Date</Label>
                  <Input
                    type="date"
                    value={format(new Date(transferDate), 'yyyy-MM-dd')}
                    onChange={(e) => {
                      const d = new Date(e.target.value);
                      setTransferDate(new Date(d.setHours(12)).toISOString());
                    }}
                    className="border-slate-200 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">Description / Libellé</Label>
                <Textarea 
                  value={transferDescription} 
                  onChange={(e) => setTransferDescription(e.target.value)} 
                  placeholder="Notes optionnelles..."
                  className="min-h-[100px] border-slate-200 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 pt-2 bg-slate-50 flex gap-2">
            <Button variant="ghost" onClick={() => setTransferDialogOpen(false)} className="text-slate-600 hover:bg-slate-200">
              Annuler
            </Button>
            <Button onClick={handleSubmitTransfer} className="bg-blue-600 hover:bg-blue-700 text-white px-8">
              Confirmer le transfert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cashDialogOpen} onOpenChange={setCashDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-indigo-600 p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Wallet className="h-5 w-5 text-indigo-200" />
                Opération de Caisse
              </DialogTitle>
              <p className="text-indigo-100 text-sm mt-1">Enregistrez un versement ou un retrait direct.</p>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-4 bg-white">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">Libellé de l'opération</Label>
                <Input 
                  value={cashName} 
                  onChange={(e) => setCashName(e.target.value)} 
                  placeholder="Ex: Apport personnel, Petite caisse..."
                  className="border-slate-200 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Montant (MAD)</Label>
                  <Input 
                    type="number"
                    value={cashAmount} 
                    onChange={(e) => setCashAmount(e.target.value)} 
                    placeholder="0.00"
                    className="border-slate-200 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Date</Label>
                  <Input
                    type="date"
                    value={format(new Date(cashDate), 'yyyy-MM-dd')}
                    onChange={(e) => {
                      const d = new Date(e.target.value);
                      setCashDate(new Date(d.setHours(12)).toISOString());
                    }}
                    className="border-slate-200 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <Label className="text-slate-700 font-semibold text-xs uppercase tracking-wider">Type d'opération</Label>
                <RadioGroup
                  value={cashType}
                  onValueChange={(v) => setCashType(v as 'versement' | 'retrait')}
                  className="flex gap-6 mt-1"
                >
                  <div className="flex items-center space-x-2 cursor-pointer group">
                    <RadioGroupItem value="versement" id="versement" className="text-indigo-600 border-slate-300" />
                    <Label htmlFor="versement" className="font-medium text-slate-700 cursor-pointer group-hover:text-indigo-600 transition-colors">
                      Verser (Entrée)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 cursor-pointer group">
                    <RadioGroupItem value="retrait" id="retrait" className="text-rose-600 border-slate-300" />
                    <Label htmlFor="retrait" className="font-medium text-slate-700 cursor-pointer group-hover:text-rose-600 transition-colors">
                      Retirer (Sortie)
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">Compte affecté</Label>
                <Select value={cashAccount} onValueChange={(v) => setCashAccount(v as any)}>
                  <SelectTrigger className="border-slate-200 focus:ring-indigo-500">
                    <SelectValue placeholder="Sélectionner un compte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="espece">Caisse Espèce</SelectItem>
                    <SelectItem value="banque">Compte Bancaire</SelectItem>
                    <SelectItem value="cheque">Chèque</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">Détails de la contrepartie (Tiers, Banque, Source...)</Label>
                <Input 
                  value={cashAccountDetails} 
                  onChange={(e) => setCashAccountDetails(e.target.value)} 
                  placeholder="Ex: Client X, Facture #123, IBAN..." 
                  className="border-slate-200 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 pt-2 bg-slate-50 flex gap-2">
            <Button variant="ghost" onClick={() => setCashDialogOpen(false)} className="text-slate-600 hover:bg-slate-200">
              Annuler
            </Button>
            <Button onClick={handleSubmitCash} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8">
              Enregistrer l'opération
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialogs - Minimal Modernization for consistency */}
      <Dialog open={editTransferOpen} onOpenChange={setEditTransferOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-600" />
              Modifier le Transfert
            </DialogTitle>
          </DialogHeader>
          {editingTransfer && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={editingTransfer.type}
                  onValueChange={(v) => setEditingTransfer({ ...editingTransfer, type: v as any })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="versement_espece">Versement Espèce</SelectItem>
                    <SelectItem value="remise_cheques">Remise de Chèques</SelectItem>
                    <SelectItem value="retrait_bancaire">Retrait Bancaire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Montant</Label>
                  <Input
                    type="number"
                    value={editingTransfer.amount}
                    onChange={(e) => setEditingTransfer({ ...editingTransfer, amount: parseFloat(e.target.value || '0') })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={format(new Date(editingTransfer.date), 'yyyy-MM-dd')}
                    onChange={(e) => {
                      const d = new Date(e.target.value);
                      setEditingTransfer({ ...editingTransfer, date: new Date(d.setHours(12)).toISOString() });
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingTransfer.description}
                  onChange={(e) => setEditingTransfer({ ...editingTransfer, description: e.target.value })}
                  className="resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTransferOpen(false)}>Annuler</Button>
            <Button onClick={handleUpdateTransfer} className="bg-blue-600 hover:bg-blue-700 text-white">Mettre à jour</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editCashOpen} onOpenChange={setEditCashOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-indigo-600" />
              Modifier l'Opération
            </DialogTitle>
          </DialogHeader>
          {editingCash && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Libellé</Label>
                <Input
                  value={editingCash.name}
                  onChange={(e) => setEditingCash({ ...editingCash, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Montant</Label>
                  <Input
                    type="number"
                    value={editingCash.amount}
                    onChange={(e) => setEditingCash({ ...editingCash, amount: parseFloat(e.target.value || '0') })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={format(new Date(editingCash.date), 'yyyy-MM-dd')}
                    onChange={(e) => {
                      const d = new Date(e.target.value);
                      setEditingCash({ ...editingCash, date: new Date(d.setHours(12)).toISOString() });
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={editingCash.type}
                    onValueChange={(v) => setEditingCash({ ...editingCash, type: v as any })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="versement">Versement</SelectItem>
                      <SelectItem value="retrait">Retrait</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Compte affecté</Label>
                  <Select
                    value={editingCash.accountAffected}
                    onValueChange={(v) => setEditingCash({ ...editingCash, accountAffected: v as any })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="espece">Espèce</SelectItem>
                      <SelectItem value="banque">Banque</SelectItem>
                      <SelectItem value="cheque">Chèque</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Détails de la contrepartie</Label>
                <Input
                  value={editingCash.accountDetails || ''}
                  onChange={(e) => setEditingCash({ ...editingCash, accountDetails: e.target.value })}
                  placeholder="Ex: Client X, IBAN..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCashOpen(false)}>Annuler</Button>
            <Button onClick={handleUpdateCash} className="bg-indigo-600 hover:bg-indigo-700 text-white">Mettre à jour</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Revenue;