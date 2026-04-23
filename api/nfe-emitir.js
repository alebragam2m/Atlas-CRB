const https = require('https')

const EMITENTE = {
  cnpj:       '57522845000164',
  nome:       'C R BRASIL',
  fantasia:   'THE CASE',
  logradouro: 'R AVERTANO ROCHA',
  numero:     '192',
  bairro:     'CAMPINA',
  municipio:  'Belem',
  uf:         'PA',
  cep:        '66023120',
  telefone:   '91981120005',
  regime:     1  // 1 = Simples Nacional
}

const BASE_URL = process.env.FOCUSNFE_ENV === 'producao'
  ? 'api.focusnfe.com.br'
  : 'homologacao.focusnfe.com.br'

function httpRequest(method, hostname, path, auth, body) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Authorization': `Basic ${Buffer.from(`${auth}:`).toString('base64')}`
    }
    if (body) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = Buffer.byteLength(body)
    }
    const req = https.request({ hostname, path, method, headers }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = process.env.FOCUSNFE_TOKEN
  if (!token) return res.status(500).json({ error: 'FOCUSNFE_TOKEN não configurado no Vercel' })

  const { venda, cliente } = req.body || {}
  if (!venda || !cliente) return res.status(400).json({ error: 'Dados incompletos' })

  const ref = venda.id.replace(/-/g, '').slice(0, 30)

  const ufDest = (cliente.uf || 'PA').toUpperCase()
  const cfop = ufDest === 'PA' ? '5102' : '6102'
  const localDestino = ufDest === 'PA' ? 1 : 2

  const cpfCnpj = (cliente.cpf_cnpj || '').replace(/\D/g, '')
  const destKey = cpfCnpj.length === 14 ? 'cnpj_destinatario' : 'cpf_destinatario'

  const ie = process.env.EMITENTE_IE || 'ISENTO'

  // Monta data/hora no formato Focus NFe (ISO com offset -03:00)
  const agora = new Date()
  const pad = n => String(n).padStart(2, '0')
  const dataEmissao = `${agora.getFullYear()}-${pad(agora.getMonth()+1)}-${pad(agora.getDate())}T` +
    `${pad(agora.getHours())}:${pad(agora.getMinutes())}:${pad(agora.getSeconds())}-03:00`

  const nfe = {
    natureza_operacao: 'Venda de Mercadoria',
    tipo_documento: 1,
    data_emissao: dataEmissao,
    data_entrada_saida: dataEmissao,
    tipo_operacao: 1,
    local_destino: localDestino,
    finalidade_emissao: 1,
    consumidor_final: 1,
    presenca_comprador: 2,

    // Emitente
    cnpj_emitente:              EMITENTE.cnpj,
    nome_emitente:              EMITENTE.nome,
    nome_fantasia_emitente:     EMITENTE.fantasia,
    logradouro_emitente:        EMITENTE.logradouro,
    numero_emitente:            EMITENTE.numero,
    bairro_emitente:            EMITENTE.bairro,
    municipio_emitente:         EMITENTE.municipio,
    uf_emitente:                EMITENTE.uf,
    cep_emitente:               EMITENTE.cep,
    telefone_emitente:          EMITENTE.telefone,
    inscricao_estadual_emitente: ie,
    regime_tributario_emitente: EMITENTE.regime,

    // Destinatário
    [destKey]:                    cpfCnpj || '00000000000',
    nome_destinatario:            cliente.nome,
    logradouro_destinatario:      cliente.local || 'N/I',
    numero_destinatario:          'S/N',
    bairro_destinatario:          'N/I',
    municipio_destinatario:       cliente.municipio || 'Belem',
    uf_destinatario:              ufDest,
    cep_destinatario:             (cliente.cep || '66000000').replace(/\D/g, ''),
    indicador_ie_destinatario:    9,

    // Produto (NCM 8526.91.00 = Rastreadores GPS)
    items: [{
      numero_item:                '1',
      codigo_produto:             'GPS001',
      descricao:                  venda.produto || 'Rastreador GPS Veicular',
      cfop,
      unidade_comercial:          'UN',
      unidade_tributavel:         'UN',
      quantidade_comercial:       Number(venda.qtd),
      quantidade_tributavel:      Number(venda.qtd),
      valor_unitario_comercial:   Number(venda.preco_unit),
      valor_unitario_tributavel:  Number(venda.preco_unit),
      valor_bruto:                Number(venda.total),
      ncm:                        '85269100',
      icms_situacao_tributaria:   '400',  // Simples Nacional sem crédito
      icms_origem:                1,      // importado diretamente
      pis_situacao_tributaria:    '07',
      cofins_situacao_tributaria: '07'
    }],

    formas_pagamento: [{
      forma_pagamento: Number(venda.num_parcelas) > 1 ? '99' : '01',
      valor_pagamento: Number(venda.total)
    }]
  }

  try {
    const result = await httpRequest('POST', BASE_URL, `/v2/nfe?ref=${ref}`, token, JSON.stringify(nfe))
    return res.status(result.status).json({ ref, ...result.body })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}