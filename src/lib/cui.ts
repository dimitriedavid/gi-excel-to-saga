export function validateRomanianCIF(v: string) {
    if (typeof v !== 'string') {
        return 'Nu este un șir de caractere!'
    }

    let cif = v.toUpperCase()

    // remove RO from cif:
    const indexOfRo = cif.indexOf('RO')

    if (indexOfRo > -1) {
        cif = cif.substr(0, indexOfRo) + cif.substr(indexOfRo + 2)
    }

    // remove spaces:
    cif = cif.replace(' ', '')

    // validate character length:
    if (cif.length < 2 || cif.length > 10) {
        return 'Lungimea corectă fără RO, este între 2 și 10 caractere!'
    }

    // validate that so far the resulting CIF looks like an integer value:
    if (Number.isNaN(parseInt(cif))) {
        return 'Nu este număr!'
    }

    // begin testing:
    const testKey = '753217532'
    const controlNumber = parseInt(cif.substr(cif.length - 1))

    // remove control number:
    cif = cif.substr(0, cif.length - 1)

    // pad left with zeros to reach testKey length:
    while (cif.length !== testKey.length) {
        cif = '0' + cif
    }

    let sum = 0
    let i = cif.length

    while (i--) {
        sum = sum + (parseInt(cif.charAt(i)) * parseInt(testKey.charAt(i)))
    }

    let calculatedControlNumber = sum * 10 % 11

    if (calculatedControlNumber === 10) {
        calculatedControlNumber = 0
    }

    return controlNumber === calculatedControlNumber ||
        `CIF invalid! Cifra de control calculată (${calculatedControlNumber}) diferă de cea introdusă (${controlNumber})!`
}