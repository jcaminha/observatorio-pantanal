from datetime import date

import pytest

from observatorio.indicadores import calculo


def test_nivel_alerta_respeita_o_sentido():
    assert calculo.nivel_alerta(2.5) == "alerta"
    assert calculo.nivel_alerta(-3.2) == "critico"
    assert calculo.nivel_alerta(-3.2, "acima") == "normal"
    assert calculo.nivel_alerta(-1.6, "abaixo") == "atencao"
    assert calculo.nivel_alerta(None) == "normal"


def test_anomalia_mensal_usa_climatologia_do_mes_no_periodo_base():
    serie = {date(a, 1, 1): 100.0 + (a % 2) * 20 for a in range(1991, 2021)}  # média 110 em janeiro
    serie |= {date(a, 7, 1): 5.0 for a in range(1991, 2021)}
    serie[date(2024, 1, 1)] = 200.0
    a = calculo.anomalias_mensais(serie, (1991, 2020))[date(2024, 1, 1)]
    assert a.referencia == pytest.approx(110.0)
    assert a.anomalia == pytest.approx(90.0)
    assert a.anomalia_pct == pytest.approx(81.82, abs=0.01)
    assert a.zscore == pytest.approx(90 / 10.17, abs=0.01)
    assert a.nivel == "critico"
    assert a.periodo_referencia == "1991-2020" and a.n_referencia == 30


def test_anomalia_sem_variancia_nao_gera_zscore():
    serie = {date(a, 7, 1): 5.0 for a in range(1991, 2021)}
    a = calculo.anomalias_mensais(serie, (1991, 2020))[date(2000, 7, 1)]
    assert a.zscore is None and a.nivel == "normal"


def test_serie_curta_usa_todo_o_periodo_e_series_minimas_sao_omitidas():
    curta = {a: float(a - 2010) for a in range(2012, 2020)}  # 8 anos, fora da regra de 10 na base
    resultado = calculo.anomalias_anuais(curta, (1991, 2020))
    assert resultado[2019].periodo_referencia == "2012-2019"
    assert calculo.anomalias_anuais({2020: 1.0, 2021: 2.0}, (1991, 2020)) == {}


def test_preencher_meses_completa_com_zero():
    serie = {date(2023, 11, 1): 4.0, date(2024, 2, 1): 1.0}
    assert calculo.preencher_meses(serie, date(2024, 3, 1)) == {
        date(2023, 11, 1): 4.0, date(2023, 12, 1): 0.0, date(2024, 1, 1): 0.0,
        date(2024, 2, 1): 1.0, date(2024, 3, 1): 0.0,
    }


def test_ano_hidrologico_comeca_em_outubro():
    assert calculo.ano_hidrologico(date(2023, 10, 1)) == 2023
    assert calculo.ano_hidrologico(date(2024, 9, 30)) == 2023
    assert calculo.ano_hidrologico(date(2024, 10, 1)) == 2024


def test_acumulados_hidrologicos_exigem_periodos_completos():
    mensal = {date(2022, m, 1): 1.0 for m in (10, 11, 12)}
    mensal |= {date(2023, m, 1): 100.0 if m <= 3 else 10.0 for m in range(1, 13)}
    mensal |= {date(2024, m, 1): 7.0 for m in (1, 2, 3)}
    r = calculo.acumulados_hidrologicos(mensal)
    assert r["estacao_chuvosa"] == {2022: 303.0, 2023: 51.0}
    assert r["estacao_seca"] == {2022: 60.0}
    assert r["ano_hidrologico"] == {2022: 363.0}


def test_taxa_de_conversao_da_vegetacao_nativa():
    cobertura = {(2020, 3): 600.0, (2020, 12): 400.0, (2020, 15): 50.0,
                 (2021, 3): 590.0, (2021, 12): 390.0, (2021, 15): 70.0}
    nativa = calculo.vegetacao_nativa(cobertura)
    assert nativa == {2020: 1000.0, 2021: 980.0}
    assert calculo.taxa_conversao(nativa) == {2021: pytest.approx(2.0)}
