import * as fs from 'fs';
import * as path from 'path';
import { unlockFile } from './lib.js';
import { runTui } from './tui.js';

const args = process.argv.slice(2);

function printUsage(): void {
    console.log('Uso:');
    console.log('  sheet-unlock [arquivo.xlsx] [--cli]     abre a TUI, ou modo CLI se arquivo + --cli');
    console.log('  sheet-unlock arquivo.xlsx -o saida.xlsx  modo CLI direto');
}

async function main(): Promise<void> {
    const flags = args.filter((a) => a.startsWith('-'));
    const positionals = args.filter((a) => !a.startsWith('-'));
    const wantsCli = flags.includes('--cli') || flags.includes('-o') || flags.includes('--output');

    // Sem arquivo -> sempre TUI
    if (positionals.length === 0 && !wantsCli) {
        await runTui();
        return;
    }

    const inputFile = positionals[0];

    // Com arquivo mas sem --cli -> TUI já com arquivo pré-selecionado
    if (inputFile && !wantsCli) {
        if (!fs.existsSync(inputFile)) {
            console.error('Arquivo não encontrado:', inputFile);
            process.exit(1);
        }
        await runTui(inputFile);
        return;
    }

    // ---- modo CLI (compatível com versão anterior + -o) ----
    if (!inputFile) {
        printUsage();
        process.exit(1);
    }
    if (!fs.existsSync(inputFile)) {
        console.error('Arquivo não encontrado:', inputFile);
        process.exit(1);
    }

    let outputFile: string;
    const oIdx = args.findIndex((a) => a === '-o' || a === '--output');
    if (oIdx !== -1 && args[oIdx + 1]) {
        outputFile = args[oIdx + 1];
    } else {
        const dir = path.dirname(inputFile);
        outputFile = path.join(dir, 'unprotected_' + path.basename(inputFile));
    }

    try {
        const r = unlockFile(inputFile, outputFile);
        console.log(`Encontradas ${r.sheetsTotal} planilhas, ${r.sheetsUnlocked} desbloqueadas.`);
        if (r.workbookUnlocked) console.log('Proteção da pasta de trabalho removida.');
        console.log('Pronto!');
        console.log(`Saída: ${r.outputFile}`);
    } catch (e) {
        console.error('Erro:', e instanceof Error ? e.message : String(e));
        process.exit(1);
    }
}

main();
