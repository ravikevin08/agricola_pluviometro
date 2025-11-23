// ===============================================
// API PARA RECEBER DADOS DO ARDUINO E GRAVAR NO
// POSTGRESQL (E ENVIAR PARA O FRONT-END)
// ===============================================

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ===============================================
// CONFIGURAÇÃO DO BANCO POSTGRESQL (MUDANÇA AQUI)
// ===============================================
const db = new Pool({
    // Usa a variável de ambiente DATABASE_URL, injetada pelo Render,
    // que contém todas as credenciais do seu agricola-db.
    connectionString: process.env.DATABASE_URL,
    
    // Configuração SSL é obrigatória para conexões de ambiente de nuvem
    // (mesmo que Render-to-Render usem a rede interna, é boa prática).
    ssl: {
        rejectUnauthorized: false
    }
});

// ===============================================
// ROTA PARA RECEBER DADOS DO ARDUINO (POST)
// ===============================================
app.post("/api/receber", async (req, res) => {
    const { umidade, estado, intensidade, chuva } = req.body;

    console.log("Recebido do Arduino:", req.body);

    try {
        const sql = `
            INSERT INTO leituras (umidade_solo, estado_solo, intensidade_chuva, chuva_mm)
            VALUES ($1, $2, $3, $4)
        `;

        await db.query(sql, [umidade, estado, intensidade, chuva]);

        res.send("Dados salvos com sucesso!");
    } catch (err) {
        console.error("Erro:", err);
        res.status(500).send("Erro ao salvar no PostgreSQL");
    }
});


// ===============================================
// NOVOS ENDPOINTS PARA O DASHBOARD (GET)
// ===============================================

// ENDPOINT 1: Buscar Última Leitura (para Cartões de Dados)
app.get('/api/ultima_leitura', async (req, res) => {
    try {
        const query = `
            SELECT
                umidade_solo,
                -- Subconsulta para somar a chuva das últimas 24 horas
                (SELECT ROUND(SUM(chuva_mm)::numeric, 1) FROM leituras WHERE data_leitura >= NOW() - INTERVAL '24 hours') AS volume_chuva_24h,
                data_leitura
            FROM leituras
            ORDER BY data_leitura DESC
            LIMIT 1;
        `;
        const result = await db.query(query);

        if (result.rows.length === 0) {
            return res.status(404).json({ mensagem: "Nenhum dado encontrado." });
        }

        const data = result.rows[0];
        res.status(200).json({
            umidade_solo: data.umidade_solo,
            // Usa 0.0 se não houver dados de chuva nas últimas 24h
            volume_chuva: data.volume_chuva_24h || 0.0, 
            data_hora: data.data_leitura
        });

    } catch (error) {
        console.error("Erro ao buscar a última leitura:", error);
        res.status(500).json({ mensagem: "Erro interno do servidor." });
    }
});

// ENDPOINT 2: Histórico de Chuva Semanal (para Gráfico de Barras)
app.get('/api/chuva_semanal', async (req, res) => {
    try {
        const query = `
            SELECT
                EXTRACT(DOW FROM data_leitura) AS dia_semana_num, -- DOW: 0=Dom, 1=Seg...
                ROUND(SUM(chuva_mm)::numeric, 1) AS volume_total
            FROM leituras
            WHERE data_leitura >= NOW() - INTERVAL '7 days'
            GROUP BY 1
            ORDER BY 1;
        `;
        const result = await db.query(query);
        res.status(200).json(result.rows);

    } catch (error) {
        console.error("Erro ao buscar chuva semanal:", error);
        res.status(500).json({ mensagem: "Erro interno do servidor." });
    }
});

// ENDPOINT 3: Histórico de Umidade (para Gráfico de Linha 24h)
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
// INICIAR SERVIDOR NA PORTA DINÂMICA (MUDANÇA AQUI)
// ===============================================
const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`API rodando na porta ${port}`);
});