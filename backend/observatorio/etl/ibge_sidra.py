"""Indicadores socioeconômicos municipais pela API do SIDRA/IBGE."""
from datetime import date
from typing import Any

from sqlalchemy import text

from .base import Contexto, FonteIndisponivel, Pipeline, gravar_series


def montar_caminho(caminho: str, municipios: list[str], periodo: str) -> str:
    """'t/3939/v/105/c79/2670' -> 't/3939/n6/<códigos>/v/105/p/<período>/c79/2670'."""
    partes = caminho.strip("/").split("/")
    if partes[0] != "t" or len(partes) < 4:
        raise ValueError(f"Caminho SIDRA inválido: {caminho}")
    return "/".join([*partes[:2], "n6", ",".join(municipios), *partes[2:4], "p", periodo, *partes[4:]])


def ler(dados: list[dict[str, str]]) -> list[tuple[str, int, float]]:
    """Resposta do SIDRA -> [(código do município, ano, valor)]. A primeira linha é o cabeçalho."""
    if not dados or "V" not in dados[0]:
        raise FonteIndisponivel(f"Resposta inesperada do SIDRA: {str(dados)[:200]}")
    cabecalho = dados[0]
    col_mun = next(k for k, v in cabecalho.items() if v == "Município (Código)")
    col_ano = next(k for k, v in cabecalho.items() if v == "Ano (Código)")
    saida = []
    for linha in dados[1:]:
        try:
            valor = float(linha["V"])
        except ValueError:  # "...", "-", "X": dado indisponível ou sigiloso
            continue
        saida.append((linha[col_mun], int(linha[col_ano]), valor))
    return saida


class IbgeSidra(Pipeline):
    """Parâmetro opcional: periodo (sintaxe do SIDRA; padrão 'last 5', use 'all' para a série completa)."""

    nome = "ibge_sidra"
    conjunto = "ibge-sidra"

    def executar(self, ctx: Contexto) -> None:
        municipios = dict(ctx.conn.execute(
            text("SELECT codigo, id FROM territorio WHERE tipo = 'municipio' ORDER BY codigo")
        ).all())
        if not municipios:
            raise RuntimeError("Municípios não carregados: execute o pipeline 'territorios' primeiro")
        periodo = str(ctx.params.get("periodo", "last 5"))
        bioma = ctx.bioma_id()
        anos: set[int] = set()

        for tabela in ctx.cfg.sidra_tabelas:
            caminho = montar_caminho(tabela["caminho"], list(municipios), periodo)
            valores = ler(ctx.baixar(f"{ctx.cfg.sidra_url.rstrip('/')}/{caminho}").json())
            ctx.lidos += len(valores)
            linhas: list[dict[str, Any]] = []
            total: dict[int, float] = {}
            for codigo, ano, valor in valores:
                if codigo not in municipios:
                    continue
                linhas.append({"territorio_id": municipios[codigo], "variavel": tabela["variavel"],
                               "periodicidade": "ano", "data": date(ano, 1, 1), "valor": valor,
                               "unidade": tabela["unidade"]})
                total[ano] = total.get(ano, 0.0) + valor
                anos.add(ano)
            # Bioma = soma dos municípios inteiros (aproximação: parte deles extrapola o limite do bioma).
            linhas += [{"territorio_id": bioma, "variavel": tabela["variavel"], "periodicidade": "ano",
                        "data": date(ano, 1, 1), "valor": v, "unidade": tabela["unidade"]}
                       for ano, v in total.items()]
            gravar_series(ctx, self.conjunto, linhas)

        if anos:
            ctx.versao_fonte = f"anos {min(anos)}–{max(anos)}"
