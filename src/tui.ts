import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { inspectFile, unlockFile, isExcelFile } from './lib.js';

// ---------- util ANSI ----------
const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    inverse: '\x1b[7m',
};

function clear(): void {
    process.stdout.write('\x1b[2J\x1b[0;0H');
}

function header(): void {
    console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════╗${C.reset}`);
    console.log(`${C.bold}${C.cyan}║     Sheet Unlocker — remover senha   ║${C.reset}`);
    console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════╝${C.reset}`);
    console.log(`${C.dim}↑↓ navega • Enter confirma • Ctrl+C sai${C.reset}\n`);
}

export interface MenuOption<T> {
    label: string;
    hint?: string;
    value: T;
}

/** Menu interativo com setas. Retorna value escolhido. */
export async function menuSelect<T>(title: string, options: MenuOption<T>[]): Promise<T> {
    if (options.length === 0) throw new Error('Nenhuma opção no menu');

    return new Promise<T>((resolve) => {
        let idx = 0;
        const stdin = process.stdin;

        const render = () => {
            clear();
            header();
            console.log(`${C.bold}${title}${C.reset}\n`);
            options.forEach((o, i) => {
                const cursor = i === idx ? `${C.inverse}›` : ' ';
                const end = i === idx ? `${C.reset}` : '';
                const label = i === idx ? `${C.inverse} ${o.label} ` : `  ${o.label}`;
                const hint = o.hint ? ` ${C.dim}${o.hint}${C.reset}` : '';
                console.log(`${cursor}${label}${end}${hint}`);
            });
        };

        const cleanup = () => {
            stdin.removeListener('keypress', onKey);
            if (stdin.isTTY) stdin.setRawMode(false);
            stdin.pause();
        };

        const onKey = (_ch: string, key: { name?: string; ctrl?: boolean }) => {
            if (key.ctrl && key.name === 'c') {
                cleanup();
                console.log('\nCancelado.');
                process.exit(0);
            }
            if (key.name === 'up' || key.name === 'k') {
                idx = (idx - 1 + options.length) % options.length;
                render();
            } else if (key.name === 'down' || key.name === 'j') {
                idx = (idx + 1) % options.length;
                render();
            } else if (key.name === 'return') {
                cleanup();
                console.log('');
                resolve(options[idx].value);
            }
        };

        readline.emitKeypressEvents(stdin);
        if (stdin.isTTY) stdin.setRawMode(true);
        stdin.resume();
        stdin.on('keypress', onKey);
        render();
    });
}

/** Prompt de texto simples com valor padrão. */
export async function textInput(prompt: string, def = ''): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        const suffix = def ? ` ${C.dim}[${def}]${C.reset}` : '';
        rl.question(`${C.bold}${prompt}${C.reset}${suffix}: `, (ans) => {
            rl.close();
            resolve(ans.trim() === '' ? def : ans.trim().replace(/^"|"$/g, ''));
        });
    });
}

async function pause(): Promise<void> {
    await textInput('Pressione Enter para continuar', '');
}

function findExcelInDir(dir: string): string[] {
    try {
        return fs
            .readdirSync(dir)
            .filter((f) => isExcelFile(f) && !f.startsWith('unprotected_') && !f.startsWith('~$'))
            .sort();
    } catch {
        return [];
    }
}

/** Fluxo principal da TUI. `initialFile` = arg CLI ou arraste do arquivo p/ o exe. */
export async function runTui(initialFile?: string): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        clear();
        header();

        // ---- 1. escolher arquivo ----
        let inputFile = initialFile;
        initialFile = undefined;

        if (!inputFile) {
            const cwd = process.cwd();
            const found = findExcelInDir(cwd);
            type Choice = { kind: 'file' | 'type' | 'exit'; path?: string };
            const opts: MenuOption<Choice>[] = [
                ...found.map((f): MenuOption<Choice> => ({
                    label: f,
                    hint: 'nesta pasta',
                    value: { kind: 'file', path: path.join(cwd, f) },
                })),
                { label: 'Digitar / colar caminho do arquivo…', value: { kind: 'type' } },
                { label: 'Sair', value: { kind: 'exit' } },
            ];
            const choice = await menuSelect(`Arquivo Excel protegido ${C.dim}(${found.length} na pasta)${C.reset}`, opts);
            if (choice.kind === 'exit') return;
            if (choice.kind === 'type') {
                inputFile = await textInput('Caminho do arquivo .xlsx/.xlsm');
            } else {
                inputFile = choice.path!;
            }
        }

        if (!inputFile || !fs.existsSync(inputFile)) {
            console.log(`${C.red}✖ Arquivo não encontrado:${C.reset} ${inputFile}`);
            await pause();
            continue;
        }
        if (!isExcelFile(inputFile)) {
            console.log(`${C.red}✖ Esperava .xlsx ou .xlsm:${C.reset} ${inputFile}`);
            await pause();
            continue;
        }

        // ---- 2. inspecionar ----
        console.log(`\n${C.cyan}▸ Analisando:${C.reset} ${inputFile}`);
        let info;
        try {
            info = inspectFile(inputFile);
        } catch (e) {
            console.log(`${C.red}✖ Não foi possível ler o arquivo (corrompido ou não é Excel válido).${C.reset}`);
            console.log(`${C.dim}${e instanceof Error ? e.message : String(e)}${C.reset}`);
            await pause();
            continue;
        }

        console.log(`  Planilhas: ${info.sheets.length} • Protegidas: ${C.yellow}${info.protectedCount}${C.reset}`);
        for (const s of info.sheets) {
            const tag = s.protected ? `${C.yellow}🔒 protegida${C.reset}` : `${C.green}○ livre${C.reset}`;
            console.log(`   ${tag}  ${C.dim}${s.entryName}${C.reset}`);
        }
        if (info.workbookProtected) console.log(`  ${C.yellow}🔒 proteção da pasta de trabalho detectada${C.reset}`);
        if (info.protectedCount === 0 && !info.workbookProtected) {
            console.log(`\n${C.green}Nada a remover — nenhuma proteção encontrada.${C.reset}`);
            const again = await menuSelect('O que fazer?', [
                { label: 'Escolher outro arquivo', value: 'outro' },
                { label: 'Sair', value: 'sair' },
            ]);
            if (again === 'sair') return;
            continue;
        }

        // ---- 3. saída ----
        const dir = path.dirname(inputFile);
        const base = path.basename(inputFile);
        const defOut = path.join(dir === '.' ? process.cwd() : dir, 'unprotected_' + base);
        const outputFile = await textInput('\nArquivo de saída', defOut);

        // ---- 4. confirmar ----
        type Go = 'go' | 'back' | 'exit';
        const confirm = await menuSelect(`Desproteger ${C.bold}${base}${C.reset}?`, [
            { label: `✅ Remover senha → ${path.basename(outputFile)}`, value: 'go' as Go },
            { label: 'Escolher outro arquivo', value: 'back' as Go },
            { label: 'Sair', value: 'exit' as Go },
        ]);
        if (confirm === 'exit') return;
        if (confirm === 'back') continue;

        // ---- 5. executar ----
        try {
            const r = unlockFile(inputFile, outputFile);
            console.log(`\n${C.green}${C.bold}✔ Pronto!${C.reset}`);
            console.log(`  Planilhas desbloqueadas: ${r.sheetsUnlocked}/${r.sheetsTotal}`);
            if (r.workbookUnlocked) console.log(`  Proteção da pasta de trabalho: removida`);
            console.log(`  Saída: ${C.bold}${r.outputFile}${C.reset}`);
        } catch (e) {
            console.log(`\n${C.red}✖ Erro ao processar:${C.reset} ${e instanceof Error ? e.message : String(e)}`);
        }

        const next = await menuSelect('\nConcluído. E agora?', [
            { label: 'Desproteger outro arquivo', value: 'outro' },
            { label: 'Sair', value: 'sair' },
        ]);
        if (next === 'sair') return;
    }
}
