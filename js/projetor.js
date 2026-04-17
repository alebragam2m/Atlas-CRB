import { getTotalCustos } from './custos.js'

let chartBarras = null
let chartLinha = null

export function initProjetor() {
  const inputs = ['proj-qtd', 'proj-custo', 'proj-preco', 'proj-parcelas', 'proj-inicio', 'proj-desc-custos']
  inputs.forEach(id => {
    const el = document.getElementById(id)
    if (el) el.addEventListener('input', calcularProjecao)
    if (el) el.addEventListener('change', calcularProjecao)
  })
}

export async function calcularProjecao() {
  const qtd = Number(document.getElementById('proj-qtd')?.value || 0)
  const custo = Number(document.getElementById('proj-custo')?.value || 0)
  const preco = Number(document.getElementById('proj-preco')?.value || 0)
  const parcelas = Number(document.getElementById('proj-parcelas')?.value || 1)
  const mesInicio = document.getElementById('proj-inicio')?.value || ''
  const descontarCustos = document.getElementById('proj-desc-custos')?.checked

  const resultados = document.getElementById('proj-resultados')
  if (!resultados) return

  if (!qtd || !preco || !mesInicio) {
    resultados.style.display = 'none'
    return
  }

  const totalCustos = descontarCustos ? await getTotalCustos() : 0

  const investimento = qtd * custo
  const receitaBruta = qtd * preco
  const lucroBruto = receitaBruta - investimento
  const margem = receitaBruta > 0 ? ((lucroBruto / receitaBruta) * 100).toFixed(1) : 0
  const parcelaMes = receitaBruta / parcelas
  const receitaLiquida = parcelaMes - totalCustos

  // Frase resumo
  const frase = document.getElementById('proj-frase')
  if (frase) {
    frase.textContent = `${qtd} aparelhos a ${fm(preco)} em ${parcelas}x → você recebe ${fm(parcelaMes)}/mês bruto e ${fm(receitaLiquida)}/mês líquido`
    frase.parentElement.classList.add('show')
  }

  // KPI cards
  setKpi('proj-kpi-invest', investimento)
  setKpi('proj-kpi-bruta', receitaBruta)
  setKpi('proj-kpi-lucro', lucroBruto)
  document.getElementById('proj-kpi-margem').textContent = margem + '%'
  setKpi('proj-kpi-parcela', parcelaMes)
  setKpi('proj-kpi-liquida', receitaLiquida)

  // Meses
  const meses = gerarMeses(mesInicio, parcelas)
  const tabelaData = meses.map((m, i) => ({
    mes: formatarMesExibicao(m),
    bruta: parcelaMes,
    custos: totalCustos,
    liquida: receitaLiquida,
    acumulado: receitaLiquida * (i + 1) - investimento
  }))

  // Tabela
  renderizarTabelaProjecao(tabelaData)

  // Gráficos
  renderizarGraficos(tabelaData)

  resultados.style.display = 'block'
}

function renderizarTabelaProjecao(dados) {
  const tbody = document.getElementById('proj-tbody')
  if (!tbody) return

  tbody.innerHTML = dados.map(d => `
    <tr>
      <td>${d.mes}</td>
      <td class="money">${fm(d.bruta)}</td>
      <td class="money money-red">${fm(d.custos)}</td>
      <td class="money money-green">${fm(d.liquida)}</td>
      <td class="money ${d.acumulado >= 0 ? 'money-green' : 'money-red'}">${fm(d.acumulado)}</td>
    </tr>
  `).join('')
}

function renderizarGraficos(dados) {
  const meses = dados.map(d => d.mes)
  const brutas = dados.map(d => d.bruta)
  const liquidas = dados.map(d => d.liquida)
  const acumulados = dados.map(d => d.acumulado)

  // Gráfico de barras
  const ctxBar = document.getElementById('proj-chart-barras')?.getContext('2d')
  if (ctxBar) {
    if (chartBarras) chartBarras.destroy()
    chartBarras = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: meses,
        datasets: [
          { label: 'Receita Bruta', data: brutas, backgroundColor: '#c8531a88', borderColor: '#c8531a', borderWidth: 1 },
          { label: 'Receita Líquida', data: liquidas, backgroundColor: '#00b89488', borderColor: '#00b894', borderWidth: 1 }
        ]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    })
  }

  // Gráfico de linha acumulado
  const ctxLinha = document.getElementById('proj-chart-linha')?.getContext('2d')
  if (ctxLinha) {
    if (chartLinha) chartLinha.destroy()
    chartLinha = new Chart(ctxLinha, {
      type: 'line',
      data: {
        labels: meses,
        datasets: [{
          label: 'Caixa Acumulado',
          data: acumulados,
          borderColor: '#c8531a',
          backgroundColor: '#c8531a22',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { ticks: { callback: v => fm(v) } } }
      }
    })
  }
}

function gerarMeses(inicio, qtd) {
  const meses = []
  const [ano, mes] = inicio.split('-').map(Number)
  for (let i = 0; i < qtd; i++) {
    let m = mes - 1 + i
    const a = ano + Math.floor(m / 12)
    m = m % 12
    meses.push(`${a}-${String(m + 1).padStart(2, '0')}`)
  }
  return meses
}

function formatarMesExibicao(mesAno) {
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const [a, m] = mesAno.split('-')
  return `${nomes[Number(m) - 1]}/${String(a).slice(2)}`
}

function setKpi(id, valor) {
  const el = document.getElementById(id)
  if (el) el.textContent = fm(valor)
}

function fm(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}