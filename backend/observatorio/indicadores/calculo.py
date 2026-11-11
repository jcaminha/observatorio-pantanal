"""Cálculo dos indicadores derivados. Funções puras, sem acesso a banco."""
from dataclasses import dataclass
from datetime import date
from math import sqrt
from typing import Callable, Hashable, Literal, TypeVar

Sentido = Literal["ambos", "acima", "abaixo"]
K = TypeVar("K")

# Classes da legenda MapBiomas consideradas vegetação nativa e água.
CLASSES_NATIVAS = {3, 4, 5, 6, 11, 12, 13, 29, 32, 49, 50}
CLASSE_AGUA = 33

MIN_ANOS_BASE = 10
MIN_ANOS_SERIE = 5


@dataclass(frozen=True)
class Anomalia:
    valor: float
    referencia: float
    anomalia: float
    anomalia_pct: float | None
    zscore: float | None
    nivel: str
    n_referencia: int
    periodo_referencia: str


def nivel_alerta(z: float | None, sentido: Sentido = "ambos") -> str:
    """Classifica o desvio padronizado: 1,5σ atenção, 2σ alerta, 3σ crítico."""
    if z is None:
        return "normal"
    desvio = abs(z) if sentido == "ambos" else z if sentido == "acima" else -z
    if desvio >= 3:
        return "critico"
    if desvio >= 2:
        return "alerta"
    if desvio >= 1.5:
        return "atencao"
    return "normal"


def anomalias(
    serie: dict[K, float],
    grupo: Callable[[K], Hashable],
    ano: Callable[[K], int],
    base: tuple[int, int],
    sentido: Sentido = "ambos",
) -> dict[K, Anomalia]:
    """Anomalia de cada ponto em relação à média histórica do seu grupo (ex.: mês do calendário).

    A referência é o período-base (climatologia); se a série tiver menos de 10 anos dentro dele,
    usa-se toda a série disponível, desde que tenha ao menos 5 anos. Sem isso o ponto é omitido.
    """
    por_grupo: dict[Hashable, list[tuple[int, float]]] = {}
    for chave, valor in serie.items():
        por_grupo.setdefault(grupo(chave), []).append((ano(chave), valor))

    referencias: dict[Hashable, tuple[float, float, int, str]] = {}
    for g, pontos in por_grupo.items():
        na_base = [v for a, v in pontos if base[0] <= a <= base[1]]
        if len(na_base) >= MIN_ANOS_BASE:
            amostra, periodo = na_base, f"{base[0]}-{base[1]}"
        elif len(pontos) >= MIN_ANOS_SERIE:
            anos = [a for a, _ in pontos]
            amostra, periodo = [v for _, v in pontos], f"{min(anos)}-{max(anos)}"
        else:
            continue
        media = sum(amostra) / len(amostra)
        dp = sqrt(sum((v - media) ** 2 for v in amostra) / (len(amostra) - 1))
        referencias[g] = (media, dp, len(amostra), periodo)

    saida: dict[K, Anomalia] = {}
    for chave, valor in serie.items():
        if (ref := referencias.get(grupo(chave))) is None:
            continue
        media, dp, n, periodo = ref
        z = (valor - media) / dp if dp > 0 else None
        saida[chave] = Anomalia(
            valor=valor, referencia=media, anomalia=valor - media,
            anomalia_pct=(valor - media) / media * 100 if media else None,
            zscore=z, nivel=nivel_alerta(z, sentido), n_referencia=n, periodo_referencia=periodo,
        )
    return saida


def anomalias_mensais(serie: dict[date, float], base: tuple[int, int], sentido: Sentido = "ambos"):
    return anomalias(serie, lambda d: d.month, lambda d: d.year, base, sentido)


def anomalias_anuais(serie: dict[int, float], base: tuple[int, int], sentido: Sentido = "ambos"):
    return anomalias(serie, lambda _: 0, lambda a: a, base, sentido)


def preencher_meses(serie: dict[date, float], fim: date) -> dict[date, float]:
    """Completa com zero os meses sem registro entre o primeiro mês da série e `fim` (inclusive).

    Para variáveis de contagem (focos, área queimada), em que ausência de linha significa zero.
    """
    if not serie:
        return {}
    completa = {}
    mes = min(serie)
    while mes <= fim:
        completa[mes] = serie.get(mes, 0.0)
        mes = date(mes.year + mes.month // 12, mes.month % 12 + 1, 1)
    return completa


def ano_hidrologico(d: date, mes_inicio: int = 10) -> int:
    """Ano hidrológico identificado pelo ano civil em que começa (out/2023–set/2024 -> 2023)."""
    return d.year if d.month >= mes_inicio else d.year - 1


def acumulados_hidrologicos(mensal: dict[date, float], mes_inicio: int = 10) -> dict[str, dict[int, float]]:
    """Acumulados por ano hidrológico e por estação (chuvosa = 6 primeiros meses; seca = 6 últimos).

    Só entram períodos com todos os meses presentes.
    """
    por_ano: dict[int, dict[int, float]] = {}
    for d, v in mensal.items():
        posicao = (d.month - mes_inicio) % 12  # 0 = primeiro mês do ano hidrológico
        por_ano.setdefault(ano_hidrologico(d, mes_inicio), {})[posicao] = v

    saida: dict[str, dict[int, float]] = {"ano_hidrologico": {}, "estacao_chuvosa": {}, "estacao_seca": {}}
    for ano, meses in por_ano.items():
        chuvosa = [meses[p] for p in range(6) if p in meses]
        seca = [meses[p] for p in range(6, 12) if p in meses]
        if len(chuvosa) == 6:
            saida["estacao_chuvosa"][ano] = sum(chuvosa)
        if len(seca) == 6:
            saida["estacao_seca"][ano] = sum(seca)
        if len(chuvosa) == 6 and len(seca) == 6:
            saida["ano_hidrologico"][ano] = sum(chuvosa) + sum(seca)
    return saida


def vegetacao_nativa(cobertura: dict[tuple[int, int], float]) -> dict[int, float]:
    """Soma, por ano, a área das classes nativas. Entrada: {(ano, classe): ha}."""
    total: dict[int, float] = {}
    for (ano, classe), ha in cobertura.items():
        if classe in CLASSES_NATIVAS:
            total[ano] = total.get(ano, 0.0) + ha
    return total


def taxa_conversao(nativa: dict[int, float]) -> dict[int, float]:
    """Perda líquida anual de vegetação nativa em % da área do ano anterior (positivo = perda)."""
    return {
        ano: (nativa[ano - 1] - ha) / nativa[ano - 1] * 100
        for ano, ha in nativa.items()
        if nativa.get(ano - 1)
    }
