// ============================================================
//  SCRIPT PRINCIPAL – SPA Conferência Eletro (Supabase)
//  Login e cadastro com tabela usuarios + RPC
// ============================================================

// --- Estado global ---
let itens = [];
let html5QrCode = null;
let cameraAberta = false;
let buscaTimeout = null;
let recebimentoEmEdicao = null; // guarda ID se estiver editando

// --- Elementos DOM (cache) ---
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// ============================================================
//  ALTERNÂNCIA ENTRE LOGIN E CADASTRO
// ============================================================
const linkCadastro = $('link-cadastro');
const linkLogin = $('link-login');
const formLoginEl = $('form-login');
const formCadastroEl = $('form-cadastro');

linkCadastro.addEventListener('click', (e) => {
  e.preventDefault();
  formLoginEl.style.display = 'none';
  formCadastroEl.style.display = 'block';
  $('login-erro').style.display = 'none';
  $('cadastro-erro').style.display = 'none';
  $('cadastro-ok').style.display = 'none';
});

linkLogin.addEventListener('click', (e) => {
  e.preventDefault();
  formLoginEl.style.display = 'block';
  formCadastroEl.style.display = 'none';
  $('login-erro').style.display = 'none';
  $('cadastro-erro').style.display = 'none';
  $('cadastro-ok').style.display = 'none';
});

// ============================================================
//  CADASTRO DE USUÁRIO (via tabela usuarios + RPC)
// ============================================================
const formCadastro = $('form-cadastro');
formCadastro.addEventListener('submit', async (e) => {
  e.preventDefault();
  const usuario = $('usuario-cad').value.trim();
  const senha = $('senha-cad').value;
  const erroEl = $('cadastro-erro');
  const okEl = $('cadastro-ok');
  erroEl.style.display = 'none';
  okEl.style.display = 'none';

  if (!usuario) {
    erroEl.textContent = '❌ Digite um nome de usuário.';
    erroEl.style.display = 'block';
    return;
  }
  if (senha.length < 6) {
    erroEl.textContent = '❌ A senha deve ter no mínimo 6 caracteres.';
    erroEl.style.display = 'block';
    return;
  }

  try {
    const { data, error } = await supabase
      .rpc('cadastrar_usuario', { usuario, senha });

    if (error) throw error;

    if (data === true) {
      okEl.textContent = '✅ Usuário cadastrado com sucesso! Faça login.';
      okEl.style.display = 'block';
      formCadastro.reset();
      // Volta para login após 3s
      setTimeout(() => {
        formLoginEl.style.display = 'block';
        formCadastroEl.style.display = 'none';
        okEl.style.display = 'none';
      }, 3000);
    } else {
      erroEl.textContent = '⚠️ Nome de usuário já existe. Escolha outro.';
      erroEl.style.display = 'block';
    }
  } catch (err) {
    erroEl.textContent = '❌ ' + err.message;
    erroEl.style.display = 'block';
  }
});

// ============================================================
//  AUTENTICAÇÃO (LOGIN COM TABELA USUARIOS + RPC)
// ============================================================

const formLogin = $('form-login');
const loginErro = $('login-erro');

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const usuario = $('usuario-login').value.trim();
  const senha = $('senha').value;

  if (!usuario || !senha) {
    loginErro.textContent = '❌ Preencha usuário e senha.';
    loginErro.style.display = 'block';
    return;
  }

  try {
    const { data, error } = await supabase
      .rpc('verificar_login', { usuario, senha });

    if (error) throw error;

    if (data === true) {
      loginErro.style.display = 'none';
      sessionStorage.setItem('user', JSON.stringify({ usuario }));
      mostrarPainel();
    } else {
      loginErro.textContent = '❌ Usuário ou senha inválidos.';
      loginErro.style.display = 'block';
    }
  } catch (err) {
    loginErro.textContent = '❌ ' + err.message;
    loginErro.style.display = 'block';
  }
});

// Verifica se já está logado (ao carregar)
document.addEventListener('DOMContentLoaded', () => {
  const user = sessionStorage.getItem('user');
  if (user) {
    mostrarPainel();
  }
});

// Logout
$('btn-sair').addEventListener('click', () => {
  sessionStorage.removeItem('user');
  document.querySelectorAll('section').forEach(s => s.style.display = 'none');
  $('main-nav').style.display = 'none';
  $('page-login').style.display = 'block';
  formLogin.reset();
});

function mostrarPainel() {
  $('page-login').style.display = 'none';
  $('main-nav').style.display = 'flex';
  navegarPara('nova');
}

// ============================================================
//  NAVEGAÇÃO ENTRE PÁGINAS
// ============================================================

const navLinks = document.querySelectorAll('[data-page]');
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.dataset.page;
    navegarPara(page);
  });
});

function navegarPara(page) {
  navLinks.forEach(l => l.classList.remove('ativo'));
  document.querySelector(`[data-page="${page}"]`)?.classList.add('ativo');

  const sections = {
    nova: $('page-nova'),
    lista: $('page-lista'),
    produtos: $('page-produtos'),
  };
  Object.keys(sections).forEach(key => {
    sections[key].style.display = key === page ? 'block' : 'none';
  });

  if (page === 'lista') carregarRecebimentos();
  if (page === 'produtos') carregarTotalProdutos();
}

// ============================================================
//  FUNÇÕES AUXILIARES
// ============================================================

function fmt(n) {
  return n % 1 === 0 ? n.toString() : n.toFixed(3).replace(/0+$/, '');
}

function divColor(d) {
  if (d === 'FALTA') return '#c0392b';
  if (d === 'SOBRA') return '#e07b2a';
  if (d === 'OK') return '#1a7a45';
  return '#1e4d7b';
}

function highlight(id) {
  const el = $(id);
  if (!el) return;
  el.focus();
  el.style.borderColor = '#c0392b';
  setTimeout(() => el.style.borderColor = '', 1500);
}

// ============================================================
//  NOVA CONFERÊNCIA – BUSCA DE PRODUTOS
// ============================================================

const inputCodBarras = $('cod-barras');
const resOk = $('res-ok');
const resNot = $('res-not');
const resDesc = $('res-desc');
const resMeta = $('res-meta');
const hSeq = $('h-seqproduto');
const hCodAcesso = $('h-codacesso');
const descricao = $('descricao');

inputCodBarras.addEventListener('input', function () {
  clearTimeout(buscaTimeout);
  const cod = this.value.trim();
  if (cod.length >= 8) {
    buscaTimeout = setTimeout(() => buscarProduto(cod), 380);
  } else {
    limparRes();
  }
});
inputCodBarras.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    buscarProduto(inputCodBarras.value.trim());
  }
});

async function buscarProduto(cod) {
  if (!cod) return;
  try {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .eq('codacesso', cod)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      aplicarResultado(data);
    } else {
      // Tenta sem zeros à esquerda
      const { data: data2 } = await supabase
        .from('produtos')
        .select('*')
        .eq('codacesso', cod.replace(/^0+/, ''))
        .maybeSingle();
      if (data2) {
        aplicarResultado(data2);
      } else {
        resOk.style.display = 'none';
        resNot.style.display = 'block';
        hSeq.value = '';
        hCodAcesso.value = '';
        descricao.value = '';
        descricao.readOnly = false;
        descricao.style.background = '';
        descricao.focus();
      }
    }
  } catch (err) {
    console.error(err);
  }
}

function aplicarResultado(prod) {
  resOk.style.display = 'block';
  resNot.style.display = 'none';
  hSeq.value = prod.seqproduto || '';
  hCodAcesso.value = prod.codacesso || '';
  resDesc.innerHTML =
    `<span class="plu">PLU ${prod.seqproduto}</span>${prod.desccompleta}`;
  resMeta.textContent =
    `${prod.tipcodigo} · ${prod.embalagem} · ${prod.qtdembalagem} un/cx · ${prod.nomerazao}`;
  descricao.value = prod.desccompleta;
  descricao.readOnly = true;
  descricao.style.background = '#f0f8f3';
  $('qtd-recebida').focus();
}

function limparRes() {
  resOk.style.display = 'none';
  resNot.style.display = 'none';
  descricao.readOnly = false;
  descricao.style.background = '';
  hSeq.value = '';
  hCodAcesso.value = '';
}

// ============================================================
//  CÂMERA (QR CODE)
// ============================================================

$('btn-cam').addEventListener('click', toggleCamera);
$('btn-fechar-cam').addEventListener('click', pararCamera);

function toggleCamera() {
  cameraAberta ? pararCamera() : abrirCamera();
}

function abrirCamera() {
  const container = $('video-container');
  container.style.display = 'block';
  $('btn-cam').textContent = '✕';
  html5QrCode = new Html5Qrcode('reader');
  html5QrCode.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 280, height: 160 } },
    (decoded) => {
      inputCodBarras.value = decoded;
      pararCamera();
      buscarProduto(decoded);
    },
    () => {}
  ).catch(err => {
    alert('Câmera indisponível: ' + err);
    pararCamera();
  });
  cameraAberta = true;
}

function pararCamera() {
  if (html5QrCode) {
    html5QrCode.stop().catch(() => {});
    html5QrCode = null;
  }
  $('video-container').style.display = 'none';
  $('btn-cam').textContent = '📷';
  cameraAberta = false;
}

// ============================================================
//  ADICIONAR ITEM
// ============================================================

$('btn-add').addEventListener('click', adicionarItem);
descricao.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault();
    adicionarItem(); }
});
$('qtd-recebida').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault();
    adicionarItem(); }
});

function adicionarItem() {
  const desc = descricao.value.trim();
  const qtdEsp = parseFloat($('qtd-esperada').value) || 0;
  const qtdRec = parseFloat($('qtd-recebida').value) || 0;
  const unidade = $('unidade').value;
  const cod = inputCodBarras.value.trim();
  const seq = hSeq.value;
  const codac = hCodAcesso.value;

  if (!desc) { highlight('descricao'); return; }
  if (qtdRec <= 0) { highlight('qtd-recebida'); return; }

  let div = '';
  if (qtdEsp > 0) {
    if (qtdRec < qtdEsp) div = 'FALTA';
    else if (qtdRec > qtdEsp) div = 'SOBRA';
    else div = 'OK';
  }

  itens.push({
    codacesso: codac || cod,
    seqproduto: seq,
    descricao: desc,
    qtd_esperada: qtdEsp,
    qtd_recebida: qtdRec,
    unidade,
    divergencia: div,
  });

  renderLista();
  limparCamposNova();
}

function renderLista() {
  const card = $('card-itens');
  const lista = $('lista-itens');
  card.style.display = itens.length ? 'block' : 'none';
  $('badge-total').textContent = `${itens.length} item${itens.length !== 1 ? 's' : ''}`;

  const divs = itens.filter(i => i.divergencia === 'FALTA' || i.divergencia === 'SOBRA');
  const bd = $('badge-div');
  if (divs.length) {
    bd.style.display = 'inline';
    bd.textContent = `${divs.length} divergência${divs.length > 1 ? 's' : ''}`;
  } else {
    bd.style.display = 'none';
  }

  lista.innerHTML = itens.map((it, i) => {
    const divHtml =
      it.divergencia === 'OK' ? `<span class="div-ok">✓ OK</span>` :
      it.divergencia === 'FALTA' ? `<span class="div-falta">▼ FALTA</span>` :
      it.divergencia === 'SOBRA' ? `<span class="div-sobra">▲ SOBRA</span>` :
      '';
    const espHtml = it.qtd_esperada > 0 ?
      `<span class="qtd-esp">Esp: ${fmt(it.qtd_esperada)}</span> →` :
      '';
    return `
      <div class="item-linha" style="border-left-color:${divColor(it.divergencia)}">
        <div class="item-info">
          <div class="item-desc">
            ${it.seqproduto ? `<span class="plu">PLU ${it.seqproduto}</span>` : ''}${it.descricao}
          </div>
          <div class="item-meta">${it.codacesso || 'Código manual'} · ${it.unidade}</div>
        </div>
        <div class="item-qtds">
          ${espHtml}
          <span class="qtd-rec">${fmt(it.qtd_recebida)} ${it.unidade}</span>
          ${divHtml}
        </div>
        <button class="btn btn-danger btn-icon btn-sm" data-remover="${i}" title="Remover">✕</button>
      </div>
    `;
  }).join('');

  lista.querySelectorAll('[data-remover]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.remover);
      itens.splice(idx, 1);
      renderLista();
    });
  });
}

function limparCamposNova() {
  inputCodBarras.value = '';
  descricao.value = '';
  $('qtd-esperada').value = '';
  $('qtd-recebida').value = '1';
  descricao.readOnly = false;
  descricao.style.background = '';
  resOk.style.display = 'none';
  resNot.style.display = 'none';
  hSeq.value = '';
  hCodAcesso.value = '';
  inputCodBarras.focus();
}

$('btn-limpar').addEventListener('click', () => {
  if (itens.length && !confirm('Limpar todos os itens?')) return;
  itens.length = 0;
  renderLista();
  limparCamposNova();
});

// ============================================================
//  SALVAR CONFERÊNCIA (com suporte a edição)
// ============================================================

$('btn-salvar').addEventListener('click', salvarConferencia);

async function salvarConferencia() {
  const fornecedor = $('fornecedor').value.trim();
  const nota_fiscal = $('nota_fiscal').value.trim();
  const observacao = $('observacao').value.trim();

  if (!fornecedor) { highlight('fornecedor'); return; }
  if (!itens.length) { alert('Adicione ao menos um item.'); return; }

  const btn = $('btn-salvar');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Salvando...';

  try {
    if (recebimentoEmEdicao) {
      // ---- EDIÇÃO ----
      const { error: err1 } = await supabase
        .from('recebimentos')
        .update({ fornecedor, nota_fiscal, observacao })
        .eq('id', recebimentoEmEdicao);
      if (err1) throw err1;

      await supabase
        .from('itens_recebimento')
        .delete()
        .eq('recebimento_id', recebimentoEmEdicao);

      const itensParaInserir = itens.map(it => ({
        recebimento_id: recebimentoEmEdicao,
        codacesso: it.codacesso || '',
        seqproduto: it.seqproduto || '',
        descricao: it.descricao,
        qtd_esperada: it.qtd_esperada,
        qtd_recebida: it.qtd_recebida,
        unidade: it.unidade,
        divergencia: it.divergencia,
      }));
      const { error: errIns } = await supabase
        .from('itens_recebimento')
        .insert(itensParaInserir);
      if (errIns) throw errIns;

      alert('✅ Recebimento atualizado com sucesso!');
      recebimentoEmEdicao = null;
      $('btn-salvar').textContent = '💾 Finalizar Conferência';
      itens.length = 0;
      renderLista();
      limparCamposNova();
      $('fornecedor').value = '';
      $('nota_fiscal').value = '';
      $('observacao').value = '';
      navegarPara('lista');
    } else {
      // ---- NOVO ----
      const { data: rec, error: err1 } = await supabase
        .from('recebimentos')
        .insert({ fornecedor, nota_fiscal, observacao })
        .select()
        .single();
      if (err1) throw err1;
      const recId = rec.id;

      const itensParaInserir = itens.map(it => ({
        recebimento_id: recId,
        codacesso: it.codacesso || '',
        seqproduto: it.seqproduto || '',
        descricao: it.descricao,
        qtd_esperada: it.qtd_esperada,
        qtd_recebida: it.qtd_recebida,
        unidade: it.unidade,
        divergencia: it.divergencia,
      }));
      const { error: err2 } = await supabase
        .from('itens_recebimento')
        .insert(itensParaInserir);
      if (err2) throw err2;

      const divs = itens.filter(i => i.divergencia === 'FALTA' || i.divergencia === 'SOBRA').length;
      $('modal-resumo').textContent = `${itens.length} item(s) conferido(s) de "${fornecedor}".`;
      $('modal-div-msg').textContent = divs ?
        `⚠️ ${divs} divergência(s) encontrada(s).` :
        '✅ Sem divergências!';
      $('modal-ok').classList.add('aberto');

      itens.length = 0;
      renderLista();
      limparCamposNova();
      $('fornecedor').value = '';
      $('nota_fiscal').value = '';
      $('observacao').value = '';
    }
  } catch (err) {
    alert('Erro: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = recebimentoEmEdicao ? '💾 Atualizar Conferência' : '💾 Finalizar Conferência';
  }
}

// Fechar modal de sucesso
$('btn-nova-conf').addEventListener('click', () => {
  $('modal-ok').classList.remove('aberto');
  navegarPara('nova');
});
$('btn-ver-lista').addEventListener('click', () => {
  $('modal-ok').classList.remove('aberto');
  navegarPara('lista');
});

// ============================================================
//  LISTA DE RECEBIMENTOS
// ============================================================

async function carregarRecebimentos() {
  const container = $('lista-recebimentos');
  container.innerHTML = '<p style="text-align:center;padding:20px;">Carregando...</p>';

  const { data, error } = await supabase
    .from('recebimentos')
    .select('*')
    .order('data_registro', { ascending: false });

  if (error) {
    container.innerHTML = `<div class="erro">Erro: ${error.message}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `<div class="vazio"><span class="vazio-ico">📭</span>Nenhum recebimento cadastrado.</div>`;
    return;
  }

  let html = `
    <div class="card" style="padding:0;overflow-x:auto;">
      <table>
        <thead><tr>
          <th>ID</th><th>Fornecedor</th><th>NF</th><th>Data</th><th>Observação</th><th style="text-align:center;">Ações</th>
        </tr></thead>
        <tbody>
  `;
  data.forEach(rec => {
    const dataFormatada = new Date(rec.data_registro).toLocaleString('pt-BR');
    html += `
      <tr>
        <td>${rec.id}</td>
        <td><strong>${rec.fornecedor}</strong></td>
        <td>${rec.nota_fiscal || '-'}</td>
        <td>${dataFormatada}</td>
        <td>${rec.observacao || ''}</td>
        <td style="text-align:center;white-space:nowrap;">
          <button class="btn btn-sm btn-azul" data-ver="${rec.id}">👁️ Ver</button>
          <button class="btn btn-sm btn-laranja" data-editar="${rec.id}">✏️ Editar</button>
          <button class="btn btn-sm btn-danger" data-excluir="${rec.id}">🗑️</button>
        </td>
      </tr>
    `;
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;

  container.querySelectorAll('[data-ver]').forEach(btn => {
    btn.addEventListener('click', () => verRecebimento(parseInt(btn.dataset.ver)));
  });
  container.querySelectorAll('[data-editar]').forEach(btn => {
    btn.addEventListener('click', () => editarRecebimento(parseInt(btn.dataset.editar)));
  });
  container.querySelectorAll('[data-excluir]').forEach(btn => {
    btn.addEventListener('click', () => excluirRecebimento(parseInt(btn.dataset.excluir)));
  });
}

// ============================================================
//  VER DETALHE
// ============================================================

async function verRecebimento(id) {
  const { data: rec, error: e1 } = await supabase
    .from('recebimentos')
    .select('*')
    .eq('id', id)
    .single();
  if (e1) { alert('Erro: ' + e1.message); return; }

  const { data: itensDB, error: e2 } = await supabase
    .from('itens_recebimento')
    .select('*')
    .eq('recebimento_id', id);
  if (e2) { alert('Erro: ' + e2.message); return; }

  let html = `
    <p><strong>Fornecedor:</strong> ${rec.fornecedor}</p>
    <p><strong>Nota Fiscal:</strong> ${rec.nota_fiscal || '-'}</p>
    <p><strong>Observação:</strong> ${rec.observacao || '-'}</p>
    <p><strong>Data:</strong> ${new Date(rec.data_registro).toLocaleString('pt-BR')}</p>
    <hr style="margin:16px 0;">
    <h4>Itens (${itensDB.length})</h4>
    <ul style="list-style:none;padding:0;">
  `;
  itensDB.forEach(it => {
    const divColor = it.divergencia === 'FALTA' ? '#c0392b' :
      it.divergencia === 'SOBRA' ? '#e07b2a' :
      it.divergencia === 'OK' ? '#1a7a45' : '#1e4d7b';
    html += `
      <li style="padding:6px 0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;">
        <span>${it.descricao} (${it.unidade})</span>
        <span style="color:${divColor};font-weight:700;">
          ${fmt(it.qtd_recebida)} ${it.divergencia ? ' — ' + it.divergencia : ''}
        </span>
      </li>
    `;
  });
  html += '</ul>';
  $('detalhe-conteudo').innerHTML = html;
  $('modal-detalhe').classList.add('aberto');
  $('modal-detalhe').dataset.recId = id;
}

// ============================================================
//  EDITAR RECEBIMENTO
// ============================================================

function editarRecebimento(id) {
  (async () => {
    const { data: rec, error: e1 } = await supabase
      .from('recebimentos')
      .select('*')
      .eq('id', id)
      .single();
    if (e1) { alert('Erro: ' + e1.message); return; }
    const { data: itensDB, error: e2 } = await supabase
      .from('itens_recebimento')
      .select('*')
      .eq('recebimento_id', id);
    if (e2) { alert('Erro: ' + e2.message); return; }

    $('fornecedor').value = rec.fornecedor;
    $('nota_fiscal').value = rec.nota_fiscal || '';
    $('observacao').value = rec.observacao || '';
    itens.length = 0;
    itensDB.forEach(it => {
      itens.push({
        codacesso: it.codacesso || '',
        seqproduto: it.seqproduto || '',
        descricao: it.descricao,
        qtd_esperada: it.qtd_esperada || 0,
        qtd_recebida: it.qtd_recebida || 0,
        unidade: it.unidade || 'UN',
        divergencia: it.divergencia || '',
      });
    });
    renderLista();
    recebimentoEmEdicao = id;
    navegarPara('nova');
    $('btn-salvar').textContent = '💾 Atualizar Conferência';
  })();
}

// ============================================================
//  EXCLUIR RECEBIMENTO
// ============================================================

async function excluirRecebimento(id) {
  if (!confirm('Tem certeza que deseja excluir este recebimento?')) return;
  try {
    const { error } = await supabase
      .from('recebimentos')
      .delete()
      .eq('id', id);
    if (error) throw error;
    alert('Recebimento excluído.');
    carregarRecebimentos();
  } catch (err) {
    alert('Erro: ' + err.message);
  }
}

$('btn-excluir').addEventListener('click', () => {
  const id = parseInt($('modal-detalhe').dataset.recId);
  if (id) {
    $('modal-detalhe').classList.remove('aberto');
    excluirRecebimento(id);
  }
});
$('btn-fechar-detalhe').addEventListener('click', () => {
  $('modal-detalhe').classList.remove('aberto');
});

// ============================================================
//  PRODUTOS – IMPORTAÇÃO CSV
// ============================================================

const formImportar = $('form-importar');
const importStatus = $('import-status');

formImportar.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = $('file-csv');
  const file = fileInput.files[0];
  if (!file) return;

  importStatus.innerHTML = '<p>⏳ Processando...</p>';
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const text = ev.target.result;
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const dataLines = lines.slice(1);
    let count = 0;
    for (const line of dataLines) {
      const cols = line.split(';');
      if (cols.length < 9) continue;
      const [nomerazao, seqproduto, desccompleta, codacesso, tipcodigo, _, __, embalagem, qtdembalagem] = cols;
      const cod = codacesso.trim();
      if (!cod) continue;
      try {
        const { error } = await supabase
          .from('produtos')
          .upsert({
            codacesso: cod,
            seqproduto: seqproduto.trim(),
            desccompleta: desccompleta.trim(),
            tipcodigo: tipcodigo.trim(),
            embalagem: embalagem.trim(),
            qtdembalagem: qtdembalagem.trim(),
            nomerazao: nomerazao.trim(),
          }, { onConflict: 'codacesso' });
        if (!error) count++;
      } catch (err) { console.error(err); }
    }
    importStatus.innerHTML = `<div class="flash ok">✅ ${count} produtos importados/atualizados com sucesso!</div>`;
    carregarTotalProdutos();
    fileInput.value = '';
  };
  reader.readAsText(file, 'latin-1');
});

async function carregarTotalProdutos() {
  const { count, error } = await supabase
    .from('produtos')
    .select('*', { count: 'exact', head: true });
  if (!error) {
    $('total-produtos').textContent = count;
  }
}