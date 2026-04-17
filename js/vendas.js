import { supabase } from '../supabase.js'

export async function carregarVendas() {
  const { data, error } = await supabase
    .from('vendas')
    .select('*, clientes(nome)')
    .order('data', { ascending: false })

  if (error) {
    mostrarAlerta('vendas-alert', 'Erro ao carregar vendas: ' + error.message, 'error')
    return
  }

  renderizarVendas(data)
}

function renderizarVendas(lista) {
  const tbody = document.getElementById('vendas-tbody')
  if (!tbody) return

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Nenhuma venda cadastrada.</td></tr>'
    return
  }

  tbody.innerHTML = lista.map(v => `
    <tr>
      <td>${formatarData(v.data)}</td>
      <td>${escapeHtml(v.clientes?.nome || '—')}</td>
      <td>${escapeHtml(v.produto || '—')}</td>
      <td>${v.qtd}</td>
      <td class="money">${formatarMoeda(v.preco_unit)}</td>
      <td class="money">${formatarMoeda(v.total)}</td>
      <td class="money money-green">${formatarMoeda(v.lucro)}</td>
      <td>${v.num_parcelas}x de ${formatarMoeda(v.valor_parcela)}</td>
      <td>
        <button class="btn btn-danger" onclick="window._removerVenda('${v.id}')">Excluir</button>
      </td>
    </tr>
  `).join('')
}

export async function adicionarVenda(dados) {
  const total = dados.qtd * dados.preco_unit
  const custo_total = dados.qtd * (dados.custo_unit || 0)
  const lucro = total - custo_total
  const valor_parcela = total / dados.num_parcelas

  const vendaPayload = {
    cliente_id: dados.cliente_id,
    data: dados.data,
    produto: dados.produto || '',
    qtd: Number(dados.qtd),
    custo_unit: Number(dados.custo_unit || 0),
    preco_unit: Number(dados.preco_unit),
    total: Number(total.toFixed(2)),
    lucro: Number(lucro.toFixed(2)),
    num_parcelas: Number(dados.num_parcelas),
    valor_parcela: Number(valor_parcela.toFixed(2)),
    venc_primeira: dados.venc_primeira,
    obs: dados.obs || ''
  }

  const { data: venda, error: erroVenda } = await supabase
    .from('vendas')
    .insert(vendaPayload)
    .select()
    .single()

  if (erroVenda) {
    mostrarAlerta('vendas-alert', 'Erro ao salvar venda: ' + erroVenda.message, 'error')
    return false
  }

  // Gera parcelas
  const parcelas = calcularParcelas(total, dados.num_parcelas, dados.venc_primeira)
  const parcelasPayload = parcelas.map(p => ({ venda_id: venda.id, ...p }))

  const { error: erroParc } = await supabase.from('parcelas').insert(parcelasPayload)

  if (erroParc) {
    mostrarAlerta('vendas-alert', 'Venda salva, mas erro ao gerar parcelas: ' + erroParc.message, 'error')
    return false
  }

  mostrarAlerta('vendas-alert', 'Venda adicionada com sucesso!', 'success')
  await carregarVendas()
  return true
}

export function calcularParcelas(total, numParcelas, vencPrimeira) {
  const parcelas = []
  const valorParcela = total / numParcelas
  const [ano, mes, dia] = vencPrimeira.split('-').map(Number)

  for (let i = 0; i < numParcelas; i++) {
    let m = mes - 1 + i
    const a = ano + Math.floor(m / 12)
    m = m % 12
    const mesAno = `${a}-${String(m + 1).padStart(2, '0')}`
    parcelas.push({
      mes_ano: mesAno,
      valor: Number(valorParcela.toFixed(2))
    })
  }

  return parcelas
}

export async function removerVenda(id) {
  if (!confirm('Remover esta venda? As parcelas também serão excluídas.')) return

  const { error } = await supabase.from('vendas').delete().eq('id', id)

  if (error) {
    mostrarAlerta('vendas-alert', 'Erro ao remover venda: ' + error.message, 'error')
    return
  }

  mostrarAlerta('vendas-alert', 'Venda removida.', 'success')
  await carregarVendas()
}

export function previewVenda() {
  const qtd = Number(document.getElementById('venda-qtd')?.value || 0)
  const custo = Number(document.getElementById('venda-custo')?.value || 0)
  const preco = Number(document.getElementById('venda-preco')?.value || 0)
  const parcelas = Number(document.getElementById('venda-parcelas')?.value || 1)

  const previewEl = document.getElementById('venda-preview')
  if (!previewEl) return

  if (!qtd || !preco) {
    previewEl.style.display = 'none'
    return
  }

  const total = qtd * preco
  const lucro = total - (qtd * custo)
  const valorParc = total / parcelas
  const margem = ((lucro / total) * 100).toFixed(1)

  previewEl.style.display = 'block'
  previewEl.innerHTML = `
    <strong>Prévia:</strong>
    Total ${formatarMoeda(total)} &nbsp;·&nbsp;
    Lucro ${formatarMoeda(lucro)} (${margem}%) &nbsp;·&nbsp;
    ${parcelas}x de ${formatarMoeda(valorParc)}
  `
}

// Helpers
function formatarMoeda(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(d) {
  if (!d) return '—'
  const [a, m, dia] = d.split('-')
  return `${dia}/${m}/${a}`
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function mostrarAlerta(id, msg, tipo) {
  const el = document.getElementById(id)
  if (!el) return
  el.textContent = msg
  el.className = `alert alert-${tipo} show`
  setTimeout(() => el.classList.remove('show'), 4000)
}

window._removerVenda = removerVenda