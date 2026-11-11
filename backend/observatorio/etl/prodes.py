"""Desmatamento anual do PRODES Pantanal (TerraBrasilis/INPE), agregado por território."""
import json

from sqlalchemy import text

from .base import Contexto, FonteIndisponivel, Pipeline

CAMADA = "prodes-pantanal-nb:yearly_deforestation"
PAGINA = 2000


class ProdesDesmatamento(Pipeline):
    """Parâmetro opcional: forcar=1 recarrega mesmo sem novidade na fonte."""

    nome = "prodes_desmatamento"
    conjunto = "prodes-desmatamento"

    def executar(self, ctx: Contexto) -> None:
        wfs = {"service": "WFS", "version": "2.0.0", "request": "GetFeature", "typeNames": CAMADA}
        r = ctx.baixar(ctx.cfg.terrabrasilis_wfs, params={**wfs, "resultType": "hits"})
        achado = r.text.split('numberMatched="', 1)
        if len(achado) < 2:
            raise FonteIndisponivel(f"Resposta inesperada do WFS: {r.text[:200]!r}")
        total = int(achado[1].split('"', 1)[0])
        versao = f"{total} polígonos"
        anterior = ctx.conn.execute(
            text("SELECT versao_fonte FROM conjunto_dados WHERE id = :c"), {"c": self.conjunto}
        ).scalar()
        if anterior == versao and not ctx.params.get("forcar"):
            ctx.avisos.append("Fonte sem novidade; nada recarregado")
            ctx.versao_fonte = versao
            return

        ctx.bioma_id()
        ctx.conn.execute(text(
            "CREATE TEMP TABLE prodes_tmp (ano integer, geom geometry(Geometry, 4326)) ON COMMIT DROP"
        ))
        limite = int(ctx.params.get("limite", total))
        for inicio in range(0, min(total, limite), PAGINA):
            pagina = ctx.baixar(ctx.cfg.terrabrasilis_wfs, params={
                **wfs, "outputFormat": "application/json", "count": PAGINA, "startIndex": inicio, "sortBy": "fid",
            }).json()["features"]
            if not pagina:
                break
            ctx.conn.execute(
                text("""INSERT INTO prodes_tmp
                        VALUES (:ano, ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(:g), 4326)))"""),
                [{"ano": f["properties"]["year"], "g": json.dumps(f["geometry"])} for f in pagina],
            )
            ctx.lidos += len(pagina)
        ctx.conn.execute(text("CREATE INDEX ON prodes_tmp USING gist (geom)"))
        ctx.conn.execute(text("ANALYZE prodes_tmp"))

        ctx.conn.execute(text("DELETE FROM serie_territorial WHERE variavel = 'desmatamento_km2'"))
        ctx.carregados = ctx.conn.execute(text("""
            INSERT INTO serie_territorial
                (territorio_id, conjunto_id, variavel, periodicidade, data, valor, unidade, execucao_id)
            SELECT t.id, :c, 'desmatamento_km2', 'ano', make_date(p.ano, 1, 1),
                   sum(ST_Area(ST_Intersection(t.geom, p.geom)::geography)) / 1e6, 'km²', :e
            FROM prodes_tmp p JOIN territorio t ON ST_Intersects(t.geom, p.geom)
            GROUP BY t.id, p.ano
        """), {"c": self.conjunto, "e": ctx.execucao_id}).rowcount
        ctx.versao_fonte = versao if limite >= total else f"parcial ({ctx.lidos} de {total})"
