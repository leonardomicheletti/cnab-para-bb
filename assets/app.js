/* =============================================================================
   Conversor CNAB 240 (PGTO27)  ->  Planilha-padrão de remessas PIX do Banco do Brasil
   Todo o processamento acontece no navegador. Nenhum dado sai do dispositivo.
   ============================================================================= */
'use strict';

/* ---------------------------------------------------------------------------
   1. Modelo exato da planilha do Banco do Brasil
   --------------------------------------------------------------------------- */
const BB_HEADER_ROW1 = [
  'Tipo de Chave Pix',
  'Data de pagamento',
  'Valor',
  'Chave Pix',
  'CPF/CNPJ',
  'Agencia',
  'Conta',
  'Instituição Financeira (COMPE)',
  'Instituição Financeira (ISPB)',
];

// Segunda linha de cabeçalho (orientações): igual ao modelo do banco, não pode ser alterada.
const BB_HEADER_ROW2 = [
  '1- Telefone\n2- e-mail\n3- CPF/CNPJ\n4- Chave Aleatoria\n5- Dados Bancários\n6- URL do QR Code\n7- Copia e Cola',
  'Formato da data: DD/MM/AAAA',
  'Valor no formato: 000000,00 (Sem pontos)',
  'Chave PIX do cliente recebedor, conforme tipo informado:',
  'Apenas números e letras, sem caracteres especiais:\nCPF:  XXXXXXXXXXX\nCNPJ: XXXXXXXXXXXXXX',
  'Agência de crédito sem dígito verificador: XXXX',
  'Conta de crédito com dígito verificador (Se houver): XXXXXXXXXX',
  'Número da Instituição Financeira (COMPE): XXX',
  'Número da Instituição Financeira (Código ISPB): XXXXXXXX',
];

// Aba "Orientações de preenchimento" reproduzida do modelo do banco (conteúdo estático).
function buildOrientacoesAoa() {
  const aoa = [];
  for (let i = 0; i < 32; i++) aoa.push(['', '', '', '', '', '', '', '', '']);
  aoa[0] = BB_HEADER_ROW1.slice();
  aoa[1] = [
    '1- Telefone\n2- e-mail\n3- CPF/CNPJ\n4- Chave Aleatoria\n5- Dados Bancários\n6- URL do QR Code\n7- Copia e Cola',
    'Data no formato DD/MM/AAAA',
    'Valor no formato XXXXXX,XX',
    'Chave pix do cliente recebedor, conforme tipo informado',
    'Apenas números e letras, sem caracteres especiais:\nCPF:  XXXXXXXXXXX\nCNPJ: XXXXXXXXXXXXXX',
    'Agência de crédito sem dígito verificador: XXXX',
    'Conta de crédito com dígito verificador (Se houver): XXXXXXXXXX',
    'Número da Instituição Financeira (COMPE): XXX',
    'Número da Instituição Financeira (Código ISPB): XXXXXXXX',
  ];
  aoa[4][0] = 'Orientações:';
  aoa[4][1] = 'Cada lançamento deverá ser preenchido em uma linha exclusiva';
  aoa[5][1] = 'As duas linhas de cabeçalho da planilha não podem ser alteradas ou excluídas';
  aoa[6][1] = 'O limite de lançamentos importados por planilha é 100 lançamentos';
  aoa[9][0] = 'Coluna A - Tipo de chave Pix';
  aoa[9][1] = 'Usuário deverá informar o tipo de chave a ser utilizada, sendo:';
  aoa[9][2] = '"1" para Telefone';
  aoa[10][2] = '"2" para e-mail';
  aoa[11][2] = '"3" para CPF/CNPJ';
  aoa[12][2] = '"4" para Chave aleatória';
  aoa[13][2] = '"5" para Dados bancários';
  aoa[14][2] = '"6" para URL do QR Code';
  aoa[15][2] = '"7" para Copia e Cola';
  aoa[17][0] = 'Coluna B - Data de pagamento';
  aoa[17][1] = 'Usuário deverá informar a data de pagamento do lançamento';
  aoa[19][0] = 'Coluna C - Valor do pagamento';
  aoa[19][1] = 'Usuário deverá informar o valor do pagamento em reais com centavos separados por vírgula';
  aoa[19][2] = 'Não utilizar pontos';
  aoa[21][0] = 'Coluna D - Chave Pix';
  aoa[21][1] = 'Usuário deverá informar a chave Pix para pagamento (Não se aplica ao tipo "5" Dados Bancários)';
  aoa[21][2] = ' Caso CPF/CNPJ sem caracteres especiais';
  aoa[23][0] = 'Coluna E - CPF/CNPJ';
  aoa[23][1] = 'Usuário pode informar o CPF ou CNPJ do recebedor (Obrigatório caso lançamento seja tipo "5" Dados Bancários)';
  aoa[23][2] = 'CPF/CNPJ sem caracteres especiais';
  aoa[25][0] = 'Coluna F - Agência';
  aoa[25][1] = 'Usuário deve informar a Agência do recebedor (Obrigatório caso lançamento seja tipo "5" Dados Bancários)';
  aoa[25][2] = 'Sem dígito verificador';
  aoa[27][0] = 'Coluna G - Conta';
  aoa[27][1] = 'Usuário deve informar a Conta do recebedor (Obrigatório caso lançamento seja tipo "5" Dados Bancários)';
  aoa[27][2] = 'Conta junto com dígito verificador caso exista';
  aoa[29][0] = 'Instituição Financeira';
  aoa[29][1] = 'Pelo menos uma das duas colunas DEVE ser preenchida caso lançamento seja DADOS BANCÁRIOS';
  return aoa;
}

const MAX_POR_PLANILHA = 100;

/* ---------------------------------------------------------------------------
   2. Parser CNAB 240
   Posições (base 1) validadas contra o arquivo PGTO27:
     Segmento A: banco/COMPE 21-23 | agência 24-28 | conta 30-41 | DV conta 42
                 nome 44-73 | data pgto 94-101 | valor 120-134
     Segmento B: tipo inscrição 18 | nº inscrição (CPF/CNPJ) 19-32
     Trailer lote (reg 5): somatório de valores 24-41
   --------------------------------------------------------------------------- */
function digitsOnly(s) { return (s || '').replace(/\D/g, ''); }
function stripZeros(s) { return (digitsOnly(s).replace(/^0+/, '')) || '0'; }
function pos(line, a, b) { return line.substring(a - 1, b); } // 1-based inclusivo

function centsToBR(cents) {
  const neg = cents < 0;
  cents = Math.abs(Math.round(cents));
  const int = Math.floor(cents / 100);
  const dec = String(cents % 100).padStart(2, '0');
  return (neg ? '-' : '') + String(int) + ',' + dec;
}

function cnabDateToBR(raw) {
  const d = digitsOnly(raw);
  if (d.length !== 8 || d === '00000000') return '';
  return d.substring(0, 2) + '/' + d.substring(2, 4) + '/' + d.substring(4, 8);
}

function formatDoc(raw, tipoInsc) {
  const d = digitsOnly(raw);
  // tipo 1 = CPF (11 dígitos), tipo 2 = CNPJ (14 dígitos)
  if (tipoInsc === '1') return d.slice(-11).padStart(11, '0');
  if (tipoInsc === '2') return d.slice(-14).padStart(14, '0');
  // sem tipo definido: deduz pelo tamanho significativo
  const sig = stripZeros(d);
  return sig.length > 11 ? d.slice(-14).padStart(14, '0') : d.slice(-11).padStart(11, '0');
}

/**
 * Lê o conteúdo de um arquivo CNAB 240 e devolve os lançamentos extraídos.
 * @returns {{entries:Array, trailerCents:number, warnings:string[], linhas:number}}
 */
function parseCnab(text, sourceName) {
  const warnings = [];
  const rawLines = text.split(/\r\n|\r|\n/);
  const lines = rawLines.filter((l) => l.trim().length > 0);
  const entries = [];
  let trailerCents = 0;
  let pending = null; // segmento A aguardando o B
  let lineCount = 0;

  lines.forEach((line, idx) => {
    if (line.length < 60) return; // linha claramente inválida/curta
    lineCount++;
    const tipoReg = line.substring(7, 8);
    const segmento = line.substring(13, 14);

    if (tipoReg === '3' && segmento === 'A') {
      if (pending) { entries.push(pending); pending = null; } // A sem B anterior
      const cents = parseInt(digitsOnly(pos(line, 120, 134)) || '0', 10);
      pending = {
        id: 'e' + entries.length + '_' + idx,
        source: sourceName,
        nome: pos(line, 44, 73).trim(),
        compe: digitsOnly(pos(line, 21, 23)).padStart(3, '0'),
        agencia: stripZeros(pos(line, 24, 28)),
        conta: stripZeros(pos(line, 30, 41) + pos(line, 42, 42)),
        data: cnabDateToBR(pos(line, 94, 101)),
        valorCents: cents,
        valor: centsToBR(cents),
        tipoChave: '5',      // Dados Bancários (padrão)
        chavePix: '',
        cpfcnpj: '',
        ispb: '',
      };
    } else if (tipoReg === '3' && segmento === 'B') {
      if (pending) {
        const tipoInsc = pos(line, 18, 18).trim();
        pending.cpfcnpj = formatDoc(pos(line, 19, 32), tipoInsc);
        entries.push(pending);
        pending = null;
      }
    } else if (tipoReg === '5') {
      // trailer de lote: acumula o somatório de valores
      trailerCents += parseInt(digitsOnly(pos(line, 24, 41)) || '0', 10);
    }
  });
  if (pending) entries.push(pending);

  if (entries.length === 0) {
    warnings.push('Nenhum lançamento (registro Segmento A) foi encontrado neste arquivo.');
  }
  return { entries, trailerCents, warnings, linhas: lineCount };
}

/* ---------------------------------------------------------------------------
   3. Validação de cada lançamento
   --------------------------------------------------------------------------- */
function validateEntry(e) {
  const errs = [];
  if (!e.valorCents || e.valorCents <= 0) errs.push('Valor inválido');
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(e.data)) errs.push('Data inválida');
  if (e.tipoChave === '5') {
    if (!e.cpfcnpj) errs.push('CPF/CNPJ obrigatório (Dados Bancários)');
    if (!e.agencia || e.agencia === '0') errs.push('Agência obrigatória');
    if (!e.conta || e.conta === '0') errs.push('Conta obrigatória');
    if (!e.compe && !e.ispb) errs.push('COMPE ou ISPB obrigatório');
  } else {
    if (!e.chavePix) errs.push('Chave Pix obrigatória para o tipo escolhido');
  }
  return errs;
}

/* ---------------------------------------------------------------------------
   4. Estado da aplicação
   --------------------------------------------------------------------------- */
const state = {
  files: [],      // [{name, entries, trailerCents, warnings}]
  entries: [],    // lançamentos consolidados (editáveis)
};

function recomputeTotals() {
  let somaCents = 0;
  state.entries.forEach((e) => {
    e.valorCents = brToCents(e.valor);
    somaCents += e.valorCents;
  });
  const trailerCents = state.files.reduce((s, f) => s + (f.trailerCents || 0), 0);
  return { somaCents, trailerCents, conferido: trailerCents > 0 && somaCents === trailerCents };
}

function brToCents(br) {
  if (typeof br !== 'string') br = String(br);
  const neg = br.trim().startsWith('-');
  const d = digitsOnly(br);
  if (!d) return 0;
  // trata "8500,00" e "8500" e "8.500,00"
  const hasComma = br.includes(',');
  let cents;
  if (hasComma) {
    const parts = br.replace(/\./g, '').split(',');
    const int = digitsOnly(parts[0]) || '0';
    const dec = (digitsOnly(parts[1]) || '00').padEnd(2, '0').slice(0, 2);
    cents = parseInt(int, 10) * 100 + parseInt(dec, 10);
  } else {
    cents = parseInt(d, 10) * 100; // sem vírgula: interpreta o número como reais inteiros
  }
  return neg ? -cents : cents;
}

/* ---------------------------------------------------------------------------
   5. Geração da planilha .xlsx no formato BB
   --------------------------------------------------------------------------- */
function entryToRow(e) {
  return [
    String(e.tipoChave || '5'),
    e.data || '',
    e.valor || '',
    e.chavePix || '',
    e.cpfcnpj || '',
    e.agencia && e.agencia !== '0' ? e.agencia : '',
    e.conta && e.conta !== '0' ? e.conta : '',
    e.compe || '',
    e.ispb || '',
  ];
}

function buildWorkbook(entries) {
  const aoa = [BB_HEADER_ROW1.slice(), BB_HEADER_ROW2.slice()];
  entries.forEach((e) => aoa.push(entryToRow(e)));

  const wsImport = XLSX.utils.aoa_to_sheet(aoa);
  // força todas as células como texto (preserva zeros à esquerda e a vírgula)
  forceText(wsImport);
  wsImport['!cols'] = [
    { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 26 }, { wch: 18 },
    { wch: 12 }, { wch: 16 }, { wch: 22 }, { wch: 22 },
  ];

  const wsOri = XLSX.utils.aoa_to_sheet(buildOrientacoesAoa());
  wsOri['!cols'] = [{ wch: 28 }, { wch: 60 }, { wch: 30 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsImport, 'Importação');
  XLSX.utils.book_append_sheet(wb, wsOri, 'Orientações de preenchimento');
  return wb;
}

function forceText(ws) {
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell && cell.v != null) {
        cell.t = 's';
        cell.v = String(cell.v);
        cell.z = '@';
      }
    }
  }
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function wbToUint8(wb) {
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}

async function exportXlsx() {
  if (state.entries.length === 0) { toast('Nenhum lançamento para exportar.', 'erro'); return; }
  const ts = timestamp();
  const lotes = chunk(state.entries, MAX_POR_PLANILHA);

  if (lotes.length === 1) {
    const data = wbToUint8(buildWorkbook(lotes[0]));
    downloadBlob(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `REMESSA_BB_PIX_${ts}.xlsx`);
    toast(`Planilha gerada com ${lotes[0].length} lançamento(s).`, 'ok');
    return;
  }

  // vários lotes -> .zip
  const zip = new JSZip();
  lotes.forEach((lote, i) => {
    const data = wbToUint8(buildWorkbook(lote));
    zip.file(`REMESSA_BB_PIX_${ts}_parte_${i + 1}.xlsx`, data);
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `REMESSA_BB_PIX_${ts}_${lotes.length}_lotes.zip`);
  toast(`${lotes.length} planilhas (até ${MAX_POR_PLANILHA} lançamentos cada) geradas em um .zip.`, 'ok');
}

/* ---------------------------------------------------------------------------
   6. Leitura de arquivos (ISO-8859-1, padrão dos arquivos CNAB)
   --------------------------------------------------------------------------- */
function readFileAsLatin1(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsText(file, 'ISO-8859-1');
  });
}

async function handleFiles(fileList) {
  const files = Array.from(fileList);
  if (!files.length) return;
  setProcessing(true);
  const allWarnings = [];
  for (const file of files) {
    try {
      const text = await readFileAsLatin1(file);
      const parsed = parseCnab(text, file.name);
      state.files.push({ name: file.name, entries: parsed.entries, trailerCents: parsed.trailerCents });
      state.entries.push(...parsed.entries);
      parsed.warnings.forEach((w) => allWarnings.push(`${file.name}: ${w}`));
    } catch (err) {
      allWarnings.push(`${file.name}: falha ao ler (${err && err.message ? err.message : err}).`);
    }
  }
  setProcessing(false);
  renderAll();
  if (allWarnings.length) toast(allWarnings.join(' '), 'aviso');
  else toast(`${files.length} arquivo(s) processado(s): ${state.entries.length} lançamento(s).`, 'ok');
}

function clearAll() {
  state.files = [];
  state.entries = [];
  renderAll();
  toast('Lista limpa.', 'ok');
}

/* ---------------------------------------------------------------------------
   7. Renderização da UI
   --------------------------------------------------------------------------- */
const $ = (sel) => document.querySelector(sel);

const SVG_OK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const SVG_WARN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
const SVG_DEL = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

function setProcessing(on) {
  $('#processing').classList.toggle('show', on);
}

function renderAll() {
  renderFileChips();
  renderTable();
  renderSummary();
}

function renderFileChips() {
  const box = $('#fileChips');
  box.innerHTML = '';
  state.files.forEach((f) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    const plural = f.entries.length === 1 ? 'lançamento' : 'lançamentos';
    chip.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg> ${escapeHtml(f.name)} <b>${f.entries.length} ${plural}</b>`;
    box.appendChild(chip);
  });
  $('#panelResults').classList.toggle('show', state.entries.length > 0 || state.files.length > 0);
}

const TIPOS = {
  '1': 'Telefone', '2': 'E-mail', '3': 'CPF/CNPJ', '4': 'Chave aleatória',
  '5': 'Dados Bancários', '6': 'URL QR Code', '7': 'Copia e Cola',
};

function renderTable() {
  const tbody = $('#tbody');
  tbody.innerHTML = '';
  state.entries.forEach((e, i) => {
    const errs = validateEntry(e);
    const tr = document.createElement('tr');
    if (errs.length) tr.classList.add('row-warn');
    tr.innerHTML = `
      <td class="muted">${i + 1}</td>
      <td class="nome" title="${escapeHtml(e.nome)}">${escapeHtml(e.nome || 'sem nome')}</td>
      <td>${tipoSelect(e, i)}</td>
      <td>${inp(e, i, 'cpfcnpj', 'doc')}</td>
      <td>${inp(e, i, 'compe', 'compe')}</td>
      <td>${inp(e, i, 'agencia', 'ag')}</td>
      <td>${inp(e, i, 'conta', 'conta')}</td>
      <td>${inp(e, i, 'data', 'data')}</td>
      <td>${inp(e, i, 'valor', 'valor')}</td>
      <td class="status">${errs.length
        ? `<span class="badge badge-warn" title="${escapeHtml(errs.join(' · '))}">${SVG_WARN}</span>`
        : `<span class="badge badge-ok" title="Lançamento válido">${SVG_OK}</span>`}
        <button class="del" data-del="${i}" title="Remover lançamento" aria-label="Remover lançamento">${SVG_DEL}</button></td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('input').forEach((el) => el.addEventListener('input', onCellEdit));
  tbody.querySelectorAll('select').forEach((el) => el.addEventListener('change', onCellEdit));
  tbody.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    state.entries.splice(parseInt(b.dataset.del, 10), 1);
    renderAll();
  }));
}

function tipoSelect(e, i) {
  const opts = Object.keys(TIPOS).map((k) =>
    `<option value="${k}" ${k === String(e.tipoChave) ? 'selected' : ''}>${k} - ${TIPOS[k]}</option>`).join('');
  return `<select data-i="${i}" data-k="tipoChave" class="sel">${opts}</select>`;
}

function inp(e, i, key, cls) {
  return `<input data-i="${i}" data-k="${key}" class="cell ${cls}" value="${escapeHtml(e[key] || '')}" spellcheck="false">`;
}

function onCellEdit(ev) {
  const el = ev.target;
  const i = parseInt(el.dataset.i, 10);
  const k = el.dataset.k;
  if (!state.entries[i]) return;
  state.entries[i][k] = el.value;
  if (k === 'valor') state.entries[i].valorCents = brToCents(el.value);
  // revalida só a linha (leve) + atualiza resumo
  const tr = el.closest('tr');
  const errs = validateEntry(state.entries[i]);
  tr.classList.toggle('row-warn', errs.length > 0);
  const st = tr.querySelector('.status .badge');
  if (st) {
    st.className = 'badge ' + (errs.length ? 'badge-warn' : 'badge-ok');
    st.innerHTML = errs.length ? SVG_WARN : SVG_OK;
    st.title = errs.length ? errs.join(' · ') : 'Lançamento válido';
  }
  renderSummary();
}

function renderSummary() {
  const n = state.entries.length;
  const { somaCents, trailerCents, conferido } = recomputeTotals();
  const lotes = Math.max(1, Math.ceil(n / MAX_POR_PLANILHA));
  const invalidas = state.entries.filter((e) => validateEntry(e).length > 0).length;

  $('#stCount').textContent = n;
  $('#stTotal').textContent = 'R$ ' + centsToBR(somaCents).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  $('#stLotes').textContent = String(lotes);
  $('#stInvalid').textContent = invalidas;
  $('#stInvalid').parentElement.classList.toggle('bad', invalidas > 0);

  const conf = $('#confBadge');
  if (trailerCents > 0) {
    conf.style.display = '';
    const totalFmt = centsToBR(trailerCents).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (conferido) {
      conf.className = 'notice conf ok';
      conf.innerHTML = `${SVG_OK}<span>Conferido com o arquivo. Total de R$ ${totalFmt}.</span>`;
    } else {
      conf.className = 'notice conf bad';
      conf.innerHTML = `${SVG_WARN}<span>Divergência: o total informado no arquivo é R$ ${totalFmt}.</span>`;
    }
  } else {
    conf.style.display = 'none';
  }

  const lim = $('#limitWarn');
  lim.style.display = n > MAX_POR_PLANILHA ? '' : 'none';
  if (n > MAX_POR_PLANILHA) {
    lim.innerHTML = `${SVG_WARN}<span>Acima de ${MAX_POR_PLANILHA} lançamentos. Serão geradas ${lotes} planilhas (até ${MAX_POR_PLANILHA} cada), entregues em um arquivo .zip.</span>`;
  }
  $('#btnExport').disabled = n === 0;
}

/* ---------------------------------------------------------------------------
   8. Utilidades de UI
   --------------------------------------------------------------------------- */
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let toastTimer = null;
function toast(msg, kind) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + (kind || '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 5200);
}

/* ---------------------------------------------------------------------------
   9. Wiring
   --------------------------------------------------------------------------- */
function initDropzone() {
  const dz = $('#dropzone');
  const input = $('#fileInput');
  dz.addEventListener('click', () => input.click());
  dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', (e) => { handleFiles(e.target.files); input.value = ''; });

  ['dragenter', 'dragover'].forEach((ev) =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); if (ev === 'drop' || e.target === dz) dz.classList.remove('drag'); }));
  dz.addEventListener('drop', (e) => {
    dz.classList.remove('drag');
    if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initDropzone();
  $('#btnExport').addEventListener('click', exportXlsx);
  $('#btnClear').addEventListener('click', clearAll);
  renderSummary();
  // expõe para testes automatizados
  window.__CNAB = { parseCnab, buildWorkbook, wbToUint8, state, handleFiles, exportXlsx };
});
