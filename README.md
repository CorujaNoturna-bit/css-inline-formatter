# CSS Inline Formatter

Transforma CSS em regras compactas: cada seletor e todas as suas propriedades em uma única linha.

```css
/* antes */
.btn {
    color: red;
    margin: 0;
}

/* depois */
.btn {color: red;margin: 0;}
```

## Comandos (Ctrl+Shift+P)

- **CSS Inline: Formatar arquivo atual**: aplica no `.css` aberto (desfazível com Ctrl+Z).
- **CSS Inline: Formatar projeto inteiro**: aplica em todos os `.css` da pasta aberta.

## Regras

- Todos os comentários são removidos.
- `@media`, `@supports`, `@keyframes` etc. mantêm a estrutura; cada regra interna fica em uma linha.
- Strings, `url(...)` e valores não são alterados.
- Antes de gravar, cada arquivo é verificado: se o resultado não for equivalente ao original (só formatação mudou), o arquivo não é tocado.
- Arquivos abertos com alterações não salvas são ignorados.
- Por padrão ficam de fora: `node_modules`, `.git`, `dist`, `build`, `out`, `vendor` e `*.min.css` (configurável em `cssInline.exclude`).

**Faça um commit antes de rodar no projeto inteiro.**