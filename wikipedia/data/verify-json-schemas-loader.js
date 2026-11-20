import { readFile } from 'node:fs/promises';
import ts from 'typescript';

let verifierUrl;

export function initialize(url) {
  verifierUrl = url;
}

export async function load(url, context, nextLoad) {
  if (url !== verifierUrl) return nextLoad(url, context);

  const { outputText } = ts.transpileModule(await readFile(new URL(url), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: url,
  });
  return { format: 'module', source: outputText, shortCircuit: true };
}
