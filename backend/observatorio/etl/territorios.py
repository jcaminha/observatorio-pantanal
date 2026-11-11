"""Recortes territoriais: bioma, municípios e UCs (TerraBrasilis/INPE) e recortes extras em GeoJSON."""
import json
import re
import unicodedata
from pathlib import Path
from typing import Any

from sqlalchemy import text

from .base import Contexto, Pipeline

UF_POR_CODIGO = {"50": "MS", "51": "MT"}


def slug(valor: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", valor).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", sem_acento.lower()).strip("-")


def _bioma(p: dict[str, Any]) -> dict[str, Any]:
    return {"codigo": slug(p["bioma"]), "nome": p["bioma"], "uf": None, "atributos": {"cd_bioma": p.get("cd_bioma")}}


def _municipio(p: dict[str, Any]) -> dict[str, Any]:
    codigo = str(p["geocodigo"])
    return {"codigo": codigo, "nome": p["nome"], "uf": UF_POR_CODIGO.get(codigo[:2]), "atributos": {}}


def _uc(p: dict[str, Any]) -> dict[str, Any]:
    nome = re.sub(r"\s+", " ", p["nome"]).strip().title()
    return {
        "codigo": f"tb-{p['id']}", "nome": nome, "uf": None,
        "atributos": {k: p.get(k) for k in ("categoria", "grupo", "esfera", "ano_cria")},
    }


CAMADAS_WFS = [
    ("bioma", "prodes-pantanal-nb:biome_border", _bioma),
    ("municipio", "prodes-pantanal-nb:municipalities_pantanal_biome", _municipio),
    ("uc", "prodes-pantanal-nb:conservation_units_pantanal_biome", _uc),
]

SQL_UPSERT = text("""
    INSERT INTO territorio (tipo, codigo, nome, uf, pid, area_km2, atributos, fonte, geom)
    SELECT :tipo, :codigo, :nome, :uf, :pid, ST_Area(g::geography) / 1e6, CAST(:atributos AS jsonb), :fonte, g
    FROM (
        SELECT ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326)), 3)) AS g
    ) AS x
    ON CONFLICT (tipo, codigo) DO UPDATE SET
        nome = excluded.nome, uf = excluded.uf, area_km2 = excluded.area_km2,
        atributos = excluded.atributos, fonte = excluded.fonte, geom = excluded.geom, atualizado_em = now()
""")


class Territorios(Pipeline):
    nome = "territorios"
    conjunto = "territorios"

    def executar(self, ctx: Contexto) -> None:
        for tipo, camada, mapear in CAMADAS_WFS:
            r = ctx.baixar(ctx.cfg.terrabrasilis_wfs, params={
                "service": "WFS", "version": "2.0.0", "request": "GetFeature",
                "typeNames": camada, "outputFormat": "application/json",
            })
            feicoes = r.json()["features"]
            if not feicoes:
                raise RuntimeError(f"Camada {camada} veio vazia")
            self._gravar(ctx, tipo, [(mapear(f["properties"]), f["geometry"]) for f in feicoes], camada)

        for extra in ctx.cfg.territorios_extra:
            origem = extra["origem"]
            if origem.startswith(("http://", "https://")):
                dados = ctx.baixar(origem).json()
            else:
                dados = json.loads(Path(origem).read_text(encoding="utf-8"))
                ctx.origens.append(origem)
            itens = []
            for f in dados["features"]:
                p = f["properties"]
                nome = str(p[extra["campo_nome"]])
                codigo = slug(str(p[extra.get("campo_codigo", extra["campo_nome"])]))
                itens.append(({"codigo": codigo, "nome": nome, "uf": p.get("uf"), "atributos": {}}, f["geometry"]))
            self._gravar(ctx, extra["tipo"], itens, origem)

        ctx.versao_fonte = f"{ctx.carregados} feições"

    def _gravar(self, ctx: Contexto, tipo: str, itens: list[tuple[dict[str, Any], dict]], fonte: str) -> None:
        for dados, geometria in itens:
            ctx.conn.execute(SQL_UPSERT, {
                **dados, "tipo": tipo, "fonte": fonte,
                "pid": f"{ctx.cfg.pid_base}/territorio/{tipo}/{dados['codigo']}",
                "atributos": json.dumps(dados["atributos"]), "geojson": json.dumps(geometria),
            })
        ctx.lidos += len(itens)
        ctx.carregados += len(itens)
