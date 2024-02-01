import { CellValue, Workbook } from "exceljs";
import { Firma } from "./firma";
import { Invoices, addInvoice, getXML } from "./xml";
import 'exceljs';
import { toast } from "sonner";

const cellValueToFloat = (cellValue: CellValue): number => {
    if (typeof cellValue === 'number') {
        return cellValue;
    } else if (typeof cellValue === 'string') {
        return parseFloat(cellValue);
    } else {
        throw new Error('cellValueToFloat: invalid cell value');
    }
}

const trimCUI = (cui: string): string => {
    cui = cui.toString();

    if (typeof cui !== 'string') {
        throw new Error('trimCUI: cui is not a string - ' + cui + ' - ' + typeof cui);
    }

    // trim whitespace
    cui = cui.trim();

    // remove "RO" prefix if present
    if (cui.startsWith('RO')) {
        cui = cui.substring(2);
    }
    return cui;
}


const workbookToXML = (async (firmaSaga: Firma, locatieImport: string, wb: Workbook): Promise<Blob> => {
    return new Promise<Blob>(async (resolve, reject) => {
        if (wb.worksheets[0].getCell('C1').value !== 'tert') {
            reject('fisier Excel invalid: coloana C1 trebuie sa contina textul "tert"');
        }

        // iterate over all cells in 'D' column
        const cells = wb.worksheets[0].getColumn('D').values;

        let cuis = [];
        // remove first row (header)
        for (let i = 2; i < cells.length; i++) {
            if (cells[i] !== undefined && cells[i] !== null) {
                let v = cells[i];
                if (typeof v !== 'string') {
                    reject("Eroare - exista valori in coloana D care nu sunt string-uri");
                } else {
                    cuis.push(trimCUI(v));
                }
            }
        }
        cuis = [...new Set(cuis)]
        toast.info(`Se proceseaza ${cuis.length} CUI-uri`);

        // get company details
        let response = await fetch('/api/firma', {
            method: 'POST',
            body: JSON.stringify({ cuis }),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            let firme: Firma[] = await response.json();

            let invoices: Invoices = {
                content: '',
                invoiceNumber: 1
            }

            // make an invoice for each CUI
            firme.forEach(async (firma) => {
                let values: CellValue[] = [];
                // get all values from column 'F' where column 'D' has the current CUI
                wb.worksheets[0].getColumn('F').eachCell((cell, rowNumber) => {
                    let cuiD = wb.worksheets[0].getRow(rowNumber).getCell('D').value;
                    if (typeof cuiD !== 'string') {
                        reject("Eroare - exista valori in coloana F care nu au un string in coloana D");
                    } else {
                        if (trimCUI(cuiD) === trimCUI(firma.cui)) {
                            values.push(cell.value);
                        }
                    }
                });

                let sum: number = 0;

                try {
                    sum = values.reduce<number>((a, b) => cellValueToFloat(a) + cellValueToFloat(b), 0);
                } catch (err) {
                    reject("Eroare la calcularea sumei pentru CUI-ul " + firma.cui + ": valoare invalida in coloana F");
                }

                // add invoice to XML
                if (locatieImport === 'intrari') {
                    invoices = addInvoice(invoices, firma, firmaSaga, sum, '628');
                } else if (locatieImport === 'iesiri') {
                    invoices = addInvoice(invoices, firmaSaga, firma, sum, '704');
                }
            })

            resolve(getXML(invoices));
        } else {
            reject("Eroare la interogarea serverului ANAF pentru CUI-urile din Excel - " + await response.text());
        }

        // resolve(new Blob(["hello"], { type: 'text/plain' }));
        reject('not implemented');
    });
});

export const convert = (async (firma: Firma, locatieImport: string, excelFile: File): Promise<Blob> => {
    return new Promise<Blob>((resolve, reject) => {
        const wb = new Workbook();
        const reader = new FileReader();

        reader.readAsArrayBuffer(excelFile);
        reader.onload = () => {
            const buffer = reader.result;

            if (buffer === null || typeof buffer === 'string') {
                reject('buffer is null or string');
            } else {
                wb.xlsx.load(buffer).then(workbook => {
                    workbookToXML(firma, locatieImport, workbook).then(xml => {
                        resolve(xml);
                    }
                    ).catch(err => {
                        reject(err);
                    });
                }).catch(err => {
                    reject(err);
                });
            }
        }

        reader.onerror = () => {
            reject('error reading file');
        }

        reader.onabort = () => {
            reject('file reading was aborted');
        }
    });
});