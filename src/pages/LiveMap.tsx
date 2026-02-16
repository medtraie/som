import React from 'react';
import { Card } from "@/components/ui/card";
import { MapPin, ExternalLink, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const LiveMap = () => {
  const platformUrl = "http://sf-tracker.pro/";

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Carte Live</h1>
            <p className="text-sm text-muted-foreground">Suivi en temps réel des véhicules</p>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          onClick={() => window.open(platformUrl, '_blank')}
          className="gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Ouvrir dans un nouvel onglet
        </Button>
      </div>

      <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800 py-2">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-xs font-bold text-amber-700">Note de connexion</AlertTitle>
        <AlertDescription className="text-xs">
          Si vous ne pouvez pas vous connecter ici, veuillez cliquer sur le bouton <strong>"Ouvrir dans un nouvel onglet"</strong> ci-dessus pour vous connecter directement sur la plateforme.
        </AlertDescription>
      </Alert>

      <Card className="flex-1 overflow-hidden border-none shadow-sm bg-muted/50">
        <iframe
          src={platformUrl}
          className="w-full h-full border-0 rounded-xl shadow-lg"
          title="SF Tracker Live Map"
          allow="geolocation; clipboard-write; encrypted-media; picture-in-picture; web-share"
        />
      </Card>
    </div>
  );
};

export default LiveMap;
