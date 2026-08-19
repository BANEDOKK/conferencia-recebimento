// ============================================================
//  SCRIPT PRINCIPAL – Conferência Eletro (Supabase)
//  CAMPO DE SENHA: senha_hash
// ============================================================

// --- Estado global ---
let itens = [];
let html5QrCode = null;
let cameraAberta = false;
let buscaTimeout = null;
let recebimentoEmEdicao = null;
let usuarioLogado = null;

// --- Elementos DOM ---
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// ============================================================
//  ALTERNÂNCIA LOGIN / CADASTRO
// ============================================================
const linkCadastro = $('link-cadastro');
const linkLogin = $('link-login');
const formLoginEl = $('form-login');
const formCadastroEl = $('form-cadastro');

if (linkCadastro) {
    linkCadastro.addEventListener('click', (e) => {
        e.preventDefault();
        formLoginEl.style.display = 'none';
        formCadastroEl.style.display = 'block';
        $('login-erro').style.display = 'none';
        $('cadastro-erro').style.display = 'none';
        $('cadastro-ok').style.display = 'none';
    });
}
if (linkLogin) {
    linkLogin.addEventListener('click', (e) => {
        e.preventDefault();
        formLoginEl.style.display = 'block';
        formCadastroEl.style.display = 'none';
        $('login-erro').style.display = 'none';
        $('cadastro-erro').style.display = 'none';
        $('cadastro-ok').style.display = 'none';
    });
}

// ============================================================
//  CADASTRO
// ============================================================
formCadastroEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuario = $('email-cad').value.trim();
    const senha = $('senha-cad').value;
    const erroEl = $('cadastro-erro');
    const okEl = $('cadastro-ok');
    erroEl.style.display = 'none';
    okEl.style.display = 'none';

    if (senha.length < 6) {
        erroEl.textContent = '❌ A senha deve ter no mínimo 6 caracteres.';
        erroEl.style.display = 'block';
        return;
    }

    try {
        const { data: existing, error: checkError } = await supabase
            .from('usuarios')
            .select('usuario')
            .eq('usuario', usuario)
            .maybeSingle();

        if (checkError) throw checkError;
        if (existing) {
            erroEl.textContent = '⚠️ Usuário já existe. Escolha outro nome.';
            erroEl.style.display = 'block';
            return;
        }

        const { error: insertError } = await supabase
            .from('usuarios')
            .insert({ 
                usuario: usuario, 
                senha_hash: senha 
            });

        if (insertError) throw insertError;

        okEl.textContent = '✅ Usuário cadastrado com sucesso! Faça login.';
        okEl.style.display = 'block';
        formCadastroEl.reset();
        setTimeout(() => {
            formLoginEl.style.display = 'block';
            formCadastroEl.style.display = 'none';
            okEl.style.display = 'none';
        }, 3000);
    } catch (err) {
        erroEl.textContent = '❌ ' + err.message;
        erroEl.style.display = 'block';
    }
});

// ============================================================
//  LOGIN - CAMPO CORRETO: senha_hash
// ============================================================
const formLogin = $('form-login');
const loginErro = $('login-erro');

formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuario = $('email').value.trim();
    const senha = $('senha').value;
    loginErro.style.display = 'none';

    if (!usuario || !senha) {
        loginErro.textContent = '❌ Preencha usuário e senha.';
        loginErro.style.display = 'block';
        return;
    }

    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('usuario, senha_hash')
            .eq('usuario', usuario);

        if (error) {
            loginErro.textContent = '❌ Erro ao conectar ao banco: ' + error.message;
            loginErro.style.display = 'block';
            return;
        }

        if (!data || data.length === 0) {
            loginErro.textContent = '❌ Usuário não encontrado.';
            loginErro.style.display = 'block';
            return;
        }

        const user = data[0];

        if (user.senha_hash === senha) {
            usuarioLogado = user.usuario;
            sessionStorage.setItem('user', JSON.stringify({ usuario: usuarioLogado }));
            mostrarPainel();
        } else {
            loginErro.textContent = '❌ Senha incorreta.';
            loginErro.style.display = 'block';
        }
    } catch (err) {
        loginErro.textContent = '❌ Erro: ' + err.message;
        loginErro.style.display = 'block';
    }
});

// --- Verificar sessão ao carregar a página ---
document.addEventListener('DOMContentLoaded', () => {
    const user = sessionStorage.getItem('user');
    if (user) {
        const parsed = JSON.parse(user);
        usuarioLogado = parsed.usuario;
        mostrarPainel();
    }
});

// --- Logout ---
$('btn-sair').addEventListener('click', () => {
    sessionStorage.removeItem('user');
    usuarioLogado = null;
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    $('main-nav').style.display = 'none';
    $('page-login').style.display = 'block';
    formLogin.reset();
    itens = [];
    recebimentoEmEdicao = null;
    renderLista();
    limparCamposNova();
    $('fornecedor').value = '';
});

function mostrarPainel() {
    $('page-login').style.display = 'none';
    $('main-nav').style.display = 'flex';
    navegarPara('nova');
}

// ============================================================
//  NAVEGAÇÃO
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

function highlight(id) {
    const el = $(id);
    if (!el) return;
    el.focus();
    el.style.borderColor = '#c0392b';
    setTimeout(() => el.style.borderColor = '', 1500);
}

// ============================================================
//  BUSCA DE PRODUTOS
// ============================================================
const inputCodBarras = $('cod-barras');
const resOk = $('res-ok');
const resNot = $('res-not');
const resDesc = $('res-desc');
const resMeta = $('res-meta');
const hSeq = $('h-seqproduto');
const hCodAcesso = $('h-codacesso');
const hUnidade = $('h-unidade');
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
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        if (data) {
            aplicarResultado(data);
        } else {
            const { data: data2 } = await supabase
                .from('produtos')
                .select('*')
                .eq('codacesso', cod.replace(/^0+/, ''))
                .limit(1)
                .maybeSingle();
            if (data2) {
                aplicarResultado(data2);
            } else {
                resOk.style.display = 'none';
                resNot.style.display = 'block';
                hSeq.value = '';
                hCodAcesso.value = '';
                hUnidade.value = '';
                descricao.value = '';
                descricao.readOnly = false;
                descricao.style.background = '';
                descricao.focus();
            }
        }
    } catch (err) {}
}

function aplicarResultado(prod) {
    resOk.style.display = 'block';
    resNot.style.display = 'none';
    hSeq.value = prod.seqproduto || '';
    hCodAcesso.value = prod.codacesso || '';
    hUnidade.value = prod.embalagem || 'UN';
    resDesc.innerHTML =
        `<span class="plu">PLU ${prod.seqproduto}</span>${prod.desccompleta}`;
    resMeta.textContent =
        `${prod.tipcodigo} · ${prod.embalagem} · ${prod.qtdembalagem} un/cx`;
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
    hUnidade.value = '';
}

// ============================================================
//  CÂMERA
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
    ).catch(() => {
        alert('Câmera indisponível');
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
    if (e.key === 'Enter') { e.preventDefault(); adicionarItem(); }
});
$('qtd-recebida').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); adicionarItem(); }
});

function adicionarItem() {
    const desc = descricao.value.trim();
    const qtdRec = parseFloat($('qtd-recebida').value) || 0;
    const cod = inputCodBarras.value.trim();
    const seq = hSeq.value;
    const codac = hCodAcesso.value;
    const unidade = hUnidade.value || 'UN';

    if (!desc) { highlight('descricao'); return; }
    if (qtdRec <= 0) { highlight('qtd-recebida'); return; }

    itens.push({
        codacesso: codac || cod,
        seqproduto: seq,
        descricao: desc,
        qtd_esperada: 0,
        qtd_recebida: qtdRec,
        unidade: unidade,
        divergencia: '',
    });

    renderLista();
    limparCamposNova();
}

// ============================================================
//  RENDER LISTA
// ============================================================
function renderLista() {
    const card = $('card-itens');
    const lista = $('lista-itens');
    card.style.display = itens.length ? 'block' : 'none';
    
    const totalQuantidade = itens.reduce((sum, item) => sum + item.qtd_recebida, 0);
    $('badge-total').textContent = `${itens.length} item${itens.length !== 1 ? 's' : ''} (${totalQuantidade.toFixed(3)} un)`;

    lista.innerHTML = itens.map((it, i) => {
        return `
            <div class="item-linha" style="border-left-color: #1e4d7b;">
                <div class="item-info">
                    <div class="item-desc">
                        ${it.seqproduto ? `<span class="plu">PLU ${it.seqproduto}</span>` : ''}${it.descricao}
                    </div>
                    <div class="item-meta">${it.codacesso || 'Código manual'} · ${it.unidade}</div>
                </div>
                <div class="item-qtds">
                    <span class="qtd-rec">
                        <input type="number" 
                               class="qtd-edit" 
                               data-index="${i}" 
                               value="${it.qtd_recebida}" 
                               min="0.001" 
                               step="0.001"
                               title="Clique para editar a quantidade">
                        <span style="font-size:0.7rem;color:var(--cinza-esc);">${it.unidade}</span>
                    </span>
                </div>
                <button class="btn btn-danger btn-icon btn-sm" data-remover="${i}" title="Remover">✕</button>
            </div>
        `;
    }).join('');

    lista.querySelectorAll('.qtd-edit').forEach(input => {
        input.addEventListener('change', function() {
            const idx = parseInt(this.dataset.index);
            const novoValor = parseFloat(this.value);
            if (!isNaN(novoValor) && novoValor > 0) {
                itens[idx].qtd_recebida = novoValor;
                const totalQuantidade = itens.reduce((sum, item) => sum + item.qtd_recebida, 0);
                $('badge-total').textContent = `${itens.length} item${itens.length !== 1 ? 's' : ''} (${totalQuantidade.toFixed(3)} un)`;
            } else {
                alert('Digite um valor válido maior que zero.');
                this.value = itens[idx].qtd_recebida;
            }
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                this.blur();
            }
        });

        input.addEventListener('focus', function() {
            this.select();
        });
    });

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
    $('qtd-recebida').value = '1';
    descricao.readOnly = false;
    descricao.style.background = '';
    resOk.style.display = 'none';
    resNot.style.display = 'none';
    hSeq.value = '';
    hCodAcesso.value = '';
    hUnidade.value = '';
    inputCodBarras.focus();
}

$('btn-limpar').addEventListener('click', () => {
    if (itens.length && !confirm('Limpar todos os itens?')) return;
    itens.length = 0;
    renderLista();
    limparCamposNova();
    recebimentoEmEdicao = null;
    $('btn-salvar').textContent = '💾 Finalizar Conferência';
});

// ============================================================
//  SALVAR CONFERÊNCIA
// ============================================================
$('btn-salvar').addEventListener('click', salvarConferencia);

async function salvarConferencia() {
    const fornecedor = $('fornecedor').value.trim();

    if (!fornecedor) { highlight('fornecedor'); return; }
    if (!itens.length) { alert('Adicione ao menos um item.'); return; }

    const btn = $('btn-salvar');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> Salvando...';

    try {
        if (recebimentoEmEdicao) {
            const { data: recExistente, error: checkError } = await supabase
                .from('recebimentos')
                .select('criado_por')
                .eq('id', recebimentoEmEdicao)
                .single();
            
            if (checkError) throw checkError;
            
            if (recExistente.criado_por !== usuarioLogado) {
                alert('❌ Você não pode editar esta conferência. Apenas o criador pode editá-la.');
                btn.disabled = false;
                btn.innerHTML = '💾 Finalizar Conferência';
                return;
            }

            const { error: err1 } = await supabase
                .from('recebimentos')
                .update({ fornecedor, nota_fiscal: '', observacao: '' })
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
                qtd_esperada: 0,
                qtd_recebida: it.qtd_recebida,
                unidade: it.unidade,
                divergencia: '',
            }));
            const { error: errIns } = await supabase
                .from('itens_recebimento')
                .insert(itensParaInserir);
            if (errIns) throw errIns;

            alert('✅ Recebimento atualizado com sucesso!');
            itens.length = 0;
            renderLista();
            limparCamposNova();
            $('fornecedor').value = '';
            recebimentoEmEdicao = null;
            btn.innerHTML = '💾 Finalizar Conferência';
            navegarPara('lista');
        } else {
            const { data: rec, error: err1 } = await supabase
                .from('recebimentos')
                .insert({ 
                    fornecedor, 
                    nota_fiscal: '', 
                    observacao: '',
                    criado_por: usuarioLogado
                })
                .select()
                .single();
            if (err1) throw err1;
            const recId = rec.id;

            const itensParaInserir = itens.map(it => ({
                recebimento_id: recId,
                codacesso: it.codacesso || '',
                seqproduto: it.seqproduto || '',
                descricao: it.descricao,
                qtd_esperada: 0,
                qtd_recebida: it.qtd_recebida,
                unidade: it.unidade,
                divergencia: '',
            }));
            const { error: err2 } = await supabase
                .from('itens_recebimento')
                .insert(itensParaInserir);
            if (err2) throw err2;

            $('modal-resumo').textContent = `${itens.length} item(s) conferido(s) da loja "${fornecedor}" por ${usuarioLogado}.`;
            $('modal-ok').classList.add('aberto');

            itens.length = 0;
            renderLista();
            limparCamposNova();
            $('fornecedor').value = '';
            recebimentoEmEdicao = null;
            btn.innerHTML = '💾 Finalizar Conferência';
        }
    } catch (err) {
        alert('Erro: ' + err.message);
    } finally {
        btn.disabled = false;
        if (!recebimentoEmEdicao) {
            btn.innerHTML = '💾 Finalizar Conferência';
        } else {
            btn.innerHTML = '💾 Atualizar Conferência';
        }
    }
}

// Fechar modal
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
                    <th>Loja</th>
                    <th>Conferente</th>
                    <th>Data</th>
                    <th style="text-align:center;">Ações</th>
                </tr></thead>
                <tbody>
    `;
    data.forEach(rec => {
        const dataFormatada = new Date(rec.data_registro).toLocaleString('pt-BR');
        const criador = rec.criado_por || 'N/A';
        const isCriador = criador === usuarioLogado;
        
        html += `
            <tr>
                <td><strong>${rec.fornecedor}</strong></td>
                <td>👤 ${criador} ${isCriador ? '<span style="color:var(--verde);font-size:0.7rem;">(você)</span>' : ''}</td>
                <td>${dataFormatada}</td>
                <td style="text-align:center;white-space:nowrap;">
                    <button class="btn btn-sm btn-azul" data-acao="ver" data-id="${rec.id}">👁️ Ver</button>
                    ${isCriador ? 
                        `<button class="btn btn-sm btn-laranja" data-acao="editar" data-id="${rec.id}">✏️ Editar</button>
                         <button class="btn btn-sm btn-danger" data-acao="excluir" data-id="${rec.id}">🗑️</button>` :
                        `<button class="btn btn-sm btn-cinza" disabled style="opacity:0.5;cursor:not-allowed;" title="Apenas o criador pode editar">🔒 Editar</button>
                         <button class="btn btn-sm btn-cinza" disabled style="opacity:0.5;cursor:not-allowed;" title="Apenas o criador pode excluir">🔒</button>`
                    }
                </td>
            </tr>
        `;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// ============================================================
//  EVENTOS DA LISTA
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    const container = $('lista-recebimentos');
    if (!container) return;

    container.addEventListener('click', function(e) {
        const btn = e.target.closest('button[data-acao]');
        if (!btn) return;
        const id = parseInt(btn.dataset.id);
        if (isNaN(id)) return;

        switch (btn.dataset.acao) {
            case 'ver':
                verRecebimento(id);
                break;
            case 'editar':
                editarRecebimento(id);
                break;
            case 'excluir':
                excluirRecebimento(id);
                break;
        }
    });
});

// ============================================================
//  VER DETALHE
// ============================================================
async function verRecebimento(id) {
    const { data: rec, error: e1 } = await supabase
        .from('recebimentos')
        .select('*')
        .eq('id', id)
        .single();
    if (e1) { alert('Erro ao buscar recebimento: ' + e1.message); return; }

    const { data: itensDB, error: e2 } = await supabase
        .from('itens_recebimento')
        .select('*')
        .eq('recebimento_id', id);
    if (e2) { alert('Erro ao buscar itens: ' + e2.message); return; }

    const isCriador = rec.criado_por === usuarioLogado;
    const criador = rec.criado_por || 'N/A';

    let html = `
        <p><strong>Loja:</strong> ${rec.fornecedor}</p>
        <p><strong>Conferente:</strong> 👤 ${criador} ${isCriador ? '<span style="color:var(--verde);font-weight:700;">(você)</span>' : ''}</p>
        <p><strong>Data:</strong> ${new Date(rec.data_registro).toLocaleString('pt-BR')}</p>
        <hr style="margin:16px 0;">
        <h4>Itens (${itensDB.length})</h4>
        <ul style="list-style:none;padding:0;">
    `;
    if (!itensDB || itensDB.length === 0) {
        html += '<li style="padding:6px 0;color:var(--cinza-esc);">Nenhum item encontrado para este recebimento.</li>';
    } else {
        itensDB.forEach(it => {
            html += `
                <li style="padding:6px 0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;">
                    <span>${it.descricao} (${it.unidade})</span>
                    <span style="font-weight:700;">${fmt(it.qtd_recebida)}</span>
                </li>
            `;
        });
    }
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
        const { data: rec, error: checkError } = await supabase
            .from('recebimentos')
            .select('*')
            .eq('id', id)
            .single();
        
        if (checkError) { alert('Erro ao buscar recebimento: ' + checkError.message); return; }
        
        if (rec.criado_por !== usuarioLogado) {
            alert('❌ Você não pode editar esta conferência. Apenas o criador pode editá-la.');
            return;
        }

        const { data: itensDB, error: e2 } = await supabase
            .from('itens_recebimento')
            .select('*')
            .eq('recebimento_id', id);
        if (e2) { alert('Erro ao buscar itens: ' + e2.message); return; }

        $('fornecedor').value = rec.fornecedor;
        itens.length = 0;
        itensDB.forEach(it => {
            itens.push({
                codacesso: it.codacesso || '',
                seqproduto: it.seqproduto || '',
                descricao: it.descricao,
                qtd_esperada: 0,
                qtd_recebida: it.qtd_recebida || 0,
                unidade: it.unidade || 'UN',
                divergencia: '',
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
    const { data: rec, error: checkError } = await supabase
        .from('recebimentos')
        .select('criado_por')
        .eq('id', id)
        .single();
    
    if (checkError) { alert('Erro ao verificar permissão: ' + checkError.message); return; }
    
    if (rec.criado_por !== usuarioLogado) {
        alert('❌ Você não pode excluir esta conferência. Apenas o criador pode excluí-la.');
        return;
    }

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
                        nomerazao: ''
                    }, { onConflict: 'codacesso' });
                if (!error) count++;
            } catch (err) {}
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