import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

const [, , inputFile] = process.argv;

if (!inputFile) {
    console.log('Usage: node dist/index.js <input.xlsx>');
    process.exit(1);
}

if (!fs.existsSync(inputFile)) {
    console.error('File does not exist:', inputFile);
    process.exit(1);
}

const inputDir = path.dirname(inputFile);
const inputBase = path.basename(inputFile);
const outputFile = path.join(inputDir, 'unprotected_' + inputBase);

function removeSheetProtection() {
    try {
        const zip = new AdmZip(inputFile);
        const worksheetEntries = zip.getEntries().filter(entry =>
            entry.entryName.startsWith('xl/worksheets/') &&
            entry.entryName.endsWith('.xml')
        );

        console.log(`Found ${worksheetEntries.length} worksheet files`);

        for (const entry of worksheetEntries) {
            const xmlContent = entry.getData().toString('utf8');

            const originalContent = xmlContent;
            const newXmlContent = xmlContent.replace(
                /<sheetProtection[^>]*\/>|<sheetProtection[^>]*>[\s\S]*?<\/sheetProtection>/gi,
                ''
            );

            if (newXmlContent !== originalContent) {
                console.log(`Removing sheet protection from ${entry.entryName}`);
                zip.updateFile(entry.entryName, Buffer.from(newXmlContent, 'utf8'));
            }
        }

        zip.writeZip(outputFile);

        console.log('Sheet protection removed successfully!');
        console.log(`Output file: ${outputFile}`);

    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

removeSheetProtection();