import { supabase } from '../supabase.js'

let listaClientes = []

export async function carregarClientes() {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('nome')

  if (error) {
    mostrarAlerta('clientes-alert', 'Erro ao carregar clientes: ' + error.message, 'error')
    return
  }

  listaClientes = data
  renderizarClientes(data)
  atualizarSelectClientes(data)
}

export function renderizarClientes(lista) {
  const tbody = document.getElementById('clientes-tbody')
  if (!tbody) return

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum cliente cadastrado.</td></tr>'
    return
  }

  tbody.innerHTML = lista.map(c => `
    <tr>
      <td>${escapeHtml(c.nome)}</td>
      <td>${escapeHtml(c.local || '—')}</td>
      <td>${escapeHtml(c.contato || '—')}</td>
      <td>
        <button class="btn btn-danger" onclick="window._removerCliente('${c.id}')">Remover</button>
      </td>
    </tr>
  `).join('')
}

export async function adicionarCliente(nome, local, contato) {
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('clientes').insert({
    nome: nome.trim(),
    local: local.trim(),
    contato: contato.trim(),
    created_by: user.id
  })

  if (error) {
    mostrarAlerta('clientes-alert', 'Erro ao salvar cliente: ' + error.message, 'error')
    return false
  }

  mostrarAlerta('clientes-alert', 'Cliente adicionado com sucesso!', 'success')
  await carregarClientes()
  return true
}

export async function removerCliente(id) {
  if (!confirm('Remover este cliente? As vendas associadas também serão excluídas.')) return

  const { error } = await supabase.from('clientes').delete().eq('id', id)

  if (error) {
    mostrarAlerta('clientes-alert', 'Erro ao remover cliente: ' + error.message, 'error')
    return
  }

  mostrarAlerta('clientes-alert', 'Cliente removido.', 'success')
  await carregarClientes()
}

function atualizarSelectClientes(lista) {
  const selects = document.querySelectorAll('.select-cliente')
  selects.forEach(sel => {
    const valorAtual = sel.value
    sel.innerHTML = '<option value="">Selecione um cliente...</option>' +
      lista.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('')
    if (valorAtual) sel.value = valorAtual
  })
}

export function getListaClientes() {
  return listaClientes
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function mostrarAlerta(id, msg, tipo) {
  const el = document.getElementById(id)
  if (!el) return
  el.textContent = msg
  el.className = `alert alert-${tipo} show`
  setTimeout(() => el.classList.remove('show'), 4000)
}

// Expõe para uso inline no HTML
window._removerCliente = removerCliente