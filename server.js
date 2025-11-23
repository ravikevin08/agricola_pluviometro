// ===============================================
// API PARA RECEBER DADOS DO ARDUINO E GRAVAR NO
// POSTGRESQL (E ENVIAR PARA O FRONT-END)
// CORREÇÃO: volume_chuva MUDADO para chuva_mm
// ===============================================

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ===============================================
// CONFIGURAÇÃO DO BANCO POSTGRESQL (VERSÃO RENDER)
// ===============================================
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    
    // Configuração SSL é obrigatória para conexões de ambiente de nuvem
    ssl: {
        rejectUnauthorized: false
    }
});

// ===============================================
// ROTA DE TESTE / HEALTH CHECK
// ===============================================
app.get('/', (req, res) => {
    res.status(200).json({ 
        status: "API Online e funcionando.",
        servico: "Pluviômetro Agrícola Inteligente",
        instrucao_arduino: "Use a rota POST /api/receber para enviar dados."
    });
});

// ===============================================
// ROTA PARA RECEBER DADOS DO ARDUINO (POST)
// O Arduino envia: umidade, estado, intensidade, chuva
// ===============================================
app.post("/api/receber", async (req, res) => {
    const { umidade, estado, intensidade, chuva } = req.body;

    // Validação básica dos dados
    if (umidade === undefined || estado === undefined || intensidade === undefined || chuva === undefined) {
        return res.status(400).json({ mensagem: "Dados incompletos. Requer: umidade, estado, intensidade, chuva." });
    }

    try {
        const query = `
            INSERT INTO leituras (umidade_solo, estado_solo, intensidade_chuva, **chuva_mm**)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const values = [umidade, estado, intensidade, chuva];
        await db.query(query, values);
        
        // Resposta de sucesso rápida para o Arduino
        res.status(200).json({ mensagem: "Dados recebidos e salvos com sucesso!" });

    } catch (error) {
        console.error("Erro ao inserir dados no banco de dados:", error);
        res.status(500).json({ mensagem: "Erro interno do servidor ao salvar dados." });
    }
});

// ===============================================
// ENDPOINT 1: Última Leitura (para o Dashboard)
// ===============================================
app.get('/api/ultima_leitura', async (req, res) => {
    try {
        const query = `
            SELECT 
                umidade_solo, 
                estado_solo, 
                intensidade_chuva, 
                **chuva_mm**,
                TO_CHAR(data_leitura, 'DD/MM/YYYY HH24:MI:SS') as data_formatada
            FROM leituras 
            ORDER BY data_leitura DESC 
            LIMIT 1;
        `;
        const result = await db.query(query);

        if (result.rows.length === 0) {
            return res.status(404).json({ mensagem: "Nenhuma leitura encontrada." });
        }

        // Importante: a chave retornada será 'chuva_mm'
        res.status(200).json(result.rows[0]); 

    } catch (error) {
        console.error("Erro ao buscar a última leitura:", error);
        res.status(500).json({ mensagem: "Erro interno do servidor." });
    }
});

// ENDPOINT 2: Chuva Semanal (para Gráfico de Barras)
// Calcula o volume de chuva total por dia nos últimos 7 dias.
app.get('/api/chuva_semanal', async (req, res) => {
    try {
        const query = `
            SELECT
                SUM(**chuva_mm**) AS chuva_total_mm,
                TO_CHAR(data_leitura, 'Day') AS dia_da_semana
            FROM leituras
            WHERE data_leitura >= NOW() - INTERVAL '7 days'
            GROUP BY 2
            ORDER BY MIN(data_leitura);
        `;
        const result = await db.query(query);
        res.status(200).json(result.rows);

    } catch (error) {
        console.error("Erro ao buscar chuva semanal:", error);
        res.status(500).json({ mensagem: "Erro interno do servidor." });
    }
});

// ENDPOINT 3: Histórico de Umidade (para Gráfico de Linha 24h)
// Calcula a umidade média agrupada em blocos de 4 horas nas últimas 24h.
app.get('/api/historico_umidade', async (req, res) => {
    try {
        const query = `
            SELECT
                ROUND(AVG(umidade_solo)::numeric, 0) AS umidade_media,
                -- Agrupa o timestamp por blocos de 4 horas para suavizar o gráfico
                TO_CHAR(DATE_TRUNC('hour', data_leitura) - (EXTRACT(HOUR FROM data_leitura)::int % 4) * INTERVAL '1 hour', 'HH24:MI') AS hora_agrupada
            FROM leituras
            WHERE data_leitura >= NOW() - INTERVAL '24 hours'
            GROUP BY 2
            ORDER BY 2;
        `;
        const result = await db.query(query);
        res.status(200).json(result.rows);

    } catch (error) {
        console.error("Erro ao buscar histórico de umidade:", error);
        res.status(500).json({ mensagem: "Erro interno do servidor." });
    }
});

// ===============================================
// INICIALIZAÇÃO DO SERVIDOR
// ===============================================
const PORT = process.env.PORT || 10000; 
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
