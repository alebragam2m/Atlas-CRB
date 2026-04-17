import { supabase } from '../supabase.js'
import { getTotalCustos } from './custos.js'

let chartFluxo = null

export async function carregarFluxo() {
  const { data: parcelas, error } = await supabase
    .from('parcelas')
    .select('*, vendas(cliente_id, clientes(nome))')
    .order('mes_ano')

  if (error) {
    console.error('Erro ao carregar fluxo:', error.message)
    return
  }

  const totalCustos = await getTotalCustos()
  montarFluxo(parcelas, totalCustos)
}

function montarFluxo(parcelas, custosMensais) {
  // Agrupa por mês
  const porMes = {}
  const porCliente = {}

  parcelas.forEach(p => {
    const mes = p.mes_ano
    const nomeCliente = p.vendas?.clientes?.nome || 'Desconhecido'

    if (!porMes[mes]) porMes[mes] = 0
    porMes[mes] += Number(p.valor)

    if (!porCliente[nomeCliente]) porCliente[nomeCliente] = {}
    if (!porCliente[nomeCliente][mes]) porCliente[nomeCliente][mes] = 0
    porCliente[nomeCliente][mes] += Number(p.valor)
  })

  const meses = Object.keys(porMes).sort()
  const receitaTotal = Object.values(porMes).reduce((s, v) => s + v, 0)
  const melhorMes = meses.reduce((best, m) => porMes[m] > (porMes[best] || 0) ? m : best, meses[0] || '')

  // KPIs
  setEl('fluxo-kpi-total', fm(receitaTotal))
  setEl('fluxo-kpi-melhor', melhorMes ? `${formatarMesExibicao(melhorMes)} (${fm(porMes[melhorMes])})` : '—')
  setEl('fluxo-kpi-custos', fm(custosMensais))
  setEl('fluxo-kpi-meses', String(meses.length))

  // Gráfico
  renderizarGraficoFluxo(meses, porMes, custosMensais)

  // Timeline
  renderizarTimeline(meses, porMes, porCliente, custosMensais)
}

function renderizarGraficoFluxo(meses, porMes, custosMensais) {
  const ctx = document.getElementById('fluxo-chart')?.getContext('2d')
  if (!ctx) return

  if (chartFluxo) chartFluxo.destroy()

  const labels = meses.map(formatarMesExibicao)
  const brutas = meses.map(m => porMes[m])
  const liquidas = meses.map(m => porMes[m] - custosMensais)

  chartFluxo = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Receita Bruta',
          data: brutas,
          backgroundColor: '#c8531a88',
          borderColor: '#c8531a',
          borderWidth: 1
        },
        {
          type: 'line',
          label: 'Receita Líquida',
          data: liquidas,
          borderColor: '#00b894',
          backgroundColor: 'transparent',
          tension: 0.3,
          borderWidth: 2,
          pointBackgroundColor: '#00b894'
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { ticks: { callback: v => fm(v) } } }
    }
  })
}

function renderizarTimeline(meses, porMes, porCliente, custosMensais) {
  const wrap = document.getElementById('fluxo-timeline')
  if (!wrap) return

  if (!meses.length) {
    wrap.innerHTML = '<p class="empty-state">Nenhuma parcela cadastrada ainda.</p>'
    return
  }

  const clientes = Object.keys(porCliente).sort()
  const labels = meses.map(formatarMesExibicao)

  const headerCols = labels.map(l => `<th>${l}</th>`).join('')
  const totalRow = meses.map(m => `<td class="money">${fm(porMes[m])}</td>`).join('')
  const liquidoRow = meses.map(m => `<td class="money money-green">${fm(porMes[m] - custosMensais)}</td>`).join('')

  const clienteRows = clientes.map(c => {
    const cols = meses.map(m => {
      const v = porCliente[c][m]
      return v ? `<td class="money">${fm(v)}</td>` : '<td>—</td>'
    }).join('')
    return `<tr><td>${escapeHtml(c)}</td>${cols}</tr>`
  }).join('')

  wrap.innerHTML = `
    <div class="timeline-wrap">
      <table class="timeline-table">
        <thead>
          <tr>
            <th>Cliente</th>
            ${headerCols}
          </tr>
        </thead>
        <tbody>
          ${clienteRows}
          <tr class="total-row">
            <td>TOTAL BRUTO</td>
            ${totalRow}
          </tr>
          <tr class="total-row">
            <td>TOTAL LÍQUIDO</td>
            ${liquidoRow}
          </tr>
        </tbody>
      </table>
    </div>
  `
}

function formatarMesExibicao(mesAno) {
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const [a, m] = mesAno.split('-')
  return `${nomes[Number(m) - 1]}/${String(a).slice(2)}`
}

function setEl(id, val) {
  const el = document.getElementById(id)
  if (el) el.textContent = val
}

function fm(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}