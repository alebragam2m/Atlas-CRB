import { supabase } from '../supabase.js'
import { calcularImpostos } from './tributario.js'

// Lote atualmente selecionado no form de venda
let loteAtual = null

// ── CARREGAR LOTES PARA O SELECT ─────────────────────────────────────────────

export async function carregarLotesParaVenda() {
  const { data: lotes } = await supabase
    .from('lotes')
    .select('id, nome_produto, data_entrada, custo_unit, custo_unitario_real, tem_import, aparelhos(id, status)')
    .order('data_entrada', { ascending: false })

  const sel = document.getElementById('venda-lote')
  if (!sel || !lotes) return

  sel.innerHTML = '<option value="">Selecione o lote...</option>' +
    lotes.map(l => {
      const disp = (l.aparelhos || []).filter(a => a.status === 'disponivel').length
      const custo = l.custo_unitario_real || l.custo_unit || 0
      const data  = formatarData(l.data_entrada)
      return `<option value="${l.id}">${escapeHtml(l.nome_produto)} — ${data} — Custo R$ ${Number(custo).toFixed(2)} (${disp} disp.)</option>`
    }).join('')
}

// ── SELECIONAR LOTE ───────────────────────────────────────────────────────────

export async function selecionarLote(loteId) {
  if (!loteId) {
    loteAtual = null
    document.getElementById('venda-custo').value = ''
    document.getElementById('venda-breakdown').style.display = 'none'
    return
  }

  const { data: lote } = await supabase
    .from('lotes')
    .select('*')
    .eq('id', loteId)
    .single()

  if (!lote) return
  loteAtual = lote

  const custo = lote.custo_unitario_real || lote.custo_unit || 0
  document.getElementById('venda-custo').value = Number(custo).toFixed(2)

  previewVenda()
}

// ── PREVIEW / BREAKDOWN ───────────────────────────────────────────────────────

export function previewVenda() {
  const qtd   = Number(document.getElementById('venda-qtd')?.value || 0)
  const preco = Number(document.getElementById('venda-preco')?.value || 0)
  const parc  = Number(document.getElementById('venda-parcelas')?.value || 1)

  const breakdown = document.getElementById('venda-breakdown')
  if (!breakdown) return
  if (!qtd || !preco) { breakdown.style.display = 'none'; return }

  // Lote com parâmetros de importação → breakdown completo
  if (loteAtual?.tem_import) {
    const r = calcularImpostos({
      custoFOB_USD:            loteAtual.custo_fob_usd || 0,
      freteInternacional_USD:  loteAtual.frete_intl_usd || 0,
      seguroInternacional_USD: loteAtual.seguro_intl_usd || 0,
      taxaCambio:              loteAtual.taxa_cambio || 1,
      aliqII:                  loteAtual.aliq_ii || 0,
      aliqIPI:                 loteAtual.aliq_ipi || 0,
      aliqPIS:                 loteAtual.aliq_pis || 0,
      aliqCOFINS:              loteAtual.aliq_cofins || 0,
      aliqICMS:                loteAtual.aliq_icms || 0,
      custosOpLote:            loteAtual.custos_op_lote || 0,
      qtdLote:                 loteAtual.qtd_lote || 1,
      aliqSimples:             loteAtual.aliq_simples || 0.04,
      precoVenda:              preco,
      quantidade:              qtd
    })

    const sinalCor = { verde: '#00b894', amarelo: '#fdcb6e', vermelho: '#d63031' }[r.sinalMargem]
    const sinalEmoji = { verde: '🟢', amarelo: '🟡', vermelho: '🔴' }[r.sinalMargem]

    breakdown.style.display = 'block'
    breakdown.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">

        <!-- Bloco A: Composição do custo -->
        <div style="background:#faf8f4;border:1px solid var(--border);border-radius:8px;padding:14px;">
          <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px;">
            Composição do Custo / Unidade
          </p>
          <table style="width:100%;font-size:12px;font-family:'Fira Code',monospace;">
            <tr><td style="color:var(--text-muted);">FOB + Frete + Seguro</td><td style="text-align:right;">${fm(r.valorCIF_unitario)}</td></tr>
            <tr><td style="color:var(--text-muted);">II (${pct(loteAtual.aliq_ii)})</td><td style="text-align:right;">${fm(r.valorII / (loteAtual.qtd_lote||1))}</td></tr>
            <tr><td style="color:var(--text-muted);">IPI (${pct(loteAtual.aliq_ipi)})</td><td style="text-align:right;">${fm(r.valorIPI / (loteAtual.qtd_lote||1))}</td></tr>
            <tr><td style="color:var(--text-muted);">PIS (${pct(loteAtual.aliq_pis)})</td><td style="text-align:right;">${fm(r.valorPIS / (loteAtual.qtd_lote||1))}</td></tr>
            <tr><td style="color:var(--text-muted);">COFINS (${pct(loteAtual.aliq_cofins)})</td><td style="text-align:right;">${fm(r.valorCOFINS / (loteAtual.qtd_lote||1))}</td></tr>
            <tr><td style="color:var(--text-muted);">ICMS-PA (${pct(loteAtual.aliq_icms)} p/dentro)</td><td style="text-align:right;">${fm(r.valorICMS / (loteAtual.qtd_lote||1))}</td></tr>
            <tr><td style="color:var(--text-muted);">Custos operacionais</td><td style="text-align:right;">${fm(r.custoOp_unitario)}</td></tr>
            <tr style="border-top:1px solid var(--border);font-weight:700;">
              <td>CUSTO TOTAL</td><td style="text-align:right;color:var(--accent);">${fm(r.custoTotalUnitario)}</td>
            </tr>
          </table>
        </div>

        <!-- Bloco B: Resultado da venda -->
        <div style="background:#faf8f4;border:1px solid var(--border);border-radius:8px;padding:14px;">
          <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px;">
            Resultado da Venda (${qtd} un.)
          </p>
          <table style="width:100%;font-size:12px;font-family:'Fira Code',monospace;">
            <tr><td style="color:var(--text-muted);">Receita bruta</td><td style="text-align:right;">${fm(r.receitaBruta)}</td></tr>
            <tr><td style="color:var(--text-muted);">Custo total produto</td><td style="text-align:right;color:var(--danger);">- ${fm(r.custoVenda)}</td></tr>
            <tr><td style="color:var(--text-muted);">DAS Simples (${pct(loteAtual.aliq_simples)})</td><td style="text-align:right;color:var(--danger);">- ${fm(r.totalDAS)}</td></tr>
            <tr style="border-top:1px solid var(--border);font-weight:700;">
              <td>LUCRO BRUTO</td><td style="text-align:right;color:var(--success);">${fm(r.lucroBruto)}</td>
            </tr>
            <tr><td style="color:var(--text-muted);">Margem bruta</td><td style="text-align:right;font-weight:700;">${r.margemBruta.toFixed(1)}%</td></tr>
            <tr><td style="color:var(--text-muted);">Carga tributária</td><td style="text-align:right;">${r.cargaTributaria.toFixed(1)}%</td></tr>
            <tr><td style="color:var(--text-muted);">${parc}x de</td><td style="text-align:right;">${fm(preco / parc)}</td></tr>
          </table>
        </div>

      </div>

      <!-- Semáforo -->
      <div style="background:${sinalCor}22;border:1px solid ${sinalCor}66;border-radius:7px;padding:10px 14px;display:flex;align-items:center;gap:10px;">
        <span style="font-size:20px;">${sinalEmoji}</span>
        <div>
          <strong style="color:${sinalCor};font-size:14px;">${r.sinalMsg}</strong>
          <span style="font-size:13px;color:var(--text-muted);margin-left:12px;">
            Margem ${r.margemBruta.toFixed(1)}% — Lucro ${fm(r.lucroBruto)} para ${qtd} un.
          </span>
        </div>
      </div>
    `
    return
  }

  // Lote simples → preview básico
  const custo = loteAtual?.custo_unitario_real || loteAtual?.custo_unit || 0
  const total  = preco * qtd
  const lucro  = (preco - custo) * qtd
  const margem = preco > 0 ? ((preco - custo) / preco * 100).toFixed(1) : 0
  const valorParc = preco / parc

  breakdown.style.display = 'block'
  breakdown.innerHTML = `
    <div style="background:#fff8f5;border:1px solid #f0d0c0;border-radius:7px;padding:10px 14px;font-size:13px;color:var(--accent);font-family:'Fira Code',monospace;">
      Total ${fm(total)} &nbsp;·&nbsp; Lucro ${fm(lucro)} (${margem}%) &nbsp;·&nbsp; ${parc}x de ${fm(valorParc)}
    </div>
  `
}

// ── CARREGAR / RENDERIZAR ─────────────────────────────────────────────────────

export async function carregarVendas() {
  const { data, error } = await supabase
    .from('vendas')
    .select('*, clientes(nome), lotes(nome_produto)')
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
      <td>${escapeHtml(v.lotes?.nome_produto || v.produto || '—')}</td>
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

// ── ADICIONAR VENDA ───────────────────────────────────────────────────────────

export async function adicionarVenda(dados) {
  const custo_unit  = Number(document.getElementById('venda-custo')?.value || 0)
  const total       = dados.qtd * dados.preco_unit
  const lucro       = (dados.preco_unit - custo_unit) * dados.qtd
  const valor_parcela = total / dados.num_parcelas

  const vendaPayload = {
    cliente_id:   dados.cliente_id,
    lote_id:      dados.lote_id || null,
    produto:      loteAtual?.nome_produto || '',
    data:         dados.data,
    qtd:          Number(dados.qtd),
    custo_unit,
    preco_unit:   Number(dados.preco_unit),
    total:        Number(total.toFixed(2)),
    lucro:        Number(lucro.toFixed(2)),
    num_parcelas: Number(dados.num_parcelas),
    valor_parcela:Number(valor_parcela.toFixed(2)),
    venc_primeira:dados.venc_primeira,
    obs:          dados.obs || ''
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

  const parcelas = calcularParcelas(total, dados.num_parcelas, dados.venc_primeira)
  const { error: erroParc } = await supabase
    .from('parcelas')
    .insert(parcelas.map(p => ({ venda_id: venda.id, ...p })))

  if (erroParc) {
    mostrarAlerta('vendas-alert', 'Venda salva, mas erro nas parcelas: ' + erroParc.message, 'error')
    return false
  }

  mostrarAlerta('vendas-alert', 'Venda registrada com sucesso!', 'success')
  loteAtual = null
  await carregarVendas()
  return true
}

// ── PARCELAS ──────────────────────────────────────────────────────────────────

export function calcularParcelas(total, numParcelas, vencPrimeira) {
  const parcelas = []
  const valorParcela = total / numParcelas
  const [ano, mes] = vencPrimeira.split('-').map(Number)

  for (let i = 0; i < numParcelas; i++) {
    let m = mes - 1 + i
    const a = ano + Math.floor(m / 12)
    m = m % 12
    parcelas.push({ mes_ano: `${a}-${String(m + 1).padStart(2, '0')}`, valor: Number(valorParcela.toFixed(2)) })
  }

  return parcelas
}

// ── REMOVER ───────────────────────────────────────────────────────────────────

export async function removerVenda(id) {
  if (!confirm('Excluir esta venda? As parcelas também serão removidas.')) return

  const { error } = await supabase.from('vendas').delete().eq('id', id)

  if (error) {
    mostrarAlerta('vendas-alert', 'Erro ao excluir venda: ' + error.message, 'error')
    return
  }

  mostrarAlerta('vendas-alert', 'Venda excluída.', 'success')
  await carregarVendas()
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function fm(v) { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function pct(v) { return `${(Number(v || 0) * 100).toFixed(2).replace('.', ',')}%` }
function formatarMoeda(v) { return fm(v) }
function formatarData(d) {
  if (!d) return '—'
  const [a, m, dia] = d.split('-')
  return `${dia}/${m}/${a}`
}
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function mostrarAlerta(id, msg, tipo) {
  const el = document.getElementById(id)
  if (!el) return
  el.textContent = msg
  el.className = `alert alert-${tipo} show`
  setTimeout(() => el.classList.remove('show'), 4000)
}

window._removerVenda = removerVenda