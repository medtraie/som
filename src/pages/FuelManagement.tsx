import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
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
  DialogDescription,
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
import { FuelPurchase, FuelConsumption, FuelDrain } from "@/types";
import { format } from "date-fns";
import React from "react";
import OilManagement from "./OilManagement";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Fuel, 
  History, 
  TrendingUp, 
  Settings2, 
  Droplet, 
  Plus, 
  Trash2,
  Calendar,
  Gauge,
  Truck,
  User,
  CreditCard,
  DollarSign
} from "lucide-react";

interface FuelTankProps {
  level: number; // Percentage from 0 to 100
}

// Définition de l'ancien composant FuelTank (conservé pour compatibilité si besoin)
const FuelTank: React.FC<FuelTankProps> = ({ level }) => {
  const color = level < 30 ? "#ef4444" : level < 60 ? "#f59e0b" : "#22c55e";
  const fillHeight = Math.max(0, Math.min(100, level));

  return (
    <div className="relative w-32 h-48 mx-auto">
      <svg viewBox="0 0 100 140" className="w-full h-full">
        <defs>
          <clipPath id="fuelTankClip">
            <rect x="10" y="10" width="80" height="120" rx="10" />
          </clipPath>
        </defs>

        {/* Tank background */}
        <rect x="10" y="10" width="80" height="120" rx="10" fill="#e5e7eb" />

        {/* Fuel liquid */}
        <g clipPath="url(#fuelTankClip)">
          <rect
            x="10"
            y={10 + 120 * (1 - fillHeight / 100)}
            width="80"
            height={120 * (fillHeight / 100)}
            fill={color}
            style={{ transition: "y 0.7s ease-in-out, height 0.7s ease-in-out" }}
          />
        </g>

        {/* Tank outline */}
        <rect x="10" y="10" width="80" height="120" rx="10" fill="none" stroke="#9ca3af" strokeWidth="2" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-2xl font-bold text-gray-700">{level.toFixed(1)}%</span>
      </div>
    </div>
  );
};

const FuelManagement = () => {
  const {
    drivers,
    trucks,
    fuelPurchases,
    addFuelPurchase,
    fuelConsumptions,
    addFuelConsumption,
    fuelDrains,
    addFuelDrain,
    addCashOperation,
  } = useApp();

  // Sous-composant local pour l’affichage du niveau (évite toute redéclaration globale)
  const CisternTank: React.FC<{ level: number }> = ({ level }) => {
    const pct = Math.max(0, Math.min(100, level));
    const fillHeight = 120 * (pct / 100);
    const color = pct < 25 ? "#ef4444" : pct < 75 ? "#f59e0b" : "#22c55e";

    return (
      <div className="relative w-44 md:w-60 lg:w-72 mx-auto">
        <svg viewBox="0 0 140 180" className="w-full h-auto">
          <defs>
            <clipPath id="batteryClip">
              <rect x="20" y="30" width="100" height="130" rx="10" />
            </clipPath>
          </defs>

        {/* Tank Cap */}
          <rect x="58" y="16" width="24" height="10" rx="2" fill="#4b5563" />

        {/* Tank Body */}
          <rect x="20" y="30" width="100" height="130" rx="10" fill="#374151" />
          <rect
            x="22"
            y="32"
            width="96"
            height="126"
            rx="8"
            fill="#111827"
            stroke="#6b7280"
            strokeWidth="1.5"
          />

          {/* Filling */}
          <g clipPath="url(#batteryClip)">
            <rect
              x="20"
              y={160 - fillHeight}
              width="100"
              height={fillHeight}
              fill={color}
              style={{ transition: "y 0.5s ease, height 0.5s ease" }}
              opacity="0.9"
            />
          </g>

        {/* Outer Frame */}
          <rect
            x="20"
            y="30"
            width="100"
            height="130"
            rx="10"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="2"
          />
        </svg>

        {/* Percentage in center */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xl md:text-2xl font-bold text-gray-100 drop-shadow">
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
    );
  };

  // Format MAD
  const formatMAD = (amount: number) =>
    new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", minimumFractionDigits: 2 }).format(amount);

  // Propriétés du réservoir
  const capacity = 20000; // L
  const baseStockLiters = 0;

  // Totaux
  const totalPurchased = useMemo(
    () => fuelPurchases.reduce((s, p) => s + p.quantityLiters, 0),
    [fuelPurchases]
  );
  const totalConsumed = useMemo(
    () => fuelConsumptions.reduce((s, c) => s + c.liters, 0),
    [fuelConsumptions]
  );
  const totalDrained = useMemo(
    () => fuelDrains.reduce((s, d) => s + d.quantityLiters, 0),
    [fuelDrains]
  );

  // Stock et niveau
  const currentStockLiters = Math.max(0, baseStockLiters + totalPurchased - totalConsumed - totalDrained);
  const fuelLevelPct = Math.min(100, (currentStockLiters / capacity) * 100);

  // Dialogues et formulaires
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [consumptionDialogOpen, setConsumptionDialogOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  
  const [drainDialogOpen, setDrainDialogOpen] = useState(false);
    

  const [purchaseForm, setPurchaseForm] = useState<Omit<FuelPurchase, "id">>({
    date: new Date(),
    quantityLiters: 0,
    price: 0,
    paymentMethod: "Espèces",
  });
  const [consumptionForm, setConsumptionForm] = useState<Omit<FuelConsumption, "id">>({
    date: new Date(),
    liters: 0,
    driver: "",
    truck: "",
    mileageKm: 0,
  });
  const [drainForm, setDrainForm] = useState<Omit<FuelDrain, "id">>({
    date: new Date(),
    quantityLiters: 0,
    price: 0,
    paymentMethod: "Espèces",
  });

  // Seuils configurables
  const [perfLimits, setPerfLimits] = useState({ greenMax: 25, yellowMax: 35 });

  // Badge couleur selon L/100km
  const perfBadge = (lPer100?: number | null) => {
    if (lPer100 == null) return "bg-gray-200 text-gray-700";
    if (lPer100 > perfLimits.yellowMax) return "bg-red-100 text-red-800";
    if (lPer100 >= perfLimits.greenMax) return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-800";
  };

  // Performance par chauffeur
  const driverPerformance = useMemo(() => {
    const acc: Record<string, { liters: number; km: number }> = {};
    fuelConsumptions.forEach((c) => {
      const name = c.driver || "N/A";
      const km = c.mileageKm || 0;
      acc[name] = {
        liters: (acc[name]?.liters || 0) + (c.liters || 0),
        km: (acc[name]?.km || 0) + km,
      };
    });
    return Object.entries(acc)
      .map(([driver, { liters, km }]) => ({
        driver,
        liters,
        km,
        lPer100: km > 0 ? (liters / km) * 100 : null,
      }))
      .sort((a, b) => (b.lPer100 ?? -Infinity) - (a.lPer100 ?? -Infinity));
  }, [fuelConsumptions, perfLimits]);

  // Données pour graphique
  const driversList = useMemo(
    () => Array.from(new Set(fuelConsumptions.map((c) => c.driver).filter(Boolean))),
    [fuelConsumptions]
  );
  const [chartDriver, setChartDriver] = useState<string>("");
  const driverSeries = useMemo(() => {
    const rows = fuelConsumptions
      .filter((c) => (chartDriver ? c.driver === chartDriver : true))
      .map((c) => ({
        date: c.date,
        lPer100: c.mileageKm && c.mileageKm > 0 ? (c.liters / c.mileageKm) * 100 : null,
      }))
      .filter((pt) => pt.lPer100 !== null)
      .sort((a, b) => +new Date(a.date) - +new Date(b.date));
    return rows as Array<{ date: Date; lPer100: number }>;
  }, [fuelConsumptions, chartDriver]);

  const addPurchase = () => {
    const newPurchase: FuelPurchase = {
      id: Date.now(),
      ...purchaseForm,
    };
    addFuelPurchase(newPurchase);

    const accountAffected =
      purchaseForm.paymentMethod === "Espèces"
        ? "espece"
        : purchaseForm.paymentMethod === "Chèque"
        ? "cheque"
        : "banque";

    addCashOperation({
      id: Date.now(),
      date: newPurchase.date,
      description: `Achat carburant - ${newPurchase.quantityLiters}L`,
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
    const newConsumption: FuelConsumption = {
      id: Date.now(),
      ...consumptionForm,
    };
    addFuelConsumption(newConsumption);
    setConsumptionDialogOpen(false);
  };

  const addDrain = () => {
    const newDrain: FuelDrain = {
      id: Date.now(),
      ...drainForm,
    };
    addFuelDrain(newDrain);

    const accountAffected =
      drainForm.paymentMethod === "Espèces"
        ? "espece"
        : drainForm.paymentMethod === "Chèque"
        ? "cheque"
        : "banque";

    addCashOperation({
      id: Date.now(),
      date: newDrain.date,
      description: `Vidange réservoir carburant - ${newDrain.quantityLiters}L`,
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
      className="p-4 md:p-8 space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestion du Carburant</h1>
          <p className="text-muted-foreground">Surveillez et gérez votre stock de carburant et la consommation.</p>
        </div>
      </div>

      {/* Stock status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 overflow-hidden">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <Fuel className="w-5 h-5 text-primary" />
              État du Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 flex flex-col items-center justify-center space-y-4">
            <CisternTank level={fuelLevelPct} />
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold">
                {currentStockLiters.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">L</span>
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${fuelLevelPct}%` }}
                    className={`h-full ${fuelLevelPct < 25 ? 'bg-red-500' : fuelLevelPct < 75 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  />
                </div>
                <span>{fuelLevelPct.toFixed(0)}%</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">Capacité totale: {capacity.toLocaleString()} L</p>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Acheté</p>
                  <h3 className="text-2xl font-bold">{totalPurchased.toLocaleString()} L</h3>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Consommé</p>
                  <h3 className="text-2xl font-bold">{totalConsumed.toLocaleString()} L</h3>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Droplet className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Vidangé</p>
                  <h3 className="text-2xl font-bold">{totalDrained.toLocaleString()} L</h3>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Ravitaillements</p>
                  <h3 className="text-2xl font-bold">{fuelPurchases.length}</h3>
                </div>
                <div className="p-3 bg-primary/10 rounded-full">
                  <History className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Operations Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Ravitaillements Table */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <CardTitle>Ravitaillements</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setPurchaseDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Acheter
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDrainDialogOpen(true)}
                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                Vider
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Quantité (L)</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead>Paiement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {fuelPurchases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Aucun ravitaillement enregistré
                        </TableCell>
                      </TableRow>
                    ) : (
                      fuelPurchases.map((p, idx) => (
                        <motion.tr
                          key={p.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                              {format(p.date, "dd/MM/yyyy")}
                            </div>
                          </TableCell>
                          <TableCell>{p.quantityLiters.toLocaleString()} L</TableCell>
                          <TableCell>{formatMAD(p.price)}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                              {p.paymentMethod}
                            </span>
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

        {/* Consommations Table */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <Droplet className="w-5 h-5 text-primary" />
              <CardTitle>Consommations</CardTitle>
            </div>
            <Button size="sm" onClick={() => setConsumptionDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Consommer
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Chauffeur/Camion</TableHead>
                    <TableHead>Quantité</TableHead>
                    <TableHead>Performance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {fuelConsumptions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Aucune consommation enregistrée
                        </TableCell>
                      </TableRow>
                    ) : (
                      fuelConsumptions.map((c, idx) => {
                        const lPer100 = c.mileageKm && c.mileageKm > 0 ? (c.liters / c.mileageKm) * 100 : null;
                        return (
                          <motion.tr
                            key={c.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className="hover:bg-muted/50 transition-colors"
                          >
                            <TableCell className="font-medium">
                              {format(c.date, "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{c.driver}</span>
                                <span className="text-xs text-muted-foreground">{c.truck} • {c.mileageKm?.toLocaleString()} km</span>
                              </div>
                            </TableCell>
                            <TableCell>{c.liters.toLocaleString()} L</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${perfBadge(lPer100 ?? undefined)}`}>
                                {lPer100 !== null ? `${lPer100.toFixed(2)} L/100` : "-"}
                              </span>
                            </TableCell>
                          </motion.tr>
                        );
                      })
                    )}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance par Chauffeur */}
        <Card>
          <CardHeader className="bg-muted/30">
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-primary" />
              <div>
                <CardTitle>Performance par Chauffeur</CardTitle>
                <CardDescription>Consommation moyenne (L/100km)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chauffeur</TableHead>
                  <TableHead className="text-right">Total (L)</TableHead>
                  <TableHead className="text-right">Total (km)</TableHead>
                  <TableHead className="text-center">Efficacité</TableHead>
                </TableRow>
              </TableHeader>
                <TableBody>
                  {driverPerformance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Aucune donnée de performance
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {driverPerformance.map((d) => (
                        <TableRow key={d.driver}>
                          <TableCell className="font-medium">{d.driver}</TableCell>
                          <TableCell className="text-right">{d.liters.toLocaleString()} L</TableCell>
                          <TableCell className="text-right">{d.km.toLocaleString()} km</TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${perfBadge(d.lPer100 ?? undefined)}`}>
                              {d.lPer100 !== null ? `${d.lPer100.toFixed(2)} L/100` : "-"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>Total Général</TableCell>
                        <TableCell className="text-right">
                          {driverPerformance.reduce((s, d) => s + d.liters, 0).toLocaleString()} L
                        </TableCell>
                        <TableCell className="text-right">
                          {driverPerformance.reduce((s, d) => s + d.km, 0).toLocaleString()} km
                        </TableCell>
                        <TableCell className="text-center">
                          {(() => {
                            const totalL = driverPerformance.reduce((s, d) => s + d.liters, 0);
                            const totalKm = driverPerformance.reduce((s, d) => s + d.km, 0);
                            const avg = totalKm > 0 ? (totalL / totalKm) * 100 : 0;
                            return (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${perfBadge(avg)}`}>
                                {avg.toFixed(2)} L/100 (Moy.)
                              </span>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Configuration des Seuils */}
        <Card>
          <CardHeader className="bg-muted/30">
            <div className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              <div>
                <CardTitle>Seuils de Performance</CardTitle>
                <CardDescription>Configurez les limites L/100km</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  Limite Optimale (Vert)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-20 text-right"
                    value={perfLimits.greenMax}
                    onChange={(e) => setPerfLimits(p => ({ ...p, greenMax: parseFloat(e.target.value) || 0 }))}
                  />
                  <span className="text-xs text-muted-foreground">L/100</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  Limite d'Alerte (Jaune)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-20 text-right"
                    value={perfLimits.yellowMax}
                    onChange={(e) => setPerfLimits(p => ({ ...p, yellowMax: parseFloat(e.target.value) || 0 }))}
                  />
                  <span className="text-xs text-muted-foreground">L/100</span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-2">
              <p>• <span className="text-green-600 font-medium">Vert:</span> En dessous de {perfLimits.greenMax} L/100km</p>
              <p>• <span className="text-yellow-600 font-medium">Jaune:</span> Entre {perfLimits.greenMax} et {perfLimits.yellowMax} L/100km</p>
              <p>• <span className="text-red-600 font-medium">Rouge:</span> Au-dessus de {perfLimits.yellowMax} L/100km</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphique Évolution */}
      <Card>
        <CardHeader className="bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <CardTitle>Évolution de la Consommation</CardTitle>
            </div>
            <Select onValueChange={(value) => setChartDriver(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tous les chauffeurs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les chauffeurs</SelectItem>
                {driversList.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {driverSeries.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
              Aucune donnée historique disponible pour ce chauffeur
            </div>
          ) : (
            <div className="w-full h-[250px] relative">
              <svg viewBox="0 0 440 200" className="w-full h-full preserve-3d">
                <defs>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                
                {/* Axes */}
                <line x1="30" y1="170" x2="420" y2="170" stroke="currentColor" strokeOpacity="0.2" />
                <line x1="30" y1="20" x2="30" y2="170" stroke="currentColor" strokeOpacity="0.2" />

                {(() => {
                  const maxY = Math.max(...driverSeries.map((p) => p.lPer100), perfLimits.yellowMax + 5);
                  const scaleY = (v: number) => 170 - ((v / maxY) * 150);
                  const yGreen = scaleY(perfLimits.greenMax);
                  const yYellow = scaleY(perfLimits.yellowMax);
                  return (
                    <>
                      <line x1="30" y1={yGreen} x2="420" y2={yGreen} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity="0.5" />
                      <line x1="30" y1={yYellow} x2="420" y2={yYellow} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity="0.5" />
                    </>
                  );
                })()}

                {(() => {
                  const n = driverSeries.length;
                  const maxY = Math.max(...driverSeries.map((p) => p.lPer100), perfLimits.yellowMax + 5);
                  const scaleX = (i: number) => 30 + (i * (390 / Math.max(1, n - 1)));
                  const scaleY = (v: number) => 170 - ((v / maxY) * 150);
                  const points = driverSeries.map((p, i) => `${scaleX(i)},${scaleY(p.lPer100)}`).join(" ");
                  const areaPoints = `${scaleX(0)},170 ${points} ${scaleX(n-1)},170`;
                  return (
                    <>
                      <polygon points={areaPoints} fill="url(#lineGradient)" />
                      <motion.polyline 
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        points={points} 
                        fill="none" 
                        stroke="#3b82f6" 
                        strokeWidth="2.5" 
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {driverSeries.map((p, i) => (
                        <circle 
                          key={i} 
                          cx={scaleX(i)} 
                          cy={scaleY(p.lPer100)} 
                          r="4" 
                          fill="white" 
                          stroke="#3b82f6" 
                          strokeWidth="2" 
                          className="hover:r-6 transition-all"
                        />
                      ))}
                    </>
                  );
                })()}
              </svg>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Oil Management Section */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <OilManagement />
      </motion.div>

      {/* Purchase Dialog */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un Ravitaillement</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Quantité (L)
              </Label>
              <Input
                id="quantity"
                type="number"
                className="col-span-3"
                onChange={(e) =>
                  setPurchaseForm({
                    ...purchaseForm,
                    quantityLiters: parseFloat(e.target.value),
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
                    paymentMethod: value as "Espèces" | "Chèque" | "Virement",
                  })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Méthode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Espèces">Espèces</SelectItem>
                  <SelectItem value="Chèque">Chèque</SelectItem>
                  <SelectItem value="Virement">Virement</SelectItem>
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
            <DialogDescription>
              Enregistrez le carburant utilisé par un camion.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="liters" className="text-right">
                Litres
              </Label>
              <Input
                id="liters"
                type="number"
                className="col-span-3"
                onChange={(e) =>
                  setConsumptionForm({
                    ...consumptionForm,
                    liters: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="driver" className="text-right">
                Chauffeur
              </Label>
              <Select
                onValueChange={(value) => {
                  const selectedDriver = drivers.find((d) => d.id === value);
                  setConsumptionForm({
                    ...consumptionForm,
                    driver: selectedDriver ? selectedDriver.name : "",
                    truck: "", // Reset truck selection
                  });
                  setSelectedDriverId(value);
                }}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Sélectionner un chauffeur" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="truck" className="text-right">
                Camion
              </Label>
              <Select
                onValueChange={(value) =>
                  setConsumptionForm({ ...consumptionForm, truck: value })
                }
                value={consumptionForm.truck}
                disabled={!selectedDriverId}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Sélectionner un camion" />
                </SelectTrigger>
                <SelectContent>
                      {trucks
                    .filter((truck) => {
                      const driver = drivers.find(d => d.id === selectedDriverId);
                      // Filtre les camions associés au chauffeur sélectionné
                      // Note: On suppose ici une correspondance par index ou matricule si driverId n'est pas dispo
                      if (driver && truck.matricule) {
                        return true; // Pour l'instant on montre tous les camions si un chauffeur est choisi
                      }
                      return false;
                    })
                    .map((truck) => (
                      <SelectItem key={truck.id} value={truck.matricule}>
                        {truck.matricule}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {/* Nouveau: Kilométrage */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="mileage" className="text-right">
                Kilométrage (km)
              </Label>
              <Input
                id="mileage"
                type="number"
                className="col-span-3"
                value={consumptionForm.mileageKm || ""}
                onChange={(e) =>
                  setConsumptionForm({
                    ...consumptionForm,
                    mileageKm: parseFloat(e.target.value) || 0,
                  })
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
            <DialogTitle>Vider le réservoir</DialogTitle>
            <DialogDescription>
              Enregistrez une vidange du réservoir. Cela peut être utilisé pour enregistrer la vente de carburant ou corriger le stock.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="drain-quantity" className="text-right">
                Quantité (L)
              </Label>
              <Input
                id="drain-quantity"
                type="number"
                className="col-span-3"
                onChange={(e) =>
                  setDrainForm({
                    ...drainForm,
                    quantityLiters: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="drain-price" className="text-right">
                Prix (MAD)
              </Label>
              <Input
                id="drain-price"
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
              <Label htmlFor="drain-payment" className="text-right">
                Paiement
              </Label>
              <Select
                onValueChange={(value) =>
                  setDrainForm({
                    ...drainForm,
                    paymentMethod: value as "Espèces" | "Chèque" | "Virement",
                  })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Méthode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Espèces">Espèces</SelectItem>
                  <SelectItem value="Chèque">Chèque</SelectItem>
                  <SelectItem value="Virement">Virement</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addDrain}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default FuelManagement;
