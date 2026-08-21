# Falaê! | Desafio técnico — Full Stack Pleno

> Feedback bom vira ação. Este desafio é sobre garantir que ele chegue lá —
> mesmo quando alguma coisa falha pelo caminho.

## Falaê! Que bom ter você por aqui 👋

Na Falaê, feedback não é só dado: é o ponto de partida para melhorar a
experiência do cliente. Neste desafio, você vai construir uma pequena aplicação
full stack que percorre esse caminho — da tela em que a avaliação chega até o
resultado da análise, sem perder dados nem travar a operação.

O recorte é proposital. Não esperamos um sistema completo nem uma arquitetura
cheia de camadas só para impressionar. Queremos entender como você organiza uma
solução enxuta, reage quando o caminho feliz deixa de ser feliz e explica as
decisões que tomou.

## Seu desafio

Construa uma aplicação full stack que:

1. permita cadastrar avaliações por uma interface web;
2. persista cada avaliação;
3. agende seu processamento assíncrono;
4. consulte a API fake de análise deste repositório;
5. armazene o resultado da análise;
6. exiba na interface o status e o resultado de cada avaliação.

## O caminho da avaliação

```text
Pessoa
  │
  ▼
Frontend
  │
  ├── POST /reviews ───────▶ API
  │                            ├── persiste a avaliação
  │                            ├── responde sem aguardar a análise
  │                            └── agenda o processamento
  │                                       │
  │                                       ▼
  │                                    Worker
  │                                       ├── chama POST /v1/analyze
  │                                       ├── trata erros temporários
  │                                       └── salva o resultado
  │
  └── GET /reviews ◀─────── status e análise atualizados
```

O ponto mais importante desse fluxo: a API deve continuar recebendo avaliações
mesmo quando o serviço externo estiver lento ou indisponível. Enquanto isso, a
tela precisa comunicar com clareza o que está pendente, o que deu certo e o que
falhou. A voz do cliente não pode ficar esperando outra API voltar.

## O contrato que esperamos

Os nomes exatos dos campos e status podem mudar, desde que o contrato continue
coerente, previsível e bem documentado.

### Receber uma avaliação

```http
POST /reviews
Content-Type: application/json
Idempotency-Key: review-order-123
```

```json
{
  "external_id": "review-order-123",
  "company_id": "company-456",
  "rating": 2,
  "comment": "O pedido demorou muito e chegou frio."
}
```

Como a análise acontece depois, esperamos uma resposta assíncrona:

```http
HTTP/1.1 202 Accepted
```

```json
{
  "id": "identificador-interno",
  "external_id": "review-order-123",
  "status": "pending"
}
```

O mesmo feedback pode chegar mais de uma vez. Sua solução deve reconhecer essa
duplicidade e evitar tanto novos registros quanto processamentos indevidos.

### Listar as avaliações

```http
GET /reviews
```

Retorne os dados necessários para montar a visão principal. O formato pode ser
ajustado, mas deve permitir identificar cada avaliação e entender seu estado:

```json
{
  "data": [
    {
      "id": "identificador-interno",
      "external_id": "review-order-123",
      "rating": 2,
      "status": "processing",
      "created_at": "2026-08-21T12:00:00.000Z"
    }
  ]
}
```

### Acompanhar uma avaliação

```http
GET /reviews/:id
```

Depois do processamento, a resposta pode seguir este formato:

```json
{
  "id": "identificador-interno",
  "external_id": "review-order-123",
  "company_id": "company-456",
  "rating": 2,
  "comment": "O pedido demorou muito e chegou frio.",
  "status": "completed",
  "analysis": {
    "sentiment": "negative",
    "category": "delivery",
    "confidence": 0.91
  },
  "attempts": 2,
  "created_at": "2026-08-21T12:00:00.000Z",
  "processed_at": "2026-08-21T12:00:04.000Z"
}
```

### Colocar o fluxo na tela

A interface é parte obrigatória da entrega. Não precisa ser um dashboard
completo: uma única página bem resolvida já é suficiente. Ela deve permitir:

- cadastrar uma avaliação com os campos do contrato;
- visualizar as avaliações já criadas;
- diferenciar estados como pendente, processando, concluído e falha;
- consultar o resultado da análise quando ele estiver disponível;
- perceber estados de carregamento, lista vazia e erro de comunicação.

A atualização do status pode ser manual ou automática, desde que a experiência
seja coerente e a decisão esteja documentada. Não buscamos uma interface
pixel-perfect; queremos ver frontend e backend funcionando juntos de verdade,
sem dados fixos para simular a integração.

## O que não pode faltar

- TypeScript no frontend e no backend;
- interface web integrada à API;
- API HTTP;
- banco de dados relacional;
- processamento assíncrono;
- execução completa de frontend, API, worker, banco e mock com Docker Compose;
- proteção contra duplicidade;
- tratamento de timeout, `429` e erros temporários `5xx`;
- política de retry limitada;
- status de processamento persistido;
- testes automatizados dos fluxos mais importantes;
- README com instruções de execução e decisões técnicas.

React, Vue, Svelte ou outra solução no frontend; Express, Fastify, NestJS,
BullMQ, RabbitMQ ou outro caminho no backend: a escolha é sua. O que queremos
ver é uma solução consistente com o problema e uma explicação clara dos
trade-offs.

## Extras que somam

Se o essencial estiver bem resolvido e ainda fizer sentido para o seu recorte,
você pode incluir:

- backoff exponencial;
- fila de mensagens mortas ou tratamento equivalente;
- endpoint para reprocessamento;
- criação de alerta para avaliações negativas;
- atualização de status em tempo real com SSE ou WebSocket;
- filtros ou busca na lista de avaliações;
- métricas ou logs estruturados;
- healthchecks separados para API, banco e worker;
- mecanismo para lidar com a falha entre persistir a avaliação e publicar o job;
- testes de integração com banco e fila reais.

Extras são realmente extras. Uma base confiável vale mais do que várias
funcionalidades pela metade.

## A API fake de análise

Este repositório já traz uma API externa simulada em TypeScript. Ela não chama
nenhum serviço real; seu papel é reproduzir o tipo de instabilidade que uma
integração de verdade pode apresentar.

### Coloque o ambiente de pé

```bash
cp .env.example .env
docker compose up --build
```

Confira se a API está saudável:

```bash
curl http://localhost:4000/health
```

### Envie uma avaliação para análise

```bash
curl --request POST 'http://localhost:4000/v1/analyze' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "review_id": "review-order-123",
    "company_id": "company-456",
    "rating": 2,
    "text": "O pedido demorou muito e chegou frio."
  }'
```

Se sua aplicação estiver no mesmo Docker Compose, use o endereço interno:

```text
http://mock-analysis-api:4000/v1/analyze
```

### Quando tudo dá certo

```json
{
  "request_id": "8a7c00f3-7a06-4809-b6fa-faf1267f7230",
  "review_id": "review-order-123",
  "analysis": {
    "sentiment": "negative",
    "category": "delivery",
    "confidence": 0.91,
    "matched_keywords": ["demorou", "frio"]
  },
  "processing_time_ms": 718,
  "processed_at": "2026-08-21T12:00:00.000Z"
}
```

### Quando o caminho feliz deixa de ser feliz

Sem headers especiais, a API fake aplica atrasos, rate limit e falhas periódicas
de acordo com o `.env`. Isso é intencional: sua aplicação precisa estar pronta
para uma dependência que nem sempre coopera.

Quando precisar de um cenário previsível nos testes, envie
`x-mock-scenario`:

| Valor | O que acontece |
|---|---|
| `success` | a análise termina com sucesso |
| `slow` | a análise termina com sucesso, mas demora mais |
| `server-error` | a API retorna `503` com `Retry-After` |
| `rate-limit` | a API retorna `429` com `Retry-After` |

O header `x-client-id` permite isolar o rate limit entre clientes de teste.
Outros exemplos prontos para uso estão em
[`examples/requests.http`](examples/requests.http).

## Alguns combinados

- IA, documentação e mecanismos de busca estão liberados. Conte brevemente no
  seu README como essas ferramentas participaram do trabalho.
- Não altere o comportamento da API fake para contornar as falhas. Elas fazem
  parte do desafio.
- O frontend faz parte do desafio, mas pode ser uma tela única. Não é necessário
  criar autenticação, um design system completo ou infraestrutura em nuvem.
- Não existe uma única biblioteca, arquitetura ou resposta considerada correta.

## Cuide do seu tempo

Este desafio foi pensado para cerca de **4 horas de dedicação**, com limite
recomendado de **6 horas**. Se alguma coisa ficar de fora, tudo bem — registre:

- o que ficou pendente;
- por que você priorizou dessa forma;
- como concluiria essa parte em um cenário real.

Saber recortar, priorizar e comunicar também faz parte do trabalho de engenharia.

## Antes de compartilhar

Envie um repositório Git com:

- código-fonte do frontend e do backend;
- migrations ou outra estrutura necessária para o banco;
- Docker Compose;
- testes;
- README com comandos, URL da interface, decisões, limitações e próximos passos.

Queremos conseguir iniciar o projeto, de preferência, com um único comando:

```bash
docker compose up --build
```

Depois que os containers subirem, deve estar claro em qual endereço local
podemos abrir a tela e percorrer o fluxo completo.

## O que vamos observar

- clareza da arquitetura;
- confiabilidade do processamento;
- integração entre frontend e backend;
- clareza dos estados e da experiência na interface;
- qualidade e legibilidade do código;
- estratégia contra duplicidade;
- tratamento de falhas e retries;
- qualidade dos testes;
- facilidade para executar o projeto;
- capacidade de explicar decisões e trade-offs.

No fim, queremos uma solução que continue ouvindo mesmo quando algo falha do
outro lado. Bem Falaê! 💬
