"""Esquema inicial: territórios, catálogo, proveniência, observações e indicadores."""
from alembic import op

revision = "0001"
down_revision = None

ESQUEMA = """
CREATE EXTENSION IF NOT EXISTS postgis;

-- Recortes territoriais usados em todas as séries.
CREATE TABLE territorio (
    id            serial PRIMARY KEY,
    tipo          text NOT NULL CHECK (tipo IN ('bioma', 'sub_regiao', 'municipio', 'uc', 'bacia')),
    codigo        text NOT NULL,
    nome          text NOT NULL,
    uf            text,
    pid           text NOT NULL UNIQUE,
    area_km2      double precision NOT NULL,
    atributos     jsonb NOT NULL DEFAULT '{}',
    fonte         text NOT NULL,
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    geom          geometry(MultiPolygon, 4326) NOT NULL,
    UNIQUE (tipo, codigo)
);
CREATE INDEX territorio_geom_idx ON territorio USING gist (geom);

-- Catálogo de metadados FAIR: um registro por conjunto de dados.
CREATE TABLE conjunto_dados (
    id                  text PRIMARY KEY,
    pid                 text NOT NULL UNIQUE,
    titulo              text NOT NULL,
    descricao           text NOT NULL,
    orgao               text NOT NULL,
    url_fonte           text NOT NULL,
    licenca             text NOT NULL,
    url_licenca         text,
    metodo              text NOT NULL,
    resolucao_espacial  text,
    resolucao_temporal  text,
    cobertura_inicio    date,
    frequencia          text,
    variaveis           jsonb NOT NULL DEFAULT '[]',
    palavras_chave      jsonb NOT NULL DEFAULT '[]',
    versao_fonte        text,
    atualizado_em       timestamptz
);

-- Proveniência: toda execução de pipeline fica registrada, com sucesso ou falha.
CREATE TABLE execucao_etl (
    id                   bigserial PRIMARY KEY,
    pipeline             text NOT NULL,
    conjunto_id          text REFERENCES conjunto_dados (id),
    status               text NOT NULL CHECK (status IN ('em_execucao', 'sucesso', 'falha')),
    iniciado_em          timestamptz NOT NULL DEFAULT now(),
    finalizado_em        timestamptz,
    parametros           jsonb NOT NULL DEFAULT '{}',
    origens              jsonb NOT NULL DEFAULT '[]',
    versao_fonte         text,
    versao_codigo        text,
    registros_lidos      integer,
    registros_carregados integer,
    erro                 text
);
CREATE INDEX execucao_etl_pipeline_idx ON execucao_etl (pipeline, iniciado_em DESC);

CREATE TABLE foco_calor (
    id              bigserial PRIMARY KEY,
    conjunto_id     text NOT NULL REFERENCES conjunto_dados (id),
    id_origem       text NOT NULL,
    data_hora       timestamptz NOT NULL,
    satelite        text NOT NULL,
    frp             double precision,
    confianca       text,
    risco_fogo      double precision,
    dias_sem_chuva  double precision,
    precipitacao    double precision,
    municipio_ibge  text,
    execucao_id     bigint NOT NULL REFERENCES execucao_etl (id),
    geom            geometry(Point, 4326) NOT NULL,
    UNIQUE (conjunto_id, id_origem)
);
CREATE INDEX foco_calor_geom_idx ON foco_calor USING gist (geom);
CREATE INDEX foco_calor_data_idx ON foco_calor (conjunto_id, data_hora);

CREATE TABLE estacao (
    codigo            text PRIMARY KEY,
    nome              text NOT NULL,
    rio               text,
    municipio         text,
    uf                text,
    sub_bacia         text,
    area_drenagem_km2 double precision,
    altitude_m        double precision,
    telemetrica       boolean NOT NULL DEFAULT false,
    operadora         text,
    execucao_id       bigint NOT NULL REFERENCES execucao_etl (id),
    geom              geometry(Point, 4326) NOT NULL
);
CREATE INDEX estacao_geom_idx ON estacao USING gist (geom);

-- consistencia: 0 = telemetria (tempo quase real), 1 = bruto, 2 = consistido (ANA).
CREATE TABLE observacao_estacao (
    estacao_codigo text NOT NULL REFERENCES estacao (codigo) ON DELETE CASCADE,
    variavel       text NOT NULL CHECK (variavel IN ('cota_cm', 'vazao_m3s', 'chuva_mm')),
    data           date NOT NULL,
    valor          double precision NOT NULL,
    consistencia   smallint NOT NULL,
    execucao_id    bigint NOT NULL REFERENCES execucao_etl (id),
    PRIMARY KEY (estacao_codigo, variavel, data)
);

-- Séries agregadas por território (estatísticas zonais, contagens, dados tabulares).
CREATE TABLE serie_territorial (
    territorio_id  integer NOT NULL REFERENCES territorio (id) ON DELETE CASCADE,
    conjunto_id    text NOT NULL REFERENCES conjunto_dados (id),
    variavel       text NOT NULL,
    categoria      text NOT NULL DEFAULT '',
    periodicidade  text NOT NULL CHECK (periodicidade IN ('dia', 'mes', 'ano')),
    data           date NOT NULL,
    valor          double precision NOT NULL,
    unidade        text NOT NULL,
    execucao_id    bigint NOT NULL REFERENCES execucao_etl (id),
    PRIMARY KEY (territorio_id, variavel, categoria, periodicidade, data)
);
CREATE INDEX serie_territorial_var_idx ON serie_territorial (variavel, periodicidade, data);

-- Indicadores derivados e sinais de alerta (recalculados integralmente a cada execução).
CREATE TABLE indicador (
    id             bigserial PRIMARY KEY,
    indicador      text NOT NULL,
    territorio_id  integer REFERENCES territorio (id) ON DELETE CASCADE,
    estacao_codigo text REFERENCES estacao (codigo) ON DELETE CASCADE,
    periodicidade  text NOT NULL,
    data           date NOT NULL,
    valor          double precision NOT NULL,
    referencia     double precision,
    anomalia       double precision,
    anomalia_pct   double precision,
    zscore         double precision,
    nivel_alerta   text NOT NULL DEFAULT 'normal'
                   CHECK (nivel_alerta IN ('normal', 'atencao', 'alerta', 'critico')),
    unidade        text NOT NULL,
    detalhes       jsonb NOT NULL DEFAULT '{}',
    execucao_id    bigint NOT NULL REFERENCES execucao_etl (id),
    CHECK (territorio_id IS NOT NULL OR estacao_codigo IS NOT NULL)
);
CREATE INDEX indicador_busca_idx ON indicador (indicador, territorio_id, estacao_codigo, data);
CREATE INDEX indicador_alerta_idx ON indicador (nivel_alerta, data DESC) WHERE nivel_alerta <> 'normal';
"""


def upgrade() -> None:
    op.execute(ESQUEMA)


def downgrade() -> None:
    op.execute(
        "DROP TABLE indicador, serie_territorial, observacao_estacao, estacao, "
        "foco_calor, execucao_etl, conjunto_dados, territorio"
    )
