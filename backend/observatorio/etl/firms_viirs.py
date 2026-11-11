"""Fogo ativo VIIRS 375 m em tempo quase real (NASA FIRMS, API de área)."""
import csv
import hashlib
import io
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import text

from ..config import Config
from .base import Contexto, FonteIndisponivel, Pipeline
from .focos import agregar_focos, inserir_focos

SATELITES = {"N": "SUOMI-NPP", "N20": "NOAA-20", "N21": "NOAA-21"}
CONFIANCA = {"l": "baixa", "n": "nominal", "h": "alta"}
MAX_DIAS = 5  # limite da API de área do FIRMS


def normalizar(linha: dict[str, str]) -> dict[str, Any]:
    hhmm = linha["acq_time"].zfill(4)
    momento = datetime.strptime(f"{linha['acq_date']} {hhmm}", "%Y-%m-%d %H%M").replace(tzinfo=UTC)
    sat = SATELITES.get(linha["satellite"], linha["satellite"])
    chave = f"{sat}|{momento.isoformat()}|{linha['latitude']}|{linha['longitude']}"
    return {
        "id_origem": hashlib.sha1(chave.encode()).hexdigest(),
        "lat": float(linha["latitude"]),
        "lon": float(linha["longitude"]),
        "data_hora": momento,
        "satelite": sat,
        "frp": float(linha["frp"]) if linha.get("frp") else None,
        "confianca": CONFIANCA.get(linha.get("confidence", ""), linha.get("confidence") or None),
    }


def ler(texto: str) -> list[dict[str, Any]]:
    leitor = csv.DictReader(io.StringIO(texto))
    if not leitor.fieldnames or "latitude" not in leitor.fieldnames:
        # O FIRMS devolve HTTP 200 com texto simples em caso de chave inválida ou limite excedido.
        raise FonteIndisponivel(f"Resposta inesperada do FIRMS: {texto[:200]!r}")
    return [normalizar(l) for l in leitor]


class FirmsViirs(Pipeline):
    """Parâmetro opcional: dias (1 a 5, padrão 2)."""

    nome = "firms_viirs"
    conjunto = "firms-viirs"

    def indisponivel(self, cfg: Config) -> str | None:
        return None if cfg.firms_map_key else "OBS_FIRMS_MAP_KEY não configurada"

    def executar(self, ctx: Contexto) -> None:
        dias = min(int(ctx.params.get("dias", 2)), MAX_DIAS)
        hoje = datetime.now(UTC).date()
        inicio = hoje - timedelta(days=dias - 1)
        o, s, l, n = ctx.conn.execute(text("""
            SELECT ST_XMin(e) - 0.05, ST_YMin(e) - 0.05, ST_XMax(e) + 0.05, ST_YMax(e) + 0.05
            FROM (SELECT ST_Extent(geom) AS e FROM territorio WHERE id = :b) x
        """), {"b": ctx.bioma_id()}).one()
        area = f"{o:.3f},{s:.3f},{l:.3f},{n:.3f}"

        base = ctx.cfg.firms_url.rstrip("/")
        for produto in ctx.cfg.firms_produtos:
            sufixo = f"{produto}/{area}/{dias}/{inicio.isoformat()}"
            r = ctx.baixar(f"{base}/{ctx.cfg.firms_map_key}/{sufixo}", registrar_como=f"{base}/***/{sufixo}")
            inserir_focos(ctx, self.conjunto, ler(r.text))

        # O retângulo envolvente traz pontos de fora do bioma.
        fora = ctx.conn.execute(text("""
            DELETE FROM foco_calor f USING territorio t
            WHERE f.execucao_id = :e AND t.id = :b AND NOT ST_Intersects(t.geom, f.geom)
        """), {"e": ctx.execucao_id, "b": ctx.bioma_id()}).rowcount
        ctx.carregados -= fora
        agregar_focos(ctx, self.conjunto, "focos_viirs", inicio, hoje)
        ctx.versao_fonte = f"NRT até {hoje.isoformat()}"
