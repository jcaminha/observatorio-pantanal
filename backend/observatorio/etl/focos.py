"""Carga e agregação de focos de calor, comum a INPE e FIRMS."""
from datetime import date
from typing import Any

from sqlalchemy import text

from .base import Contexto, em_lotes

SQL_INSERIR = text("""
    INSERT INTO foco_calor (conjunto_id, id_origem, data_hora, satelite, frp, confianca, risco_fogo,
        dias_sem_chuva, precipitacao, municipio_ibge, execucao_id, geom)
    VALUES (:conjunto, :id_origem, :data_hora, :satelite, :frp, :confianca, :risco_fogo,
        :dias_sem_chuva, :precipitacao, :municipio_ibge, :execucao,
        ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))
    ON CONFLICT (conjunto_id, id_origem) DO NOTHING
""")

CAMPOS_OPCIONAIS = ("frp", "confianca", "risco_fogo", "dias_sem_chuva", "precipitacao", "municipio_ibge")


def inserir_focos(ctx: Contexto, conjunto: str, focos: list[dict[str, Any]]) -> None:
    """Insere focos ignorando os já existentes e contabiliza os novos em ctx.carregados."""
    base = dict.fromkeys(CAMPOS_OPCIONAIS)
    conta = text("SELECT count(*) FROM foco_calor WHERE execucao_id = :e")
    antes = ctx.conn.execute(conta, {"e": ctx.execucao_id}).scalar_one()
    for lote in em_lotes(focos, 2000):
        ctx.conn.execute(
            SQL_INSERIR, [{**base, **f, "conjunto": conjunto, "execucao": ctx.execucao_id} for f in lote]
        )
    ctx.lidos += len(focos)
    ctx.carregados += ctx.conn.execute(conta, {"e": ctx.execucao_id}).scalar_one() - antes


def agregar_focos(
    ctx: Contexto, conjunto: str, variavel: str, inicio: date, fim: date, satelite: str | None = None
) -> None:
    """Recalcula a contagem diária (dia UTC) de focos por território no intervalo [inicio, fim]."""
    filtro = {"v": variavel, "a": inicio, "b": fim, "c": conjunto, "sat": satelite, "e": ctx.execucao_id}
    ctx.conn.execute(
        text("""DELETE FROM serie_territorial
                WHERE variavel = :v AND periodicidade = 'dia' AND data BETWEEN :a AND :b"""),
        filtro,
    )
    ctx.conn.execute(
        text("""
            INSERT INTO serie_territorial
                (territorio_id, conjunto_id, variavel, periodicidade, data, valor, unidade, execucao_id)
            SELECT t.id, :c, :v, 'dia', (f.data_hora AT TIME ZONE 'UTC')::date, count(*), 'focos', :e
            FROM foco_calor f
            JOIN territorio t ON ST_Intersects(t.geom, f.geom)
            WHERE f.conjunto_id = :c
              AND (CAST(:sat AS text) IS NULL OR f.satelite = :sat)
              AND (f.data_hora AT TIME ZONE 'UTC')::date BETWEEN :a AND :b
            GROUP BY 1, 5
        """),
        filtro,
    )
