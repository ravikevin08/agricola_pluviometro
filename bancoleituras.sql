CREATE TABLE leituras (
    id SERIAL PRIMARY KEY,
    umidade_solo INTEGER,
    estado_solo VARCHAR(20),
    intensidade_chuva INTEGER,
    chuva_mm NUMERIC(10,2),
    data_leitura TIMESTAMP DEFAULT NOW()
);

SELECT * FROM leituras;