const https = require('https')

const BASE_URL = process.env.FOCUSNFE_ENV === 'producao'
  ? 'api.focusnfe.com.br'
  : 'homologacao.focusnfe.com.br'

function httpGet(hostname, path, auth) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path, method: 'GET',
      headers: { 'Authorization': `Basic ${Buffer.from(`${auth}:`).toString('base64')}` }
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const token = process.env.FOCUSNFE_TOKEN
  if (!token) return res.status(500).json({ error: 'Token não configurado' })

  const { ref } = req.query
  if (!ref) return res.status(400).json({ error: 'ref obrigatório' })

  try {
    const result = await httpGet(BASE_URL, `/v2/nfe/${ref}`, token)
    return res.status(result.status).json(result.body)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}