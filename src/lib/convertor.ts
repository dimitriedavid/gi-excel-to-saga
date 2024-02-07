import { CellValue, Workbook } from "exceljs";
import { Firma } from "./firma";
import { Invoices, addInvoice, getXML } from "./xml";
import 'exceljs';
import { toast } from "sonner";
import { validateRomanianCIF } from "./cui";

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

    // cui to uppercase
    cui = cui.toUpperCase();

    // remove "RO" prefix if present
    if (cui.startsWith('RO')) {
        cui = cui.substring(2);
    }

    return cui;
}


const workbookToXML_simplu = (async (firmaSaga: Firma, locatieImport: string, wb: Workbook): Promise<[Blob, string]> => {
    return new Promise<[Blob, string]>(async (resolve, reject) => {
        if (wb.worksheets[0].getCell('C1').value !== 'tert') {
            reject('fisier Excel invalid: celula C1 trebuie sa contina textul "tert"');
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

        // find out invalid cuis
        let cuisn = cuis.filter(c => validateRomanianCIF(c) !== true);
        cuis = cuis.filter(c => validateRomanianCIF(c) === true);

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
                    invoices = addInvoice(invoices, firma, firmaSaga, sum, '628', 19);
                } else if (locatieImport === 'iesiri') {
                    invoices = addInvoice(invoices, firmaSaga, firma, sum, '704', 19);
                }
            })

            resolve([getXML(invoices), 'CUI-uri invalide: ' + cuisn.join(', ')]);
        } else {
            reject("Eroare la interogarea serverului ANAF pentru CUI-urile din Excel - " + await response.text());
        }

        reject('not implemented');
    });
});

const workbookToXML_jurnalCumparari = (async (firmaSaga: Firma, locatieImport: string, wb: Workbook): Promise<[Blob, string]> => {
    return new Promise<[Blob, string]>(async (resolve, reject) => {
        if (wb.worksheets[0].getCell('N1').value !== 'bazaned') {
            reject('fisier Excel invalid: celula N1 trebuie sa contina textul "bazaned"');
        }

        // iterate over all cells in 'F' column
        const cells = wb.worksheets[0].getColumn('F').values;

        let cuis = [];
        // remove first row (header)
        for (let i = 2; i < cells.length; i++) {
            if (cells[i] !== undefined && cells[i] !== null) {
                let v = cells[i];
                if (typeof v !== 'string') {
                    reject("Eroare - exista valori in coloana F care nu sunt string-uri");
                } else {
                    cuis.push(trimCUI(v));
                }
            }
        }
        cuis = [...new Set(cuis)]

        // find out invalid cuis
        let cuisn = cuis.filter(c => validateRomanianCIF(c) !== true);
        cuis = cuis.filter(c => validateRomanianCIF(c) === true);

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
                let valuesMap = new Map<number, number[]>();
                // get all values from column 'F' where the value is the current CUI
                wb.worksheets[0].getColumn('F').eachCell((cell, rowNumber) => {
                    let cuiF = cell.value;
                    if (typeof cuiF !== 'string') {
                        reject("Eroare - exista CUI-uri in coloana F care nu sunt string");
                    } else {
                        if (trimCUI(cuiF) === trimCUI(firma.cui)) {
                            // get value from P column
                            let vatProc = wb.worksheets[0].getRow(rowNumber).getCell('P').value;
                            // get value from N column
                            let base = wb.worksheets[0].getRow(rowNumber).getCell('N').value;
                            // get value from O column
                            let vatValue = wb.worksheets[0].getRow(rowNumber).getCell('O').value;

                            // check if base * vatProc / 100 = vatValue
                            // if (base !== null && vatProc !== null && vatValue !== null) {
                            //     if ((Math.round(((Math.round(cellValueToFloat(base) * 100) / 100) * cellValueToFloat(vatProc) / 100) * 100) / 100) !== (Math.round(cellValueToFloat(vatValue) * 100) / 100)) {
                            //         vatProc = cellValueToFloat(vatProc);
                            //         vatValue = cellValueToFloat(vatValue);
                            //         base = cellValueToFloat(base);

                            //         console.log('base', base);
                            //         console.log('vatProc', vatProc);
                            //         console.log('vatValue', vatValue);
                            //         console.log('calcul', (Math.round(((Math.round(cellValueToFloat(base) * 100) / 100) * cellValueToFloat(vatProc) / 100) * 100) / 100));

                            //         reject("Eroare la calculul TVA pentru CUI-ul " + firma.cui + " - randul " + rowNumber);
                            //     }
                            // }

                            vatProc = cellValueToFloat(vatProc);
                            vatValue = cellValueToFloat(vatValue);
                            base = cellValueToFloat(base);

                            let total = base + vatValue;

                            // add total value to map with vatProc as key
                            if (valuesMap.has(vatProc)) {
                                valuesMap.set(vatProc, [...valuesMap.get(vatProc) || [], total]);
                            } else {
                                valuesMap.set(vatProc, [total]);
                            }
                        }
                    }
                });

                for (let [vatProc, values] of valuesMap) {
                    let sum: number = 0;

                    try {
                        sum = values.reduce<number>((a, b) => cellValueToFloat(a) + cellValueToFloat(b), 0);
                    } catch (err) {
                        reject("Eroare la calcularea sumei pentru CUI-ul " + firma.cui + ": valoare invalida in coloana F");
                    }

                    // add invoice to XML
                    if (locatieImport === 'intrari') {
                        invoices = addInvoice(invoices, firma, firmaSaga, sum, '628', vatProc);
                    } else if (locatieImport === 'iesiri') {
                        invoices = addInvoice(invoices, firmaSaga, firma, sum, '704', vatProc);
                    }
                }
            })

            resolve([getXML(invoices), 'CUI-uri invalide: ' + cuisn.join(', ')]);
        } else {
            reject("Eroare la interogarea serverului ANAF pentru CUI-urile din Excel - " + await response.text());
        }

        // resolve(new Blob(["hello"], { type: 'text/plain' }));
        reject('not implemented');
    });
});

const workbookToXML_jurnalVanzari = (async (firmaSaga: Firma, locatieImport: string, wb: Workbook): Promise<[Blob, string]> => {
    return new Promise<[Blob, string]>(async (resolve, reject) => {
        if (wb.worksheets[0].getCell('K1').value !== 'bazaned') {
            reject('fisier Excel invalid: celula N1 trebuie sa contina textul "bazaned"');
        }

        // iterate over all cells in 'F' column
        const cells = wb.worksheets[0].getColumn('F').values;

        let cuis = [];
        // remove first row (header)
        for (let i = 2; i < cells.length; i++) {
            if (cells[i] !== undefined && cells[i] !== null) {
                let v = cells[i];
                if (typeof v !== 'string') {
                    reject("Eroare - exista valori in coloana F care nu sunt string-uri");
                } else {
                    cuis.push(trimCUI(v));
                }
            }
        }
        cuis = [...new Set(cuis)]

        // find out invalid cuis
        let cuisn = cuis.filter(c => validateRomanianCIF(c) !== true);
        cuis = cuis.filter(c => validateRomanianCIF(c) === true);

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
                let valuesMap = new Map<number, number[]>();
                // get all values from column 'F' where the value is the current CUI
                wb.worksheets[0].getColumn('F').eachCell((cell, rowNumber) => {
                    let cuiF = cell.value;
                    if (typeof cuiF !== 'string') {
                        reject("Eroare - exista CUI-uri in coloana F care nu sunt string");
                    } else {
                        if (trimCUI(cuiF) === trimCUI(firma.cui)) {
                            // get value from P column
                            let vatProc = wb.worksheets[0].getRow(rowNumber).getCell('M').value;
                            // get value from N column
                            let base = wb.worksheets[0].getRow(rowNumber).getCell('K').value;
                            // get value from O column
                            let vatValue = wb.worksheets[0].getRow(rowNumber).getCell('L').value;

                            // check if base * vatProc / 100 = vatValue
                            // if (base !== null && vatProc !== null && vatValue !== null) {
                            //     if ((Math.round(((Math.round(cellValueToFloat(base) * 100) / 100) * cellValueToFloat(vatProc) / 100) * 100) / 100) !== (Math.round(cellValueToFloat(vatValue) * 100) / 100)) {
                            //         vatProc = cellValueToFloat(vatProc);
                            //         vatValue = cellValueToFloat(vatValue);
                            //         base = cellValueToFloat(base);

                            //         console.log('base', base);
                            //         console.log('vatProc', vatProc);
                            //         console.log('vatValue', vatValue);
                            //         console.log('calcul', (Math.round(((Math.round(cellValueToFloat(base) * 100) / 100) * cellValueToFloat(vatProc) / 100) * 100) / 100));

                            //         reject("Eroare la calculul TVA pentru CUI-ul " + firma.cui + " - randul " + rowNumber);
                            //     }
                            // }

                            vatProc = cellValueToFloat(vatProc);
                            vatValue = cellValueToFloat(vatValue);
                            base = cellValueToFloat(base);

                            let total = base + vatValue;

                            // add total value to map with vatProc as key
                            if (valuesMap.has(vatProc)) {
                                valuesMap.set(vatProc, [...valuesMap.get(vatProc) || [], total]);
                            } else {
                                valuesMap.set(vatProc, [total]);
                            }
                        }
                    }
                });

                for (let [vatProc, values] of valuesMap) {
                    let sum: number = 0;

                    try {
                        sum = values.reduce<number>((a, b) => cellValueToFloat(a) + cellValueToFloat(b), 0);
                    } catch (err) {
                        reject("Eroare la calcularea sumei pentru CUI-ul " + firma.cui + ": valoare invalida in coloana F");
                    }

                    // add invoice to XML
                    if (locatieImport === 'intrari') {
                        invoices = addInvoice(invoices, firma, firmaSaga, sum, '628', vatProc);
                    } else if (locatieImport === 'iesiri') {
                        invoices = addInvoice(invoices, firmaSaga, firma, sum, '704', vatProc);
                    }
                }
            })

            resolve([getXML(invoices), cuisn.length !== 0 ? 'CUI-uri invalide: ' + cuisn.join(', ') : '']);
        } else {
            reject("Eroare la interogarea serverului ANAF pentru CUI-urile din Excel - " + await response.text());
        }

        // resolve(new Blob(["hello"], { type: 'text/plain' }));
        reject('not implemented');
    });
});

export const convert = (async (firma: Firma, locatieImport: string, tipExcel: string, excelFile: File): Promise<[Blob, string]> => {
    return new Promise<[Blob, string]>((resolve, reject) => {
        const wb = new Workbook();
        const reader = new FileReader();

        reader.readAsArrayBuffer(excelFile);
        reader.onload = () => {
            const buffer = reader.result;

            if (buffer === null || typeof buffer === 'string') {
                reject('buffer is null or string');
            } else {
                wb.xlsx.load(buffer).then(workbook => {
                    console.log('tipExcel', tipExcel);
                    if (tipExcel === 'simplu') {
                        workbookToXML_simplu(firma, locatieImport, workbook).then(res => {
                            resolve(res);
                        }
                        ).catch(err => {
                            reject(err);
                        });
                    } else if (tipExcel === 'jurnalCumparari') {
                        workbookToXML_jurnalCumparari(firma, locatieImport, workbook).then(res => {
                            resolve(res);
                        }
                        ).catch(err => {
                            reject(err);
                        });
                    } else if (tipExcel === 'jurnalVanzari') {
                        workbookToXML_jurnalVanzari(firma, locatieImport, workbook).then(res => {
                            resolve(res);
                        }
                        ).catch(err => {
                            reject(err);
                        });
                    } else {
                        reject(`tipul de Excel ${tipExcel} nu este recunoscut`);
                    }
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