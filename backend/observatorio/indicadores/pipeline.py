"""Recalcula todos os indicadores derivados a partir das séries carregadas."""
import calendar
import json
from collections import defaultdict
from datetime import date
from typing import Any

from sqlalchemy import text

from ..etl.base import Contexto, Pipeline, em_lotes
from . import calculo
from .calculo import Anomalia, Sentido

# variável -> (agregação mensal, sentido do alerta, ausência de linha significa zero?)
MENSAIS: dict[str, tuple[str, Sentido, bool]] = {
    "chuva_mm": ("sum", "ambos", False),
    "temp_media_c": ("avg", "acima", False),
    "temp_max_c": ("avg", "acima", False),
    "umidade_relativa_pct": ("avg", "abaixo", False),
    "focos": ("sum", "acima", True),
    "area_queimada_ha": ("sum", "acima", True),
}
ESTACOES: dict[str, str] = {"cota_cm": "avg", "vazao_m3s": "avg"}
MIN_DIAS_ESTACAO = 20

SQL_INSERIR = text("""
    INSERT INTO indicador (indicador, territorio_id, estacao_codigo, periodicidade, data, valor, referencia,
        anomalia, anomalia_pct, zscore, nivel_alerta, unidade, detalhes, execucao_id)
    VALUES (:indicador, :territorio_id, :estacao_codigo, :periodicidade, :data, :valor, :referencia,
        :anomalia, :anomalia_pct, :zscore, :nivel, :unidade, CAST(:detalhes AS jsonb), :execucao)
""")


def _mes_completo(mes: date, dias: int) -> bool:
    return dias >= calendar.monthrange(mes.year, mes.month)[1]


class Indicadores(Pipeline):
    nome = "indicadores"
    conjunto = "indicadores"

    def executar(self, ctx: Contexto) -> None:
        self.ctx = ctx
        self.base = (ctx.cfg.climatologia_inicio, ctx.cfg.climatologia_fim)
        self.linhas: list[dict[str, Any]] = []
        self.areas = dict(ctx.conn.execute(text("SELECT id, area_km2 FROM territorio")).all())
        self.mes_atual = date.today().replace(day=1)

        chuva_mensal = self._anomalias_mensais_territorio()
        self._anomalias_mensais_estacao()
        self._acumulados_hidrologicos(chuva_mensal)
        self._frequencia_fogo()
        self._cobertura()

        ctx.conn.execute(text("DELETE FROM indicador"))
        for lote in em_lotes(self.linhas):
            ctx.conn.execute(SQL_INSERIR, lote)
        ctx.lidos = ctx.carregados = len(self.linhas)

    # --- auxiliares -------------------------------------------------------------------------

    def _emitir(
        self, indicador: str, periodicidade: str, quando: date, unidade: str, a: Anomalia | None = None,
        *, valor: float | None = None, territorio_id: int | None = None, estacao: str | None = None,
        detalhes: dict[str, Any] | None = None,
    ) -> None:
        detalhes = dict(detalhes or {})
        if a:
            detalhes |= {"periodo_referencia": a.periodo_referencia, "n_referencia": a.n_referencia}
        self.linhas.append({
            "indicador": indicador, "territorio_id": territorio_id, "estacao_codigo": estacao,
            "periodicidade": periodicidade, "data": quando, "unidade": unidade,
            "valor": a.valor if a else valor,
            "referencia": a.referencia if a else None, "anomalia": a.anomalia if a else None,
            "anomalia_pct": a.anomalia_pct if a else None, "zscore": a.zscore if a else None,
            "nivel": a.nivel if a else "normal", "detalhes": json.dumps(detalhes), "execucao": self.ctx.execucao_id,
        })

    def _series_mensais(self, variavel: str, agregacao: str, zero: bool) -> tuple[dict[int, dict[date, float]], str]:
        """Série mensal por território. Meses incompletos (ou o mês corrente) ficam de fora."""
        linhas = self.ctx.conn.execute(text(f"""
            SELECT territorio_id, date_trunc('month', data)::date AS mes, {agregacao}(valor),
                   count(*), bool_or(periodicidade = 'mes'), min(unidade)
            FROM serie_territorial
            WHERE variavel = :v AND periodicidade IN ('dia', 'mes')
            GROUP BY 1, 2
        """), {"v": variavel}).all()
        series: dict[int, dict[date, float]] = defaultdict(dict)
        unidade = ""
        ultimo_mes = None
        for tid, mes, valor, dias, ja_mensal, unidade in linhas:
            ultimo_mes = max(ultimo_mes or mes, mes)
            if mes >= self.mes_atual:
                continue
            if zero or ja_mensal or _mes_completo(mes, dias):
                series[tid][mes] = valor
        if zero and series:
            # Todos os territórios vão até o último mês fechado coberto pela carga, com zeros onde não houve registro.
            anterior = date(self.mes_atual.year - (self.mes_atual.month == 1), (self.mes_atual.month - 2) % 12 + 1, 1)
            fim = min(ultimo_mes, anterior)
            series = {tid: calculo.preencher_meses(s, fim) for tid, s in series.items()}
        return series, unidade

    # --- indicadores ------------------------------------------------------------------------

    def _anomalias_mensais_territorio(self) -> dict[int, dict[date, float]]:
        chuva: dict[int, dict[date, float]] = {}
        for variavel, (agregacao, sentido, zero) in MENSAIS.items():
            series, unidade = self._series_mensais(variavel, agregacao, zero)
            if variavel == "chuva_mm":
                chuva = series
            for tid, serie in series.items():
                for mes, a in calculo.anomalias_mensais(serie, self.base, sentido).items():
                    self._emitir(f"anomalia_{variavel}", "mes", mes, unidade, a, territorio_id=tid)
        return chuva

    def _anomalias_mensais_estacao(self) -> None:
        for variavel, agregacao in ESTACOES.items():
            linhas = self.ctx.conn.execute(text(f"""
                SELECT estacao_codigo, date_trunc('month', data)::date, {agregacao}(valor), count(*)
                FROM observacao_estacao WHERE variavel = :v GROUP BY 1, 2
            """), {"v": variavel}).all()
            series: dict[str, dict[date, float]] = defaultdict(dict)
            for codigo, mes, valor, dias in linhas:
                if mes < self.mes_atual and dias >= MIN_DIAS_ESTACAO:
                    series[codigo][mes] = valor
            unidade = "cm" if variavel == "cota_cm" else "m³/s"
            for codigo, serie in series.items():
                for mes, a in calculo.anomalias_mensais(serie, self.base, "ambos").items():
                    self._emitir(f"anomalia_{variavel}", "mes", mes, unidade, a, estacao=codigo)

    def _acumulados_hidrologicos(self, chuva_mensal: dict[int, dict[date, float]]) -> None:
        inicio = self.ctx.cfg.ano_hidrologico_mes_inicio
        for tid, mensal in chuva_mensal.items():
            for recorte, por_ano in calculo.acumulados_hidrologicos(mensal, inicio).items():
                mes = (inicio + 6 - 1) % 12 + 1 if recorte == "estacao_seca" else inicio
                for ano, a in calculo.anomalias_anuais(por_ano, self.base, "ambos").items():
                    quando = date(ano + (1 if mes < inicio else 0), mes, 1)
                    self._emitir(f"chuva_{recorte}", recorte, quando, "mm", a, territorio_id=tid,
                                 detalhes={"ano_hidrologico": f"{ano}/{ano + 1}"})

    def _anuais(self, variavel: str) -> dict[int, dict[int, float]]:
        """Soma por ano civil e território, somente anos encerrados."""
        linhas = self.ctx.conn.execute(text("""
            SELECT territorio_id, extract(year FROM data)::int, sum(valor)
            FROM serie_territorial WHERE variavel = :v AND categoria = '' GROUP BY 1, 2
        """), {"v": variavel}).all()
        series: dict[int, dict[int, float]] = defaultdict(dict)
        for tid, ano, valor in linhas:
            if ano < self.mes_atual.year:
                series[tid][ano] = valor
        return series

    def _frequencia_fogo(self) -> None:
        """Focos por 1.000 km² e fração da área queimada, por ano civil."""
        for variavel, indicador, unidade, fator in (
            ("focos", "focos_por_1000km2", "focos/1000 km²", 1000.0),
            ("area_queimada_ha", "area_queimada_pct", "% da área", 1.0),  # ha -> km² -> %
        ):
            for tid, por_ano in self._anuais(variavel).items():
                area = self.areas[tid]
                if not area:
                    continue
                anos = range(min(por_ano), max(por_ano) + 1)
                densidade = {a: por_ano.get(a, 0.0) / area * fator for a in anos}
                bruto = {a: por_ano.get(a, 0.0) for a in anos}
                for ano, a in calculo.anomalias_anuais(densidade, self.base, "acima").items():
                    self._emitir(indicador, "ano", date(ano, 1, 1), unidade, a, territorio_id=tid,
                                 detalhes={variavel: bruto[ano], "area_km2": round(area, 2)})

    def _cobertura(self) -> None:
        """Vegetação nativa, taxa de conversão e superfície de água a partir do MapBiomas."""
        linhas = self.ctx.conn.execute(text("""
            SELECT territorio_id, extract(year FROM data)::int, categoria, valor
            FROM serie_territorial WHERE variavel = 'cobertura_ha' AND periodicidade = 'ano'
        """)).all()
        cobertura: dict[int, dict[tuple[int, int], float]] = defaultdict(dict)
        for tid, ano, classe, ha in linhas:
            cobertura[tid][(ano, int(classe))] = ha

        for tid, classes in cobertura.items():
            nativa = calculo.vegetacao_nativa(classes)
            for ano, ha in nativa.items():
                self._emitir("vegetacao_nativa_ha", "ano", date(ano, 1, 1), "ha", valor=ha, territorio_id=tid)
            taxas = calculo.taxa_conversao(nativa)
            anomalias = calculo.anomalias_anuais(taxas, self.base, "acima")
            for ano, taxa in taxas.items():
                detalhes = {"perda_ha": round(nativa[ano - 1] - nativa[ano], 2)}
                if ano in anomalias:
                    self._emitir("taxa_conversao_nativa_pct", "ano", date(ano, 1, 1), "% ao ano",
                                 anomalias[ano], territorio_id=tid, detalhes=detalhes)
                else:
                    self._emitir("taxa_conversao_nativa_pct", "ano", date(ano, 1, 1), "% ao ano",
                                 valor=taxa, territorio_id=tid, detalhes=detalhes)
            agua = {ano: ha for (ano, classe), ha in classes.items() if classe == calculo.CLASSE_AGUA}
            for ano, a in calculo.anomalias_anuais(agua, self.base, "abaixo").items():
                self._emitir("superficie_agua_ha", "ano", date(ano, 1, 1), "ha", a, territorio_id=tid)
