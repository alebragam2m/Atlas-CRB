/**
 * Cálculo tributário de importação + venda
 * Base: Especificação Técnica v2.0 — C R Brasil ME — Simples Nacional — Belém/PA
 * NCM 8526.91.00 — Rastreadores GPS
 */

export function calcularImpostos({
  custoFOB_USD,
  freteInternacional_USD,
  seguroInternacional_USD,
  taxaCambio,
  aliqII,
  aliqIPI,
  aliqPIS,
  aliqCOFINS,
  aliqICMS,
  custosOpLote,
  qtdLote,
  aliqSimples,
  precoVenda,
  quantidade
}) {
  // ── 1. CIF ────────────────────────────────────────────────────────────────
  const valorCIF_USD = custoFOB_USD + freteInternacional_USD + seguroInternacional_USD
  const valorCIF_BRL = valorCIF_USD * taxaCambio
  const valorCIF_unitario = valorCIF_BRL / qtdLote

  // ── 2. II ─────────────────────────────────────────────────────────────────
  const valorII = valorCIF_BRL * aliqII

  // ── 3. IPI ────────────────────────────────────────────────────────────────
  const valorIPI = (valorCIF_BRL + valorII) * aliqIPI

  // ── 4. PIS e COFINS ───────────────────────────────────────────────────────
  const valorPIS    = valorCIF_BRL * aliqPIS
  const valorCOFINS = valorCIF_BRL * aliqCOFINS

  // ── 5. ICMS por dentro ────────────────────────────────────────────────────
  // CRÍTICO: o ICMS compõe sua própria base — nunca aplicar diretamente
  const somaAntesICMS = valorCIF_BRL + valorII + valorIPI + valorPIS + valorCOFINS
  const baseICMS  = somaAntesICMS / (1 - aliqICMS)
  const valorICMS = baseICMS * aliqICMS

  // ── 6. Totais de importação ───────────────────────────────────────────────
  const totalTributos          = valorII + valorIPI + valorPIS + valorCOFINS + valorICMS
  const totalTributos_unitario = totalTributos / qtdLote
  const custoOp_unitario       = custosOpLote / qtdLote
  const custoTotalUnitario     = (valorCIF_BRL + totalTributos + custosOpLote) / qtdLote

  // ── 7. Venda ──────────────────────────────────────────────────────────────
  const receitaBruta     = precoVenda * quantidade
  const valorDAS_unit    = precoVenda * aliqSimples
  const totalDAS         = valorDAS_unit * quantidade
  const custoVenda       = custoTotalUnitario * quantidade
  const lucroBruto       = receitaBruta - custoVenda - totalDAS
  const margemBruta      = receitaBruta > 0 ? (lucroBruto / receitaBruta) * 100 : 0
  const cargaTributaria  = receitaBruta > 0
    ? ((totalTributos_unitario * quantidade + totalDAS) / receitaBruta) * 100
    : 0

  // ── 8. Semáforo de margem ─────────────────────────────────────────────────
  let sinalMargem = 'verde'
  let sinalMsg    = 'Margem saudável'
  if (margemBruta < 20) {
    sinalMargem = 'vermelho'
    sinalMsg    = 'Abaixo do limite seguro'
  } else if (margemBruta < 35) {
    sinalMargem = 'amarelo'
    sinalMsg    = 'Margem reduzida'
  }

  return {
    // CIF
    valorCIF_USD, valorCIF_BRL, valorCIF_unitario,
    // Tributos importação
    valorII, valorIPI, valorPIS, valorCOFINS, valorICMS,
    totalTributos, totalTributos_unitario,
    // Custos
    custoOp_unitario, custoTotalUnitario,
    // Venda
    valorDAS_unit, receitaBruta, totalDAS,
    custoVenda, lucroBruto, margemBruta,
    cargaTributaria,
    // Semáforo
    sinalMargem, sinalMsg
  }
}

/**
 * Calcula apenas o custo unitário real de um lote (sem dados de venda)
 */
export function calcularCustoUnitario({
  custoFOB_USD, freteInternacional_USD, seguroInternacional_USD,
  taxaCambio, aliqII, aliqIPI, aliqPIS, aliqCOFINS, aliqICMS,
  custosOpLote, qtdLote
}) {
  return calcularImpostos({
    custoFOB_USD, freteInternacional_USD, seguroInternacional_USD,
    taxaCambio, aliqII, aliqIPI, aliqPIS, aliqCOFINS, aliqICMS,
    custosOpLote, qtdLote,
    aliqSimples: 0, precoVenda: 0, quantidade: 1
  }).custoTotalUnitario
}

/**
 * Busca cotação do dólar do dia no Banco Central do Brasil
 */
export async function buscarCotacaoDolar() {
  try {
    const hoje  = new Date()
    // BCB não tem cotação de fim de semana — usa sexta se for sáb/dom
    const dia   = hoje.getDay()
    if (dia === 0) hoje.setDate(hoje.getDate() - 2)
    if (dia === 6) hoje.setDate(hoje.getDate() - 1)
    const dd    = String(hoje.getDate()).padStart(2, '0')
    const mm    = String(hoje.getMonth() + 1).padStart(2, '0')
    const yyyy  = hoje.getFullYear()
    const data  = `${mm}-${dd}-${yyyy}`
    const url   = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@d)?@d='${data}'&$top=1&$orderby=dataHoraCotacao%20desc&$format=json&$select=cotacaoVenda`
    const res   = await fetch(url)
    const json  = await res.json()
    return json?.value?.[0]?.cotacaoVenda ?? null
  } catch {
    return null
  }
}