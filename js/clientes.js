import { supabase } from '../supabase.js'

let listaClientes = []

export async function carregarClientes() {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('nome')

  if (error) {
    mostrarAlerta('clientes-alert', 'Erro ao carregar clientes: ' + error.message, 'error')
    return
  }

  listaClientes = data
  renderizarClientes(data)
  atualizarSelectClientes(data)
}

export function renderizarClientes(lista) {
  const tbody = document.getElementById('clientes-tbody')
  if (!tbody) return

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum cliente cadastrado.</td></tr>'
    return
  }

  tbody.innerHTML = lista.map(c => `
    <tr class="cliente-row" style="cursor:pointer;" onclick="window._abrirFichaCliente('${c.id}')">
      <td>
        <span style="color:var(--accent);font-weight:600;">${escapeHtml(c.nome)}</span>
      </td>
      <td>${escapeHtml(c.nome_contato || '—')}</td>
      <td>${escapeHtml(c.local || '—')}</td>
      <td>${escapeHtml(c.contato || '—')}</td>
      <td onclick="event.stopPropagation()">
        <button class="btn btn-danger" onclick="window._removerCliente('${c.id}')">Remover</button>
      </td>
    </tr>
  `).join('')
}

export async function adicionarCliente(nome, nomeContato, local, contato) {
  const { error } = await supabase.from('clientes').insert({
    nome: nome.trim(),
    nome_contato: nomeContato.trim(),
    local: local.trim(),
    contato: contato.trim()
  })

  if (error) {
    mostrarAlerta('clientes-alert', 'Erro ao salvar cliente: ' + error.message, 'error')
    return false
  }

  mostrarAlerta('clientes-alert', 'Cliente adicionado com sucesso!', 'success')
  await carregarClientes()
  return true
}

export async function removerCliente(id) {
  if (!confirm('Remover este cliente? As vendas associadas também serão excluídas.')) return

  const { error } = await supabase.from('clientes').delete().eq('id', id)

  if (error) {
    mostrarAlerta('clientes-alert', 'Erro ao remover cliente: ' + error.message, 'error')
    return
  }

  mostrarAlerta('clientes-alert', 'Cliente removido.', 'success')
  await carregarClientes()
}

export async function abrirFichaCliente(id) {
  const modal = document.getElementById('modal-ficha')
  const conteudo = document.getElementById('ficha-conteudo')
  if (!modal || !conteudo) return

  conteudo.innerHTML = '<p style="color:var(--text-muted);padding:20px;">Carregando...</p>'
  modal.classList.add('show')
  document.body.style.overflow = 'hidden'

  // Busca dados do cliente
  const { data: cliente, error: erroCli } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single()

  // Busca vendas com parcelas
  const { data: vendas, error: erroVendas } = await supabase
    .from('vendas')
    .select('*, parcelas(*)')
    .eq('cliente_id', id)
    .order('data', { ascending: false })

  if (erroCli || erroVendas) {
    conteudo.innerHTML = '<p style="color:var(--danger);padding:20px;">Erro ao carregar dados.</p>'
    return
  }

  const mesAtual = new Date().toISOString().slice(0, 7) // "YYYY-MM"

  const linhasVendas = (vendas || []).map(v => {
    const parcelas = v.parcelas || []
    const total = parcelas.length
    const pagas = parcelas.filter(p => p.mes_ano <= mesAtual).length
    const status = calcularStatus(pagas, total)

    return `
      <tr>
        <td>${formatarData(v.data)}</td>
        <td>${v.qtd} un.</td>
        <td class="money">${fm(v.preco_unit)}</td>
        <td class="money">${fm(v.total)}</td>
        <td class="money money-green">${fm(v.lucro)}</td>
        <td>${statusBadge(status, pagas, total)}</td>
      </tr>
    `
  }).join('')

  const totalVendas = (vendas || []).reduce((s, v) => s + Number(v.total), 0)
  const totalLucro = (vendas || []).reduce((s, v) => s + Number(v.lucro), 0)
  const totalAparelhos = (vendas || []).reduce((s, v) => s + Number(v.qtd), 0)

  conteudo.innerHTML = `
    <div style="margin-bottom:24px;">
      <h2 style="font-size:22px;font-weight:700;color:var(--text);">${escapeHtml(cliente.nome)}</h2>
      <div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:12px;">
        ${cliente.nome_contato ? `<span style="font-size:13px;color:var(--text-muted);">👤 <strong>${escapeHtml(cliente.nome_contato)}</strong></span>` : ''}
        ${cliente.local ? `<span style="font-size:13px;color:var(--text-muted);">📍 ${escapeHtml(cliente.local)}</span>` : ''}
        ${cliente.contato ? `<span style="font-size:13px;color:var(--text-muted);">📞 ${escapeHtml(cliente.contato)}</span>` : ''}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">
      <div class="kpi-card">
        <div class="kpi-label">Aparelhos</div>
        <div class="kpi-value">${totalAparelhos}</div>
      </div>
      <div class="kpi-card accent">
        <div class="kpi-label">Receita Total</div>
        <div class="kpi-value">${fm(totalVendas)}</div>
      </div>
      <div class="kpi-card success">
        <div class="kpi-label">Lucro Total</div>
        <div class="kpi-value">${fm(totalLucro)}</div>
      </div>
    </div>

    <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:12px;">
      Histórico de Compras
    </h3>

    ${!vendas || !vendas.length
      ? '<p class="empty-state">Nenhuma venda registrada para este cliente.</p>'
      : `<div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Qtd</th>
                <th>Preço Unit.</th>
                <th>Total</th>
                <th>Lucro</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${linhasVendas}</tbody>
          </table>
        </div>`
    }
  `
}

export function fecharFichaCliente() {
  const modal = document.getElementById('modal-ficha')
  if (modal) modal.classList.remove('show')
  document.body.style.overflow = ''
}

function calcularStatus(pagas, total) {
  if (total === 0) return 'sem-parcelas'
  if (pagas >= total) return 'quitado'
  if (pagas === 0) return 'aguardando'
  return 'em-andamento'
}

function statusBadge(status, pagas, total) {
  if (status === 'quitado') {
    return '<span style="background:#d4edda;color:#155724;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">Quitado ✓</span>'
  }
  if (status === 'aguardando') {
    return '<span style="background:#fff3cd;color:#856404;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">Aguardando 1ª parcela</span>'
  }
  if (status === 'em-andamento') {
    return `<span style="background:#fff0e8;color:var(--accent);padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">Parcela ${pagas} de ${total}</span>`
  }
  return '—'
}

function atualizarSelectClientes(lista) {
  const selects = document.querySelectorAll('.select-cliente')
  selects.forEach(sel => {
    const valorAtual = sel.value
    sel.innerHTML = '<option value="">Selecione um cliente...</option>' +
      lista.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('')
    if (valorAtual) sel.value = valorAtual
  })
}

export function getListaClientes() {
  return listaClientes
}

function formatarData(d) {
  if (!d) return '—'
  const [a, m, dia] = d.split('-')
  return `${dia}/${m}/${a}`
}

function fm(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function mostrarAlerta(id, msg, tipo) {
  const el = document.getElementById(id)
  if (!el) return
  el.textContent = msg
  el.className = `alert alert-${tipo} show`
  setTimeout(() => el.classList.remove('show'), 4000)
}

window._removerCliente = removerCliente
window._abrirFichaCliente = abrirFichaCliente