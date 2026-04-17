import { supabase } from '../supabase.js'

export async function carregarCustos() {
  const { data, error } = await supabase
    .from('custos_fixos')
    .select('*')
    .order('nome')

  if (error) {
    mostrarAlerta('custos-alert', 'Erro ao carregar custos: ' + error.message, 'error')
    return
  }

  renderizarCustos(data)
}

function renderizarCustos(lista) {
  const cont = document.getElementById('custos-lista')
  if (!cont) return

  if (!lista.length) {
    cont.innerHTML = '<p class="empty-state">Nenhum custo fixo cadastrado.</p>'
    document.getElementById('custos-total').textContent = 'R$ 0,00'
    return
  }

  cont.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Descrição</th>
          <th>Valor/Mês</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${lista.map(c => `
          <tr>
            <td>${escapeHtml(c.nome)}</td>
            <td class="money money-red">${formatarMoeda(c.valor)}</td>
            <td><button class="btn btn-danger" onclick="window._removerCusto('${c.id}')">Remover</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `

  const total = lista.reduce((s, c) => s + Number(c.valor), 0)
  const el = document.getElementById('custos-total')
  if (el) el.textContent = formatarMoeda(total)
}

export async function adicionarCusto(nome, valor) {
  const { error } = await supabase.from('custos_fixos').insert({
    nome: nome.trim(),
    valor: Number(valor)
  })

  if (error) {
    mostrarAlerta('custos-alert', 'Erro ao salvar custo: ' + error.message, 'error')
    return false
  }

  mostrarAlerta('custos-alert', 'Custo adicionado!', 'success')
  await carregarCustos()
  return true
}

export async function removerCusto(id) {
  if (!confirm('Remover este custo fixo?')) return

  const { error } = await supabase.from('custos_fixos').delete().eq('id', id)

  if (error) {
    mostrarAlerta('custos-alert', 'Erro ao remover custo: ' + error.message, 'error')
    return
  }

  mostrarAlerta('custos-alert', 'Custo removido.', 'success')
  await carregarCustos()
}

export async function getTotalCustos() {
  const { data, error } = await supabase.from('custos_fixos').select('valor')
  if (error || !data) return 0
  return data.reduce((s, c) => s + Number(c.valor), 0)
}

function formatarMoeda(v) {
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
  setTimeout(() => el.classList.remove('show'), 4000)
}

window._removerCusto = removerCusto