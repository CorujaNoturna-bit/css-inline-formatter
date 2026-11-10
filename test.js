'use strict';
const assert = require('assert');
const { safeMinify } = require('./minify');

let passed = 0;

function eq(name, input, expected) {
  const r = safeMinify(input);
  assert.ok(r.ok, `[${name}] falhou: ${r.error}`);
  assert.strictEqual(r.output, expected, `[${name}] saída diferente`);
  passed++;
}

function fails(name, input) {
  const r = safeMinify(input);
  assert.ok(!r.ok, `[${name}] deveria ter falhado`);
  passed++;
}

// 1. Exemplo do usuário
eq(
  'exemplo do usuário',
  `.profile-character-card-creator-name-link {
    position: absolute;
    transform: translate(0px, 350px);
    background: #0b1f44;
    border-radius: 0 0 8px 8px;
    border-bottom: 2px solid #e8e5c9;
    z-index: 0 !important;
}
`,
  '.profile-character-card-creator-name-link {position: absolute;transform: translate(0px, 350px);background: #0b1f44;border-radius: 0 0 8px 8px;border-bottom: 2px solid #e8e5c9;z-index: 0 !important;}\n'
);

// 2. @media (Opção A)
eq(
  '@media',
  `@media (max-width: 600px) {
    .a {
        color: red;
        margin: 0;
    }
    .b { color: blue }
}
`,
  `@media (max-width: 600px) {
    .a {color: red;margin: 0;}
    .b {color: blue;}
}
`
);

// 3. @keyframes
eq(
  '@keyframes',
  '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }',
  `@keyframes spin {
    from {transform: rotate(0deg);}
    to {transform: rotate(360deg);}
}
`
);

// 4. Comentários removidos (em qualquer posição)
eq(
  'comentários',
  `/* cabeçalho */
.a /* x */ .b {
  color: red; /* y */
  /* z */
  margin: 0 /* w */
}
/* fim */`,
  '.a .b {color: red;margin: 0;}\n'
);

// 5. Comentário dentro de string é conteúdo, não comentário
eq('comentário em string', '.a::before{content:"/* x */"}', '.a::before {content:"/* x */";}\n');

// 6. url() com ; e base64, e strings com { } ;
eq(
  'url e strings',
  `.i { background: url(data:image/svg+xml;base64,AAAA/*x*/BBB); content: "a;b{c}"; }`,
  '.i {background: url(data:image/svg+xml;base64,AAAA/*x*/BBB);content: "a;b{c}";}\n'
);

// 7. @charset / @import
eq(
  '@import',
  `@charset "UTF-8";
@import url("a.css");
/* c */
.a{color:red}`,
  `@charset "UTF-8";
@import url("a.css");
.a {color:red;}
`
);

// 8. Valores e seletores em várias linhas
eq(
  'multilinha',
  `a,
b:hover
{
  transition: color .2s ease,
              background .2s ease;
  font-family: "A B",
    sans-serif;
}`,
  'a, b:hover {transition: color .2s ease, background .2s ease;font-family: "A B", sans-serif;}\n'
);

// 9. Custom property com chaves
eq('custom property', ':root{--x:{a:b;c:d};--y: 1px;}', ':root {--x:{a:b;c:d};--y: 1px;}\n');

// 10. CSS aninhado
eq(
  'aninhado',
  '.card { color: red; &:hover { color: blue; } .title { margin: 0; } padding: 1px; }',
  `.card {
    color: red;
    &:hover {color: blue;}
    .title {margin: 0;}
    padding: 1px;
}
`
);

// 11. Sem ; na última declaração e regra vazia
eq('sem ponto e vírgula', '.a{color:red;margin:0}', '.a {color:red;margin:0;}\n');
eq('regra vazia', '.a{}', '.a {}\n');

// 12. CRLF preservado
eq('CRLF', '.a{\r\n color:red;\r\n}\r\n', '.a {color:red;}\r\n');

// 13. @font-face e @media com @font-face dentro
eq(
  '@font-face',
  `@font-face { font-family: "X"; src: url(x.woff2) format("woff2"), url('x.woff') format('woff'); }`,
  `@font-face {font-family: "X";src: url(x.woff2) format("woff2"), url('x.woff') format('woff');}\n`
);

// 14. CSS inválido não é alterado (erro)
fails('chave sem fechar', '.a{color:red');
fails('chave sobrando', '.a{color:red}}');

console.log(`OK: ${passed} testes passaram.`);