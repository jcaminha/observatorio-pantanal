"""Focos de calor do INPE (BDQueimadas) a partir do servidor de dados abertos.

Arquivos disponíveis (verificado em nov/2026):
  diario/Brasil/focos_diario_br_AAAAMMDD.csv   — últimos ~30 dias, todos os satélites
  mensal/Brasil/focos_mensal_br_AAAAMM.csv|zip — desde 2023-01, todos os satélites
  anual/Brasil_sat_ref/focos_br_ref_AAAA.zip   — 2003 em diante, só o satélite de referência
"""
import csv
import io
import zipfile
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any, Iterator

import httpx
from sqlalchemy import text

from .base import Contexto, Pipeline, para_data
from .focos import agregar_focos, inserir_focos

PRIMEIRO_MENSAL = date(2023, 1, 1)
PRIMEIRO_ANUAL = 2003
BIOMA = "Pantanal"


def _num(valor: str | None) -> float | None:
    """Número não negativo ou None (o INPE usa vazio e -999 para ausência)."""
    if valor is None or not valor.strip():
        return None
    n = float(valor)
    return n if n >= 0 else None


def normalizar(linha: dict[str, str], satelite_referencia: str) -> dict[str, Any] | None:
    """Converte uma linha dos CSVs do INPE (formato diário/mensal ou anual) em um foco do Pantanal."""
    if linha.get("bioma", "").strip() != BIOMA:
        return None
    momento = (linha.get("data_hora_gmt") or linha["data_pas"]).strip()
    return {
        "id_origem": (linha.get("id") or linha["foco_id"]).strip(),
        "lat": float(linha["lat"]),
        "lon": float(linha["lon"]),
        "data_hora": datetime.fromisoformat(momento).replace(tzinfo=UTC),
        "satelite": (linha.get("satelite") or satelite_referencia).strip(),
        "frp": _num(linha.get("frp")),
        "risco_fogo": _num(linha.get("risco_fogo")),
        "dias_sem_chuva": _num(linha.get("numero_dias_sem_chuva")),
        "precipitacao": _num(linha.get("precipitacao")),
        "municipio_ibge": (linha.get("municipio_id") or "").strip() or None,
    }


def ler_csv(caminho: Path) -> Iterator[dict[str, str]]:
    if caminho.suffix == ".zip":
        with zipfile.ZipFile(caminho) as z, z.open(z.namelist()[0]) as bruto:
            yield from csv.DictReader(io.TextIOWrapper(bruto, encoding="utf-8"))
    else:
        with caminho.open(encoding="utf-8", newline="") as f:
            yield from csv.DictReader(f)


def planejar(inicio: date, fim: date, hoje: date) -> list[tuple[str, str]]:
    """Escolhe os arquivos que cobrem [inicio, fim]: lista de (tipo, caminho relativo sem extensão)."""
    if inicio >= hoje - timedelta(days=28):
        dias = (fim - inicio).days + 1
        return [("diario", f"diario/Brasil/focos_diario_br_{inicio + timedelta(days=i):%Y%m%d}") for i in range(dias)]
    plano: list[tuple[str, str]] = []
    for ano in range(max(inicio.year, PRIMEIRO_ANUAL), min(fim.year, PRIMEIRO_MENSAL.year - 1) + 1):
        plano.append(("anual", f"anual/Brasil_sat_ref/focos_br_ref_{ano}"))
    mes = max(inicio.replace(day=1), PRIMEIRO_MENSAL)
    while mes <= fim:
        plano.append(("mensal", f"mensal/Brasil/focos_mensal_br_{mes:%Y%m}"))
        mes = (mes + timedelta(days=32)).replace(day=1)
    return plano


class InpeFocos(Pipeline):
    """Parâmetros opcionais: inicio, fim (AAAA-MM-DD). Sem parâmetros, carga incremental."""

    nome = "inpe_focos"
    conjunto = "inpe-focos"

    def executar(self, ctx: Contexto) -> None:
        hoje = datetime.now(UTC).date()
        fim = para_data(ctx.params.get("fim")) or hoje
        inicio = para_data(ctx.params.get("inicio"))
        if inicio is None:
            ultimo = ctx.conn.execute(
                text("SELECT max(data_hora AT TIME ZONE 'UTC')::date FROM foco_calor WHERE conjunto_id = :c"),
                {"c": self.conjunto},
            ).scalar()
            # Reprocessa a véspera: os arquivos diários recebem focos atrasados.
            inicio = max(ultimo - timedelta(days=1), hoje - timedelta(days=28)) if ultimo else hoje - timedelta(days=28)
        if inicio > fim:
            raise ValueError(f"Intervalo inválido: {inicio} > {fim}")

        ctx.bioma_id()  # garante que os territórios existem antes de agregar
        ref = ctx.cfg.inpe_satelite_referencia
        datas: list[date] = []
        for tipo, relativo in planejar(inicio, fim, hoje):
            caminho = self._baixar(ctx, tipo, relativo, hoje)
            if caminho is None:
                continue
            try:
                focos = []
                for linha in ler_csv(caminho):
                    foco = normalizar(linha, ref)
                    if foco and inicio <= foco["data_hora"].date() <= fim:
                        focos.append(foco)
            finally:
                caminho.unlink(missing_ok=True)
            inserir_focos(ctx, self.conjunto, focos)
            datas.extend(f["data_hora"].date() for f in focos)

        # A série cobre todo o intervalo pedido, inclusive dias sem focos (que ficam sem linha = zero).
        agregar_focos(ctx, self.conjunto, "focos", inicio, fim, satelite=ref)
        ctx.versao_fonte = ctx.ultima_modificacao or f"consulta em {hoje.isoformat()}"

    def _baixar(self, ctx: Contexto, tipo: str, relativo: str, hoje: date) -> Path | None:
        base = ctx.cfg.inpe_url.rstrip("/")
        extensoes = {"diario": [".csv"], "mensal": [".csv", ".zip"], "anual": [".zip"]}[tipo]
        for i, ext in enumerate(extensoes):
            try:
                return ctx.baixar_arquivo(f"{base}/{relativo}{ext}")
            except httpx.HTTPStatusError as e:
                if e.response.status_code != 404:
                    raise
                if i < len(extensoes) - 1:
                    continue
                # O arquivo do dia corrente só aparece após a primeira passagem processada.
                if tipo == "diario" and relativo.endswith(f"{hoje:%Y%m%d}"):
                    ctx.avisos.append(f"Arquivo de hoje ainda não publicado: {relativo}")
                    return None
                raise
        return None
