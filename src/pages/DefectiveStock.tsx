import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApp } from '@/contexts/AppContext';
import { AlertTriangle, Package, PlusCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AddDefectiveStockDialog } from '@/components/dialogs/AddDefectiveStockDialog';
import { BottleType } from '@/types';

const DefectiveStock = () => {
  const { defectiveBottles = [], bottleTypes, addDefectiveStock } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBottleType, setSelectedBottleType] = useState<BottleType | null>(null);

  const handleOpenDialog = (bottleType: BottleType) => {
    setSelectedBottleType(bottleType);
    setDialogOpen(true);
  };

  // Group by bottle type
  const groupedByType = defectiveBottles.reduce((acc, bottle) => {
    const key = bottle.bottleTypeId;
    if (!acc[key]) {
      acc[key] = {
        bottleTypeId: bottle.bottleTypeId,
        bottleTypeName: bottle.bottleTypeName,
        totalQuantity: 0,
        entries: []
      };
    }
    acc[key].totalQuantity += bottle.quantity;
    acc[key].entries.push(bottle);
    return acc;
  }, {} as Record<string, { bottleTypeId: string; bottleTypeName: string; totalQuantity: number; entries: typeof defectiveBottles }>);

  const totalDefective = defectiveBottles.reduce((sum, b) => sum + b.quantity, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock de Bouteilles Défectueuses</h1>
          <p className="text-muted-foreground mt-1">
            Gestion des bouteilles défectueuses retournées
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Défectueux</p>
                <p className="text-2xl font-bold">{totalDefective}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Types de Bouteilles</p>
                <p className="text-2xl font-bold">{Object.keys(groupedByType).length}</p>
              </div>
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Entrées</p>
                <p className="text-2xl font-bold">{defectiveBottles.length}</p>
              </div>
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock Summary by Type */}
      <Card>
        <CardHeader>
          <CardTitle>Stock par Type</CardTitle>
        </CardHeader>
        <CardContent>
          {bottleTypes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type de Bouteille</TableHead>
                  <TableHead className="text-right">Quantité Actuelle</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bottleTypes.map((bottleType) => {
                  const totalQuantity = groupedByType[bottleType.id]?.totalQuantity || 0;
                  return (
                    <TableRow key={bottleType.id}>
                      <TableCell className="font-medium">{bottleType.name}</TableCell>
                      <TableCell className="text-right font-bold">{totalQuantity}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(bottleType)}>
                          <PlusCircle className="w-4 h-4 mr-2" />
                          Ajouter
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Aucun type de bouteille configuré. Veuillez en ajouter un d'abord.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed History */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des Entrées</CardTitle>
        </CardHeader>
        <CardContent>
          {defectiveBottles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>B.D Référence</TableHead>
                  <TableHead>Type de Bouteille</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defectiveBottles.slice().reverse().map((bottle) => (
                  <TableRow key={bottle.id}>
                    <TableCell>{new Date(bottle.date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell className="font-medium">{bottle.returnOrderId}</TableCell>
                    <TableCell>{bottle.bottleTypeName}</TableCell>
                    <TableCell className="text-right">{bottle.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Aucune entrée enregistrée
            </div>
          )}
        </CardContent>
      </Card>

      {selectedBottleType && (
        <AddDefectiveStockDialog
          bottleType={selectedBottleType}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </div>
  );
};

export default DefectiveStock;
