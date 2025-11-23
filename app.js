// ATENÇÃO: Se sua API não estiver no localhost, troque o IP abaixo para o IP do seu notebook/servidor.
// Ex: Se o IP do seu notebook é 192.168.0.12, use 'http://192.168.0.12:3000/api'
const API_URL = 'http://localhost:3000/api'; 
const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
let umidadeChartInstance = null;
let chuvaChartInstance = null;

// ===============================================
// FUNÇÕES DE BUSCA (FETCH)
// ===============================================

async function buscarUltimaLeitura() {
    try {
        const response = await fetch(`${API_URL}/ultima_leitura`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        // 1. Atualiza os cartões
        document.getElementById('umidade-valor').textContent = `${data.umidade_solo} %`;
        document.getElementById('chuva-valor').textContent = `${data.volume_chuva} mm`;
        
        // 2. Formata e atualiza a data/hora
        const dataLeitura = new Date(data.data_hora);
        const horaMinuto = dataLeitura.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('data-hora').textContent = horaMinuto;

    } catch (error) {
        console.error("Erro ao buscar última leitura:", error);
    }
}

async function buscarDadosChuva() {
    try {
        const response = await fetch(`${API_URL}/chuva_semanal`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const dados = await response.json();
        
        // Formata os dados
        const labels = dados.map(item => diasSemana[item.dia_semana_num]);
        const volumes = dados.map(item => parseFloat(item.volume_total));

        renderizarChuvaChart(labels, volumes);
    } catch (error) {
        console.error("Erro ao buscar dados de chuva:", error);
    }
}

async function buscarDadosUmidade() {
    try {
        const response = await fetch(`${API_URL}/historico_umidade`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const dados = await response.json();
        
        // Formata os dados: a API já agrupa por 4 horas, basta usar os campos
        const labels = dados.map(item => item.hora_agrupada);
        const umidades = dados.map(item => parseFloat(item.umidade_media));

        renderizarUmidadeChart(labels, umidades);
    } catch (error) {
        console.error("Erro ao buscar histórico de umidade:", error);
    }
}

// ===============================================
// FUNÇÕES DE RENDERIZAÇÃO (CHART.JS)
// ===============================================

function renderizarChuvaChart(labels, volumes) {
    if (chuvaChartInstance) chuvaChartInstance.destroy(); // Destrói o anterior
    const ctx = document.getElementById('chuvaChart').getContext('2d');
    chuvaChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels, 
            datasets: [{
                label: 'Volume (mm)',
                data: volumes,
                backgroundColor: 'rgba(54, 162, 235, 0.8)', // Azul
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'mm' } },
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderizarUmidadeChart(labels, umidades) {
    if (umidadeChartInstance) umidadeChartInstance.destroy(); // Destrói o anterior
    const ctx = document.getElementById('umidadeChart').getContext('2d');
    umidadeChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels, 
            datasets: [{
                label: 'Umidade (%)',
                data: umidades,
                borderColor: '#c69542', // Marrom/Dourado (similar ao seu gráfico)
                tension: 0.4, 
                fill: false,
                pointRadius: 5, // Pontos maiores
                pointBackgroundColor: '#c69542'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { min: 0, max: 100, title: { display: true, text: 'Umidade (%)' } },
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// ===============================================
// INICIALIZAÇÃO E REPETIÇÃO
// ===============================================
function initDashboard() {
    // Busca e atualiza os dados imediatamente
    buscarUltimaLeitura();
    buscarDadosChuva();
    buscarDadosUmidade();
    
    // Atualiza os cartões mais frequentemente (a cada 60 segundos)
    setInterval(buscarUltimaLeitura, 60000); 
    // Atualiza os gráficos menos frequentemente, pois envolve consultas mais pesadas (a cada 5 minutos)
    setInterval(buscarDadosChuva, 300000); 
    setInterval(buscarDadosUmidade, 300000); 
}

// Inicia o dashboard quando a página é carregada
window.onload = initDashboard;