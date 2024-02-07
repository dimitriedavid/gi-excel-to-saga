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

        let res_text = await response.text();
        if (res_text.includes("mentenanță")) {
            return "Serviciul ANAF este in mentenanta";
        }

        let json: any;
        try {
            json = JSON.parse(res_text);
        } catch (error) {
            console.error("Could not parse response as JSON; Text response from ANAF: \n" + res_text);
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

    let data: string | Firma[] = "";

    let retryCount = 5;
    let retryDelay = 1000;

    while (retryCount > 0) {
        data = await queryCUIs(cuis);

        if (typeof data === "string") {
            console.error(`Error when querying ANAF - retry ${retryCount}: ${data}`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryCount--;
        } else {
            return new Response(JSON.stringify(data), { status: 200 });
        }
    }

    return new Response(data, { status: 500 });
}