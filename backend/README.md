# Backend do Observatório do Pantanal

ETL em Python, banco espaço-temporal (PostgreSQL/PostGIS), catálogo FAIR e API REST.

## Rodar localmente

```bash
docker compose up -d --build            # PostGIS (5433), migrações, API (8001) e agendador
docker compose run --rm api observatorio etl listar
docker compose run --rm api observatorio etl rodar territorios ana_estacoes   # primeira carga, nesta ordem
docker compose run --rm api observatorio etl rodar inpe_focos ana_hidroweb ibge_sidra prodes_desmatamento indicadores
```

Documentação interativa da API: http://localhost:8001/api/docs

Cargas históricas usam parâmetros `-p chave=valor`:

```bash
observatorio etl rodar inpe_focos -p inicio=2003-01-01      # anuais (sat. referência) + mensais
observatorio etl rodar ibge_sidra -p periodo=all
observatorio etl rodar chirps -p inicio=1981-01-01          # requer OBS_GEE_CHAVE_JSON
```

## Testes

```bash
docker compose up -d db
docker compose run --rm --no-deps \
  -e OBS_TEST_DATABASE_URL=postgresql+psycopg://observatorio:observatorio@db:5432/observatorio_teste \
  -v "$PWD/backend:/app" api pytest
```

Sem `OBS_TEST_DATABASE_URL` rodam só os testes unitários (leitores e cálculos); os de integração recriam o
banco `observatorio_teste` e simulam todas as fontes externas.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `observatorio/etl/base.py` | Execução com proveniência (`execucao_etl`), transação única por carga, novas tentativas, alerta de falha |
| `observatorio/etl/*.py` | Um módulo por fonte; `registro.py` lista os pipelines |
| `observatorio/indicadores/` | `calculo.py` (funções puras) e `pipeline.py` (anomalias, ano hidrológico, fogo por área, conversão de vegetação) |
| `observatorio/catalogo.py` | Definição dos conjuntos de dados (licença, fonte, método) e exportação DCAT |
| `observatorio/agendador.py` | Agenda cron (padrões em `config.py`, sobrescritos por `OBS_AGENDA`) |
| `observatorio/api/app.py` | API REST (FastAPI) |
| `migrations/` | Esquema do banco (Alembic) |
| `../deploy/k8s/` | Manifests para o cluster Kubernetes |

## Pipelines

| Pipeline | Fonte | Requisito |
| --- | --- | --- |
| `territorios` | TerraBrasilis/INPE (bioma, municípios, UCs) + GeoJSON de `OBS_TERRITORIOS_EXTRA` (sub-regiões, bacias) | — |
| `inpe_focos` | INPE BDQueimadas (dados abertos) | — |
| `firms_viirs` | NASA FIRMS, VIIRS 375 m | `OBS_FIRMS_MAP_KEY` |
| `ana_estacoes`, `ana_hidroweb` | ANA ServiceANA (inventário, série histórica, telemetria) | — |
| `chirps`, `era5`, `mapbiomas_cobertura`, `mapbiomas_fogo` | Google Earth Engine | `OBS_GEE_CHAVE_JSON` |
| `prodes_desmatamento` | TerraBrasilis/INPE | — |
| `ibge_sidra` | IBGE SIDRA (rebanho, população, PIB) | — |
| `indicadores` | séries já carregadas | — |

Pipelines sem credencial configurada são ignorados pelo agendador (com aviso no log), sem gerar alerta.
