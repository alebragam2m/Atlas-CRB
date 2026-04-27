const https = require('https')

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const token = process.env.FOCUSNFE_TOKEN
  const env   = process.env.FOCUSNFE_ENV || 'homologacao'
  const host  = env === 'producao' ? 'api.focusnfe.com.br' : 'homologacao.focusnfe.com.br'

  if (!token) {
    return res.status(200).json({ ok: false, erro: 'FOCUSNFE_TOKEN não está definido no Vercel' })
  }

  // Faz um GET simples na API para testar autenticação
  const result = await new Promise((resolve, reject) => {
    const auth = Buffer.from(`${token}:`).toString('base64')
    const req2 = https.request({
      hostname: host,
      path: '/v2/nfe?limit=1',
      method: 'GET',
      headers: { 'Authorization': `Basic ${auth}` }
    }, r => {
      let data = ''
      r.on('data', c => data += c)
      r.on('end', () => resolve({ status: r.statusCode, body: data.slice(0, 200) }))
    })
    req2.on('error', reject)
    req2.end()
  })

  return res.status(200).json({
    ok: result.status === 200,
    status_http: result.status,
    ambiente: host,
    token_primeiros_chars: token.slice(0, 6) + '...' + token.slice(-4),
    token_tamanho: token.length,
    resposta_focusnfe: result.body
  })
}