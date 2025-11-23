#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SPI.h>
#include <Ethernet.h> 

// ===========================================
// 1. CONFIGURAÇÃO DA REDE E API
// ===========================================
byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED }; // Endereço MAC
IPAddress ip(192, 168, 0, 177); // IP Fixo para o Arduino
IPAddress gateway(192, 168, 0, 1); // Gateway Padrão (Router)
IPAddress subnet(255, 255, 255, 0);

// IP do seu notebook (API Node.js rodando na porta 3000)
IPAddress server(192, 168, 0, 12); 
const int port = 3000;
EthernetClient client; 

// ===========================================
// 2. PINOS E COMPONENTES
// ===========================================
LiquidCrystal_I2C lcd(0x27, 16, 2); 

const int pinoSensorUmidade = A0; 
const int pinoSensorChuva = A1; 

// CORREÇÃO: Pinos 9, 8 e 7 não conflitam com o Ethernet/SPI
const int LED_VERMELHO = 9; // Solo Seco
const int LED_AMARELO  = 8;  // Solo Ideal
const int LED_VERDE    = 7;    // Solo Encharcado

// ===========================================
// 3. LIMITES E CALIBRAÇÃO
// ===========================================
const int LIMITE_SECO = 20; 
const int LIMITE_ENCHARCADO = 50;

const int valorSecoSolo = 800; 
const int valorMolhadoSolo = 350; 
const int valorSecoChuva = 800; 
const int valorMolhadoChuva = 300; 

// ===========================================
// 4. VARIÁVEIS GLOBAIS E FILTROS
// ===========================================
int umidadeSolo = 0; 
int intensidadeChuva = 0; 
int estadoSolo = 0; 
float chuvaMMh = 0.0; 
float leituraFiltradaSolo = 0;

int lerMedia(int pino, int amostras = 10) {
  long soma = 0;
  for (int i = 0; i < amostras; i++) {
    soma += analogRead(pino);
    delay(10);
  }
  return soma / amostras;
}

float mediaFiltrada(float leituraAtual, float leituraAnterior, float fator = 0.9) {
  return (fator * leituraAnterior) + ((1 - fator) * leituraAtual);
}


// ===========================================
// 5. FUNÇÃO PARA ENVIAR DADOS PARA A API
// ===========================================
void enviarParaBanco(int umidade, const char* estado, int intensidade, float chuva) {

  // Formata o JSON com os dados
  String json = "{";
  json += "\"umidade\":"; json += umidade; json += ",";
  json += "\"estado\":\""; json += estado; json += "\",";
  json += "\"intensidade\":"; json += intensidade; json += ",";
  json += "\"chuva\":"; json += chuva;
  json += "}";

  if (client.connect(server, port)) {
    Serial.println("Conectado ao servidor. Enviando dados...");
        
    // 1. Envia a Requisição POST (Cabeçalhos HTTP)
    client.println("POST /api/receber HTTP/1.1");
    client.println("Host: 192.168.0.12"); 
    client.println("Content-Type: application/json");
    client.print("Content-Length: ");
    client.println(json.length());
    client.println("Connection: close");
    client.println(); 
    
    // 2. Envia o Corpo (JSON)
    client.println(json);
    Serial.print("JSON Enviado: ");
    Serial.println(json);

    // 3. Lê a Resposta do Servidor (Para debug)
    delay(500); 
    if (client.available()) {
      Serial.print("Resposta da API: ");
      while (client.available()) {
        Serial.write(client.read());
      }
      Serial.println();
    }
    
    client.stop();
  } else {
    Serial.println("❌ Erro ao conectar ao servidor Node.js!");
  }
}

// ===========================================
// 6. CONFIGURAÇÃO INICIAL
// ===========================================
void setup() {
  Serial.begin(9600);
  lcd.init();
  lcd.backlight();

  // Define os pinos dos LEDs como OUTPUT
  pinMode(LED_VERMELHO, OUTPUT);
  pinMode(LED_AMARELO, OUTPUT);
  pinMode(LED_VERDE, OUTPUT);

  // CORREÇÃO: Inicializa o módulo Ethernet com IP Fixo (sem o 'if == 0')
  Ethernet.begin(mac, ip, gateway, subnet);
  delay(1000); 

  if (Ethernet.hardwareStatus() == EthernetNoHardware) {
    Serial.println("Falha ao configurar a Ethernet.");
    Serial.println("Verifique o modulo e as conexoes SPI.");
  } else {
    Serial.println("Ethernet Inicializada com Sucesso!");
    Serial.print("IP do Arduino: ");
    Serial.println(Ethernet.localIP());
  }

  lcd.setCursor(0, 0);
  lcd.print("Monitor Agricola");
  lcd.setCursor(0, 1);
  lcd.print("Iniciando...");
  delay(2000);
  lcd.clear();
}

// ===========================================
// 7. LOOP PRINCIPAL
// ===========================================
void loop() {
  
  // ===========================
  // LEITURA E LÓGICA DO SOLO
  // ===========================
  int leituraBrutaSolo = lerMedia(pinoSensorUmidade);
  leituraFiltradaSolo = mediaFiltrada(leituraBrutaSolo, leituraFiltradaSolo);

  umidadeSolo = map(leituraFiltradaSolo, valorSecoSolo, valorMolhadoSolo, 0, 100);
  umidadeSolo = constrain(umidadeSolo, 0, 100);

  // Determinar estado do solo
  if (umidadeSolo <= LIMITE_SECO) estadoSolo = 0;
  else if (umidadeSolo >= LIMITE_ENCHARCADO) estadoSolo = 2;
  else estadoSolo = 1;

  // Lógica dos LEDs:
  digitalWrite(LED_VERMELHO, estadoSolo == 0 ? HIGH : LOW); // Seco (LED no pino 9)
  digitalWrite(LED_AMARELO, estadoSolo == 1 ? HIGH : LOW);  // Ideal (LED no pino 8)
  digitalWrite(LED_VERDE, estadoSolo == 2 ? HIGH : LOW);    // Encharcado (LED no pino 7)

  // Cria a string do estado para envio e LCD
  const char* estadoTexto;
  
  // LCD Display 1
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Solo: ");
  if (estadoSolo == 0) {
    estadoTexto = "Seco";
    lcd.print(estadoTexto);
  }
  else if (estadoSolo == 1) {
    estadoTexto = "Ideal";
    lcd.print(estadoTexto);
  }
  else {
    estadoTexto = "Encharcado";
    lcd.print(estadoTexto);
  }

  lcd.setCursor(0, 1);
  lcd.print("Umid: ");
  lcd.print(umidadeSolo);
  lcd.print("% ");

  Serial.println("=== LEITURA DE UMIDADE DO SOLO ===");
  Serial.print("Umidade: "); Serial.print(umidadeSolo);
  Serial.print("% | Estado: ");
  Serial.println(estadoTexto);

  delay(10000);

  // ===========================
  // LEITURA E LÓGICA DA CHUVA
  // ===========================
  int leituraChuva = lerMedia(pinoSensorChuva);
  intensidadeChuva = map(leituraChuva, valorSecoChuva, valorMolhadoChuva, 0, 100);
  intensidadeChuva = constrain(intensidadeChuva, 0, 100);

  if (intensidadeChuva < 20) chuvaMMh = 0.0;
  else if (intensidadeChuva < 40) chuvaMMh = 1.5;
  else if (intensidadeChuva < 60) chuvaMMh = 5.0;
  else if (intensidadeChuva < 80) chuvaMMh = 12.0;
  else chuvaMMh = 20.0;

  // LCD Display 2
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Pluviometro");
  lcd.setCursor(0, 1);
  if (chuvaMMh == 0.0) lcd.print("Sem chuva");
  else {
    lcd.print("Chuva: ");
    lcd.print(chuvaMMh, 1);
    lcd.print("mm/h");
  }

  Serial.println("=== LEITURA DO PLUVIOMETRO ===");
  Serial.print("Intensidade: "); Serial.print(intensidadeChuva); Serial.print("%");
  Serial.print(" | Estimado: "); Serial.print(chuvaMMh); Serial.println(" mm/h");

  delay(10000);

  // ===========================
  // ENVIO PARA A API
  // ===========================
  // Envia todos os dados coletados de uma só vez
  enviarParaBanco(umidadeSolo, estadoTexto, intensidadeChuva, chuvaMMh);
  
  // Aguarda mais 10 segundos antes do próximo ciclo de leitura/envio
  delay(10000); 
}