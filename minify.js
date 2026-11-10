'use strict';

/**
 * Minificador de formatação de CSS: cada regra (seletor + propriedades) em uma única linha.
 *
 * - Remove todos os comentários.
 * - Preserva strings, url(...) sem aspas e escapes.
 * - @media, @supports, @keyframes etc. mantêm a estrutura (um nível por indentação),
 *   com cada regra interna em uma linha (Opção A).
 * - Não altera valores, ordem nem nomes: só a formatação.
 */

const INDENT = '    ';

class Reader {
  constructor(src) {
    this.s = src;
    this.i = 0;
  }

  /**
   * Lê texto até encontrar { ; ou } no nível 0 (fora de strings, parênteses,
   * colchetes e comentários). Normaliza espaços e remove comentários.
   * Não consome o delimitador.
   */
  readUntilDelimiter() {
    const s = this.s;
    let out = '';
    let pendingSpace = false;
    let paren = 0;
    let bracket = 0;
    let brace = 0; // chaves dentro de uma custom property: --x: { ... }

    const push = (t) => {
      if (pendingSpace && out) out += ' ';
      pendingSpace = false;
      out += t;
    };

    while (this.i < s.length) {
      const c = s[this.i];
      const n = s[this.i + 1];

      // comentário
      if (c === '/' && n === '*') {
        const end = s.indexOf('*/', this.i + 2);
        this.i = end === -1 ? s.length : end + 2;
        pendingSpace = true;
        continue;
      }

      // espaço em branco
      if (/\s/.test(c)) {
        pendingSpace = true;
        this.i++;
        continue;
      }

      // string
      if (c === '"' || c === "'") {
        push(this.readString());
        continue;
      }

      // escape (ex.: .a\:b)
      if (c === '\\') {
        push(s.slice(this.i, this.i + 2));
        this.i += 2;
        continue;
      }

      // url(...) sem aspas: conteúdo cru (pode ter ; // /* etc.)
      if ((c === 'u' || c === 'U') && /^url\(/i.test(s.slice(this.i, this.i + 4)) && !/[\w-]/.test(s[this.i - 1] || '')) {
        const raw = this.tryReadRawUrl();
        if (raw !== null) {
          push(raw);
          continue;
        }
      }

      if (c === '(') {
        paren++;
      } else if (c === ')') {
        if (paren > 0) paren--;
      } else if (c === '[') {
        bracket++;
      } else if (c === ']') {
        if (bracket > 0) bracket--;
      } else if (paren === 0 && bracket === 0) {
        if (c === '{') {
          if (brace > 0 || /^--[^\s:]*\s*:/.test(out)) {
            brace++; // custom property com chaves: trata como texto
          } else {
            break;
          }
        } else if (c === '}') {
          if (brace > 0) brace--;
          else break;
        } else if (c === ';' && brace === 0) {
          break;
        }
      }

      push(c);
      this.i++;
    }

    return out;
  }

  readString() {
    const s = this.s;
    const q = s[this.i];
    let j = this.i + 1;
    while (j < s.length) {
      if (s[j] === '\\') {
        j += 2;
        continue;
      }
      if (s[j] === q) {
        j++;
        break;
      }
      j++;
    }
    const str = s.slice(this.i, j);
    this.i = j;
    return str;
  }

  tryReadRawUrl() {
    const s = this.s;
    let j = this.i + 4;
    while (j < s.length && /\s/.test(s[j])) j++;
    if (s[j] === '"' || s[j] === "'") return null; // com aspas: fluxo normal
    let k = j;
    while (k < s.length && s[k] !== ')') {
      if (s[k] === '\\') k++;
      k++;
    }
    if (k >= s.length) return null;
    const result = s.slice(this.i, this.i + 4) + s.slice(j, k).trim() + ')';
    this.i = k + 1;
    return result;
  }

  parseItems(depth) {
    const items = [];
    for (; ;) {
      const text = this.readUntilDelimiter();
      const d = this.s[this.i];

      if (d === '{') {
        this.i++;
        const children = this.parseItems(depth + 1);
        items.push({ type: 'block', header: text, children });
      } else if (d === ';') {
        this.i++;
        if (text) items.push({ type: 'decl', text });
      } else if (d === '}') {
        if (depth === 0) throw new Error('Chave "}" sem abertura correspondente.');
        if (text) items.push({ type: 'decl', text });
        this.i++;
        return items;
      } else {
        if (depth > 0) throw new Error('Chave "{" sem fechamento.');
        if (text) items.push({ type: 'decl', text });
        return items;
      }
    }
  }
}

function renderBlock(block, indent) {
  const head = block.header ? block.header + ' {' : '{';
  const hasBlocks = block.children.some((c) => c.type === 'block');

  // Regra simples: tudo em uma linha
  if (!hasBlocks) {
    const body = block.children.map((c) => c.text + ';').join('');
    return [indent + head + body + '}'];
  }

  // Contêiner (@media, @keyframes, CSS aninhado): mantém a estrutura
  return [indent + head, ...renderItems(block.children, indent + INDENT, false), indent + '}'];
}

function renderItems(items, indent, topLevel) {
  const lines = [];
  let run = [];
  const flush = () => {
    if (run.length) {
      lines.push(indent + run.map((t) => t + ';').join(''));
      run = [];
    }
  };

  for (const it of items) {
    if (it.type === 'decl') {
      if (topLevel) lines.push(indent + it.text + ';'); // @import, @charset...
      else run.push(it.text);
    } else {
      flush();
      lines.push(...renderBlock(it, indent));
    }
  }
  flush();
  return lines;
}

function minifyCSS(src) {
  const bom = src.charCodeAt(0) === 0xfeff ? '\uFEFF' : '';
  if (bom) src = src.slice(1);
  const eol = src.includes('\r\n') ? '\r\n' : '\n';

  const reader = new Reader(src);
  const items = reader.parseItems(0);
  const lines = renderItems(items, '', true);
  return bom + (lines.length ? lines.join(eol) + eol : '');
}

/**
 * Reduz o CSS ao mínimo (sem comentários e sem espaços fora de strings) para
 * comparar "antes" e "depois". Ignora apenas os ";" que são redundantes.
 */
function squash(css) {
  const URL_RE = /url\(\s*(?!["'\s])/iy;
  let out = '';
  let i = 0;
  while (i < css.length) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') {
      const e = css.indexOf('*/', i + 2);
      i = e === -1 ? css.length : e + 2;
      continue;
    }
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== c) j += css[j] === '\\' ? 2 : 1;
      out += css.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === '\\') {
      out += css.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (c === 'u' || c === 'U') {
      URL_RE.lastIndex = i;
      if (URL_RE.test(css)) {
        let k = i + 4;
        while (k < css.length && css[k] !== ')') k += css[k] === '\\' ? 2 : 1;
        out += css.slice(i, k).replace(/\s+/g, '');
        i = k;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out
    .replace(/;+/g, ';')
    .replace(/\{;/g, '{')
    .replace(/\};/g, '}')
    .replace(/;\}/g, '}')
    .replace(/;$/, '');
}

function safeMinify(src) {
  try {
    const output = minifyCSS(src);
    if (squash(src) !== squash(output)) {
      return { ok: false, error: 'A verificação de equivalência falhou; arquivo não alterado.' };
    }
    if (minifyCSS(output) !== output) {
      return { ok: false, error: 'A verificação de idempotência falhou; arquivo não alterado.' };
    }
    return { ok: true, output };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}



function minifyEmbeddedStyles(html) {
  const STYLE_REGEX = /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi;
  let hasErrors = false;
  let firstError = '';

  const output = html.replace(STYLE_REGEX, (match, openTag, cssContent, closeTag) => {
    // Se o estilo estiver em branco, mantém
    if (!cssContent.trim()) return match;

    const res = safeMinify(cssContent);
    if (!res.ok) {
      hasErrors = true;
      firstError = res.error;
      return match;
    }

    return `${openTag}\n${res.output.trim()}\n${closeTag}`;
  });

  if (hasErrors) {
    return { ok: false, error: firstError };
  }
  return { ok: true, output };
}

module.exports = { minifyCSS, squash, safeMinify, minifyEmbeddedStyles };