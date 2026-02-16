import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { 
  ArrowRightLeft, 
  Plus, 
  Building2, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Package, 
  AlertTriangle, 
  Download, 
  Trash, 
  Edit,
  History,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Settings2
} from 'lucide-react';
import { AddForeignBottleDialog } from '@/components/dialogs/AddForeignBottleDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { BottleType, Brand } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const COMPANIES = [
  'Aziz gaz', 'Winxo', 'Dima gaz', 'Total', 'Putagaz', 
  'Nadigaz', 'Somap gaz', 'Atlas gaz', 'Ultra gaz', 'Petrom gaz'
];

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
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };

  const tableRowVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 10 }
  };

const Exchanges = () => {
  const { exchanges = [], bottleTypes = [], addExchange, foreignBottles = [], brands = [] } = useApp();
  const [showExchangeForm, setShowExchangeForm] = useState(false);
  const [selectedBottleType, setSelectedBottleType] = useState<BottleType | null>(null);
  const [addForeignDialogOpen, setAddForeignDialogOpen] = useState(false);
  const [showBrandDialog, setShowBrandDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [exchangeForm, setExchangeForm] = useState({
    companyName: '',
    clientName: '',
    bottleType: '',
    quantityGiven: 0,
    quantityReceived: 0,
    unitPrice: 0,
    paidBy: 'nous' as 'nous' | 'client'
  });

  const handleExchange = () => {
    const bottleTypeData = bottleTypes.find(bt => bt.id === exchangeForm.bottleType);
    const priceDifference = (exchangeForm.quantityReceived - exchangeForm.quantityGiven) * (exchangeForm.unitPrice || bottleTypeData?.unitPrice || 0);
    
    addExchange({
      companyName: exchangeForm.companyName,
      clientName: exchangeForm.clientName || undefined,
      bottleType: bottleTypeData?.name || '',
      quantityGiven: exchangeForm.quantityGiven,
      quantityReceived: exchangeForm.quantityReceived,
      priceDifference: Math.abs(priceDifference),
      date: new Date().toISOString(),
      isPaidByUs: priceDifference < 0,
      paidBy: exchangeForm.paidBy
    });

    setExchangeForm({
      companyName: '',
      clientName: '',
      bottleType: '',
      quantityGiven: 0,
      quantityReceived: 0,
      unitPrice: 0,
      paidBy: 'nous'
    });
    setShowExchangeForm(false);
  };

  // Stats calculation
  const stats = useMemo(() => {
    const totalNousPayons = exchanges.filter(ex => ex.isPaidByUs).reduce((sum, ex) => sum + ex.priceDifference, 0);
    const totalIlsPaient = exchanges.filter(ex => !ex.isPaidByUs).reduce((sum, ex) => sum + ex.priceDifference, 0);
    const netSolde = totalIlsPaient - totalNousPayons;
    
    return {
      totalExchanges: exchanges.length,
      totalNousPayons,
      totalIlsPaient,
      netSolde
    };
  }, [exchanges]);

  const getForeignStockByCompany = (companyName: string) => {
    return foreignBottles
      .filter(fb => fb.companyName === companyName && fb.type === 'normal')
      .reduce((acc, fb) => {
        const existing = acc.find(item => item.bottleType === fb.bottleType);
        if (existing) {
          existing.quantity += fb.quantity;
        } else {
          acc.push({ bottleType: fb.bottleType, quantity: fb.quantity });
        }
        return acc;
      }, [] as { bottleType: string; quantity: number }[]);
  };

  const getTotalForeignStockByCompany = (companyName: string) => {
    return foreignBottles
      .filter(fb => fb.companyName === companyName && fb.type === 'normal')
      .reduce((sum, fb) => sum + fb.quantity, 0);
  };

  const getForeignStockForBottleTypeAndCompany = (bottleTypeName: string, companyName: string) => {
    return foreignBottles
      .filter(fb => fb.bottleType === bottleTypeName && fb.companyName === companyName && fb.type === 'normal')
      .reduce((sum, fb) => sum + fb.quantity, 0);
  };

  const getTotalForeignStockForBottleType = (bottleTypeName: string) => {
    return foreignBottles
      .filter(fb => fb.bottleType === bottleTypeName && fb.type === 'normal')
      .reduce((sum, fb) => sum + fb.quantity, 0);
  };

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { status: 'Vide', variant: 'destructive' as const, color: 'text-rose-600', bg: 'bg-rose-50' };
    if (quantity < 20) return { status: 'Faible', variant: 'secondary' as const, color: 'text-amber-600', bg: 'bg-amber-50' };
    return { status: 'Normal', variant: 'default' as const, color: 'text-emerald-600', bg: 'bg-emerald-50' };
  };

  const availableBottleTypes = bottleTypes.filter(bt => !bt.name.includes('Détendeur'));

  const filteredExchanges = useMemo(() => {
    if (!searchQuery) return exchanges;
    const query = searchQuery.toLowerCase();
    return exchanges.filter(ex => 
      ex.companyName.toLowerCase().includes(query) || 
      ex.clientName?.toLowerCase().includes(query) ||
      ex.bottleType.toLowerCase().includes(query)
    );
  }, [exchanges, searchQuery]);

  const exportExchangesToPDF = () => {
    const w = window.open('', '_blank');
    if (!w) return;

    const rows = exchanges.map(ex => `
        <tr>
          <td>${format(new Date(ex.date), 'dd/MM/yyyy')}</td>
          <td>${ex.companyName}</td>
          <td>${ex.clientName ?? '-'}</td>
          <td>${ex.bottleType}</td>
          <td style="text-align:right">${ex.quantityGiven}</td>
          <td style="text-align:right">${ex.quantityReceived}</td>
          <td>${ex.isPaidByUs ? 'Nous payons' : 'Ils paient'}</td>
          <td style="text-align:right">${ex.priceDifference.toLocaleString('fr-FR')} DH</td>
        </tr>
    `).join('');

    w.document.write(`
      <html>
        <head>
          <title>Historique des échanges</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; line-height: 1.6; direction: ltr; }
            .header { border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
            h1 { color: #4f46e5; margin: 0; font-size: 24px; }
            .meta { display: flex; gap: 20px; margin-top: 10px; font-weight: bold; }
            .stat { background: #f3f4f6; padding: 10px 15px; border-radius: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e5e7eb; padding: 12px; font-size: 13px; text-align: left; }
            th { background: #4f46e5; color: white; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
            tr:nth-child(even) { background: #f9fafb; }
            .footer { margin-top: 30px; border-top: 2px solid #e5e7eb; padding-top: 20px; text-align: right; }
            .total-box { display: inline-block; background: #4f46e5; color: white; padding: 15px 25px; border-radius: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Historique des échanges de bouteilles</h1>
            <div class="meta">
              <div class="stat">Total échanges: ${stats.totalExchanges}</div>
              <div class="stat">Nous payons: ${stats.totalNousPayons.toLocaleString('fr-FR')} DH</div>
              <div class="stat">Ils paient: ${stats.totalIlsPaient.toLocaleString('fr-FR')} DH</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Marque</th>
                <th>Client</th>
                <th>Type</th>
                <th style="text-align:right">Donné</th>
                <th style="text-align:right">Reçu</th>
                <th>Sens</th>
                <th style="text-align:right">Montant</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="8" style="text-align:center;color:#777">Aucun échange enregistré</td></tr>'}
            </tbody>
          </table>
          <div class="footer">
            <div class="total-box">
              <div style="font-size: 12px; opacity: 0.8; text-transform: uppercase; margin-bottom: 5px;">Solde Net</div>
              <div style="font-size: 24px; font-weight: bold;">${stats.netSolde.toLocaleString('fr-FR')} DH</div>
            </div>
          </div>
        </body>
      </html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-4 md:p-8 space-y-8 bg-slate-50/30 min-h-screen text-left"
      dir="ltr"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-4 mb-2">
            <motion.div 
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.5 }}
              className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-200"
            >
              <ArrowRightLeft className="w-7 h-7 text-white" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Échanges Commerciaux</h1>
              <p className="text-slate-500 font-medium">Gestion et suivi des bouteilles étrangères et des échanges</p>
            </div>
          </div>
        </motion.div>
        
        <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-3">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button 
              variant="outline" 
              onClick={() => setShowBrandDialog(true)}
              className="border-slate-200 hover:bg-white hover:border-indigo-300 text-slate-600 rounded-xl h-12 px-6 transition-all shadow-sm"
            >
              <Settings2 className="w-5 h-5 mr-2 text-indigo-500" />
              Gérer les Marques
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button 
              onClick={() => setShowExchangeForm(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 rounded-xl h-12 px-8 font-bold transition-all"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nouvel Échange
            </Button>
          </motion.div>
        </motion.div>
      </div>

      {/* Stats Section */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Échanges', value: stats.totalExchanges, icon: ArrowRightLeft, color: 'bg-blue-600', trend: 'neutral' },
          { label: 'Nous devons payer', value: `${stats.totalNousPayons.toLocaleString()} DH`, icon: ArrowDownLeft, color: 'bg-rose-600', trend: 'down' },
          { label: 'Nous devons recevoir', value: `${stats.totalIlsPaient.toLocaleString()} DH`, icon: ArrowUpRight, color: 'bg-emerald-600', trend: 'up' },
          { label: 'Solde Net', value: `${stats.netSolde.toLocaleString()} DH`, icon: DollarSign, color: 'bg-indigo-600', trend: stats.netSolde >= 0 ? 'up' : 'down' }
        ].map((stat, idx) => (
          <motion.div 
            key={idx} 
            variants={itemVariants}
            whileHover={{ y: -5 }}
            className="relative group"
          >
            <Card className="border-none shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden bg-white/80 backdrop-blur-sm">
              <div className={`absolute top-0 left-0 w-1 h-full ${stat.color}`} />
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 ${stat.color} bg-opacity-10 rounded-2xl group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className={`w-6 h-6 ${stat.color.replace('bg-', 'text-')}`} />
                  </div>
                  {stat.trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-500" />}
                  {stat.trend === 'down' && <TrendingDown className="w-4 h-4 text-rose-500" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                  <h3 className="text-2xl font-black text-slate-900">{stat.value}</h3>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Stock Inventory */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div variants={itemVariants} className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Package className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-xl font-black text-slate-800">Stock de Bouteilles Étrangères</h2>
            </div>
            <Badge variant="outline" className="bg-indigo-50/50 text-indigo-700 border-indigo-100 px-4 py-1.5 rounded-full font-bold">
              {brands.length} marques enregistrées
            </Badge>
          </motion.div>

          <div className="grid gap-6">
            <AnimatePresence>
              {availableBottleTypes.map((bottleType, bIdx) => {
                const totalStockForType = getTotalForeignStockForBottleType(bottleType.name);
                const { status, color, bg } = getStockStatus(totalStockForType);

                return (
                  <motion.div 
                    key={bottleType.id} 
                    variants={itemVariants}
                    layout
                  >
                    <Card className="border-none shadow-sm overflow-hidden group hover:shadow-lg transition-all duration-300 bg-white">
                      <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between p-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                            <Package className="w-6 h-6 text-indigo-600" />
                          </div>
                          <div>
                            <CardTitle className="text-xl font-black text-slate-800">{bottleType.name}</CardTitle>
                            <p className="text-xs text-slate-500 font-bold mt-0.5">Stock total actuel</p>
                          </div>
                        </div>
                        <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl ${bg} ${color} font-black text-sm shadow-sm`}>
                          <motion.div 
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className={`w-2 h-2 rounded-full ${color.replace('text-', 'bg-')}`} 
                          />
                          {status}: {totalStockForType}
                        </div>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="grid sm:grid-cols-2 gap-4">
                          {brands.map((company) => {
                            const qty = getForeignStockForBottleTypeAndCompany(bottleType.name, company.name);
                            return (
                              <motion.div 
                                key={company.id} 
                                whileHover={{ scale: 1.02 }}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 ${
                                  qty > 0 
                                    ? 'bg-white border-slate-200 shadow-sm' 
                                    : 'bg-slate-50/50 border-transparent opacity-60'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${qty > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <Building2 className="w-4 h-4" />
                                  </div>
                                  <span className="text-sm font-bold text-slate-700">{company.name}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                  <span className={`text-lg font-black ${qty > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>{qty}</span>
                                  {qty > 0 && <span className="text-[10px] text-slate-400 font-bold">bouteille(s)</span>}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dernière mise à jour : Aujourd'hui</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-indigo-600 hover:bg-indigo-50 rounded-xl font-black px-4 h-10 transition-colors"
                            onClick={() => {
                              setSelectedBottleType(bottleType);
                              setAddForeignDialogOpen(true);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-2" /> Ajuster le stock
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column: History & Controls */}
        <div className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card className="border-none shadow-sm overflow-hidden bg-white h-full">
              <CardHeader className="bg-slate-900 text-white p-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-black flex items-center gap-3">
                    <History className="w-5 h-5 text-indigo-400" />
                    Historique des Échanges
                  </CardTitle>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={exportExchangesToPDF}
                    className="bg-white/10 hover:bg-white/20 border-none text-white rounded-lg h-9 px-4"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <Input 
                      placeholder="Rechercher une marque, client ou type..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-11 bg-white border-slate-200 focus:ring-2 focus:ring-indigo-600/10 rounded-xl text-sm font-medium text-left"
                    />
                  </div>
                </div>
                
                <div className="divide-y divide-slate-100 max-h-[800px] overflow-y-auto custom-scrollbar">
                  <AnimatePresence mode="popLayout">
                    {filteredExchanges.length > 0 ? (
                      filteredExchanges.map((exchange, idx) => (
                        <motion.div 
                          key={exchange.id}
                          variants={tableRowVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          layout
                          transition={{ 
                            delay: idx * 0.03,
                            layout: { duration: 0.2 }
                          }}
                          whileHover={{ x: 5, backgroundColor: "rgba(248, 250, 252, 1)" }}
                          className="p-5 hover:bg-slate-50 transition-all cursor-default group border-l-2 border-transparent hover:border-indigo-500"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-2xl shadow-sm ${
                                exchange.isPaidByUs ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                              }`}>
                                <ArrowRightLeft className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="font-black text-slate-900">{exchange.companyName}</div>
                                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                                  <Calendar className="w-3 h-3" />
                                  {format(new Date(exchange.date), 'dd MMMM yyyy', { locale: fr })}
                                </div>
                              </div>
                            </div>
                            <Badge 
                              className={`text-[10px] font-black px-3 py-1 rounded-full border-none ${
                                exchange.isPaidByUs ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {exchange.isPaidByUs ? "Payé" : "Reçu"}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 group-hover:bg-white transition-colors">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Donné</p>
                              <div className="flex items-center gap-2">
                                <TrendingDown className="w-3 h-3 text-rose-500" />
                                <span className="font-black text-slate-800">{exchange.quantityGiven}</span>
                                <span className="text-[10px] font-bold text-slate-500">bouteille(s)</span>
                              </div>
                            </div>
                            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 group-hover:bg-white transition-colors">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Reçu</p>
                              <div className="flex items-center gap-2">
                                <TrendingUp className="w-3 h-3 text-emerald-500" />
                                <span className="font-black text-slate-800">{exchange.quantityReceived}</span>
                                <span className="text-[10px] font-bold text-slate-500">bouteille(s)</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between bg-indigo-50/30 p-3 rounded-xl">
                            <div className="flex items-center gap-2">
                              <Package className="w-3.5 h-3.5 text-indigo-500" />
                              <span className="text-xs font-bold text-indigo-900">{exchange.bottleType}</span>
                            </div>
                            <div className="font-black text-indigo-600 text-sm">
                              {exchange.priceDifference.toLocaleString()} DH
                            </div>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                        <div className="p-4 bg-slate-50 rounded-full mb-4">
                          <Search className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-bold">Aucun résultat trouvé</p>
                        <p className="text-xs text-slate-400 mt-1">Essayez d'autres mots-clés</p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Forms & Dialogs */}
      <Dialog open={showExchangeForm} onOpenChange={setShowExchangeForm}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-indigo-600 p-6 text-white">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold">Nouvel Échange</DialogTitle>
                  <p className="text-indigo-100 text-xs mt-1">Enregistrer un mouvement de bouteilles entre marques</p>
                </div>
              </div>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-6 bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Société / Marque</Label>
                <Select
                  value={exchangeForm.companyName}
                  onValueChange={(value) => setExchangeForm({ ...exchangeForm, companyName: value })}
                >
                  <SelectTrigger className="rounded-xl border-slate-200 h-11">
                    <SelectValue placeholder="Choisir la société..." />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map(company => (
                      <SelectItem key={company.id} value={company.name}>{company.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Nom du Client</Label>
                <Input
                  value={exchangeForm.clientName}
                  onChange={(e) => setExchangeForm({...exchangeForm, clientName: e.target.value})}
                  className="rounded-xl border-slate-200 h-11"
                  placeholder="Optionnel..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Type de Bouteille</Label>
                <Select 
                  value={exchangeForm.bottleType} 
                  onValueChange={(value) => setExchangeForm({...exchangeForm, bottleType: value})}
                >
                  <SelectTrigger className="rounded-xl border-slate-200 h-11">
                    <SelectValue placeholder="Choisir le type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bottleTypes.map(bt => (
                      <SelectItem key={bt.id} value={bt.id}>{bt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Payé par</Label>
                <Select 
                  value={exchangeForm.paidBy} 
                  onValueChange={(value: 'nous' | 'client') => setExchangeForm({...exchangeForm, paidBy: value})}
                >
                  <SelectTrigger className="rounded-xl border-slate-200 h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nous">Nous payons</SelectItem>
                    <SelectItem value="client">Le client paye</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Donné</Label>
                <Input
                  type="number"
                  value={exchangeForm.quantityGiven}
                  onChange={(e) => setExchangeForm({...exchangeForm, quantityGiven: parseInt(e.target.value) || 0})}
                  className="rounded-xl border-slate-200 h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Reçu</Label>
                <Input
                  type="number"
                  value={exchangeForm.quantityReceived}
                  onChange={(e) => setExchangeForm({...exchangeForm, quantityReceived: parseInt(e.target.value) || 0})}
                  className="rounded-xl border-slate-200 h-11"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Prix (DH)</Label>
                <Input
                  type="number"
                  value={exchangeForm.unitPrice}
                  onChange={(e) => setExchangeForm({...exchangeForm, unitPrice: parseFloat(e.target.value) || 0})}
                  className="rounded-xl border-slate-200 h-11 font-bold text-indigo-600"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 pt-2 bg-slate-50 flex gap-2">
            <Button variant="ghost" onClick={() => setShowExchangeForm(false)} className="rounded-xl text-slate-500">Annuler</Button>
            <Button onClick={handleExchange} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-8 font-bold">Enregistrer l'échange</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock adjustment dialog */}
      {selectedBottleType && (
        <AddForeignBottleDialog
          isOpen={addForeignDialogOpen}
          onClose={() => setAddForeignDialogOpen(false)}
          bottleType={selectedBottleType}
        />
      )}

      {/* Brand Management Dialog */}
      <BrandManagerDialog open={showBrandDialog} onOpenChange={setShowBrandDialog} />
    </motion.div>
  );
};

const BrandManagerDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void; }) => {
  const { brands, addBrand, updateBrand, deleteBrand } = useApp();
  const [newBrandName, setNewBrandName] = useState("");
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);

  const handleAddBrand = () => {
    if (newBrandName.trim()) {
      if (editingBrand) {
        updateBrand(editingBrand.id, { name: newBrandName });
        setEditingBrand(null);
      } else {
        addBrand({ name: newBrandName, id: '' });
      }
      setNewBrandName("");
    }
  };

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setNewBrandName(brand.name);
  };

  const handleCancelEdit = () => {
    setEditingBrand(null);
    setNewBrandName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-slate-900 p-6 text-white">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <Settings2 className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Gestion des Marques</DialogTitle>
                <p className="text-slate-400 text-xs mt-1">Ajouter, modifier ou supprimer des sociétés enregistrées</p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <Input
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              placeholder={editingBrand ? "Nouveau nom..." : "Nom de la nouvelle société..."}
              className="rounded-xl h-11 border-slate-200"
            />
            <Button 
              onClick={handleAddBrand}
              className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-6 font-bold"
            >
              {editingBrand ? "Mettre à jour" : "Ajouter"}
            </Button>
            {editingBrand && (
              <Button variant="ghost" onClick={handleCancelEdit} className="rounded-xl">Annuler</Button>
            )}
          </div>

          <div className="bg-slate-50 rounded-2xl border border-slate-100 divide-y divide-slate-200 max-h-[300px] overflow-y-auto">
            {brands.map((brand) => (
              <div key={brand.id} className="flex items-center justify-between p-4 group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                    {brand.name.charAt(0)}
                  </div>
                  <span className="font-bold text-slate-700">{brand.name}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(brand)} className="h-8 w-8 text-slate-400 hover:text-indigo-600">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteBrand(brand.id)} className="h-8 w-8 text-slate-400 hover:text-rose-600">
                    <Trash className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="p-4 bg-slate-50">
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="rounded-xl w-full">Fermer la fenêtre</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Exchanges;