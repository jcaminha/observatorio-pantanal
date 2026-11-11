"""API REST do Observatório: os mesmos dados do painel, em JSON, GeoJSON ou CSV."""
import csv
import io
import json
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Any, Iterator, Literal

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, Response, StreamingResponse
from sqlalchemy import Connection, text

from .. import catalogo
from ..config import config
from ..db import motor

DESCRICAO = """
Acesso programático aos dados do **Observatório de Dados Públicos do Pantanal (INPP)**.

* Todos os recursos de dados aceitam `formato=csv` para download do que alimenta cada gráfico do painel.
* Recursos espaciais aceitam `formato=geojson`.
* A comparação com a média histórica está em `/indicadores` (`valor`, `referencia`, `anomalia`, `zscore`).
* O catálogo (`/catalogo`) segue DCAT em JSON-LD, com identificador persistente, licença, fonte e método
  de cada conjunto; `/execucoes` expõe a proveniência de cada carga.
"""

Formato = Literal["json", "csv"]
FormatoGeo = Literal["json", "csv", "geojson"]


def conexao() -> Iterator[Connection]:
    with motor().connect() as conn:
        yield conn


Conn = Annotated[Connection, Depends(conexao)]


def consultar(conn: Connection, sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    return [dict(l) for l in conn.execute(text(sql), params or {}).mappings()]


class Filtro:
    """Monta cláusulas WHERE só com os filtros informados (parâmetros sempre vinculados)."""

    def __init__(self) -> None:
        self.condicoes: list[str] = []
        self.params: dict[str, Any] = {}

    def se(self, valor: Any, condicao: str, nome: str) -> "Filtro":
        if valor is not None:
            self.condicoes.append(condicao)
            self.params[nome] = valor
        return self

    @property
    def where(self) -> str:
        return ("WHERE " + " AND ".join(self.condicoes)) if self.condicoes else ""


def _csv(linhas: list[dict[str, Any]], nome: str) -> Response:
    saida = io.StringIO()
    if linhas:
        escritor = csv.DictWriter(saida, fieldnames=list(linhas[0]))
        escritor.writeheader()
        for l in linhas:
            escritor.writerow({k: json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v
                               for k, v in l.items()})
    return Response(
        saida.getvalue(), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{nome}.csv"'},
    )


def _geojson(linhas: list[dict[str, Any]]) -> Response:
    feicoes = [
        {"type": "Feature", "geometry": json.loads(l.pop("geometria")), "properties": l}
        for l in linhas
    ]
    corpo = json.dumps({"type": "FeatureCollection", "features": feicoes}, default=str, ensure_ascii=False)
    return Response(corpo, media_type="application/geo+json")


def responder(linhas: list[dict[str, Any]], formato: str, nome: str) -> Any:
    if formato == "geojson":
        return _geojson(linhas)
    for l in linhas:
        l.pop("geometria", None)
    return _csv(linhas, nome) if formato == "csv" else linhas


v1 = APIRouter(prefix="/api/v1")


# --- Territórios ------------------------------------------------------------------------------

@v1.get("/territorios", tags=["Territórios"], summary="Recortes territoriais (filtros do painel)")
def territorios(
    conn: Conn,
    tipo: Annotated[Literal["bioma", "sub_regiao", "municipio", "uc", "bacia"] | None, Query()] = None,
    formato: FormatoGeo = "json",
    tolerancia: Annotated[float, Query(ge=0, le=0.1, description="Simplificação da geometria, em graus")] = 0.005,
):
    f = Filtro().se(tipo, "tipo = :tipo", "tipo")
    geom = ", ST_AsGeoJSON(ST_Multi(ST_SimplifyPreserveTopology(geom, :tol)), 5) AS geometria" if formato == "geojson" else ""
    if geom:
        f.params["tol"] = tolerancia
    return responder(consultar(conn, f"""
        SELECT id, tipo, codigo, nome, uf, pid, round(area_km2::numeric, 2)::float AS area_km2, atributos{geom}
        FROM territorio {f.where} ORDER BY tipo, nome
    """, f.params), formato, "territorios")


def _territorio(conn: Connection, territorio: int | None) -> int:
    """Território informado ou, por padrão, o bioma."""
    linha = conn.execute(
        text("SELECT id FROM territorio WHERE id = :t" if territorio else
             "SELECT id FROM territorio WHERE tipo = 'bioma' ORDER BY id LIMIT 1"),
        {"t": territorio} if territorio else {},
    ).first()
    if linha is None:
        raise HTTPException(404, "Território não encontrado")
    return linha[0]


# --- Queimadas --------------------------------------------------------------------------------

@v1.get("/focos", tags=["Queimadas"], summary="Focos de calor (pontos)")
def focos(
    conn: Conn,
    conjunto: Literal["inpe-focos", "firms-viirs"] = "inpe-focos",
    inicio: Annotated[date | None, Query(description="Padrão: 2 dias atrás (UTC)")] = None,
    fim: date | None = None,
    territorio: Annotated[int | None, Query(description="id do território; padrão: todo o bioma")] = None,
    satelite: str | None = None,
    bbox: Annotated[str | None, Query(description="oeste,sul,leste,norte", pattern=r"^-?[\d.]+(,-?[\d.]+){3}$")] = None,
    limite: Annotated[int, Query(ge=1, le=200_000)] = 20_000,
    formato: FormatoGeo = "json",
):
    hoje = datetime.now(UTC).date()
    inicio = inicio or hoje - timedelta(days=2)
    fim = fim or hoje
    meia_noite = datetime.min.time()
    f = Filtro().se(conjunto, "f.conjunto_id = :c", "c").se(satelite, "f.satelite = :sat", "sat")
    f.se(datetime.combine(inicio, meia_noite, UTC), "f.data_hora >= :a", "a")
    f.se(datetime.combine(fim + timedelta(days=1), meia_noite, UTC), "f.data_hora < :b", "b")
    if territorio:
        f.se(_territorio(conn, territorio),
             "ST_Intersects((SELECT geom FROM territorio WHERE id = :t), f.geom)", "t")
    if bbox:
        o, s, l, n = (float(x) for x in bbox.split(","))
        f.condicoes.append("f.geom && ST_MakeEnvelope(:o, :s, :l, :n, 4326)")
        f.params |= {"o": o, "s": s, "l": l, "n": n}
    f.params["lim"] = limite
    geom = ", ST_AsGeoJSON(f.geom, 5) AS geometria" if formato == "geojson" else ""
    return responder(consultar(conn, f"""
        SELECT f.id_origem AS id, f.data_hora, f.satelite, ST_Y(f.geom) AS lat, ST_X(f.geom) AS lon,
               f.frp, f.confianca, f.risco_fogo, f.dias_sem_chuva, f.precipitacao, f.municipio_ibge,
               f.conjunto_id AS conjunto{geom}
        FROM foco_calor f {f.where} ORDER BY f.data_hora DESC LIMIT :lim
    """, f.params), formato, "focos")


# --- Rios -------------------------------------------------------------------------------------

@v1.get("/estacoes", tags=["Rios"], summary="Estações fluviométricas com a última cota e sua anomalia")
def estacoes(conn: Conn, formato: FormatoGeo = "json"):
    geom = ", ST_AsGeoJSON(e.geom, 5) AS geometria" if formato == "geojson" else ""
    return responder(consultar(conn, f"""
        SELECT e.codigo, e.nome, e.rio, e.municipio, e.uf, ST_Y(e.geom) AS lat, ST_X(e.geom) AS lon,
               e.area_drenagem_km2, e.telemetrica, e.operadora,
               u.data AS ultima_data, u.valor AS ultima_cota_cm,
               u.valor - s.valor AS variacao_7d_cm,
               i.data AS mes_referencia, i.valor AS cota_media_mes_cm, i.referencia AS media_historica_cm,
               i.zscore, i.nivel_alerta{geom}
        FROM estacao e
        LEFT JOIN LATERAL (SELECT data, valor FROM observacao_estacao
                           WHERE estacao_codigo = e.codigo AND variavel = 'cota_cm'
                           ORDER BY data DESC LIMIT 1) u ON true
        LEFT JOIN LATERAL (SELECT valor FROM observacao_estacao
                           WHERE estacao_codigo = e.codigo AND variavel = 'cota_cm' AND data <= u.data - 7
                           ORDER BY data DESC LIMIT 1) s ON true
        LEFT JOIN LATERAL (SELECT data, valor, referencia, zscore, nivel_alerta FROM indicador
                           WHERE estacao_codigo = e.codigo AND indicador = 'anomalia_cota_cm'
                           ORDER BY data DESC LIMIT 1) i ON true
        ORDER BY e.rio, e.nome
    """), formato, "estacoes")


@v1.get("/estacoes/{codigo}/observacoes", tags=["Rios"], summary="Série diária de cota, vazão ou chuva")
def observacoes(
    conn: Conn,
    codigo: str,
    variavel: Literal["cota_cm", "vazao_m3s", "chuva_mm"] = "cota_cm",
    inicio: date | None = None,
    fim: date | None = None,
    formato: Formato = "json",
):
    f = Filtro().se(codigo, "estacao_codigo = :c", "c").se(variavel, "variavel = :v", "v")
    f.se(inicio, "data >= :a", "a").se(fim, "data <= :b", "b")
    return responder(consultar(conn, f"""
        SELECT estacao_codigo AS estacao, variavel, data, valor,
               CASE consistencia WHEN 2 THEN 'consistido' WHEN 1 THEN 'bruto' ELSE 'telemetria' END AS consistencia
        FROM observacao_estacao {f.where} ORDER BY data
    """, f.params), formato, f"{codigo}_{variavel}")


# --- Séries territoriais ----------------------------------------------------------------------

@v1.get("/series/variaveis", tags=["Séries"], summary="Variáveis disponíveis e seu período")
def variaveis(conn: Conn):
    return consultar(conn, """
        SELECT variavel, periodicidade, conjunto_id AS conjunto, min(unidade) AS unidade,
               min(data) AS inicio, max(data) AS fim, count(DISTINCT territorio_id) AS territorios
        FROM serie_territorial GROUP BY 1, 2, 3 ORDER BY 1, 2
    """)


@v1.get("/series", tags=["Séries"], summary="Série temporal de uma variável em um território")
def series(
    conn: Conn,
    variavel: Annotated[str, Query(description="Ver /series/variaveis (ex.: chuva_mm, focos, cobertura_ha)")],
    territorio: Annotated[int | None, Query(description="id do território; padrão: bioma")] = None,
    categoria: Annotated[str | None, Query(description="Classe MapBiomas, para cobertura_ha")] = None,
    agregacao: Annotated[
        Literal["original", "mes", "ano"],
        Query(description="Reagrupa a série: soma para acumulados (chuva, focos, áreas), média para os demais"),
    ] = "original",
    inicio: date | None = None,
    fim: date | None = None,
    formato: Formato = "json",
):
    f = Filtro().se(_territorio(conn, territorio), "s.territorio_id = :t", "t").se(variavel, "s.variavel = :v", "v")
    f.se(categoria, "s.categoria = :cat", "cat").se(inicio, "s.data >= :a", "a").se(fim, "s.data <= :b", "b")
    if agregacao == "original":
        sql = f"""
            SELECT s.data, s.valor, s.unidade, s.categoria, s.periodicidade, s.variavel,
                   t.codigo AS territorio, s.conjunto_id AS conjunto
            FROM serie_territorial s JOIN territorio t ON t.id = s.territorio_id
            {f.where} ORDER BY s.data, s.categoria
        """
    else:
        campo = "month" if agregacao == "mes" else "year"
        sql = f"""
            SELECT date_trunc('{campo}', s.data)::date AS data,
                   CASE WHEN s.variavel ~ '^(temp_|umidade_)' THEN avg(s.valor) ELSE sum(s.valor) END AS valor,
                   min(s.unidade) AS unidade, s.categoria, '{agregacao}' AS periodicidade, s.variavel,
                   t.codigo AS territorio, min(s.conjunto_id) AS conjunto, count(*) AS n_registros
            FROM serie_territorial s JOIN territorio t ON t.id = s.territorio_id
            {f.where} GROUP BY 1, s.categoria, s.variavel, t.codigo ORDER BY 1, s.categoria
        """
    return responder(consultar(conn, sql, f.params), formato, variavel)


# --- Indicadores e alertas --------------------------------------------------------------------

SQL_INDICADOR = """
    SELECT i.indicador, i.periodicidade, i.data, i.valor, i.referencia, i.anomalia, i.anomalia_pct, i.zscore,
           i.nivel_alerta, i.unidade, i.detalhes, t.tipo AS territorio_tipo, t.codigo AS territorio_codigo,
           t.nome AS territorio_nome, i.territorio_id, i.estacao_codigo, e.nome AS estacao_nome
    FROM indicador i
    LEFT JOIN territorio t ON t.id = i.territorio_id
    LEFT JOIN estacao e ON e.codigo = i.estacao_codigo
"""


@v1.get("/indicadores/tipos", tags=["Indicadores"], summary="Indicadores disponíveis")
def tipos_indicador(conn: Conn):
    return consultar(conn, """
        SELECT indicador, periodicidade, min(unidade) AS unidade, min(data) AS inicio, max(data) AS fim
        FROM indicador GROUP BY 1, 2 ORDER BY 1
    """)


@v1.get("/indicadores", tags=["Indicadores"],
        summary="Indicador com valor observado, média histórica (referência) e anomalia")
def indicadores(
    conn: Conn,
    indicador: Annotated[str, Query(description="Ver /indicadores/tipos (ex.: anomalia_chuva_mm)")],
    territorio: Annotated[int | None, Query(description="id do território; padrão: bioma")] = None,
    estacao: Annotated[str | None, Query(description="Código da estação (indicadores de rios)")] = None,
    inicio: date | None = None,
    fim: date | None = None,
    formato: Formato = "json",
):
    f = Filtro().se(indicador, "i.indicador = :i", "i").se(inicio, "i.data >= :a", "a").se(fim, "i.data <= :b", "b")
    if estacao:
        f.se(estacao, "i.estacao_codigo = :e", "e")
    else:
        f.se(_territorio(conn, territorio), "i.territorio_id = :t", "t")
    return responder(consultar(conn, f"{SQL_INDICADOR} {f.where} ORDER BY i.data", f.params), formato, indicador)


@v1.get("/alertas", tags=["Indicadores"], summary="Situações fora do padrão histórico no período mais recente")
def alertas(
    conn: Conn,
    nivel_minimo: Literal["atencao", "alerta", "critico"] = "atencao",
    tipo_territorio: Literal["bioma", "sub_regiao", "municipio", "uc", "bacia"] | None = None,
    formato: Formato = "json",
):
    niveis = ["atencao", "alerta", "critico"]
    f = Filtro().se(niveis[niveis.index(nivel_minimo):], "u.nivel_alerta = ANY(:niveis)", "niveis")
    f.se(tipo_territorio, "u.territorio_tipo = :tipo", "tipo")
    return responder(consultar(conn, f"""
        SELECT * FROM (
            SELECT DISTINCT ON (x.indicador, x.territorio_id, x.estacao_codigo) x.*
            FROM ({SQL_INDICADOR}) x
            ORDER BY x.indicador, x.territorio_id, x.estacao_codigo, x.data DESC
        ) u {f.where}
        ORDER BY array_position(ARRAY['critico', 'alerta', 'atencao'], u.nivel_alerta), u.data DESC
    """, f.params), formato, "alertas")


# --- Catálogo FAIR e proveniência --------------------------------------------------------------

@v1.get("/catalogo", tags=["Catálogo"], summary="Catálogo de metadados (DCAT, JSON-LD)")
def catalogo_dcat(conn: Conn):
    cfg = config()
    linhas = consultar(conn, "SELECT * FROM conjunto_dados ORDER BY id")
    return JSONResponse({
        "@context": catalogo.CONTEXTO_DCAT,
        "@id": f"{cfg.pid_base}/catalogo",
        "@type": "dcat:Catalog",
        "dct:title": "Observatório de Dados Públicos do Pantanal",
        "dct:publisher": {"@type": "foaf:Organization", "foaf:name": "Instituto Nacional de Pesquisa do Pantanal (INPP)"},
        "dct:language": "pt-BR",
        "dcat:dataset": [catalogo.dcat_dataset(l, cfg) for l in linhas],
    }, media_type="application/ld+json")


def _conjunto(conn: Connection, id: str) -> dict[str, Any]:
    linhas = consultar(conn, "SELECT * FROM conjunto_dados WHERE id = :id", {"id": id})
    if not linhas:
        raise HTTPException(404, "Conjunto de dados não encontrado")
    return linhas[0]


@v1.get("/catalogo/{id}", tags=["Catálogo"], summary="Metadados de um conjunto de dados")
def conjunto(conn: Conn, id: str):
    ds = catalogo.dcat_dataset(_conjunto(conn, id), config())
    return JSONResponse({"@context": catalogo.CONTEXTO_DCAT, **ds}, media_type="application/ld+json")


DADOS_POR_CONJUNTO = {
    "inpe-focos": "focos", "firms-viirs": "focos", "ana-hidroweb": "observacoes",
    "territorios": "territorios", "indicadores": "indicadores",
}
SQL_DADOS = {
    "focos": """SELECT id_origem AS id, data_hora, satelite, ST_Y(geom) AS lat, ST_X(geom) AS lon, frp,
                       confianca, risco_fogo, dias_sem_chuva, precipitacao, municipio_ibge, execucao_id
                FROM foco_calor WHERE conjunto_id = :id ORDER BY data_hora""",
    "observacoes": """SELECT estacao_codigo AS estacao, variavel, data, valor, consistencia, execucao_id
                      FROM observacao_estacao ORDER BY estacao_codigo, variavel, data""",
    "territorios": """SELECT tipo, codigo, nome, uf, pid, area_km2, fonte, ST_AsText(geom, 5) AS wkt
                      FROM territorio ORDER BY tipo, codigo""",
    "indicadores": """SELECT i.indicador, t.tipo AS territorio_tipo, t.codigo AS territorio_codigo,
                             i.estacao_codigo, i.periodicidade, i.data, i.valor, i.referencia, i.anomalia,
                             i.anomalia_pct, i.zscore, i.nivel_alerta, i.unidade, i.execucao_id
                      FROM indicador i LEFT JOIN territorio t ON t.id = i.territorio_id
                      ORDER BY i.indicador, i.data""",
    "series": """SELECT t.tipo AS territorio_tipo, t.codigo AS territorio_codigo, s.variavel, s.categoria,
                        s.periodicidade, s.data, s.valor, s.unidade, s.execucao_id
                 FROM serie_territorial s JOIN territorio t ON t.id = s.territorio_id
                 WHERE s.conjunto_id = :id ORDER BY s.variavel, t.tipo, t.codigo, s.data""",
}


@v1.get("/catalogo/{id}/dados", tags=["Catálogo"],
        summary="Download integral do conjunto de dados (cada linha traz o id da execução que a carregou)")
def dados_conjunto(conn: Conn, id: str, formato: Formato = "csv"):
    _conjunto(conn, id)
    sql = text(SQL_DADOS[DADOS_POR_CONJUNTO.get(id, "series")])

    def linhas() -> Iterator[str]:
        # Conexão própria: a da dependência é fechada antes de o corpo ser transmitido.
        with motor().connect() as c:
            resultado = c.execution_options(stream_results=True).execute(sql, {"id": id})
            colunas = list(resultado.keys())
            saida = io.StringIO()
            escritor = csv.writer(saida)
            if formato == "csv":
                escritor.writerow(colunas)
            primeiro = True
            for parte in resultado.partitions(2000):
                for linha in parte:
                    if formato == "csv":
                        escritor.writerow(linha)
                    else:
                        saida.write(("[" if primeiro else ",") + json.dumps(dict(zip(colunas, linha)), default=str))
                        primeiro = False
                yield saida.getvalue()
                saida.seek(0)
                saida.truncate()
            if formato == "json":
                yield "[]" if primeiro else "]"

    midia = "text/csv; charset=utf-8" if formato == "csv" else "application/json"
    return StreamingResponse(linhas(), media_type=midia, headers={
        "Content-Disposition": f'attachment; filename="{id}.{formato}"'})


@v1.get("/execucoes", tags=["Catálogo"], summary="Proveniência: histórico de execuções dos pipelines")
def execucoes(
    conn: Conn,
    pipeline: str | None = None,
    conjunto: str | None = None,
    status: Literal["em_execucao", "sucesso", "falha"] | None = None,
    limite: Annotated[int, Query(ge=1, le=1000)] = 100,
):
    f = Filtro().se(pipeline, "pipeline = :p", "p").se(conjunto, "conjunto_id = :c", "c").se(status, "status = :s", "s")
    f.params["lim"] = limite
    return consultar(conn, f"""
        SELECT id, pipeline, conjunto_id AS conjunto, status, iniciado_em, finalizado_em, parametros, origens,
               versao_fonte, versao_codigo, registros_lidos, registros_carregados, erro
        FROM execucao_etl {f.where} ORDER BY id DESC LIMIT :lim
    """, f.params)


@v1.get("/execucoes/{id}", tags=["Catálogo"], summary="Uma execução (referenciada por execucao_id nos dados)")
def execucao(conn: Conn, id: int):
    linhas = consultar(conn, "SELECT * FROM execucao_etl WHERE id = :id", {"id": id})
    if not linhas:
        raise HTTPException(404, "Execução não encontrada")
    return linhas[0]


# --- Aplicação --------------------------------------------------------------------------------

app = FastAPI(
    title="Observatório do Pantanal — API", version="1", description=DESCRICAO,
    docs_url="/api/docs", redoc_url="/api/redoc", openapi_url="/api/openapi.json",
)
app.add_middleware(GZipMiddleware, minimum_size=2000)
app.add_middleware(CORSMiddleware, allow_origins=config().cors_origens, allow_methods=["GET"])
app.include_router(v1)


@app.get("/saude", tags=["Operação"], summary="Verificação de saúde (inclui o banco)")
def saude(conn: Conn):
    conn.execute(text("SELECT 1"))
    return {"status": "ok"}


@app.get("/id/conjunto/{id}", tags=["Identificadores persistentes"], summary="Resolve o PID de um conjunto")
def resolver_conjunto(id: str):
    return RedirectResponse(f"/api/v1/catalogo/{id}", status_code=303)


@app.get("/id/territorio/{tipo}/{codigo}", tags=["Identificadores persistentes"],
         summary="Resolve o PID de um território")
def resolver_territorio(conn: Conn, tipo: str, codigo: str):
    linhas = consultar(conn, """
        SELECT id, tipo, codigo, nome, uf, pid, area_km2, atributos, fonte, atualizado_em,
               ST_AsGeoJSON(geom, 5) AS geometria
        FROM territorio WHERE tipo = :t AND codigo = :c
    """, {"t": tipo, "c": codigo})
    if not linhas:
        raise HTTPException(404, "Território não encontrado")
    l = linhas[0]
    return JSONResponse(json.loads(json.dumps(
        {"type": "Feature", "geometry": json.loads(l.pop("geometria")), "properties": l}, default=str
    )), media_type="application/geo+json")
