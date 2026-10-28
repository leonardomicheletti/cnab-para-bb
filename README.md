# ⚡ CNAB → Planilha BB

Conversor que lê arquivos **CNAB 240** (ex.: `PGTO27`) e gera a **planilha-padrão de
remessas PIX do Banco do Brasil**, pronta para importar na plataforma do banco.

🔗 **Acesse:** https://leonardomicheletti.github.io/cnab-para-bb

> 🔒 **Privacidade:** todo o processamento acontece **no seu navegador**. Nenhum arquivo ou
> dado bancário é enviado para qualquer servidor. A página é apenas HTML/JS estático.

---

## O que faz

1. **Upload** de um ou vários arquivos CNAB 240 (`.txt`), por arrastar-e-soltar ou seleção.
2. **Extração** de cada lançamento (Segmento A + Segmento B): favorecido, banco (COMPE),
   agência, conta, CPF/CNPJ, data e valor.
3. **Conferência automática**: compara a soma dos lançamentos com o total do próprio arquivo
   (trailer de lote) e mostra o selo **Conferido ✓** quando batem.
4. **Pré-visualização editável**: ajuste qualquer célula antes de exportar; linhas com
   problema ficam destacadas.
5. **Exportação** no modelo exato do BB (duas linhas de cabeçalho idênticas, dados a partir da
   linha 3), tipo de chave **5 – Dados Bancários**. Acima de **100 lançamentos**, divide
   automaticamente em várias planilhas (limite do banco) entregues em um `.zip`.

## Mapeamento CNAB 240 → planilha

| Coluna da planilha | Origem no CNAB 240 (Segmento) |
|---|---|
| Tipo de Chave Pix | fixo `5` (Dados Bancários) — editável |
| Data de pagamento | A, posições 94–101 (`DDMMAAAA` → `DD/MM/AAAA`) |
| Valor | A, posições 120–134 (2 casas decimais → `8500,00`) |
| CPF/CNPJ | B, posições 19–32 |
| Agência (sem dígito) | A, posições 24–28 |
| Conta (com dígito) | A, posições 30–41 + dígito 42 |
| Instituição (COMPE) | A, posições 21–23 (banco favorecido) |

## Como usar

1. Abra o site (ou o `index.html` localmente).
2. Suba o(s) arquivo(s) CNAB.
3. Confira a pré-visualização (o selo **Conferido ✓** indica que o total bate com o arquivo).
4. Clique em **Gerar planilha(s) do BB** e importe o `.xlsx` na plataforma do banco.

Há um arquivo de demonstração em [`exemplo/EXEMPLO_PGTO27.txt`](exemplo/EXEMPLO_PGTO27.txt)
(dados fictícios).

## Rodando localmente

Por ser um site estático, basta servir a pasta:

```bash
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## Tecnologia

- HTML + CSS + JavaScript puro (sem build, sem backend).
- [SheetJS](https://sheetjs.com) (`xlsx`) para gerar o `.xlsx` — vendorizado em `assets/`.
- [JSZip](https://stuk.github.io/jszip/) para empacotar múltiplas planilhas — vendorizado em `assets/`.

## Estrutura

```
cnab-para-bb/
├── index.html
├── assets/
│   ├── app.js              # parser CNAB 240 + geração do .xlsx + UI
│   ├── style.css           # tema futurista
│   ├── xlsx.full.min.js    # SheetJS (vendorizado)
│   └── jszip.min.js        # JSZip (vendorizado)
└── exemplo/
    └── EXEMPLO_PGTO27.txt  # arquivo de demonstração (dados fictícios)
```

---

> ⚠️ Confira sempre os dados na pré-visualização antes de enviar a remessa ao banco. Os
> campos de banco/agência/conta seguem o layout CNAB 240 FEBRABAN; em layouts proprietários
> diferentes, valide uma remessa pequena antes de usar em produção.
