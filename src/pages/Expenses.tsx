import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/contexts/AppContext';
import { DollarSign, Plus, Calendar, Search, Filter, Download, Trash2, Receipt, Wallet, CreditCard, Banknote, History, CheckCircle2, AlertCircle, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Expense } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DateRange } from 'react-day-picker';

const paymentMethods = [
  'espece',
  'cheque',
  'banque'
];

const Expenses = () => {
  const { expenses, addExpense, updateExpense, deleteExpense, expenseTypes, addExpenseType } = useApp();
  const today = new Date();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expenseType, setExpenseType] = useState<string>('');
  const [customExpenseType, setCustomExpenseType] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [date, setDate] = useState<Date>(new Date());
  const [note, setNote] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  const handleAddExpense = () => {
    if (!expenseType || !code || !amount || !paymentMethod) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (expenseType === 'autre' && !customExpenseType) {
      toast.error('Veuillez préciser le type de dépense');
      return;
    }

    let finalType = expenseType;
    if (expenseType === 'autre') {
      finalType = customExpenseType;
      addExpenseType(customExpenseType);
    }

    if (expenseToEdit) {
      updateExpense(expenseToEdit.id, {
        type: finalType as any,
        code,
        amount: parseFloat(amount),
        paymentMethod: paymentMethod as any,
        date: date.toISOString(),
        note: note || undefined
      });
      toast.success('Dépense mise à jour avec succès');
    } else {
      const newExpense: Expense = {
        id: Date.now().toString(),
        type: finalType as any,
        code,
        amount: parseFloat(amount),
        paymentMethod: paymentMethod as any,
        date: date.toISOString(),
        note: note || undefined
      };

      addExpense(newExpense);
      toast.success('Dépense ajoutée avec succès');
    }
    
    resetForm();
    setDialogOpen(false);
  };

  const handleEditExpense = (expense: Expense) => {
    setExpenseToEdit(expense);
    setExpenseType(expense.type);
    setCode(expense.code || '');
    setAmount(expense.amount.toString());
    setPaymentMethod(expense.paymentMethod);
    setDate(new Date(expense.date));
    setNote(expense.note || '');
    setDialogOpen(true);
  };

  const resetForm = () => {
    setExpenseToEdit(null);
    setExpenseType('');
    setCustomExpenseType('');
    setCode('');
    setAmount('');
    setPaymentMethod('');
    setDate(new Date());
    setNote('');
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    doc.text('Liste des Dépenses', 14, 16);

    const tableColumn = ["Type", "Code", "Date", "Mode de paiement", "Note", "Montant (MAD)"];
    const tableRows: (string | number)[][] = [];

    filteredExpenses.forEach(expense => {
      const expenseData = [
        expense.type,
        expense.code || '-',
        format(new Date(expense.date), 'dd/MM/yyyy'),
        expense.paymentMethod,
        expense.note || '-',
        `-${expense.amount.toFixed(2)} DH`
      ];
      tableRows.push(expenseData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    const finalY = (doc as any).lastAutoTable.finalY;
    doc.setFontSize(10);
    doc.text(`Total des dépenses: -${totalExpenses.toFixed(2)} DH`, 14, finalY + 10);

    doc.save(`dépenses_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const filteredExpenses = expenses.filter(expense => 
    (expense.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    expense.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    expense.note?.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (!dateRange?.from || new Date(expense.date) >= dateRange.from) &&
    (!dateRange?.to || new Date(expense.date) <= dateRange.to)
  );

  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);

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
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Gestion des Dépenses</h1>
          <p className="text-slate-500 font-medium">
            Suivi des charges et flux de trésorerie
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleDownloadPDF} className="hidden md:flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border-slate-200 h-11 px-6 rounded-xl">
            <Download className="w-4 h-4" />
            Exporter PDF
          </Button>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all rounded-xl h-11 px-6 font-bold">
            <Plus className="w-5 h-5 mr-2" />
            Nouvelle Charge
          </Button>
        </div>
      </div>

      {/* Stats Cards Section */}
      <div className="grid gap-6 sm:grid-cols-3">
        <Card className="p-6 border-none shadow-md bg-gradient-to-br from-rose-600 to-rose-700 text-white overflow-hidden relative group">
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <Receipt className="w-32 h-32" />
          </div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-rose-100 text-sm font-semibold mb-1 uppercase tracking-wider">Total Dépenses</p>
              <div className="text-4xl font-black tracking-tight">{totalExpenses.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} <span className="text-lg font-medium opacity-80">DH</span></div>
              <div className="flex items-center gap-2 mt-3 bg-white/10 w-fit px-2 py-1 rounded-lg backdrop-blur-sm">
                <AlertCircle className="w-3.5 h-3.5 text-rose-200" />
                <span className="text-rose-100 text-[10px] font-bold uppercase">Charges cumulées</span>
              </div>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md shadow-inner border border-white/10">
              <DollarSign className="h-9 w-9 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-6 border-none shadow-md bg-gradient-to-br from-indigo-600 to-indigo-700 text-white overflow-hidden relative group">
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <Wallet className="w-32 h-32" />
          </div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-indigo-100 text-sm font-semibold mb-1 uppercase tracking-wider">Transactions</p>
              <div className="text-4xl font-black tracking-tight">{filteredExpenses.length}</div>
              <div className="flex items-center gap-2 mt-3 bg-white/10 w-fit px-2 py-1 rounded-lg backdrop-blur-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-200" />
                <span className="text-indigo-100 text-[10px] font-bold uppercase">Opérations filtrées</span>
              </div>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md shadow-inner border border-white/10">
              <History className="h-9 w-9 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-6 border-none shadow-md bg-gradient-to-br from-emerald-600 to-emerald-700 text-white overflow-hidden relative group">
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <CreditCard className="w-32 h-32" />
          </div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-emerald-100 text-sm font-semibold mb-1 uppercase tracking-wider">Moyenne</p>
              <div className="text-4xl font-black tracking-tight">{(totalExpenses / (filteredExpenses.length || 1)).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} <span className="text-lg font-medium opacity-80">DH</span></div>
              <div className="flex items-center gap-2 mt-3 bg-white/10 w-fit px-2 py-1 rounded-lg backdrop-blur-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                <span className="text-emerald-100 text-[10px] font-bold uppercase">Par transaction</span>
              </div>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md shadow-inner border border-white/10">
              <Banknote className="h-9 w-9 text-white" />
            </div>
          </div>
        </Card>
      </div>

      {/* Controls: search and filters */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="relative flex-1 max-w-md group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par type ou note..."
              className="pl-10 h-12 bg-slate-50 border-slate-100 focus:ring-2 focus:ring-indigo-600/20 transition-all rounded-xl"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 mr-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtres</span>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-[280px] h-12 bg-white border-slate-200 rounded-xl justify-start text-left font-medium shadow-sm hover:bg-slate-50 transition-all",
                    !dateRange && "text-slate-500"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4 text-indigo-600" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd MMM", { locale: fr })} - {format(dateRange.to, "dd MMM", { locale: fr })}
                      </>
                    ) : (
                      format(dateRange.from, "dd MMMM yyyy", { locale: fr })
                    )
                  ) : (
                    <span>Toutes les dates</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none overflow-hidden" align="end">
                <CalendarComponent
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  className="bg-white p-4"
                />
              </PopoverContent>
            </Popover>

            {(searchQuery || dateRange) && (
              <Button 
                variant="ghost" 
                onClick={() => {
                  setSearchQuery('');
                  setDateRange(undefined);
                }}
                className="h-12 px-4 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-all font-semibold flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Réinitialiser
              </Button>
            )}
          </div>
        </div>
      </div>
      {/* Expenses Table */}
      <Card className="border-none shadow-md overflow-hidden rounded-2xl bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="text-slate-600 font-bold">Type</TableHead>
                <TableHead className="text-slate-600 font-bold">Date</TableHead>
                <TableHead className="text-slate-600 font-bold">Mode de paiement</TableHead>
                <TableHead className="text-slate-600 font-bold">Note</TableHead>
                <TableHead className="text-slate-600 font-bold text-right">Montant</TableHead>
                <TableHead className="text-slate-600 font-bold text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Receipt className="w-12 h-12 mb-2 opacity-20" />
                      <p className="text-lg font-medium">Aucune dépense trouvée</p>
                      <p className="text-sm">Vérifiez vos filtres ou ajoutez une nouvelle charge</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense) => (
                  <TableRow key={expense.id} className="group hover:bg-slate-50/50 transition-colors border-slate-100">
                    <TableCell>
                      <Badge variant="outline" className="bg-white border-slate-200 text-slate-700 font-bold px-3 py-1 rounded-lg capitalize">
                        {expense.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600 font-medium">
                      {expense.code || '-'}
                    </TableCell>
                    <TableCell className="text-slate-600 font-medium">
                      {format(new Date(expense.date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {expense.paymentMethod === 'espece' && <Banknote className="w-4 h-4 text-emerald-500" />}
                        {expense.paymentMethod === 'cheque' && <Receipt className="w-4 h-4 text-amber-500" />}
                        {expense.paymentMethod === 'banque' && <CreditCard className="w-4 h-4 text-indigo-500" />}
                        <span className="capitalize text-slate-700 font-medium">
                          {expense.paymentMethod === 'espece' ? 'Espèce' : 
                           expense.paymentMethod === 'cheque' ? 'Chèque' : 
                           expense.paymentMethod === 'banque' ? 'Banque' : expense.paymentMethod}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-slate-500 italic text-sm">
                      {expense.note || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-extrabold text-rose-600 bg-rose-50 px-3 py-1 rounded-lg">
                        -{expense.amount.toFixed(2)} DH
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          onClick={() => handleEditExpense(expense)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          onClick={() => {
                            if (window.confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) {
                              deleteExpense(expense.id);
                              toast.success('Dépense supprimée avec succès');
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {filteredExpenses.length > 0 && (
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-t-2 border-slate-100">
                  <TableCell colSpan={4} className="py-5 text-lg font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-6 bg-rose-500 rounded-full"></div>
                      Total des charges filtrées
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-5">
                    <div className="inline-flex flex-col items-end">
                      <span className="text-2xl font-black text-rose-700">
                        -{totalExpenses.toFixed(2)} DH
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Montant total TTC</span>
                    </div>
                  </TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md p-0 border-none overflow-hidden shadow-2xl">
          <div className="bg-rose-600 p-6 text-white">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-white">
                    {expenseToEdit ? 'Modifier la Charge' : 'Nouvelle Charge'}
                  </DialogTitle>
                  <p className="text-rose-100 text-xs mt-0.5">
                    {expenseToEdit ? 'Mettre à jour les informations de la charge' : 'Enregistrer une nouvelle charge financière'}
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-5 bg-white">
            <div className="space-y-2">
              <Label htmlFor="type" className="text-slate-700 font-semibold ml-1">Ajouter une dépense *</Label>
              <Select value={expenseType} onValueChange={setExpenseType}>
                <SelectTrigger className="h-11 bg-slate-50 border-slate-100 focus:ring-2 focus:ring-rose-500 transition-all rounded-xl">
                  <SelectValue placeholder="Choisir un type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                  {expenseTypes.map(type => (
                    <SelectItem key={type} value={type} className="rounded-lg capitalize">{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {expenseType === 'autre' && (
              <div className="space-y-2">
                <Label htmlFor="customExpenseType" className="text-slate-700 font-semibold ml-1">Nom de dépense *</Label>
                <Input
                  id="customExpenseType"
                  value={customExpenseType}
                  onChange={(e) => setCustomExpenseType(e.target.value)}
                  placeholder="Entrez le nom de la dépense"
                  className="h-11 bg-slate-50 border-slate-100 focus:ring-2 focus:ring-rose-500 transition-all rounded-xl font-bold"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="code" className="text-slate-700 font-semibold ml-1">Code *</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Code de la dépense"
                className="h-11 bg-slate-50 border-slate-100 focus:ring-2 focus:ring-rose-500 transition-all rounded-xl font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount" className="text-slate-700 font-semibold ml-1">Montant (MAD) *</Label>
              <div className="relative group">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-rose-600 transition-colors" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-10 h-11 bg-slate-50 border-slate-100 focus:ring-2 focus:ring-rose-500 transition-all rounded-xl font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod" className="text-slate-700 font-semibold ml-1">Mode de règlement *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-11 bg-slate-50 border-slate-100 focus:ring-2 focus:ring-rose-500 transition-all rounded-xl">
                  <SelectValue placeholder="Choisir un mode" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                  <SelectItem value="espece">Espèce</SelectItem>
                  <SelectItem value="cheque">Chèque</SelectItem>
                  <SelectItem value="banque">Banque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date" className="text-slate-700 font-semibold ml-1">Date de l'opération *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-11 bg-slate-50 border-slate-100 focus:ring-2 focus:ring-rose-500 transition-all rounded-xl justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4 text-rose-500" />
                    {date ? format(date, "dd MMMM yyyy", { locale: fr }) : <span>Choisir une date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none overflow-hidden" align="center">
                  <CalendarComponent
                    mode="single"
                    selected={date}
                    onSelect={(date) => date && setDate(date)}
                    initialFocus
                    className="bg-white p-4"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note" className="text-slate-700 font-semibold ml-1">Note / Détails (facultatif)</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Précisions sur la dépense..."
                className="bg-slate-50 border-slate-100 focus:ring-2 focus:ring-rose-500 transition-all rounded-xl resize-none min-h-[100px]"
              />
            </div>

            <DialogFooter className="flex gap-3 pt-4 sm:justify-start">
              <Button onClick={handleAddExpense} className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 shadow-md transition-all font-bold rounded-xl text-white">
                {expenseToEdit ? 'Mettre à jour' : 'Enregistrer'}
              </Button>
              <Button type="button" variant="outline" onClick={() => {
                setDialogOpen(false);
                resetForm();
              }} className="flex-1 h-11 border-slate-200 font-medium rounded-xl hover:bg-slate-50">
                Annuler
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Expenses;