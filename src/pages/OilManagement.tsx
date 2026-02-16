import { useState, useMemo, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/contexts/AppContext";
import { OilPurchase, OilConsumption, OilDrain } from "@/types";
import { format } from "date-fns";
import React from "react";
import { Plus, Minus, Droplet, ShoppingCart, History, Trash2, Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

interface OilBarrelProps {
  level: number; // Percentage from 0 to 100
}

const OilBarrel: React.FC<OilBarrelProps> = ({ level }) => {
  const color = level < 30 ? "#ef4444" : level < 60 ? "#f59e0b" : "#22c55e";
  const fillHeight = Math.max(0, Math.min(100, level));

  return (
    <div className="relative w-32 h-40 mx-auto">
      <svg viewBox="0 0 100 120" className="w-full h-full">
        <defs>
          <clipPath id="barrelClip">
            <path d="M 20 10 C 10 20, 10 100, 20 110 H 80 C 90 100, 90 20, 80 10 Z" />
          </clipPath>
        </defs>

        {/* Barrel background */}
        <path d="M 20 10 C 10 20, 10 100, 20 110 H 80 C 90 100, 90 20, 80 10 Z" fill="#e5e7eb" />

        {/* Oil liquid */}
        <g clipPath="url(#barrelClip)">
          <rect
            x="10"
            y={10 + 100 * (1 - fillHeight / 100)}
            width="80"
            height={100 * (fillHeight / 100)}
            fill={color}
            style={{ transition: "y 0.7s ease-in-out, height 0.7s ease-in-out" }}
          />
        </g>

        {/* Barrel outline and details */}
        <path d="M 20 10 C 10 20, 10 100, 20 110 H 80 C 90 100, 90 20, 80 10 Z" fill="none" stroke="#9ca3af" strokeWidth="2" />
        <path d="M 12 40 C 5 45, 5 75, 12 80" fill="none" stroke="#9ca3af" strokeWidth="1.5" />
        <path d="M 88 40 C 95 45, 95 75, 88 80" fill="none" stroke="#9ca3af" strokeWidth="1.5" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-2xl font-bold text-gray-700">{level.toFixed(1)}%</span>
      </div>
    </div>
  );
};

function OilManagement() {
  const {
    oilPurchases,
    addOilPurchase,
    oilConsumptions,
    addOilConsumption,
    oilDrains,
    addOilDrain,
    addCashOperation,
  } = useApp();

  // Barils : Définition unique
  const [barrelCount, setBarrelCount] = useState<number>(() => {
    const raw = localStorage.getItem("oilManagement.barrelCount");
    return raw ? parseInt(raw) : 2;
  });
  useEffect(() => {
    localStorage.setItem("oilManagement.barrelCount", barrelCount.toString());
  }, [barrelCount]);
  const adjustBarrelCount = (delta: number) => {
    setBarrelCount((prev) => Math.max(1, Math.min(20, prev + delta)));
  };
  const barrels = Array.from({ length: Math.max(1, barrelCount) }, (_, i) => i);

  // Configuration des barils : Nom et capacité
  const [barrelsConfig, setBarrelsConfig] = useState<Array<{ name: string; capacityLiters: number }>>(() => {
    const raw = localStorage.getItem("oilManagement.barrelsConfig");
    const initial = raw
      ? JSON.parse(raw)
      : Array.from({ length: barrelCount }, (_, i) => ({ name: `Baril ${i + 1}`, capacityLiters: 220 }));
    return initial.slice(0, barrelCount);
  });
  useEffect(() => {
    setBarrelsConfig((prev) => {
      const next = Array.from({ length: barrelCount }, (_, i) => prev[i] || { name: `Baril ${i + 1}`, capacityLiters: 220 });
      localStorage.setItem("oilManagement.barrelsConfig", JSON.stringify(next));
      return next;
    });
  }, [barrelCount]);

  // Initialize localStorage structures used by dashboard widget
  useEffect(() => {
    if (!localStorage.getItem("oilManagement.purchases")) {
      const lsPurchases = (oilPurchases || []).map((p) => ({ date: p.date, quantityLiters: (p.quantity || 0) * 220 }));
      localStorage.setItem("oilManagement.purchases", JSON.stringify(lsPurchases));
    }
    if (!localStorage.getItem("oilManagement.consumptions")) {
      const lsConsumptions = (oilConsumptions || []).map((c) => ({ date: c.date, quantityLiters: (c.quantity || 0) * 220 }));
      localStorage.setItem("oilManagement.consumptions", JSON.stringify(lsConsumptions));
    }
    if (!localStorage.getItem("oilManagement.baseStockLiters")) {
      localStorage.setItem("oilManagement.baseStockLiters", "0");
    }
  }, []);
  const baseStock = 0; // Starting stock in barrels


  const formatMAD = (amount: number) =>
    new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", minimumFractionDigits: 2 }).format(amount);

  // NOUVEAU : Capacité par opération (utilisé pour calculer la colonne Litres)
  const [purchaseCapacityLiters, setPurchaseCapacityLiters] = useState<number>(220);
  const [consumptionCapacityLiters, setConsumptionCapacityLiters] = useState<number>(220);
  const [drainCapacityLiters, setDrainCapacityLiters] = useState<number>(220);
  
  // Cartographie des capacités par ligne (id -> capacité en litres du baril)
  const purchaseCapacities = useMemo<Record<string | number, number>>(() => {
    try { return JSON.parse(localStorage.getItem("oilManagement.purchaseCapacities") || "{}"); }
    catch { return {}; }
  }, [oilPurchases]);
  const consumptionCapacities = useMemo<Record<string | number, number>>(() => {
    try { return JSON.parse(localStorage.getItem("oilManagement.consumptionCapacities") || "{}"); }
    catch { return {}; }
  }, [oilConsumptions]);

  // Calculate total purchased, consumed, and drained in Liters
  const totalPurchasedLiters = useMemo(
    () => oilPurchases.reduce((s, p) => s + p.quantity * (purchaseCapacities[p.id] || 220), 0),
    [oilPurchases, purchaseCapacities]
  );
  const totalConsumedLiters = useMemo(
    () => oilConsumptions.reduce((s, c) => s + c.quantity * (consumptionCapacities[c.id] || 220), 0),
    [oilConsumptions, consumptionCapacities]
  );
  const totalDrainedLiters = useMemo(() => oilDrains.reduce((s, d) => s + d.quantity * 220, 0), [oilDrains]); // Assuming 220L for drains

  const totalCapacityLiters = useMemo(
    () => barrelsConfig.reduce((sum, b) => sum + b.capacityLiters, 0),
    [barrelsConfig]
  );

  const baseStockLiters = 0; // Or read from localStorage if you have a base
  const currentStockLiters = baseStockLiters + totalPurchasedLiters - totalConsumedLiters - totalDrainedLiters;

  // Calculs de la barre de niveau dans la fonction
  const oilLevelPct = totalCapacityLiters > 0 ? Math.min(100, Math.max(0, (currentStockLiters / totalCapacityLiters) * 100)) : 0;
  const oilLevelColor =
    oilLevelPct < 30 ? "bg-red-500" : oilLevelPct < 60 ? "bg-yellow-500" : "bg-green-500";

  // Initialize localStorage structures used by dashboard widget
  useEffect(() => {
    if (!localStorage.getItem("oilManagement.purchases")) {
      const lsPurchases = (oilPurchases || []).map((p) => ({ date: p.date, quantityLiters: (p.quantity || 0) * 220 }));
      localStorage.setItem("oilManagement.purchases", JSON.stringify(lsPurchases));
    }
    if (!localStorage.getItem("oilManagement.consumptions")) {
      const lsConsumptions = (oilConsumptions || []).map((c) => ({ date: c.date, quantityLiters: (c.quantity || 0) * 220 }));
      localStorage.setItem("oilManagement.consumptions", JSON.stringify(lsConsumptions));
    }
    if (!localStorage.getItem("oilManagement.baseStockLiters")) {
      localStorage.setItem("oilManagement.baseStockLiters", "0");
    }
  }, []);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [consumptionDialogOpen, setConsumptionDialogOpen] = useState(false);
  const [drainDialogOpen, setDrainDialogOpen] = useState(false);

  const [purchaseForm, setPurchaseForm] = useState<Omit<OilPurchase, "id">>({
    date: new Date(),
    quantity: 0,
    price: 0,
    paymentMethod: "cash",
  });
  const [consumptionForm, setConsumptionForm] = useState<
    Omit<OilConsumption, "id">
  >({
    date: new Date(),
    quantity: 0,
    driver: "",
    truck: "",
  });
  const [drainForm, setDrainForm] = useState<Omit<OilDrain, "id">>({
    date: new Date(),
    quantity: 0,
    price: 0,
    paymentMethod: "cash",
  });

  const addPurchase = () => {
    const newPurchase: OilPurchase = { id: Date.now(), ...purchaseForm };
    addOilPurchase(newPurchase);

    // Persist capacity for this row
    const caps = JSON.parse(localStorage.getItem("oilManagement.purchaseCapacities") || "{}");
    caps[newPurchase.id] = purchaseCapacityLiters;
    localStorage.setItem("oilManagement.purchaseCapacities", JSON.stringify(caps));

    // Mirror purchase in liters for dashboard widget
    const purchasesLS = JSON.parse(localStorage.getItem("oilManagement.purchases") || "[]");
    purchasesLS.push({
      date: newPurchase.date,
      quantityLiters: (purchaseForm.quantity || 0) * purchaseCapacityLiters,
    });
    localStorage.setItem("oilManagement.purchases", JSON.stringify(purchasesLS));

    const accountAffected =
      purchaseForm.paymentMethod === "cash"
        ? "espece"
        : purchaseForm.paymentMethod === "check"
        ? "cheque"
        : "autre";

    addCashOperation({
      id: Date.now(),
      date: newPurchase.date,
      description: `Achat d'huile - ${newPurchase.quantity} barils`,
      amount: newPurchase.price,
      type: "retrait",
      category: "Achat",
      paymentMethod: purchaseForm.paymentMethod,
      status: "pending",
      accountAffected,
    });

    setPurchaseDialogOpen(false);
  };

  const addConsumption = () => {
    const newConsumption: OilConsumption = { id: Date.now(), ...consumptionForm };
    addOilConsumption(newConsumption);

    // Persist capacity for this row
    const caps = JSON.parse(localStorage.getItem("oilManagement.consumptionCapacities") || "{}");
    caps[newConsumption.id] = consumptionCapacityLiters;
    localStorage.setItem("oilManagement.consumptionCapacities", JSON.stringify(caps));

    setConsumptionDialogOpen(false);
  };

  const addDrain = () => {
    const newDrain: OilDrain = { id: Date.now(), ...drainForm };
    addOilDrain(newDrain);

    // Treat drain as consumption in liters for dashboard
    const consumptionsLS = JSON.parse(localStorage.getItem("oilManagement.consumptions") || "[]");
    consumptionsLS.push({
      date: newDrain.date,
      quantityLiters: (drainForm.quantity || 0) * drainCapacityLiters,
    });
    localStorage.setItem("oilManagement.consumptions", JSON.stringify(consumptionsLS));

    const accountAffected =
      drainForm.paymentMethod === "cash"
        ? "espece"
        : drainForm.paymentMethod === "check"
        ? "cheque"
        : "autre";

    addCashOperation({
      id: Date.now(),
      date: newDrain.date,
      description: `Vidange barils d'huile - ${newDrain.quantity} barils`,
      amount: newDrain.price,
      type: "retrait",
      category: "Achat",
      paymentMethod: drainForm.paymentMethod,
      status: "pending",
      accountAffected,
    });

    setDrainDialogOpen(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestion de l'Huile</h1>
          <p className="text-muted-foreground">Suivez les stocks de barils et la consommation par véhicule.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Status Card */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-blue-50/50 border-b">
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Droplet className="w-5 h-5" />
              État du Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 flex flex-col items-center justify-center space-y-6">
            <OilBarrel level={oilLevelPct} />
            
            <div className="text-center space-y-2">
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold">{oilLevelPct.toFixed(1)}%</span>
                <Badge
                  variant={oilLevelPct > 70 ? "default" : oilLevelPct > 30 ? "secondary" : "destructive"}
                  className="mt-1"
                >
                  {oilLevelPct > 70 ? "Niveau optimal" : oilLevelPct > 30 ? "Niveau moyen" : "Niveau bas"}
                </Badge>
              </div>
              
              <div className="pt-2">
                <p className="text-xl font-bold">
                  {Math.round(currentStockLiters).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">L</span>
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Stock Actuel / {Math.round(totalCapacityLiters).toLocaleString()} L</p>
              </div>
            </div>

            <div className="w-full space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Nombre de Barils</Label>
                <div className="flex items-center bg-secondary/50 rounded-lg p-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => adjustBarrelCount(-1)} disabled={barrelCount <= 1}>
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-bold w-12 text-center">{barrelCount}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => adjustBarrelCount(1)} disabled={barrelCount >= 20}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-2 max-h-[120px] overflow-auto p-2">
                {barrels.map((i) => (
                  <motion.div 
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="relative w-8 h-10 group cursor-help"
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-gray-300 to-gray-500 rounded border border-gray-400 shadow-sm overflow-hidden">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${oilLevelPct}%` }}
                        className={`absolute bottom-0 left-0 right-0 ${oilLevelPct > 70 ? 'bg-blue-600' : oilLevelPct > 30 ? 'bg-yellow-500' : 'bg-orange-600'}`}
                      />
                      <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500" onClick={() => setPurchaseDialogOpen(true)}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nouvel Achat</p>
                <h3 className="text-xl font-bold mt-1">Approvisionner</h3>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <ShoppingCart className="w-6 h-6 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500" onClick={() => setConsumptionDialogOpen(true)}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Consommation</p>
                <h3 className="text-xl font-bold mt-1">Enregistrer Utilisation</h3>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Droplet className="w-6 h-6 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="sm:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Gauge className="w-4 h-4 text-primary" />
                Résumé des Mouvements
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-xl">
                <p className="text-xs text-muted-foreground uppercase">Total Acheté</p>
                <p className="text-xl font-bold">{totalPurchasedLiters.toLocaleString()} L</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-xl">
                <p className="text-xs text-muted-foreground uppercase">Total Consommé</p>
                <p className="text-xl font-bold">{totalConsumedLiters.toLocaleString()} L</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Purchases Table */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              <CardTitle>Historique des Achats</CardTitle>
            </div>
            <Button size="sm" variant="outline" onClick={() => setDrainDialogOpen(true)} className="text-red-600 hover:bg-red-50 gap-2">
              <Trash2 className="w-4 h-4" />
              Vider Stock
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Quantité</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Prix Total</TableHead>
                    <TableHead>Mode</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {oilPurchases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                          Aucun achat enregistré
                        </TableCell>
                      </TableRow>
                    ) : (
                      oilPurchases.map((p, idx) => (
                        <motion.tr 
                          key={p.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.05 }}
                        >
                          <TableCell className="font-medium">{format(p.date, "dd/MM/yyyy")}</TableCell>
                          <TableCell>{p.quantity} barils</TableCell>
                          <TableCell>{((p.quantity || 0) * (purchaseCapacities[p.id] ?? 220)).toLocaleString()} L</TableCell>
                          <TableCell className="font-bold">{formatMAD(p.price)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{p.paymentMethod}</Badge>
                          </TableCell>
                        </motion.tr>
                      ))
                    )}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Consumptions Table */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <Droplet className="w-5 h-5 text-primary" />
              <CardTitle>Historique des Consommations</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Véhicule / Chauffeur</TableHead>
                    <TableHead>Quantité</TableHead>
                    <TableHead>Volume</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {oilConsumptions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                          Aucune consommation enregistrée
                        </TableCell>
                      </TableRow>
                    ) : (
                      oilConsumptions.map((c, idx) => (
                        <motion.tr 
                          key={c.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.05 }}
                        >
                          <TableCell className="font-medium">{format(c.date, "dd/MM/yyyy")}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{c.truck}</span>
                              <span className="text-xs text-muted-foreground">{c.driver}</span>
                            </div>
                          </TableCell>
                          <TableCell>{c.quantity} barils</TableCell>
                          <TableCell>{((c.quantity || 0) * (consumptionCapacities[c.id] ?? 220)).toLocaleString()} L</TableCell>
                        </motion.tr>
                      ))
                    )}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Purchase Dialog */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un Achat d'Huile</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Quantité (barils)
              </Label>
              <Input
                id="quantity"
                type="number"
                className="col-span-3"
                onChange={(e) =>
                  setPurchaseForm({
                    ...purchaseForm,
                    quantity: parseInt(e.target.value),
                  })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price" className="text-right">
                Prix (MAD)
              </Label>
              <Input
                id="price"
                type="number"
                className="col-span-3"
                onChange={(e) =>
                  setPurchaseForm({
                    ...purchaseForm,
                    price: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="payment" className="text-right">
                Paiement
              </Label>
              <Select
                onValueChange={(value) =>
                  setPurchaseForm({
                    ...purchaseForm,
                    paymentMethod: value as "cash" | "credit" | "check",
                  })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Méthode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addPurchase}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consumption Dialog */}
      <Dialog open={consumptionDialogOpen} onOpenChange={setConsumptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une Consommation</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="c-quantity" className="text-right">
                Quantité (barils)
              </Label>
              <Input
                id="c-quantity"
                type="number"
                className="col-span-3"
                onChange={(e) =>
                  setConsumptionForm({
                    ...consumptionForm,
                    quantity: parseInt(e.target.value),
                  })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="driver" className="text-right">
                Chauffeur
              </Label>
              <Input
                id="driver"
                className="col-span-3"
                onChange={(e) =>
                  setConsumptionForm({ ...consumptionForm, driver: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="truck" className="text-right">
                Camion
              </Label>
              <Input
                id="truck"
                className="col-span-3"
                onChange={(e) =>
                  setConsumptionForm({ ...consumptionForm, truck: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addConsumption}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drain Dialog */}
      <Dialog open={drainDialogOpen} onOpenChange={setDrainDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vider barils d'huile</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="d-quantity" className="text-right">
                Quantité (barils)
              </Label>
              <Input
                id="d-quantity"
                type="number"
                className="col-span-3"
                onChange={(e) =>
                  setDrainForm({
                    ...drainForm,
                    quantity: parseInt(e.target.value),
                  })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="d-price" className="text-right">
                Prix (MAD)
              </Label>
              <Input
                id="d-price"
                type="number"
                className="col-span-3"
                onChange={(e) =>
                  setDrainForm({
                    ...drainForm,
                    price: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Capacité par baril (L)</Label>
              <Select onValueChange={(v) => setDrainCapacityLiters(parseInt(v))}>
                <SelectTrigger className="col-span-3"><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="60">60</SelectItem>
                  <SelectItem value="220">220</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addDrain}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barrels configuration card: names + capacities */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Configuration des Barils</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {barrelsConfig.map((b, idx) => (
            <div key={idx} className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Nom du baril #{idx + 1}</Label>
              <Input
                className="col-span-1"
                value={b.name}
                onChange={(e) => {
                  const next = [...barrelsConfig];
                  next[idx] = { ...next[idx], name: e.target.value };
                  setBarrelsConfig(next);
                  localStorage.setItem("oilManagement.barrelsConfig", JSON.stringify(next));
                }}
              />
              <Label className="text-right">Capacité (L)</Label>
              <Select
                value={String(b.capacityLiters)}
                onValueChange={(v) => {
                  const next = [...barrelsConfig];
                  next[idx] = { ...next[idx], capacityLiters: parseInt(v) };
                  setBarrelsConfig(next);
                  localStorage.setItem("oilManagement.barrelsConfig", JSON.stringify(next));
                }}
              >
                <SelectTrigger className="col-span-1">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="60">60</SelectItem>
                  <SelectItem value="220">220</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default OilManagement;
