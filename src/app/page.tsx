"use client"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { convert } from "@/lib/convertor";
import { Firma } from "@/lib/firma";
import { useState } from "react";
import { toast } from "sonner";

export default function Home() {
  const [cui, setCui] = useState("");
  const [firma, setFirma] = useState<null | Firma>(null);
  const [cuiSearching, setCuiSearching] = useState(false);
  const [locatieImport, setLocatieImport] = useState("");
  const [selectedFile, setSelectedFile] = useState<null | File>(null)

  // cui button click
  const handleCuiClick = async () => {
    if (cui === "") {
      toast.error("CUI-ul trebuie introdus");
      setFirma(null);
    } else {
      setCuiSearching(true);
      setFirma(null);

      // get firma
      let response = await fetch('/api/firma', {
        method: 'POST',
        body: JSON.stringify({ cuis: [cui] }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      setCuiSearching(false);

      if (response.ok) {
        let data = await response.json();
        setFirma(data[0]);
      } else {
        toast.error("CUI-ul nu a fost găsit");
      }
    }
  }

  const handleConvertClick = async () => {
    // check firma
    if (!firma) {
      toast.error("Trebuie selectată o firmă");
      return;
    }

    // check locatie import
    if (locatieImport === "") {
      toast.error("Trebuie selectată locația de import");
      return;
    }

    // check file
    if (!selectedFile) {
      toast.error("Trebuie selectat un fișier");
      return;
    }

    // check file extension
    if (selectedFile.name.split(".").pop() !== "xlsx") { //  && selectedFile.name.split(".").pop() !== "xls"
      toast.error("Fișierul trebuie să fie de tipul .xlsx");
      return;
    }

    toast.info("Se începe conversia...");

    // convert
    try {

      let outputFile = await convert(firma, locatieImport, selectedFile);

      // download
      const element = document.createElement("a");
      element.href = URL.createObjectURL(outputFile);
      element.download = "F_" + firma.cui + "_" + locatieImport + "_" + new Date().toISOString().slice(0, 10) + ".xml";
      document.body.appendChild(element); // Required for this to work in FireFox
      element.click();
    } catch (error) {
      toast.error("Eroare întampinată - " + error);
      console.error(error);
    }
  }


  return (
    <main className="flex min-h-screen flex-col items-start justify-start p-24">
      {/* header */}
      <div className="flex items-center justify-between w-full mb-10">
        <p className="text-xl font-bold">Excel to SAGA XML converter</p>
      </div>

      {/* company selection */}
      <div className="mb-10">
        <Label htmlFor="cui">CUI firma SAGA (fara RO)</Label>
        <Input id="cui" placeholder="CUI firma SAGA" value={cui} onChange={(e) => setCui(e.target.value)} />
        <Button className="mt-2" onClick={handleCuiClick}>Selectează</Button>
      </div>

      {/* firma */}
      {cuiSearching ? <div className="space-y-2">
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[350px]" />
        <Skeleton className="h-4 w-[300px]" />
      </div> : null}
      {firma ? (
        <div>
          <p className="text-xl font-bold">Firma selectată</p>
          <div className="mt-2">
            <p className="text-sm">CUI: <span className="font-bold">{firma.cui}</span></p>
            <p className="text-sm">Denumire: <span className="font-bold">{firma.denumire}</span></p>
            <p className="text-sm">Adresa: <span className="font-bold">{firma.adresa}</span></p>
            <p className="text-sm">Nr Reg Com: <span className="font-bold">{firma.nr_reg_com}</span></p>
            <p className="text-sm">Judet: <span className="font-bold">{firma.judet}</span></p>
            <p className="text-sm">Localitate: <span className="font-bold">{firma.localitate}</span></p>
          </div>
        </div>
      ) : null}

      {/* locatie import */}
      {firma ? (
        <div className="mt-10">
          <Label htmlFor="locatieImport">Selectează locul unde să se importe facturile</Label>
          <Select onValueChange={(e) => setLocatieImport(e)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selectează locatie" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="intrari">Intrări</SelectItem>
                <SelectItem value="iesiri">Ieșiri</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      ) : null
      }

      {/* excel facturi */}
      {
        firma ? (
          <div className="mt-10">
            <Label htmlFor="facturi">Selectează fișierul Excel cu facturile</Label>
            <Input id="facturi" type="file" onChange={(e) => {
              setSelectedFile(null);
              if (e.target.files) {
                const file = e.target.files[0];
                if (file) {
                  toast.success("Fișierul a fost încărcat cu succes " + file.name);
                  setSelectedFile(file);
                }
              }
            }} />
          </div>
        ) : null
      }

      {/* convert button */}
      {
        firma ? (
          <div className="mt-10">
            <Button onClick={handleConvertClick}>Convertește</Button>
          </div>
        ) : null
      }

      {/* footer */}
    </main >
  );
}
