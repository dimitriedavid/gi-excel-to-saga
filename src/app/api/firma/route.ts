import { Firma } from "@/lib/firma";
import { NextRequest } from "next/server";

const queryCUIs = (async (cuis: string[]): Promise<Firma[] | string> => {
    try {
        // make a POST request to the server
        let url = "https://webservicesp.anaf.ro/PlatitorTvaRest/api/v8/ws/tva";
        let data = cuis.map(c => {
            return {
                cui: c,
                // date has to be formated like 'YYYY-MM-DD'
                data: new Date().toISOString().slice(0, 10)
            }
        });

        let response = await fetch(url, {
            method: "POST",
            body: JSON.stringify(data),
            headers: {
                "Content-Type": "application/json",
            }
        });

        let json: any;
        try {
            json = await response.json();
        } catch (error) {
            console.error(await response.text());
            throw new Error("Could not parse response as JSON");
        }

        if (json.found.length !== cuis.length) {
            // find missing CUIs
            let foundCuis = json.found.map((f: any) => f.date_generale.cui);
            let missingCuis = cuis.filter(c => !foundCuis.includes(c));

            throw new Error("Not all CUIs were found. Missing CUIs: " + missingCuis.join(", "));
        }

        let firme: Firma[] = json.found.map((f: any) => {
            let tva: boolean = f.inregistrare_scop_Tva.scpTVA;
            return {
                denumire: f.date_generale.denumire,
                cui: tva ? "RO" + f.date_generale.cui : f.date_generale.cui,
                nr_reg_com: f.date_generale.nrRegCom,
                adresa: f.date_generale.adresa,
                judet: f.adresa_sediu_social.scod_JudetAuto,
                localitate: f.adresa_sediu_social.sdenumire_Localitate
            }
        });

        return firme;
    }
    catch (error) {
        console.error(error);
        return JSON.stringify(error);
    }
})

export async function POST(req: NextRequest) {
    let { cuis } = await req.json();

    let data = await queryCUIs(cuis);

    if (typeof data === "string") {
        return new Response(data, { status: 500 });
    }

    return new Response(JSON.stringify(data), { status: 200 });
}