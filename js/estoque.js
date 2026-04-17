import { supabase } from '../supabase.js'

let loteAtivoId = null
let loteAtivoNome = null
let aparelhoEscaneado = null
let html5QrEntrada = null
let html5QrSaida = null

// ── LOTES ────────────────────────────────────────────────────────────────────

export async function carregarEstoque() {
  const { data: lotes, error } = await supabase
    .from('lotes')
    .select('*, aparelhos(id, status)')
    .order('data_entrada', { ascending: false })

  if (error) {
    mostrarAlerta('estoque-alert', 'Erro ao carregar estoque: ' + error.message, 'error')
    return
  }

  renderizarLotes(lotes || [])
}

function renderizarLotes(lotes) {
  const cont = document.getElementById('estoque-lista')
  if (!cont) return

  if (!lotes.length) {
    cont.innerHTML = '<p class="empty-state">Nenhum lote cadastrado ainda.</p>'
    return
  }

  cont.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Entrada</th>
            <th>Custo Unit.</th>
            <th>Total</th>
            <th>Disponível</th>
            <th>Vendido</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${lotes.map(l => {
            const total = l.aparelhos?.length || 0
            const vendidos = l.aparelhos?.filter(a => a.status === 'vendido').length || 0
            const disp = total - vendidos
            return `
              <tr>
                <td><strong>${escapeHtml(l.nome_produto)}</strong></td>
                <td>${formatarData(l.data_entrada)}</td>
                <td class="money">${fm(l.custo_unit)}</td>
                <td>${total}</td>
                <td><span style="color:var(--success);font-weight:700;">${disp}</span></td>
                <td><span style="color:var(--text-muted);">${vendidos}</span></td>
                <td>
                  <button class="btn btn-primary btn-sm"
                    onclick="window._ativarLote('${l.id}', '${escapeHtml(l.nome_produto).replace(/'/g,"\\'")}')">
                    Escanear Entrada
                  </button>
                </td>
              </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>
  `
}

export async function criarLote(nome, data, custoUnit) {
  const { data: lote, error } = await supabase
    .from('lotes')
    .insert({ nome_produto: nome.trim(), data_entrada: data, custo_unit: Number(custoUnit) })
    .select()
    .single()

  if (error) {
    mostrarAlerta('estoque-alert', 'Erro ao criar lote: ' + error.message, 'error')
    return null
  }

  mostrarAlerta('estoque-alert', `Lote "${nome}" criado! Agora escaneie os aparelhos.`, 'success')
  await carregarEstoque()
  return lote
}

// ── ENTRADAS ─────────────────────────────────────────────────────────────────

export function ativarLote(id, nome) {
  loteAtivoId = id
  loteAtivoNome = nome

  const infoEl = document.getElementById('lote-ativo-info')
  if (infoEl) {
    infoEl.textContent = `Lote ativo: ${nome}`
    infoEl.style.display = 'block'
  }

  document.getElementById('painel-entrada').style.display = 'block'
  document.getElementById('codigo-manual-entrada').focus()

  // Limpa lista de escaneados anteriores
  const lista = document.getElementById('codigos-escaneados')
  if (lista) lista.innerHTML = ''
}

export async function registrarAparelho(codigo) {
  if (!loteAtivoId) {
    mostrarAlerta('estoque-alert', 'Selecione um lote antes de escanear.', 'error')
    return false
  }

  const cod = codigo.trim()
  if (!cod) return false

  // Verifica duplicata
  const { data: exist } = await supabase
    .from('aparelhos')
    .select('id, lotes(nome_produto)')
    .eq('codigo', cod)
    .maybeSingle()

  if (exist) {
    mostrarAlerta('estoque-alert', `"${cod}" já está cadastrado no lote: ${exist.lotes?.nome_produto || '?'}.`, 'error')
    return false
  }

  const { error } = await supabase
    .from('aparelhos')
    .insert({ lote_id: loteAtivoId, codigo: cod, status: 'disponivel' })

  if (error) {
    mostrarAlerta('estoque-alert', 'Erro ao registrar aparelho: ' + error.message, 'error')
    return false
  }

  adicionarNaListaEntrada(cod)
  await carregarEstoque()
  return true
}

function adicionarNaListaEntrada(codigo) {
  const lista = document.getElementById('codigos-escaneados')
  if (!lista) return
  const item = document.createElement('div')
  item.className = 'codigo-item entrada'
  item.innerHTML = `<span style="color:var(--success);">✓</span> ${escapeHtml(codigo)}`
  lista.prepend(item)
}

// ── SCANNER CÂMERA: ENTRADA ───────────────────────────────────────────────────

export function iniciarScannerEntrada() {
  if (!loteAtivoId) { alert('Selecione um lote primeiro.'); return }
  if (!window.Html5Qrcode) { alert('Scanner não carregado.'); return }

  const divId = 'qr-reader-entrada'
  document.getElementById(divId).style.display = 'block'

  html5QrEntrada = new window.Html5Qrcode(divId)
  html5QrEntrada.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 280, height: 130 } },
    async (codigo) => { await registrarAparelho(codigo) },
    () => {}
  ).catch(err => mostrarAlerta('estoque-alert', 'Câmera indisponível: ' + err, 'error'))

  document.getElementById('btn-start-scanner-entrada').style.display = 'none'
  document.getElementById('btn-stop-scanner-entrada').style.display = 'inline-flex'
}

export function pararScannerEntrada() {
  if (html5QrEntrada) {
    html5QrEntrada.stop().then(() => {
      document.getElementById('qr-reader-entrada').style.display = 'none'
    }).catch(() => {})
    html5QrEntrada = null
  }
  document.getElementById('btn-start-scanner-entrada').style.display = 'inline-flex'
  document.getElementById('btn-stop-scanner-entrada').style.display = 'none'
}

// ── SAÍDAS ────────────────────────────────────────────────────────────────────

export async function buscarAparelhoPorCodigo(codigo) {
  const cod = codigo.trim()
  if (!cod) return

  const { data, error } = await supabase
    .from('aparelhos')
    .select('*, lotes(nome_produto, data_entrada, custo_unit)')
    .eq('codigo', cod)
    .maybeSingle()

  const painel = document.getElementById('saida-resultado')
  if (!painel) return

  if (error || !data) {
    painel.innerHTML = `<div class="alert alert-error show">Código "${escapeHtml(cod)}" não encontrado no estoque.</div>`
    return
  }

  if (data.status === 'vendido') {
    painel.innerHTML = `<div class="alert alert-error show">Este aparelho já foi registrado como vendido.</div>`
    return
  }

  aparelhoEscaneado = data

  // Busca vendas recentes para associar
  const { data: vendas } = await supabase
    .from('vendas')
    .select('id, data, qtd, clientes(nome)')
    .order('data', { ascending: false })
    .limit(60)

  painel.innerHTML = `
    <div class="card" style="border-left:4px solid var(--success);margin-top:12px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
        <div>
          <p style="font-weight:700;font-size:16px;">${escapeHtml(data.lotes?.nome_produto || '—')}</p>
          <p style="font-size:12px;color:var(--text-muted);margin-top:3px;">
            Código: <code style="font-family:'Fira Code',monospace;">${escapeHtml(data.codigo)}</code>
            &nbsp;·&nbsp; Lote entrada: ${formatarData(data.lotes?.data_entrada)}
            &nbsp;·&nbsp; Custo: ${fm(data.lotes?.custo_unit || 0)}
          </p>
        </div>
        <span style="background:#d4edda;color:#155724;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">Disponível</span>
      </div>
      <hr class="section-divider" style="margin:12px 0;" />
      <div class="form-group" style="margin-bottom:14px;">
        <label>Associar à Venda</label>
        <select id="select-venda-saida">
          <option value="">Selecione uma venda...</option>
          ${(vendas || []).map(v =>
            `<option value="${v.id}">${formatarData(v.data)} — ${escapeHtml(v.clientes?.nome || '?')} (${v.qtd} un.)</option>`
          ).join('')}
        </select>
      </div>
      <button class="btn btn-primary" onclick="window._confirmarSaida()">Confirmar Saída</button>
    </div>
  `
}

export async function confirmarSaida() {
  if (!aparelhoEscaneado) return
  const vendaId = document.getElementById('select-venda-saida')?.value
  if (!vendaId) { mostrarAlerta('estoque-alert-saida', 'Selecione uma venda.', 'error'); return }

  const { error } = await supabase
    .from('aparelhos')
    .update({ status: 'vendido', venda_id: vendaId })
    .eq('id', aparelhoEscaneado.id)

  if (error) {
    mostrarAlerta('estoque-alert-saida', 'Erro ao registrar saída: ' + error.message, 'error')
    return
  }

  mostrarAlerta('estoque-alert-saida', `Aparelho ${aparelhoEscaneado.codigo} — saída confirmada!`, 'success')
  document.getElementById('saida-resultado').innerHTML = ''
  document.getElementById('codigo-manual-saida').value = ''
  aparelhoEscaneado = null
  await carregarEstoque()
}

// ── SCANNER CÂMERA: SAÍDA ────────────────────────────────────────────────────

export function iniciarScannerSaida() {
  if (!window.Html5Qrcode) { alert('Scanner não carregado.'); return }

  const divId = 'qr-reader-saida'
  document.getElementById(divId).style.display = 'block'

  html5QrSaida = new window.Html5Qrcode(divId)
  html5QrSaida.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 280, height: 130 } },
    async (codigo) => {
      await pararScannerSaida()
      await buscarAparelhoPorCodigo(codigo)
    },
    () => {}
  ).catch(err => mostrarAlerta('estoque-alert-saida', 'Câmera indisponível: ' + err, 'error'))

  document.getElementById('btn-start-scanner-saida').style.display = 'none'
  document.getElementById('btn-stop-scanner-saida').style.display = 'inline-flex'
}

export function pararScannerSaida() {
  if (html5QrSaida) {
    html5QrSaida.stop().catch(() => {})
    document.getElementById('qr-reader-saida').style.display = 'none'
    html5QrSaida = null
  }
  document.getElementById('btn-start-scanner-saida').style.display = 'inline-flex'
  document.getElementById('btn-stop-scanner-saida').style.display = 'none'
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function formatarData(d) {
  if (!d) return '—'
  const [a, m, dia] = d.split('-')
  return `${dia}/${m}/${a}`
}

function fm(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function mostrarAlerta(id, msg, tipo) {
  const el = document.getElementById(id)
  if (!el) return
  el.textContent = msg
  el.className = `alert alert-${tipo} show`
  setTimeout(() => el.classList.remove('show'), 5000)
}

// Globais
window._ativarLote = ativarLote
window._confirmarSaida = confirmarSaida