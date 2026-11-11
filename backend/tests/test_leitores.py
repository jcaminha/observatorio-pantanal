"""Leitores das fontes, com amostras no formato real de cada serviço (capturadas em nov/2026)."""
from datetime import UTC, date, datetime

import pytest

from observatorio.etl import ana_hidroweb, firms_viirs, gee, ibge_sidra, inpe_focos
from observatorio.etl.base import FonteIndisponivel

LINHA_DIARIA = {
    "id": "7331e2b3", "lat": " -18.943000", "lon": " -57.179470", "data_hora_gmt": "2026-11-09 16:37:00",
    "satelite": "NOAA-20", "municipio": "CORUMBÁ", "estado": "MATO GROSSO DO SUL", "pais": "Brasil",
    "municipio_id": "5003207", "estado_id": "50", "pais_id": "33", "numero_dias_sem_chuva": "0",
    "precipitacao": "0.0", "risco_fogo": "-999", "bioma": "Pantanal", "frp": "",
}
LINHA_ANUAL = {
    "id_bdq": "9988885 ", "foco_id": "5e864494", "lat": "  -18.518000 ", "lon": "  -57.028000 ",
    "data_pas": "2003-05-15 17:05:00", "pais": "Brasil", "estado": "MATO GROSSO DO SUL",
    "municipio": "CORUMBÁ", "bioma": "Pantanal",
}


def test_inpe_normaliza_formato_diario():
    foco = inpe_focos.normalizar(LINHA_DIARIA, "AQUA_M-T")
    assert foco["id_origem"] == "7331e2b3" and foco["satelite"] == "NOAA-20"
    assert (foco["lat"], foco["lon"]) == (-18.943, -57.17947)
    assert foco["data_hora"] == datetime(2026, 11, 9, 16, 37, tzinfo=UTC)
    assert foco["frp"] is None and foco["risco_fogo"] is None  # vazio e -999 são ausência de dado
    assert foco["dias_sem_chuva"] == 0 and foco["municipio_ibge"] == "5003207"


def test_inpe_normaliza_formato_anual_e_descarta_outros_biomas():
    foco = inpe_focos.normalizar(LINHA_ANUAL, "AQUA_M-T")
    assert foco["id_origem"] == "5e864494" and foco["satelite"] == "AQUA_M-T"
    assert inpe_focos.normalizar({**LINHA_DIARIA, "bioma": "Cerrado"}, "AQUA_M-T") is None


def test_inpe_planeja_arquivos_por_periodo():
    hoje = date(2026, 11, 10)
    assert inpe_focos.planejar(date(2026, 11, 9), hoje, hoje) == [
        ("diario", "diario/Brasil/focos_diario_br_20261109"), ("diario", "diario/Brasil/focos_diario_br_20261110")]
    plano = inpe_focos.planejar(date(2021, 6, 1), date(2023, 2, 15), hoje)
    assert plano == [
        ("anual", "anual/Brasil_sat_ref/focos_br_ref_2021"), ("anual", "anual/Brasil_sat_ref/focos_br_ref_2022"),
        ("mensal", "mensal/Brasil/focos_mensal_br_202301"), ("mensal", "mensal/Brasil/focos_mensal_br_202302")]


FIRMS_CSV = (
    "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,"
    "bright_ti5,frp,daynight\n"
    "-18.94300,-57.17947,330.1,0.4,0.4,2026-11-09,437,N20,VIIRS,n,2.0NRT,290.2,9.7,N\n"
)


def test_firms_le_csv_e_gera_id_estavel():
    (a,), (b,) = firms_viirs.ler(FIRMS_CSV), firms_viirs.ler(FIRMS_CSV)
    assert a["id_origem"] == b["id_origem"] and len(a["id_origem"]) == 40
    assert a["satelite"] == "NOAA-20" and a["confianca"] == "nominal" and a["frp"] == 9.7
    assert a["data_hora"] == datetime(2026, 11, 9, 4, 37, tzinfo=UTC)


def test_firms_rejeita_resposta_de_erro_com_http_200():
    with pytest.raises(FonteIndisponivel):
        firms_viirs.ler("Invalid MAP_KEY.")


def _xml(marca: str, registros: list[dict[str, str]]) -> bytes:
    corpo = "".join(
        f"<{marca}>" + "".join(f"<{k}>{v}</{k}>" if v != "" else f"<{k} />" for k, v in r.items()) + f"</{marca}>"
        for r in registros
    )
    return (
        '<?xml version="1.0" encoding="utf-8"?><DataTable xmlns="http://MRCS/">'
        '<diffgr:diffgram xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1">'
        f'<DocumentElement xmlns="">{corpo}</DocumentElement></diffgr:diffgram></DataTable>'
    ).encode()


def test_ana_serie_historica_prefere_dado_consistido_e_ignora_dias_inexistentes():
    xml = _xml("SerieHistorica", [
        {"EstacaoCodigo": "66825000", "NivelConsistencia": "1", "DataHora": "2024-02-01 00:00:00",
         "Cota01": "63", "Cota02": "64", "Cota29": "87", "Cota30": "999", "Cota03": ""},
        {"EstacaoCodigo": "66825000", "NivelConsistencia": "2", "DataHora": "2024-02-01 00:00:00", "Cota01": "65"},
    ])
    serie = ana_hidroweb.ler_serie_historica(xml, "Cota")
    assert serie == {date(2024, 2, 1): (65.0, 2), date(2024, 2, 2): (64.0, 1), date(2024, 2, 29): (87.0, 1)}


def test_ana_telemetria_agrega_por_dia():
    xml = _xml("DadosHidrometereologicos", [
        {"CodEstacao": "66825000", "DataHora": "2026-11-10 18:00:00 ", "Vazao": "", "Nivel": "81.00", "Chuva": "0.20"},
        {"CodEstacao": "66825000", "DataHora": "2026-11-10 17:45:00 ", "Vazao": "", "Nivel": "79.00", "Chuva": "0.40"},
        {"CodEstacao": "66825000", "DataHora": "2026-11-09 23:45:00 ", "Vazao": "1500", "Nivel": "", "Chuva": ""},
    ])
    r = ana_hidroweb.ler_telemetria(xml)
    assert r["cota_cm"] == {date(2026, 11, 10): 80.0}
    assert r["chuva_mm"] == {date(2026, 11, 10): pytest.approx(0.6)}
    assert r["vazao_m3s"] == {date(2026, 11, 9): 1500.0}


def test_ana_xml_invalido_e_falha_da_fonte():
    with pytest.raises(FonteIndisponivel):
        ana_hidroweb.ler_serie_historica(b"<html>Service Unavailable", "Cota")


def test_sidra_monta_caminho_e_le_valores():
    assert ibge_sidra.montar_caminho("t/3939/v/105/c79/2670", ["5003207", "5102504"], "last 5") == (
        "t/3939/n6/5003207,5102504/v/105/p/last 5/c79/2670")
    assert ibge_sidra.montar_caminho("t/6579/v/9324", ["1"], "all") == "t/6579/n6/1/v/9324/p/all"
    dados = [
        {"V": "Valor", "D1C": "Município (Código)", "D2C": "Variável (Código)", "D3C": "Ano (Código)"},
        {"V": "2195363", "D1C": "5003207", "D2C": "105", "D3C": "2024"},
        {"V": "...", "D1C": "5102504", "D2C": "105", "D3C": "2024"},
    ]
    assert ibge_sidra.ler(dados) == [("5003207", 2024, 2195363.0)]


def test_era5_converte_kelvin_e_deriva_umidade():
    assert gee.umidade_relativa(25.0, 25.0) == pytest.approx(100.0)
    assert gee.umidade_relativa(30.0, 20.0) == pytest.approx(55.1, abs=0.3)
    linhas = gee.era5_para_linhas([{"tid": 1, "data": "2024-01-02", "temperature_2m": 303.15,
                                    "dewpoint_temperature_2m": 293.15, "temperature_2m_max": 308.15}])
    assert {l["variavel"]: l["valor"] for l in linhas} == {
        "temp_media_c": 30.0, "temp_max_c": 35.0, "umidade_relativa_pct": pytest.approx(55.1, abs=0.3)}


def test_mapbiomas_areas_por_classe_e_por_mes():
    bruto = [{"tid": 7, "grupos": [{"valor": 3, "ha": 10.0}, {"valor": 0, "ha": 99.0}, {"valor": 13, "ha": 1.0}]}]
    cobertura = gee.areas_para_linhas(bruto, 2022, "cobertura_ha", mensal=False)
    assert [(l["categoria"], l["data"], l["valor"]) for l in cobertura] == [
        ("3", date(2022, 1, 1), 10.0), ("13", date(2022, 1, 1), 1.0)]
    fogo = gee.areas_para_linhas(bruto, 2022, "area_queimada_ha", mensal=True)  # 13 não é mês válido
    assert [(l["data"], l["periodicidade"]) for l in fogo] == [(date(2022, 3, 1), "mes")]
