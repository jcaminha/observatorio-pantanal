"""Pipelines pré-processados no Google Earth Engine: CHIRPS, ERA5 e MapBiomas (cobertura e fogo).

Toda a redução espacial acontece no GEE; aqui só trafegam tabelas (território × data × valor).
O acesso usa conta de serviço (OBS_GEE_CHAVE_JSON). As funções `*_para_linhas` são puras e
testadas com respostas simuladas; as chamadas ao GEE ficam isoladas em `ClienteGee`.
"""
import json
import math
import re
from datetime import date, timedelta
from typing import Any

from sqlalchemy import text

from ..config import Config
from .base import Contexto, Pipeline, gravar_series, para_data, ultima_data

MAX_ELEMENTOS = 4500  # o GEE aborta getInfo() de coleções com mais de 5000 elementos


class ClienteGee:
    def __init__(self, cfg: Config) -> None:
        import ee  # importação tardia: dependência opcional (extra "gee")

        chave = json.loads(open(cfg.gee_chave_json, encoding="utf-8").read())
        credenciais = ee.ServiceAccountCredentials(chave["client_email"], key_data=json.dumps(chave))
        ee.Initialize(credenciais, project=cfg.gee_projeto or chave.get("project_id"))
        self.ee = ee

    def _colecao(self, territorios: list[dict[str, Any]]):
        ee = self.ee
        return ee.FeatureCollection([ee.Feature(ee.Geometry(t["geojson"]), {"tid": t["id"]}) for t in territorios])

    def medias_diarias(
        self, colecao: str, bandas: list[str], inicio: date, fim_exclusivo: date,
        territorios: list[dict[str, Any]], escala: float,
    ) -> list[dict[str, Any]]:
        """Média zonal de cada imagem diária: [{'tid', 'data', <banda>: valor, ...}]."""
        ee = self.ee
        fc = self._colecao(territorios)
        # Com uma única banda o redutor nomeia a saída como "mean"; com várias, usa o nome da banda.
        saidas = ["mean"] if len(bandas) == 1 else bandas

        def por_imagem(img):
            dia = img.date().format("YYYY-MM-dd")
            zonas = img.select(bandas).reduceRegions(collection=fc, reducer=ee.Reducer.mean(), scale=escala)
            return zonas.map(lambda f: f.select(["tid", *saidas], None, False).set("data", dia))

        tabela = ee.ImageCollection(colecao).filterDate(inicio.isoformat(), fim_exclusivo.isoformat()).map(por_imagem)
        linhas = []
        for f in tabela.flatten().getInfo()["features"]:
            p = f["properties"]
            if len(bandas) == 1:
                p[bandas[0]] = p.pop("mean", None)
            linhas.append(p)
        return linhas

    def bandas(self, imagem: str) -> list[str]:
        return self.ee.Image(imagem).bandNames().getInfo()

    def area_por_valor(self, imagem: str, banda: str, territorios: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Área (ha) por valor de pixel da banda: [{'tid', 'grupos': [{'valor', 'ha'}]}]."""
        ee = self.ee
        img = ee.Image.pixelArea().divide(10_000).addBands(ee.Image(imagem).select(banda))
        zonas = img.reduceRegions(
            collection=self._colecao(territorios),
            reducer=ee.Reducer.sum().group(groupField=1, groupName="valor"),
            scale=30, tileScale=8,
        )
        return [
            {"tid": f["properties"]["tid"],
             "grupos": [{"valor": g["valor"], "ha": g["sum"]} for g in f["properties"].get("groups", [])]}
            for f in zonas.select(["tid", "groups"], None, False).getInfo()["features"]
        ]

    def ultima_imagem(self, colecao: str) -> date:
        ee = self.ee
        ms = ee.ImageCollection(colecao).limit(1, "system:time_start", False).first().date().millis().getInfo()
        return date.fromtimestamp(ms / 1000)


def umidade_relativa(temp_c: float, orvalho_c: float) -> float:
    """Umidade relativa (%) pela fórmula de Magnus a partir de temperatura e ponto de orvalho (°C)."""
    def e(t: float) -> float:
        return math.exp(17.625 * t / (243.04 + t))
    return max(0.0, min(100.0, 100.0 * e(orvalho_c) / e(temp_c)))


def chirps_para_linhas(bruto: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {"territorio_id": p["tid"], "variavel": "chuva_mm", "periodicidade": "dia",
         "data": date.fromisoformat(p["data"]), "valor": round(p["precipitation"], 3), "unidade": "mm"}
        for p in bruto if p.get("precipitation") is not None
    ]


def era5_para_linhas(bruto: list[dict[str, Any]]) -> list[dict[str, Any]]:
    linhas = []
    for p in bruto:
        t, td, tmax = (p.get(b) for b in ERA5_BANDAS)
        if t is None:
            continue
        comum = {"territorio_id": p["tid"], "periodicidade": "dia", "data": date.fromisoformat(p["data"])}
        linhas.append({**comum, "variavel": "temp_media_c", "valor": round(t - 273.15, 2), "unidade": "°C"})
        if tmax is not None:
            linhas.append({**comum, "variavel": "temp_max_c", "valor": round(tmax - 273.15, 2), "unidade": "°C"})
        if td is not None:
            ur = umidade_relativa(t - 273.15, td - 273.15)
            linhas.append({**comum, "variavel": "umidade_relativa_pct", "valor": round(ur, 1), "unidade": "%"})
    return linhas


def areas_para_linhas(
    bruto: list[dict[str, Any]], ano: int, variavel: str, mensal: bool
) -> list[dict[str, Any]]:
    """Cobertura: categoria = classe MapBiomas, série anual. Fogo: valor do pixel = mês, série mensal."""
    linhas = []
    for zona in bruto:
        for g in zona["grupos"]:
            valor = int(g["valor"])
            if valor == 0 or (mensal and not 1 <= valor <= 12):
                continue
            linhas.append({
                "territorio_id": zona["tid"], "variavel": variavel, "unidade": "ha", "valor": round(g["ha"], 2),
                "periodicidade": "mes" if mensal else "ano",
                "data": date(ano, valor, 1) if mensal else date(ano, 1, 1),
                "categoria": "" if mensal else str(valor),
            })
    return linhas


ERA5_BANDAS = ["temperature_2m", "dewpoint_temperature_2m", "temperature_2m_max"]


def _territorios(ctx: Contexto) -> list[dict[str, Any]]:
    linhas = ctx.conn.execute(text("""
        SELECT id, ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.002), 5) AS g FROM territorio ORDER BY id
    """)).all()
    if not linhas:
        raise RuntimeError("Territórios não carregados: execute o pipeline 'territorios' primeiro")
    return [{"id": i, "geojson": json.loads(g)} for i, g in linhas]


class _PipelineGee(Pipeline):
    def indisponivel(self, cfg: Config) -> str | None:
        return None if cfg.gee_chave_json else "OBS_GEE_CHAVE_JSON não configurada"

    def cliente(self, ctx: Contexto) -> ClienteGee:
        # Testes injetam um cliente simulado em params["_gee"].
        return ctx.params.get("_gee") or ClienteGee(ctx.cfg)


class _SerieDiariaGee(_PipelineGee):
    """Parâmetros opcionais: inicio, fim (AAAA-MM-DD). Sem parâmetros, continua do último dia carregado."""

    variavel_controle: str
    inicio_padrao: date
    escala: float

    def colecao(self, cfg: Config) -> str:
        raise NotImplementedError

    def bandas(self) -> list[str]:
        raise NotImplementedError

    def converter(self, bruto: list[dict[str, Any]]) -> list[dict[str, Any]]:
        raise NotImplementedError

    def executar(self, ctx: Contexto) -> None:
        gee = self.cliente(ctx)
        colecao = self.colecao(ctx.cfg)
        territorios = _territorios(ctx)
        disponivel = gee.ultima_imagem(colecao)
        fim = min(para_data(ctx.params.get("fim")) or disponivel, disponivel)
        inicio = para_data(ctx.params.get("inicio"))
        if inicio is None:
            ultimo = ultima_data(ctx, self.variavel_controle, "dia")
            inicio = ultimo + timedelta(days=1) if ultimo else self.inicio_padrao

        passo = max(1, MAX_ELEMENTOS // len(territorios))
        while inicio <= fim:
            proximo = min(inicio + timedelta(days=passo), fim + timedelta(days=1))
            bruto = gee.medias_diarias(colecao, self.bandas(), inicio, proximo, territorios, self.escala)
            ctx.lidos += len(bruto)
            gravar_series(ctx, self.conjunto, self.converter(bruto))
            inicio = proximo
        ctx.origens.append(f"earthengine://{colecao}")
        ctx.versao_fonte = f"{colecao} até {disponivel.isoformat()}"


class Chirps(_SerieDiariaGee):
    nome = "chirps"
    conjunto = "chirps"
    variavel_controle = "chuva_mm"
    inicio_padrao = date(1981, 1, 1)
    escala = 5566

    def colecao(self, cfg: Config) -> str:
        return cfg.gee_chirps

    def bandas(self) -> list[str]:
        return ["precipitation"]

    def converter(self, bruto):
        return chirps_para_linhas(bruto)


class Era5(_SerieDiariaGee):
    nome = "era5"
    conjunto = "era5"
    variavel_controle = "temp_media_c"
    inicio_padrao = date(1981, 1, 1)
    escala = 11132

    def colecao(self, cfg: Config) -> str:
        return cfg.gee_era5

    def bandas(self) -> list[str]:
        return ERA5_BANDAS

    def converter(self, bruto):
        return era5_para_linhas(bruto)


class _AreasMapbiomas(_PipelineGee):
    """Parâmetro opcional: anos (separados por vírgula). Sem parâmetro, carrega os anos ainda ausentes."""

    variavel: str
    mensal: bool

    def imagem(self, cfg: Config) -> str:
        raise NotImplementedError

    def executar(self, ctx: Contexto) -> None:
        gee = self.cliente(ctx)
        imagem = self.imagem(ctx.cfg)
        territorios = _territorios(ctx)
        bandas = {int(m.group(1)): b for b in gee.bandas(imagem) if (m := re.search(r"(\d{4})$", b))}
        if not bandas:
            raise RuntimeError(f"Nenhuma banda anual encontrada em {imagem}")
        if ctx.params.get("anos"):
            anos = [int(a) for a in str(ctx.params["anos"]).split(",")]
        else:
            presentes = {d.year for (d,) in ctx.conn.execute(
                text("SELECT DISTINCT data FROM serie_territorial WHERE variavel = :v"), {"v": self.variavel})}
            anos = sorted(set(bandas) - presentes)

        for ano in anos:
            bruto = gee.area_por_valor(imagem, bandas[ano], territorios)
            ctx.lidos += sum(len(z["grupos"]) for z in bruto)
            ctx.conn.execute(
                text("""DELETE FROM serie_territorial
                        WHERE variavel = :v AND data >= make_date(:a, 1, 1) AND data < make_date(:a + 1, 1, 1)"""),
                {"v": self.variavel, "a": ano},
            )
            gravar_series(ctx, self.conjunto, areas_para_linhas(bruto, ano, self.variavel, self.mensal))
        ctx.origens.append(f"earthengine://{imagem}")
        ctx.versao_fonte = f"{imagem} ({min(bandas)}–{max(bandas)})"


class MapbiomasCobertura(_AreasMapbiomas):
    nome = "mapbiomas_cobertura"
    conjunto = "mapbiomas-cobertura"
    variavel = "cobertura_ha"
    mensal = False

    def imagem(self, cfg: Config) -> str:
        return cfg.gee_mapbiomas_cobertura


class MapbiomasFogo(_AreasMapbiomas):
    nome = "mapbiomas_fogo"
    conjunto = "mapbiomas-fogo"
    variavel = "area_queimada_ha"
    mensal = True

    def imagem(self, cfg: Config) -> str:
        return cfg.gee_mapbiomas_fogo
