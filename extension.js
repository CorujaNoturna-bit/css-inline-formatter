'use strict';

const vscode = require('vscode');
const { safeMinify, minifyEmbeddedStyles } = require('./minify');

function processContent(text, languageId) {
  if (languageId === 'html') {
    return minifyEmbeddedStyles(text);
  }
  return safeMinify(text);
}

async function formatCurrentFile() {
  const editor = vscode.window.activeTextEditor;
  const validLangs = ['css', 'html'];
  
  if (!editor || !validLangs.includes(editor.document.languageId)) {
    vscode.window.showWarningMessage('Abra um arquivo .css ou .html para usar este comando.');
    return;
  }

  const doc = editor.document;
  const text = doc.getText();
  const result = processContent(text, doc.languageId);

  if (!result.ok) {
    vscode.window.showErrorMessage(`CSS Inline: ${result.error}`);
    return;
  }
  if (result.output === text) {
    vscode.window.showInformationMessage('CSS Inline: nada a alterar neste arquivo.');
    return;
  }

  const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(text.length));
  await editor.edit((eb) => eb.replace(fullRange, result.output));
}

async function formatProject(output) {
  if (!vscode.workspace.workspaceFolders) {
    vscode.window.showWarningMessage('Abra uma pasta (projeto) no VS Code primeiro.');
    return;
  }

  const exclude = vscode.workspace.getConfiguration('cssInline').get('exclude');
  // Busca tanto arquivos .css quanto .html
  const files = await vscode.workspace.findFiles('**/*.{css,html}', exclude);

  if (files.length === 0) {
    vscode.window.showInformationMessage('CSS Inline: nenhum arquivo .css ou .html encontrado.');
    return;
  }

  const choice = await vscode.window.showWarningMessage(
    `Isto vai reescrever até ${files.length} arquivo(s) (.css e .html) e remover comentários de CSS. ` +
      'Faça um commit (ou backup) antes de continuar.',
    { modal: true },
    'Continuar'
  );
  if (choice !== 'Continuar') return;

  const stats = { changed: 0, unchanged: 0, failed: [], dirty: [], cancelled: false };
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  const encoder = new TextEncoder();

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'CSS Inline', cancellable: true },
    async (progress, token) => {
      for (const uri of files) {
        if (token.isCancellationRequested) {
          stats.cancelled = true;
          break;
        }

        const rel = vscode.workspace.asRelativePath(uri);
        progress.report({ message: rel, increment: 100 / files.length });

        const isDirty = vscode.workspace.textDocuments.some((d) => d.uri.toString() === uri.toString() && d.isDirty);
        if (isDirty) {
          stats.dirty.push(rel);
          continue;
        }

        try {
          const text = decoder.decode(await vscode.workspace.fs.readFile(uri));
          const isHtml = uri.path.endsWith('.html');
          const result = isHtml ? minifyEmbeddedStyles(text) : safeMinify(text);

          if (!result.ok) {
            stats.failed.push(`${rel}: ${result.error}`);
            continue;
          }
          if (result.output === text) {
            stats.unchanged++;
            continue;
          }
          await vscode.workspace.fs.writeFile(uri, encoder.encode(result.output));
          stats.changed++;
        } catch (e) {
          stats.failed.push(`${rel}: ${e.message}`);
        }
      }
    }
  );

  output.clear();
  output.appendLine(`Alterados: ${stats.changed}`);
  output.appendLine(`Já estavam no formato: ${stats.unchanged}`);
  if (stats.cancelled) output.appendLine('Operação cancelada antes de terminar.');
  if (stats.dirty.length) {
    output.appendLine(`\nIgnorados (abertos com alterações não salvas): ${stats.dirty.length}`);
    stats.dirty.forEach((f) => output.appendLine(`  - ${f}`));
  }
  if (stats.failed.length) {
    output.appendLine(`\nNão alterados por erro: ${stats.failed.length}`);
    stats.failed.forEach((f) => output.appendLine(`  - ${f}`));
  }

  const problems = stats.dirty.length + stats.failed.length;
  const summary =
    `CSS Inline: ${stats.changed} alterado(s), ${stats.unchanged} sem mudança` +
    (problems ? `, ${problems} ignorado(s)/com erro.` : '.');
  const action = await vscode.window.showInformationMessage(summary, 'Ver detalhes');
  if (action === 'Ver detalhes') output.show(true);
}

function activate(context) {
  const output = vscode.window.createOutputChannel('CSS Inline');
  context.subscriptions.push(
    output,
    vscode.commands.registerCommand('cssInline.formatFile', formatCurrentFile),
    vscode.commands.registerCommand('cssInline.formatProject', () => formatProject(output))
  );
}

function deactivate() {}

module.exports = { activate, deactivate };