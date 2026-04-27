import { supabase } from '../supabase.js'

export async function emitirNFe(vendaId) {
  const { data: venda, error } = await supabase
    .from('vendas')
    .select('*, clientes(*)')
    .eq('id', vendaId)
    .single()

  if (error || !venda) { alert('Erro ao carregar dados da venda.'); return }

  const cliente = venda.clientes
  if (!cliente?.cpf_cnpj) {
    alert('⚠️ CPF/CNPJ do cliente não cadastrado.\nEdite o cliente e adicione antes de emitir.')
    return
  }

  const btn = document.getElementById(`nfe-btn-${vendaId}`)
  const statusEl = document.getElementById(`nfe-status-${vendaId}`)
  if (btn) { btn.disabled = true; btn.textContent = 'Emitindo...' }
  if (statusEl) statusEl.innerHTML = badgeNFe('processando')

  try {
    const resp = await fetch('/api/nfe-emitir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ venda, cliente })
    })
    const data = await resp.json()

    if (!resp.ok) throw new Error(data.error || data.mensagem || data.message || `HTTP ${resp.status}`)

    const ref = data.ref
    await supabase.from('vendas').update({ nfe_ref: ref, nfe_status: 'processando' }).eq('id', vendaId)

    // Aguarda processamento e consulta
    await new Promise(r => setTimeout(r, 4000))
    await consultarNFe(vendaId, ref)

  } catch (err) {
    alert('Erro ao emitir NF-e: ' + err.message)
    if (btn) { btn.disabled = false; btn.textContent = 'Emitir NF-e' }
    if (statusEl) statusEl.innerHTML = badgeNFe('erro')
  }
}

export async function consultarNFe(vendaId, ref) {
  const btn = document.getElementById(`nfe-btn-${vendaId}`)
  const statusEl = document.getElementById(`nfe-status-${vendaId}`)

  try {
    const resp = await fetch(`/api/nfe-consultar?ref=${ref}`)
    const data = await resp.json()

    const status   = data.status || 'erro'
    const pdfUrl   = data.caminho_danfe || null
    const chave    = data.chave_nfe || null

    await supabase.from('vendas').update({
      nfe_status:  status,
      nfe_chave:   chave,
      nfe_pdf_url: pdfUrl
    }).eq('id', vendaId)

    if (statusEl) statusEl.innerHTML = badgeNFe(status, pdfUrl)

    if (btn) {
      if (status === 'autorizado') {
        btn.textContent = '📄 DANFE'
        btn.disabled = false
        btn.onclick = () => window.open(pdfUrl, '_blank')
      } else if (status === 'processando') {
        btn.textContent = '🔄 Verificar'
        btn.disabled = false
        btn.onclick = () => consultarNFe(vendaId, ref)
      } else {
        btn.textContent = 'Reemitir'
        btn.disabled = false
        btn.onclick = () => emitirNFe(vendaId)
      }
    }
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Verificar' }
  }
}

function badgeNFe(status, pdfUrl) {
  const MAP = {
    autorizado:  ['#d4edda', '#155724', '✓ Autorizada'],
    processando: ['#fff3cd', '#856404', '⏳ Processando'],
    denegado:    ['#f8d7da', '#721c24', '✗ Denegada'],
    cancelado:   ['#f8d7da', '#721c24', '✗ Cancelada'],
    erro:        ['#f8d7da', '#721c24', '✗ Erro']
  }
  const [bg, color, label] = MAP[status] || MAP.erro
  const link = (pdfUrl && status === 'autorizado')
    ? ` <a href="${pdfUrl}" target="_blank" style="color:${color};text-decoration:underline;font-size:11px;margin-left:4px;">PDF</a>` : ''
  return `<span style="background:${bg};color:${color};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;">${label}</span>${link}`
}

window._emitirNFe   = emitirNFe
window._consultarNFe = consultarNFe