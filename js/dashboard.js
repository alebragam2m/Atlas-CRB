import { supabase } from '../supabase.js'

let chartBarras = null
let chartRosca = null

export async function carregarDashboard() {
  const [
    { data: vendas },
    { data: parcelas },
    { data: custos },
    { data: clientes }
  ] = await Promise.all([
    supabase.from('vendas').select('total, lucro, qtd, cliente_id, clientes(nome)'),
    supabase.from('parcelas').select('mes_ano, valor, vendas(cliente_id, clientes(nome))').order('mes_ano'),
    supabase.from('custos_fixos').select('valor'),
    supabase.from('clientes').select('id')
  ])

  if (!vendas) return

  const receitaTotal = (parcelas || []).reduce((s, p) => s + Number(p.valor), 0)
  const lucroTotal = (vendas || []).reduce((s, v) => s + Number(v.lucro), 0)
  const aparelhos = (vendas || []).reduce((s, v) => s + Number(v.qtd), 0)
  const custoMes = (custos || []).reduce((s, c) => s + Number(c.valor), 0)

  setEl('dash-kpi-receita', fm(receitaTotal))
  setEl('dash-kpi-lucro', fm(lucroTotal))
  setEl('dash-kpi-aparelhos', String(aparelhos))
  setEl('dash-kpi-custo', fm(custoMes))

  // Agrupa parcelas por mês
  const porMes = {}
  ;(parcelas || []).forEach(p => {
    porMes[p.mes_ano] = (porMes[p.mes_ano] || 0) + Number(p.valor)
  })

  // Agrupa por cliente
  const porCliente = {}
  ;(vendas || []).forEach(v => {
    const nome = v.clientes?.nome || 'Desconhecido'
    porCliente[nome] = (porCliente[nome] || 0) + Number(v.total)
  })

  const meses = Object.keys(porMes).sort()

  renderizarGraficos(meses, porMes, porCliente, custoMes)
  renderizarTabelaResumo(meses, porMes, custoMes)
}

function renderizarGraficos(meses, porMes, porCliente, custoMes) {
  const labels = meses.map(formatarMesExibicao)

  // Barras
  const ctxBar = document.getElementById('dash-chart-barras')?.getContext('2d')
  if (ctxBar) {
    if (chartBarras) chartBarras.destroy()
    chartBarras = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Receita Bruta',
          data: meses.map(m => porMes[m]),
          backgroundColor: '#c8531a',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { ticks: { callback: v => fm(v) } } }
      }
    })
  }

  // Rosca por cliente
  const ctxRosca = document.getElementById('dash-chart-rosca')?.getContext('2d')
  if (ctxRosca) {
    if (chartRosca) chartRosca.destroy()
    const cNames = Object.keys(porCliente)
    const cValues = cNames.map(n => porCliente[n])
    const colors = ['#c8531a', '#e07840', '#f0a060', '#f5c590', '#2d7dd2', '#3da5d9', '#00b894', '#55efc4']

    chartRosca = new Chart(ctxRosca, {
      type: 'doughnut',
      data: {
        labels: cNames,
        datasets: [{
          data: cValues,
          backgroundColor: colors.slice(0, cNames.length),
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: ctx => ` ${fm(ctx.raw)}`
            }
          }
        }
      }
    })
  }
}

function renderizarTabelaResumo(meses, porMes, custoMes) {
  const tbody = document.getElementById('dash-tbody')
  if (!tbody) return

  if (!meses.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Sem dados ainda.</td></tr>'
    return
  }

  tbody.innerHTML = meses.map(m => {
    const bruta = porMes[m]
    const liquida = bruta - custoMes
    return `
      <tr>
        <td>${formatarMesExibicao(m)}</td>
        <td class="money">${fm(bruta)}</td>
        <td class="money money-red">${fm(custoMes)}</td>
        <td class="money ${liquida >= 0 ? 'money-green' : 'money-red'}">${fm(liquida)}</td>
      </tr>
    `
  }).join('')
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