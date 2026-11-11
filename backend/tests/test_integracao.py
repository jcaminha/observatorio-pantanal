"""Fluxo completo sobre PostGIS: fontes simuladas -> pipelines -> indicadores -> API."""
from datetime import UTC, date, datetime, timedelta

import httpx
import pytest
from sqlalchemy import text

from observatorio.etl.base import FonteIndisponivel, rodar
from observatorio.etl.registro import PIPELINES
from test_leitores import FIRMS_CSV, _xml

HOJE = datetime.now(UTC).date()
ONTEM = HOJE - timedelta(days=1)


def _quadrado(o, s, l, n):
    return {"type": "MultiPolygon", "coordinates": [[[[o, s], [l, s], [l, n], [o, n], [o, s]]]]}


CAMADAS = {
    "biome_border": [({"bioma": "Pantanal", "cd_bioma": 6}, _quadrado(-58, -20, -56, -18))],
    "municipalities_pantanal_biome": [
        ({"nome": "Corumbá", "geocodigo": "5003207"}, _quadrado(-58, -20, -57, -18)),
        ({"nome": "Poconé", "geocodigo": "5106505"}, _quadrado(-57, -20, -56, -18))],
    "conservation_units_pantanal_biome": [
        ({"id": 9, "nome": "PARQUE  TESTE", "categoria": "Parque"}, _quadrado(-57.5, -19.5, -57.4, -19.4))],
}

CSV_INPE = "id,lat,lon,data_hora_gmt,satelite,municipio,estado,pais,municipio_id,estado_id,pais_id," \
           "numero_dias_sem_chuva,precipitacao,risco_fogo,bioma,frp\n" + "".join(
    f"{i},{lat},{lon},{ONTEM} 17:00:00,{sat},X,MS,Brasil,5003207,50,33,3,0.0,0.9,{bioma},12.5\n"
    for i, lat, lon, sat, bioma in [
        ("a1", -19.0, -57.5, "AQUA_M-T", "Pantanal"), ("a2", -19.45, -57.45, "AQUA_M-T", "Pantanal"),
        ("a3", -19.0, -56.5, "NOAA-20", "Pantanal"), ("a4", -10.0, -50.0, "AQUA_M-T", "Cerrado")])


def fontes(falhar: str | None = None):
    """Transporte HTTP simulado para todas as fontes; `falhar` força erro 503 nas URLs que o contêm."""
    def responder(req: httpx.Request) -> httpx.Response:
        url = str(req.url)
        if falhar and falhar in url:
            return httpx.Response(503)
        q = req.url.params
        if "geoserver" in url:
            feicoes = [{"type": "Feature", "properties": p, "geometry": g}
                       for p, g in CAMADAS[q["typeNames"].split(":")[1]]]
            return httpx.Response(200, json={"type": "FeatureCollection", "features": feicoes})
        if "focos_diario" in url:
            return httpx.Response(200, text=CSV_INPE) if f"{ONTEM:%Y%m%d}" in url else httpx.Response(404)
        if "firms" in url:
            assert "segredo" in url
            fora = FIRMS_CSV.splitlines()[1].replace("-18.94300,-57.17947", "-17.00000,-57.00000")
            return httpx.Response(200, text=(FIRMS_CSV + fora + "\n").replace("2026-11-09", str(ONTEM)))
        if "HidroInventario" in url:
            return httpx.Response(200, content=_xml("Table", [
                {"Codigo": "66825000", "Nome": "LADÁRIO", "RioNome": "RIO PARAGUAI", "Latitude": "-19.0",
                 "Longitude": "-57.59", "nmEstado": "MATO GROSSO DO SUL", "TipoEstacaoTelemetrica": "1"},
                {"Codigo": "99999999", "Nome": "FORA DO BIOMA", "Latitude": "-10.0", "Longitude": "-50.0"}]))
        if "HidroSerieHistorica" in url:
            if q["tipoDados"] != "1":
                return httpx.Response(200, content=_xml("SerieHistorica", []))
            meses = [{"NivelConsistencia": "2", "DataHora": f"{a}-01-01 00:00:00",
                      **{f"Cota{d:02d}": str(500 if a == 2024 else 200 + a % 3) for d in range(1, 32)}}
                     for a in range(2010, 2025)]
            return httpx.Response(200, content=_xml("SerieHistorica", meses))
        if "DadosHidrometeorologicos" in url:
            return httpx.Response(200, content=_xml("DadosHidrometereologicos", [
                {"DataHora": f"{ONTEM} 12:00:00", "Nivel": "90.00", "Vazao": "", "Chuva": "1.0"}]))
        if "apisidra" in url:
            assert "/n6/5003207,5106505/" in url
            return httpx.Response(200, json=[
                {"V": "Valor", "D1C": "Município (Código)", "D3C": "Ano (Código)"},
                {"V": "100", "D1C": "5003207", "D3C": "2024"}, {"V": "50", "D1C": "5106505", "D3C": "2024"}])
        raise AssertionError(f"URL inesperada: {url}")

    return httpx.Client(transport=httpx.MockTransport(responder))


class GeeSimulado:
    def ultima_imagem(self, colecao):
        return date(2025, 12, 31)

    def medias_diarias(self, colecao, bandas, inicio, fim_exclusivo, territorios, escala):
        linhas, dia = [], inicio
        while dia < fim_exclusivo:
            mm = 30.0 if (dia.year, dia.month) == (2024, 1) else 10.0 if dia.month in (10, 11, 12, 1, 2, 3) else 1.0
            linhas += [{"tid": t["id"], "data": dia.isoformat(), "precipitation": mm} for t in territorios]
            dia += timedelta(days=1)
        return linhas

    def bandas(self, imagem):
        return [f"classification_{a}" for a in (2020, 2021, 2022)]

    def area_por_valor(self, imagem, banda, territorios):
        ano = int(banda[-4:])
        nativa = 1000.0 - 10 * (ano - 2020)
        return [{"tid": t["id"], "grupos": [{"valor": 3, "ha": nativa}, {"valor": 15, "ha": 2000 - nativa},
                                             {"valor": 33, "ha": 50.0}]} for t in territorios]


def um(conn, sql, **params):
    return conn.execute(text(sql), params).scalar()


@pytest.fixture(scope="module")
def carregado(motor):
    """Banco com todos os pipelines executados uma vez sobre as fontes simuladas."""
    from observatorio.config import Config

    cfg = Config(_env_file=None, firms_map_key="segredo", sidra_tabelas=[
        {"variavel": "rebanho_bovino", "unidade": "cabeças", "caminho": "t/3939/v/105/c79/2670"}])
    gee = {"_gee": GeeSimulado()}
    for nome, params in [
        ("territorios", {}), ("inpe_focos", {"inicio": ONTEM, "fim": HOJE}), ("firms_viirs", {}),
        ("ana_estacoes", {}), ("ana_hidroweb", {}), ("ibge_sidra", {}),
        ("chirps", {**gee, "inicio": "2014-01-01"}), ("mapbiomas_cobertura", gee), ("indicadores", {}),
    ]:
        rodar(PIPELINES[nome], motor, cfg, params, http=fontes())
    return motor


def test_territorios_com_pid_e_area(carregado):
    with carregado.connect() as conn:
        linhas = conn.execute(text("SELECT tipo, codigo, nome, pid, uf FROM territorio ORDER BY tipo, codigo")).all()
        assert [(l.tipo, l.codigo) for l in linhas] == [
            ("bioma", "pantanal"), ("municipio", "5003207"), ("municipio", "5106505"), ("uc", "tb-9")]
        assert linhas[1].uf == "MS" and linhas[3].nome == "Parque Teste"
        assert linhas[0].pid == "https://observatorio.inpp.gov.br/id/territorio/bioma/pantanal"
        area = um(conn, "SELECT area_km2 FROM territorio WHERE tipo = 'bioma'")
        assert area == pytest.approx(46_700, rel=0.02)  # 2° x 2° perto de 19°S


def test_focos_inpe_filtrados_pelo_bioma_e_contados_pelo_satelite_de_referencia(carregado):
    with carregado.connect() as conn:
        assert um(conn, "SELECT count(*) FROM foco_calor WHERE conjunto_id = 'inpe-focos'") == 3
        contagem = dict(conn.execute(text("""
            SELECT t.codigo, s.valor FROM serie_territorial s JOIN territorio t ON t.id = s.territorio_id
            WHERE s.variavel = 'focos' AND s.data = :d"""), {"d": ONTEM}).all())
        # a3 é NOAA-20 (fora da contagem de referência); a2 cai dentro da UC.
        assert contagem == {"pantanal": 2, "5003207": 2, "tb-9": 1}


def test_recarga_e_idempotente(carregado, cfg):
    execucao = rodar(PIPELINES["inpe_focos"], carregado, cfg, {"inicio": ONTEM, "fim": HOJE}, http=fontes())
    with carregado.connect() as conn:
        assert um(conn, "SELECT count(*) FROM foco_calor WHERE conjunto_id = 'inpe-focos'") == 3
        assert um(conn, "SELECT registros_carregados FROM execucao_etl WHERE id = :i", i=execucao) == 0
        assert um(conn, "SELECT sum(valor) FROM serie_territorial WHERE variavel = 'focos'") == 5


def test_firms_descarta_pontos_fora_do_bioma_e_nao_registra_a_chave(carregado):
    with carregado.connect() as conn:
        assert um(conn, "SELECT count(*) FROM foco_calor WHERE conjunto_id = 'firms-viirs'") == 1  # mesma detecção nos 3 produtos
        origens = um(conn, "SELECT origens::text FROM execucao_etl WHERE pipeline = 'firms_viirs'")
        assert "segredo" not in origens and "/***/VIIRS_SNPP_NRT/" in origens


def test_ana_so_estacoes_do_bioma_e_consistencia(carregado):
    with carregado.connect() as conn:
        assert [c for (c,) in conn.execute(text("SELECT codigo FROM estacao"))] == ["66825000"]
        assert um(conn, "SELECT count(*) FROM observacao_estacao WHERE consistencia = 2") == 15 * 31
        assert um(conn, "SELECT valor FROM observacao_estacao WHERE data = :d AND variavel = 'cota_cm'", d=ONTEM) == 90


def test_sidra_soma_municipios_no_bioma(carregado):
    with carregado.connect() as conn:
        assert um(conn, """SELECT valor FROM serie_territorial s JOIN territorio t ON t.id = s.territorio_id
                           WHERE variavel = 'rebanho_bovino' AND t.tipo = 'bioma'""") == 150


def test_proveniencia_registrada_e_catalogo_atualizado(carregado):
    with carregado.connect() as conn:
        l = conn.execute(text("SELECT * FROM execucao_etl WHERE pipeline = 'territorios'")).mappings().one()
        assert l["status"] == "sucesso" and l["registros_carregados"] == 4 and l["finalizado_em"]
        assert len(l["origens"]) == 3 and "biome_border" in l["origens"][0]
        assert um(conn, "SELECT atualizado_em FROM conjunto_dados WHERE id = 'inpe-focos'") is not None
        assert "_gee" not in um(conn, "SELECT parametros::text FROM execucao_etl WHERE pipeline = 'chirps'")
        # Toda linha de dado aponta para a execução que a carregou.
        assert um(conn, """SELECT count(*) FROM serie_territorial s JOIN execucao_etl e ON e.id = s.execucao_id
                           WHERE e.status <> 'sucesso'""") == 0


def test_falha_reverte_a_carga_registra_e_avisa_a_equipe(carregado, cfg, monkeypatch):
    avisos = []
    monkeypatch.setattr("observatorio.etl.base.notificar_falha", lambda *a: avisos.append(a))
    with carregado.connect() as conn:
        antes = um(conn, "SELECT count(*) FROM territorio")
    with pytest.raises(FonteIndisponivel):
        rodar(PIPELINES["territorios"], carregado, cfg, http=fontes(falhar="municipalities"))
    with carregado.connect() as conn:
        l = conn.execute(text("SELECT * FROM execucao_etl ORDER BY id DESC LIMIT 1")).mappings().one()
        assert l["status"] == "falha" and "HTTP 503" in l["erro"] and l["finalizado_em"]
        assert um(conn, "SELECT count(*) FROM territorio") == antes
    assert len(avisos) == 1 and avisos[0][1] == "territorios" and avisos[0][2] == l["id"]


def test_alerta_por_webhook(cfg, monkeypatch):
    from observatorio import alertas

    enviados = []
    monkeypatch.setattr(alertas.httpx, "post", lambda url, **k: enviados.append((url, k["json"]))
                        or httpx.Response(200, request=httpx.Request("POST", url)))
    cfg.alerta_webhook_url = "https://chat.exemplo/hook"
    assert alertas.notificar_falha(cfg, "chirps", 7, "boom") == ["webhook"]
    assert enviados[0][0] == "https://chat.exemplo/hook" and "chirps" in enviados[0][1]["text"]


def test_indicadores(carregado):
    with carregado.connect() as conn:
        def ind(nome, data, tipo="bioma"):
            return conn.execute(text("""
                SELECT i.* FROM indicador i JOIN territorio t ON t.id = i.territorio_id
                WHERE i.indicador = :n AND i.data = :d AND t.tipo = :t LIMIT 1
            """), {"n": nome, "d": data, "t": tipo}).mappings().one()

        chuva = ind("anomalia_chuva_mm", date(2024, 1, 1))
        assert chuva["valor"] == pytest.approx(930) and chuva["referencia"] == pytest.approx(361.67, abs=0.01)
        assert chuva["nivel_alerta"] == "critico" and chuva["detalhes"]["periodo_referencia"] == "2014-2025"
        assert ind("anomalia_chuva_mm", date(2023, 1, 1))["nivel_alerta"] == "normal"

        # Ano hidrológico 2023/24: out-mar com janeiro anômalo (183 dias: 152 x 10 + 31 x 30), abr-set a 1 mm/dia.
        assert ind("chuva_estacao_chuvosa", date(2023, 10, 1))["valor"] == pytest.approx(152 * 10 + 31 * 30)
        assert ind("chuva_estacao_seca", date(2024, 4, 1))["valor"] == pytest.approx(183)
        total = ind("chuva_ano_hidrologico", date(2023, 10, 1))
        assert total["valor"] == pytest.approx(2450 + 183) and total["detalhes"]["ano_hidrologico"] == "2023/2024"

        taxa = ind("taxa_conversao_nativa_pct", date(2021, 1, 1))
        assert taxa["valor"] == pytest.approx(1.0) and taxa["detalhes"]["perda_ha"] == 10
        assert ind("vegetacao_nativa_ha", date(2022, 1, 1))["valor"] == 980

        cota = conn.execute(text("""SELECT * FROM indicador WHERE indicador = 'anomalia_cota_cm'
                                    AND data = '2024-01-01'""")).mappings().one()
        assert cota["estacao_codigo"] == "66825000" and cota["valor"] == 500 and cota["nivel_alerta"] == "critico"


@pytest.fixture(scope="module")
def api(carregado):
    from fastapi.testclient import TestClient

    from observatorio.api.app import app

    return TestClient(app)


def test_api_territorios_e_focos(api):
    assert api.get("/saude").json() == {"status": "ok"}
    territorios = api.get("/api/v1/territorios", params={"tipo": "municipio"}).json()
    assert [t["nome"] for t in territorios] == ["Corumbá", "Poconé"]
    geo = api.get("/api/v1/territorios", params={"tipo": "bioma", "formato": "geojson"}).json()
    assert geo["features"][0]["geometry"]["type"] == "MultiPolygon"

    focos = api.get("/api/v1/focos").json()
    assert {f["id"] for f in focos} == {"a1", "a2", "a3"}
    pocone = next(t["id"] for t in territorios if t["nome"] == "Poconé")
    assert [f["id"] for f in api.get("/api/v1/focos", params={"territorio": pocone}).json()] == ["a3"]
    geo = api.get("/api/v1/focos", params={"formato": "geojson", "satelite": "NOAA-20"}).json()
    assert geo["features"][0]["geometry"] == {"type": "Point", "coordinates": [-56.5, -19]}
    assert len(api.get("/api/v1/focos", params={"bbox": "-57.6,-19.1,-57.4,-18.9"}).json()) == 1
    assert len(api.get("/api/v1/focos", params={"conjunto": "firms-viirs"}).json()) == 1
    assert api.get("/api/v1/focos", params={"bbox": "x"}).status_code == 422


def test_api_series_com_download_csv(api):
    mensal = api.get("/api/v1/series", params={
        "variavel": "chuva_mm", "agregacao": "mes", "inicio": "2024-01-01", "fim": "2024-02-29"}).json()
    assert [(m["data"], m["valor"]) for m in mensal] == [("2024-01-01", 930.0), ("2024-02-01", 290.0)]
    r = api.get("/api/v1/series", params={"variavel": "cobertura_ha", "categoria": "3", "formato": "csv"})
    assert r.headers["content-type"].startswith("text/csv") and "cobertura_ha.csv" in r.headers["content-disposition"]
    linhas = r.text.strip().splitlines()
    assert linhas[0].startswith("data,valor,unidade,categoria") and len(linhas) == 4
    assert api.get("/api/v1/series", params={"variavel": "chuva_mm", "territorio": 99999}).status_code == 404
    variaveis = {v["variavel"] for v in api.get("/api/v1/series/variaveis").json()}
    assert {"chuva_mm", "focos", "focos_viirs", "cobertura_ha", "rebanho_bovino"} <= variaveis


def test_api_rios(api):
    (estacao,) = api.get("/api/v1/estacoes").json()
    assert estacao["codigo"] == "66825000" and estacao["ultima_cota_cm"] == 90
    assert estacao["nivel_alerta"] == "critico" and estacao["media_historica_cm"] is not None
    obs = api.get("/api/v1/estacoes/66825000/observacoes", params={"inicio": "2024-01-30"}).json()
    assert [o["consistencia"] for o in obs] == ["consistido", "consistido", "telemetria"]


def test_api_indicadores_e_alertas(api):
    serie = api.get("/api/v1/indicadores", params={"indicador": "anomalia_chuva_mm", "inicio": "2024-01-01",
                                                    "fim": "2024-01-01"}).json()
    assert serie[0]["territorio_tipo"] == "bioma" and serie[0]["zscore"] > 3
    assert api.get("/api/v1/indicadores", params={"indicador": "anomalia_cota_cm", "estacao": "66825000",
                                                  "formato": "csv"}).text.count("\n") == 16
    assert "chuva_ano_hidrologico" in {t["indicador"] for t in api.get("/api/v1/indicadores/tipos").json()}
    # Alertas consideram só o período mais recente de cada indicador: a anomalia de jan/2024 já passou.
    alertas = api.get("/api/v1/alertas").json()
    assert all(a["nivel_alerta"] != "normal" for a in alertas)
    assert not any(a["indicador"] == "anomalia_chuva_mm" for a in alertas)
    assert any(a["estacao_codigo"] == "66825000" for a in alertas)  # jan/2024 é o último mês da estação


def test_api_catalogo_fair_e_proveniencia(api):
    cat = api.get("/api/v1/catalogo")
    assert cat.headers["content-type"] == "application/ld+json"
    conjuntos = {d["@id"].rsplit("/", 1)[1]: d for d in cat.json()["dcat:dataset"]}
    assert {"inpe-focos", "firms-viirs", "mapbiomas-cobertura", "mapbiomas-fogo", "chirps", "era5",
            "ana-hidroweb"} <= set(conjuntos)
    for d in conjuntos.values():
        assert d["dct:identifier"] and d["dct:license"] and d["dct:source"] and d["dct:provenance"]["rdfs:label"]
        assert d["dcat:distribution"][0]["dcat:downloadURL"]
    assert conjuntos["chirps"]["dct:modified"] and "obs:versaoFonte" in conjuntos["chirps"]

    r = api.get("/id/conjunto/chirps", follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"] == "/api/v1/catalogo/chirps"
    assert api.get("/id/territorio/bioma/pantanal").json()["properties"]["nome"] == "Pantanal"
    assert api.get("/api/v1/catalogo/inexistente").status_code == 404

    csv_focos = api.get("/api/v1/catalogo/inpe-focos/dados").text.strip().splitlines()
    assert csv_focos[0].startswith("id,data_hora,satelite") and len(csv_focos) == 4
    dados = api.get("/api/v1/catalogo/ibge-sidra/dados", params={"formato": "json"}).json()
    assert len(dados) == 3 and dados[0]["execucao_id"]

    execucoes = api.get("/api/v1/execucoes", params={"status": "falha"}).json()
    assert execucoes and execucoes[0]["pipeline"] == "territorios"
    assert api.get(f"/api/v1/execucoes/{dados[0]['execucao_id']}").json()["pipeline"] == "ibge_sidra"
    assert "/api/v1/focos" in api.get("/api/openapi.json").json()["paths"]
