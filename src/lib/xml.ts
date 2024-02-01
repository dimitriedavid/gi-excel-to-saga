import { Firma } from "./firma";

export interface Invoices {
    content: string;
    invoiceNumber: number;
}

export const getXML = (invoices: Invoices): Blob => {
    invoices.content += '</Facturi>\n';

    // replace all & with &amp;
    invoices.content = invoices.content.replace(/&/g, '&amp;');

    return new Blob([invoices.content], { type: 'text/xml' });
}

export const addInvoice = (invoices: Invoices, furnizor: Firma, client: Firma, valoare: number, cont: string): Invoices => {
    if (invoices.content === '') {
        invoices.content += '<Facturi>\n';
        invoices.invoiceNumber = 1;
    }

    invoices.content += '<Factura>\n'
    // header
    invoices.content += '    <Antet>\n'
    invoices.content += `        <FurnizorNume>${furnizor.denumire}</FurnizorNume>
        <FurnizorCIF>${furnizor.cui}</FurnizorCIF>
        <FurnizorNrRegCom>${furnizor.nr_reg_com}</FurnizorNrRegCom>
        <FurnizorCapital></FurnizorCapital>
        <FurnizorTara>RO</FurnizorTara>
        <FurnizorLocalitate>${furnizor.localitate}</FurnizorLocalitate>
        <FurnizorJudet>${furnizor.judet}</FurnizorJudet>
        <FurnizorAdresa>${furnizor.adresa}</FurnizorAdresa>
        <FurnizorTelefon></FurnizorTelefon>
        <FurnizorMail></FurnizorMail>
        <FurnizorBanca></FurnizorBanca>
        <FurnizorIBAN></FurnizorIBAN>
        <FurnizorInformatiiSuplimentare></FurnizorInformatiiSuplimentare>
        <ClientNume>${client.denumire}</ClientNume>
        <ClientInformatiiSuplimentare></ClientInformatiiSuplimentare>
        <ClientCIF>${client.cui}</ClientCIF>
        <ClientNrRegCom>${client.nr_reg_com}</ClientNrRegCom>
        <ClientJudet>${client.judet}</ClientJudet>
        <ClientTara>RO</ClientTara>
        <ClientLocalitate>${client.localitate}</ClientLocalitate>
        <ClientAdresa>${client.adresa}</ClientAdresa>
        <ClientBanca></ClientBanca>
        <ClientIBAN></ClientIBAN>
        <ClientTelefon></ClientTelefon>
        <ClientMail></ClientMail>
        <FacturaNumar>${'FR' + invoices.invoiceNumber}</FacturaNumar>
        <FacturaData>31.12.2023</FacturaData>
        <FacturaScadenta>31.12.2023</FacturaScadenta>
        <FacturaTaxareInversa>Nu</FacturaTaxareInversa>
        <FacturaTVAIncasare>Nu</FacturaTVAIncasare>
        <FacturaTip></FacturaTip>
        <FacturaInformatiiSuplimentare></FacturaInformatiiSuplimentare>
        <FacturaMoneda>RON</FacturaMoneda>
        <FacturaGreutate>0.000</FacturaGreutate>\n`
    invoices.content += '    </Antet>\n'
    invoices.invoiceNumber++;

    // body
    invoices.content += '    <Detalii>\n        <Continut>\n'

    let priceWithoutVAT = valoare / 1.19;
    let VAT = valoare - priceWithoutVAT;

    invoices.content += `            <Linie>
                <LinieNrCrt>1</LinieNrCrt>
                <Gestiune></Gestiune>
                <Activitate></Activitate>
                <Descriere>PRELUARE DATE</Descriere>
                <CodArticolFurnizor></CodArticolFurnizor>
                <CodArticolClient></CodArticolClient>
                <CodBare></CodBare>
                <InformatiiSuplimentare></InformatiiSuplimentare>
                <UM>BUC</UM>
                <Cantitate>1</Cantitate>
                <Pret>${(Math.round(priceWithoutVAT * 100) / 100).toFixed(2)}</Pret>
                <Valoare>${(Math.round(priceWithoutVAT * 100) / 100).toFixed(2)}</Valoare>
                <ProcTVA>19</ProcTVA>
                <CotaTVA>19</CotaTVA>
                <TVA>${(Math.round(VAT * 100) / 100).toFixed(2)}</TVA>
                <Cont>${cont}</Cont>
            </Linie>\n`

    invoices.content += '        </Continut>\n    </Detalii>\n'
    invoices.content += '</Factura>\n'

    return invoices;
}