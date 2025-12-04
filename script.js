// script.js - Lógica V8 (Proteção contra falhas de HTML)
// Se você já tinha dados na V3, mantemos a V3. Se não, ele cria.
const KEY = 'fin_v3_final'; 
const ARCH_KEY = 'fin_v3_archives';
const TITHE = 0.10;

let store = JSON.parse(localStorage.getItem(KEY)) || { 
    entradas: [], 
    gastos: [], 
    saldoInicial: 0, 
    lastWarningMonth: ''
};

// Migração: Se não houver categorias, adiciona as padrão sem apagar os dados
if (!store.categories) {
    store.categories = ['Lucro barbearia', 'Alimentação', 'Veiculo', 'Lazer', 'Familia', 'Outros'];
}

let archives = JSON.parse(localStorage.getItem(ARCH_KEY)) || [];
let lastAdded = null;
let toastTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // --- DATA ---
    const inputDate = document.getElementById('inputDate');
    if (inputDate) {
        // Data Local Correta
        const now = new Date();
        const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
        inputDate.value = localDate;
        inputDate.onchange = renderDayList;
    }

    // --- LISTENERS SEGUROS ---
    // A função safeClick adiciona o evento apenas se o elemento existir
    const safeClick = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.onclick = fn;
    };

    safeClick('btnAdd', onAdd);
    safeClick('btnUndo', onUndoManual);
    safeClick('btnCloseMonth', confirmCloseMonth);
    
    // Navegação
    safeClick('tabHome', closeScreens);
    safeClick('tabReport', openReportScreen);
    safeClick('tabHistory', openHistoryScreen);
    safeClick('btnOpenReport', openReportScreen);
    
    // Voltar
    safeClick('btnBackReport', closeScreens);
    safeClick('btnBackHistory', closeScreens);
    safeClick('btnBackSettings', closeScreens);
    
    // Configurações
    safeClick('btnOpenSettings', openSettingsScreen);
    safeClick('btnSaveInitialBalance', saveInitialBalance);
    safeClick('btnAddCategory', addCategory);
    
    // Aviso
    safeClick('btnConfigInitialBalanceNow', () => { closeWarningScreen(); openSettingsScreen(); });
    safeClick('btnConfigInitialBalanceLater', closeWarningScreen);

    // Exportar
    const btnPdf = document.getElementById('btnExportPdf');
    if(btnPdf) btnPdf.onclick = () => { alert('Use a função Imprimir do navegador.'); window.print(); };

    // --- RENDERIZAÇÃO ---
    renderCategorySelect();
    renderDayList();
    renderMonthSummary();
    renderTransactionsList();
    checkInitialBalanceWarning();
}

// --- NAVEGAÇÃO ---
function openReportScreen() {
    try { renderReport(); } catch (e) { console.error(e); showToast('Erro ao abrir relatório'); }
    document.getElementById('screenReport').style.display = 'flex';
    document.getElementById('screenHistory').style.display = 'none';
    document.getElementById('screenSettings').style.display = 'none';
}
function openHistoryScreen() {
    renderArchives();
    renderTransactionsList();
    document.getElementById('screenHistory').style.display = 'flex';
    document.getElementById('screenReport').style.display = 'none';
    document.getElementById('screenSettings').style.display = 'none';
}
function openSettingsScreen() {
    document.getElementById('inputInitialBalance').value = (store.saldoInicial || 0).toFixed(2);
    renderCategoryList();
    document.getElementById('screenSettings').style.display = 'flex';
}
function closeScreens() {
    document.getElementById('screenReport').style.display = 'none';
    document.getElementById('screenHistory').style.display = 'none';
    document.getElementById('screenSettings').style.display = 'none';
}
function closeWarningScreen(){
    const screen = document.getElementById('screenInitialBalanceWarning');
    if(screen) screen.style.display = 'none';
    store.lastWarningMonth = new Date().toISOString().slice(0,7);
    save();
}
function checkInitialBalanceWarning(){
    const screen = document.getElementById('screenInitialBalanceWarning');
    if (!screen) return;
    const ym = new Date().toISOString().slice(0,7);
    if((!store.saldoInicial || store.saldoInicial === 0) && store.lastWarningMonth !== ym){
        screen.style.display = 'flex';
    }
}

// --- DADOS ---
function save() {
    localStorage.setItem(KEY, JSON.stringify(store));
    localStorage.setItem(ARCH_KEY, JSON.stringify(archives));
}
function showToast(msg, ok=true) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.style.display = 'block';
    toast.style.background = ok ? 'rgba(0,0,0,0.8)' : '#d43b3b';
    toast.innerText = msg;
    toastTimer = setTimeout(() => toast.style.display = 'none', 3000);
}
function formatCurrency(v){ return 'R$ ' + Number(v||0).toFixed(2); }

// --- REGISTRO ---
function onAdd() {
    const d = document.getElementById('inputDate').value;
    const tipo = document.getElementById('inputTipo').value;
    // Tenta pegar a categoria, se não existir (erro HTML), usa vazio
    const catEl = document.getElementById('inputCategoria');
    const cat = catEl ? catEl.value : 'Geral';
    
    const valor = parseFloat(document.getElementById('inputValor').value);
    const desc = (document.getElementById('inputDesc').value || 'Sem descrição').trim();

    if (!valor || valor <= 0) return showToast('Valor inválido', false);

    const entry = { id: Date.now().toString(36), data: d, tipo, desc, valor: +valor, categoria: cat };
    
    if (tipo === 'entrada') store.entradas.push(entry);
    else store.gastos.push(entry);
    
    lastAdded = entry;
    save();
    
    document.getElementById('inputValor').value = '';
    document.getElementById('inputDesc').value = '';
    document.getElementById('inputDesc').focus();
    
    renderDayList();
    renderMonthSummary();
    renderTransactionsList();
    showToast('Salvo!');
}

function onUndoManual() {
    if (!lastAdded) return showToast('Nada para desfazer', false);
    if (lastAdded.tipo === 'entrada') store.entradas = store.entradas.filter(e => e.id !== lastAdded.id);
    else store.gastos = store.gastos.filter(e => e.id !== lastAdded.id);
    lastAdded = null;
    save();
    renderDayList();
    renderMonthSummary();
    renderTransactionsList();
    showToast('Desfeito');
}

// --- CATEGORIAS ---
function renderCategorySelect() {
    const select = document.getElementById('inputCategoria');
    if (!select) return; // PROTEÇÃO: Se o HTML estiver velho, não trava o resto
    
    select.innerHTML = '';
    store.categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.innerText = cat;
        select.appendChild(opt);
    });
}
function renderCategoryList() {
    const list = document.getElementById('categoryList');
    if (!list) return;
    list.innerHTML = '';
    store.categories.forEach(cat => {
        const item = document.createElement('div');
        item.className = 'list-item small';
        item.style.cursor = 'pointer';
        item.style.marginRight = '8px';
        item.style.backgroundColor = '#333';
        item.innerHTML = `${cat} <span style="color:#ff6b6b; margin-left:5px;">×</span>`;
        item.onclick = () => {
            if(confirm(`Apagar categoria "${cat}"?`)) {
                store.categories = store.categories.filter(c => c !== cat);
                save(); renderCategorySelect(); renderCategoryList();
            }
        };
        list.appendChild(item);
    });
}
function addCategory() {
    const el = document.getElementById('inputNewCategory');
    if(!el) return;
    const val = el.value.trim();
    if(val && !store.categories.includes(val)) {
        store.categories.push(val);
        save();
        renderCategorySelect(); renderCategoryList();
        el.value = '';
    }
}

// --- VISUALIZAÇÕES ---
function renderDayList() {
    const inputD = document.getElementById('inputDate');
    if(!inputD) return;
    const d = inputD.value;
    const entries = store.entradas.filter(e => e.data === d);
    const gastos = store.gastos.filter(g => g.data === d);
    const list = document.getElementById('listDay');
    if(!list) return;
    
    let html = '<div><strong>Entradas</strong></div>';
    if(entries.length===0) html += '<div class="small muted">Nada</div>';
    else entries.forEach(e => html += `<div class="list-item">${e.desc} (${e.categoria||'Geral'}) — ${formatCurrency(e.valor)}</div>`);
    
    html += '<div style="margin-top:10px"><strong>Saídas</strong></div>';
    if(gastos.length===0) html += '<div class="small muted">Nada</div>';
    else gastos.forEach(g => html += `<div class="list-item">${g.desc} (${g.categoria||'Geral'}) — ${formatCurrency(g.valor)}</div>`);
    
    list.innerHTML = html;
}

function renderTransactionsList() {
    const list = document.getElementById('transactionsList');
    if(!list) return;
    const all = [...store.entradas, ...store.gastos].sort((a,b) => new Date(b.data) - new Date(a.data));
    
    if(all.length === 0) { list.innerHTML = '<div class="small muted">Vazio</div>'; return; }
    
    list.innerHTML = all.map(t => `
        <div class="transaction-item">
            <div class="transaction-details">
                <div style="font-weight:600">${t.desc}</div>
                <div class="small muted">${new Date(t.data+'T00:00').toLocaleDateString('pt-BR')} • ${t.categoria||'Geral'}</div>
            </div>
            <div class="transaction-value ${t.tipo==='entrada'?'value-entrada':'value-saida'}">
                ${t.tipo==='entrada'?'+':'-'} ${t.valor.toFixed(2)}
            </div>
        </div>
    `).join('');
}

function renderMonthSummary() {
    const summaryEl = document.getElementById('monthSummary');
    if (!summaryEl) return;

    const ym = new Date().toISOString().slice(0,7);
    const entradasMes = store.entradas.filter(e => e.data.startsWith(ym));
    const gastosMes = store.gastos.filter(g => g.data.startsWith(ym));

    const ent = entradasMes.reduce((s,i)=>s+i.valor,0);
    const gas = gastosMes.reduce((s,i)=>s+i.valor,0);
    const dizimo = ent * TITHE;
    const liq = (store.saldoInicial||0) + ent - gas - dizimo;

    const map = {};
    entradasMes.forEach(e => { map[e.data] = (map[e.data] || 0) + e.valor; });
    const vals = Object.values(map);
    const best = vals.length ? Math.max(...vals) : 0;
    const worst = vals.length ? Math.min(...vals) : 0;
    
    summaryEl.innerHTML = `
        <div class="stat">${formatCurrency(ent)}<div class="small muted">Entradas</div></div>
        <div class="stat">${formatCurrency(gas)}<div class="small muted">Gastos</div></div>
        <div class="stat">${formatCurrency(dizimo)}<div class="small muted">Dízimo (10%)</div></div>
        <div class="stat">${formatCurrency(store.saldoInicial||0)}<div class="small muted">Inicial</div></div>
        <div class="stat liquid-final" style="grid-column:span 2; border:1px solid var(--primary-btn)">${formatCurrency(liq)}<div class="small muted">Líquido Final</div></div>
        <div class="stat">${formatCurrency(best)}<div class="small muted">Melhor Dia</div></div>
        <div class="stat">${formatCurrency(worst)}<div class="small muted">Pior Dia</div></div>
    `;
}

// --- RELATÓRIO E GRÁFICO ---
function renderReport() {
    const ym = new Date().toISOString().slice(0,7);
    const entradasMes = store.entradas.filter(e => e.data.startsWith(ym));
    const gastosMes = store.gastos.filter(g => g.data.startsWith(ym));
    
    const container = document.getElementById('donutChart');
    const legendContainer = document.getElementById('chartLegend');
    
    if (container && legendContainer) {
        container.innerHTML = '';
        legendContainer.innerHTML = '';
        
        const cats = {};
        let totalG = 0;
        gastosMes.forEach(g => {
            const c = g.categoria || 'Outros';
            cats[c] = (cats[c] || 0) + g.valor;
            totalG += g.valor;
        });
        
        if(totalG > 0 && typeof d3 !== 'undefined') {
            const data = Object.entries(cats).map(([k,v]) => ({key:k, value:v}));
            const width = 260, height = 260, margin = 10;
            const radius = Math.min(width, height) / 2 - margin;
            
            const svg = d3.select("#donutChart").append("svg")
                .attr("width", width).attr("height", height)
                .append("g").attr("transform", `translate(${width/2},${height/2})`);
                
            const color = d3.scaleOrdinal().range(d3.schemeCategory10); 
            const pie = d3.pie().value(d=>d.value);
            const arc = d3.arc().innerRadius(radius*0.5).outerRadius(radius);
            
            svg.selectAll('path').data(pie(data)).enter().append('path')
                .attr('d', arc).attr('fill', d=>color(d.data.key))
                .attr("stroke", "#080808").style("stroke-width", "2px");
                
            let htmlLegend = '';
            data.forEach((d, i) => {
                const cor = d3.schemeCategory10[i % 10];
                const pct = ((d.value/totalG)*100).toFixed(0);
                htmlLegend += `<div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span><span style="display:inline-block;width:10px;height:10px;background:${cor};margin-right:5px;border-radius:50%"></span>${d.key}</span>
                    <span>${formatCurrency(d.value)} (${pct}%)</span>
                </div>`;
            });
            legendContainer.innerHTML = htmlLegend;
        } else {
            container.innerHTML = '<div class="small muted" style="padding:20px; text-align:center">Sem gastos para gerar gráfico.</div>';
        }
    }
    
    // Resumo Texto
    const ent = entradasMes.reduce((s,i)=>s+i.valor,0);
    const gas = gastosMes.reduce((s,i)=>s+i.valor,0);
    const dizimo = ent * TITHE;
    const liq = (store.saldoInicial||0) + ent - gas - dizimo;

    // Melhor/Pior
    const map = {};
    entradasMes.forEach(e => { map[e.data] = (map[e.data] || 0) + e.valor; });
    const vals = Object.values(map);
    const best = vals.length ? Math.max(...vals) : 0;
    const worst = vals.length ? Math.min(...vals) : 0;

    const reportSum = document.getElementById('reportSummary');
    if (reportSum) {
        reportSum.innerHTML = `
            <div><strong>Total Entradas</strong>: ${formatCurrency(ent)}</div>
            <div><strong>Total Gastos</strong>: ${formatCurrency(gas)}</div>
            <div><strong>Dízimo (10%)</strong>: ${formatCurrency(dizimo)}</div>
            <div><strong>Saldo Inicial</strong>: ${formatCurrency(store.saldoInicial||0)}</div>
            <div style="margin-top:8px; font-size:1.1em; color:var(--accent)"><strong>Líquido Final: ${formatCurrency(liq)}</strong></div>
            <div style="margin-top:8px; border-top:1px solid #333; padding-top:8px;">
                <div>Melhor dia (Entradas): ${formatCurrency(best)}</div>
                <div>Pior dia (Entradas): ${formatCurrency(worst)}</div>
            </div>
        `;
    }
    
    renderReportWeeks();
    renderReportDays();
}

function renderReportWeeks(){
  const now = new Date();
  const ym = now.toISOString().slice(0,7);
  const [y,m] = ym.split('-').map(Number);
  const weeks = getWeeksForMonth(y,m);
  const rw = document.getElementById('reportWeeks');
  if(!rw) return;
  rw.innerHTML = '';
  
  weeks.forEach((w, idx) => {
    const dateKeys = w.dates.map(d=>d.toISOString().slice(0,10));
    const entradas = store.entradas.filter(e => dateKeys.includes(e.data)).reduce((s,i)=>s+i.valor,0);
    const gastos = store.gastos.filter(g => dateKeys.includes(g.data)).reduce((s,i)=>s+i.valor,0);
    const diz = entradas * TITHE;
    const liqui = entradas - (gastos + diz); 
    const startLabel = w.start.toLocaleDateString('pt-BR');
    const endLabel = w.end.toLocaleDateString('pt-BR');
    const block = document.createElement('div');
    block.className = 'card';
    block.innerHTML = `<strong>Semana ${idx+1} — ${startLabel} → ${endLabel}</strong>
      <div class="small muted">Entradas: ${formatCurrency(entradas)} • Gastos: ${formatCurrency(gastos)} • Dízimo: ${formatCurrency(diz)} • Líquido: ${formatCurrency(liqui)}</div>`;
    rw.appendChild(block);
  });
}

function renderReportDays(){
  const now = new Date();
  const ym = now.toISOString().slice(0,7);
  const [y,m] = ym.split('-').map(Number);
  
  const monthDates = [];
  const lastDay = new Date(y, m, 0).getDate();
  for(let d=1; d<= lastDay; d++){
    const dd = new Date(y, m-1, d);
    const key = dd.toISOString().slice(0,10);
    monthDates.push(key);
  }
  
  const rd = document.getElementById('reportDays');
  if(!rd) return;
  rd.innerHTML = '';
  monthDates.forEach(day => {
    const eTot = store.entradas.filter(e => e.data === day).reduce((s,i)=>s+i.valor,0);
    const gTot = store.gastos.filter(g => g.data === day).reduce((s,i)=>s+i.valor,0);
    const row = document.createElement('div');
    row.className = 'list-item';
    row.innerHTML = `${new Date(day+'T00:00:00').toLocaleDateString('pt-BR')} — Entradas: ${formatCurrency(eTot)} • Gastos: ${formatCurrency(gTot)}`;
    rd.appendChild(row);
  });
}

function getWeeksForMonth(year, month){
  const weeks = {};
  const last = new Date(year, month, 0).getDate();
  for(let day=1; day<=last; day++){
    const d = new Date(year, month-1, day);
    const monday = new Date(d);
    while(monday.getDay() !== 1) monday.setDate(monday.getDate() - 1);
    const mondayKey = monday.toISOString().slice(0,10);
    if(!weeks[mondayKey]) weeks[mondayKey] = { start: monday, dates: [] };
    weeks[mondayKey].dates.push(d);
  }
  Object.keys(weeks).forEach(k => {
    const start = weeks[k].start;
    const sat = new Date(start);
    while(sat.getDay() !== 6) sat.setDate(sat.getDate() + 1);
    weeks[k].end = sat;
  });
  const arr = Object.keys(weeks).map(k => ({ mondayKey: k, start: weeks[k].start, end: weeks[k].end, dates: weeks[k].dates }));
  arr.sort((a,b)=>new Date(a.mondayKey)-new Date(b.mondayKey));
  return arr;
}

function saveInitialBalance() {
    const el = document.getElementById('inputInitialBalance');
    if(el) store.saldoInicial = parseFloat(el.value) || 0;
    save();
    renderMonthSummary();
    closeScreens();
}

function confirmCloseMonth() {
    if(!confirm('Fechar mês e arquivar?')) return;
    const ym = new Date().toISOString().slice(0,7);
    const ent = store.entradas.filter(e => e.data.startsWith(ym));
    const gas = store.gastos.filter(g => g.data.startsWith(ym));
    archives.push({ month: ym, data: { entradas: ent, gastos: gas } });
    store.entradas = store.entradas.filter(e => !e.data.startsWith(ym));
    store.gastos = store.gastos.filter(g => !g.data.startsWith(ym));
    store.saldoInicial = 0;
    save();
    renderDayList(); renderMonthSummary(); renderTransactionsList();
    showToast('Mês fechado!');
}
function renderArchives() {
    const list = document.getElementById('archivesList');
    if(!list) return;
    if(archives.length === 0) list.innerHTML = '<div class="small muted">Vazio</div>';
    else list.innerHTML = archives.map(a => `<div class="list-item">${a.month}</div>`).join('');
}