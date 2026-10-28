# Conversor CNAB para Planilha BB

Ferramenta que lê arquivos de pagamento no formato **CNAB 240** e gera a **planilha de
importação de remessas PIX do Banco do Brasil**, pronta para enviar na plataforma do banco.

Acesse: https://leonardomicheletti.github.io/cnab-para-bb

> **Privacidade:** todo o processamento acontece no seu navegador. Nenhum arquivo ou dado
> bancário é enviado para servidores. A página é apenas HTML e JavaScript estático.

## O que faz

1. Upload de um ou vários arquivos CNAB 240 (`.txt`), por arrastar e soltar ou seleção manual.
2. Extração de cada lançamento (Segmento A combinado com o Segmento B): favorecido, banco
   (COMPE), agência, conta, CPF ou CNPJ, data e valor.
3. Conferência automática: compara a soma dos lançamentos com o total informado no próprio
   arquivo (trailer do lote) e indica a situação "Conferido" quando coincidem.
4. Pré-visualização editável: qualquer célula pode ser ajustada antes de exportar, e as linhas
   com inconsistência ficam destacadas.
5. Exportação no layout do Banco do Brasil (duas linhas de cabeçalho idênticas ao modelo,
   dados a partir da linha 3), com tipo de chave 5 (Dados Bancários). Acima de 100 lançamentos,
   o conteúdo é dividido automaticamente em várias planilhas, entregues em um arquivo `.zip`.

## Mapeamento CNAB 240 para a planilha

| Coluna da planilha      | Origem no CNAB 240 (Segmento)                      |
|-------------------------|----------------------------------------------------|
| Tipo de Chave Pix       | fixo 5 (Dados Bancários), editável                 |
| Data de pagamento       | A, posições 94 a 101 (DDMMAAAA para DD/MM/AAAA)    |
| Valor                   | A, posições 120 a 134 (duas casas decimais)        |
| CPF / CNPJ              | B, posições 19 a 32                                |
| Agência (sem dígito)    | A, posições 24 a 28                                |
| Conta (com dígito)      | A, posições 30 a 41 mais o dígito na posição 42    |
| Instituição (COMPE)     | A, posições 21 a 23 (banco favorecido)             |

## Como usar

1. Abra o site, ou o arquivo `index.html` localmente.
2. Envie o arquivo ou os arquivos CNAB.
3. Confira a pré-visualização. A situação "Conferido" indica que o total bate com o arquivo.
4. Clique em "Gerar planilha do BB" e importe o `.xlsx` na plataforma do banco.

Há um arquivo de demonstração em `exemplo/EXEMPLO_CNAB240.txt`, com dados fictícios.

## Rodando localmente

Por ser um site estático, basta servir a pasta:

```bash
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## Tecnologia

- HTML, CSS e JavaScript puro, sem build e sem backend.
- SheetJS (`xlsx`) para gerar o arquivo `.xlsx`, incluído em `assets/`.
- JSZip para empacotar várias planilhas, incluído em `assets/`.

## Estrutura

```
cnab-para-bb/
  index.html
  assets/
    app.js             parser CNAB 240, geração do .xlsx e interface
    style.css          estilos
    favicon.svg        ícone do site
    xlsx.full.min.js   SheetJS
    jszip.min.js       JSZip
  exemplo/
    EXEMPLO_CNAB240.txt arquivo de demonstração (dados fictícios)
```

## Observação

Confira sempre os dados na pré-visualização antes de enviar a remessa ao banco. Os campos de
banco, agência e conta seguem o layout CNAB 240 da FEBRABAN. Em layouts proprietários
diferentes, valide uma remessa pequena antes de usar em produção.
