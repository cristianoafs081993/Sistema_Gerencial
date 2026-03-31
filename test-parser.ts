import { parseSiafiCsv, syncSiafiDataToDb } from './src/lib/siafi-parser.js';
import * as fs from 'fs';

// Mock File API for Node boundary testing
type MockFileOptions = { type?: string };
type MockFileReaderEvent = { target: { result: string } };

global.File = class File {
    buffer: Buffer;
    name: string;
    type: string;
    constructor(bits: Uint8Array[], name: string, options?: MockFileOptions) {
        this.buffer = Buffer.from(bits[0]);
        this.name = name;
        this.type = options?.type || '';
    }
};

global.FileReader = class FileReader {
    onload: (e: MockFileReaderEvent) => void = () => { };
    onerror: (e: unknown) => void = () => { };
    readAsText(file: { buffer: Buffer }, encoding: string) {
        try {
            const text = file.buffer.toString('utf-8');
            this.onload({ target: { result: text } });
        } catch (e) {
            this.onerror(e);
        }
    }
} as unknown as typeof FileReader;


async function test() {
    const filePath = 'docs/Exec_NE_Exercicio_RAP_UG_Executora.csv';
    console.log('Lendo arquivo:', filePath);

    const content = fs.readFileSync(filePath);
    const file = new File([content], 'Exec_NE_Exercicio_RAP_UG_Executora.csv', { type: 'text/csv' });

    try {
        const data = await parseSiafiCsv(file as unknown as File);
        console.log(`Parseou ${data.length} linhas.`);
        if (data.length > 0) {
            console.log('Exemplo 1 (Rap):', data.find(d => d.isRap));
            console.log('Exemplo 2 (Corrente):', data.find(d => !d.isRap));
        }
    } catch (error) {
        console.error('Erro no parser:', error);
    }
}

test();
