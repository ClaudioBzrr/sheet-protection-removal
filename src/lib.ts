import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

export interface SheetInfo {
    entryName: string;
    protected: boolean;
}

export interface InspectResult {
    sheets: SheetInfo[];
    workbookProtected: boolean;
    protectedCount: number;
}

export interface UnlockResult {
    outputFile: string;
    sheetsTotal: number;
    sheetsUnlocked: number;
    workbookUnlocked: boolean;
}

const SHEET_PROTECTION_RE = /<sheetProtection[^>]*\/>|<sheetProtection[^>]*>[\s\S]*?<\/sheetProtection>/gi;
const WORKBOOK_PROTECTION_RE = /<workbookProtection[^>]*\/>|<workbookProtection[^>]*>[\s\S]*?<\/workbookProtection>/gi;

export function inspectFile(inputFile: string): InspectResult {
    const zip = new AdmZip(inputFile);
    const sheets: SheetInfo[] = zip
        .getEntries()
        .filter((e) => e.entryName.startsWith('xl/worksheets/') && e.entryName.endsWith('.xml'))
        .map((e) => ({
            entryName: e.entryName,
            protected: SHEET_PROTECTION_RE.test(e.getData().toString('utf8')),
        }));
    // reset regex lastIndex (global flag)
    SHEET_PROTECTION_RE.lastIndex = 0;

    let workbookProtected = false;
    const wb = zip.getEntry('xl/workbook.xml');
    if (wb) {
        const xml = wb.getData().toString('utf8');
        workbookProtected = WORKBOOK_PROTECTION_RE.test(xml);
        WORKBOOK_PROTECTION_RE.lastIndex = 0;
    }

    return {
        sheets,
        workbookProtected,
        protectedCount: sheets.filter((s) => s.protected).length,
    };
}

export function unlockFile(inputFile: string, outputFile: string): UnlockResult {
    const zip = new AdmZip(inputFile);
    let sheetsUnlocked = 0;
    let workbookUnlocked = false;

    const sheets = zip
        .getEntries()
        .filter((e) => e.entryName.startsWith('xl/worksheets/') && e.entryName.endsWith('.xml'));
    for (const entry of sheets) {
        const xml = entry.getData().toString('utf8');
        SHEET_PROTECTION_RE.lastIndex = 0;
        const next = xml.replace(SHEET_PROTECTION_RE, '');
        if (next !== xml) {
            zip.updateFile(entry.entryName, Buffer.from(next, 'utf8'));
            sheetsUnlocked++;
        }
    }

    const wb = zip.getEntry('xl/workbook.xml');
    if (wb) {
        const xml = wb.getData().toString('utf8');
        WORKBOOK_PROTECTION_RE.lastIndex = 0;
        const next = xml.replace(WORKBOOK_PROTECTION_RE, '');
        if (next !== xml) {
            zip.updateFile('xl/workbook.xml', Buffer.from(next, 'utf8'));
            workbookUnlocked = true;
        }
    }

    // Garante que o diretório de saída existe
    const outDir = path.dirname(outputFile);
    if (outDir && outDir !== '.' && !fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    zip.writeZip(outputFile);

    return {
        outputFile,
        sheetsTotal: sheets.length,
        sheetsUnlocked,
        workbookUnlocked,
    };
}

export function isExcelFile(p: string): boolean {
    return /\.(xlsx|xlsm)$/i.test(p);
}
