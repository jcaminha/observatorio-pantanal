"""Catálogo de metadados FAIR: definição dos conjuntos de dados e exportação DCAT (JSON-LD)."""
import json
from typing import Any

from sqlalchemy import Connection, text

from .config import Config

CC_BY = ("CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/")
CC_BY_SA = ("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/")


def _c(id, titulo, descricao, orgao, url, licenca, metodo, espacial, temporal, inicio, freq, variaveis, chaves):
    return {
        "id": id, "titulo": titulo, "descricao": descricao, "orgao": orgao, "url_fonte": url,
        "licenca": licenca[0], "url_licenca": licenca[1], "metodo": metodo,
        "resolucao_espacial": espacial, "resolucao_temporal": temporal, "cobertura_inicio": inicio,
        "frequencia": freq, "variaveis": variaveis, "palavras_chave": chaves,
    }


CONJUNTOS: list[dict[str, Any]] = [
    _c("territorios", "Recortes territoriais do Pantanal",
       "Limites do bioma, municípios, unidades de conservação, sub-regiões e bacias usados para agregar as séries.",
       "INPE/TerraBrasilis; IBGE; MMA", "https://terrabrasilis.dpi.inpe.br/", CC_BY_SA,
       "Camadas vetoriais obtidas por WFS (SIRGAS 2000, tratadas como WGS 84) e carregadas no PostGIS.",
       "vetorial", None, None, "mensal", ["geom", "area_km2"], ["território", "limites"]),
    _c("inpe-focos", "Focos de calor — INPE/BDQueimadas",
       "Focos de calor detectados por satélite no bioma Pantanal, todos os satélites; "
       "as contagens usam o satélite de referência.",
       "INPE — Programa Queimadas", "https://terrabrasilis.dpi.inpe.br/queimadas/bdqueimadas/",
       ("Dados abertos INPE (uso livre com citação da fonte)", "https://www.gov.br/inpe/pt-br/acesso-a-informacao/dados-abertos"),
       "Arquivos CSV diários, mensais e anuais do servidor de dados abertos do INPE, filtrados pelo bioma "
       "Pantanal; contagens diárias por território via interseção espacial.",
       "1 km (MODIS) a 375 m (VIIRS)", "passagem do satélite", "2003-01-01", "horária",
       ["focos"], ["queimadas", "focos de calor", "fogo"]),
    _c("firms-viirs", "Fogo ativo VIIRS 375 m — NASA FIRMS",
       "Detecções de fogo ativo do sensor VIIRS (S-NPP, NOAA-20, NOAA-21) em tempo quase real.",
       "NASA LANCE/FIRMS", "https://firms.modaps.eosdis.nasa.gov/",
       ("Política de dados abertos NASA EOSDIS", "https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance"),
       "API de área do FIRMS para o retângulo envolvente do bioma; pontos fora do bioma são descartados.",
       "375 m", "passagem do satélite", None, "a cada 3 horas",
       ["focos_viirs"], ["queimadas", "fogo ativo", "VIIRS"]),
    _c("ana-hidroweb", "Cotas, vazões e chuva em estações — ANA/HidroWeb",
       "Séries diárias da Rede Hidrometeorológica Nacional para estações fluviométricas do Pantanal.",
       "ANA — Agência Nacional de Águas e Saneamento Básico", "https://www.snirh.gov.br/hidroweb/",
       ("Dados abertos ANA (uso livre com citação da fonte)", "https://dadosabertos.ana.gov.br/"),
       "Série histórica (bruta e consistida) e telemetria do serviço ServiceANA; a telemetria é agregada "
       "em média diária (cota, vazão) ou soma diária (chuva). Dado consistido prevalece sobre bruto e telemetria.",
       "estação", "diária", None, "a cada 6 horas",
       ["cota_cm", "vazao_m3s", "chuva_mm"], ["rios", "hidrologia", "cheia", "seca"]),
    _c("chirps", "Chuva — CHIRPS",
       "Precipitação diária média por território a partir da grade CHIRPS.",
       "UCSB Climate Hazards Center", "https://www.chc.ucsb.edu/data/chirps",
       ("CC0 1.0 (domínio público)", "https://creativecommons.org/publicdomain/zero/1.0/"),
       "Média zonal diária calculada no Google Earth Engine.",
       "0,05°", "diária", "1981-01-01", "diária", ["chuva_mm"], ["chuva", "precipitação"]),
    _c("era5", "Variáveis climáticas — ERA5 (Copernicus)",
       "Temperatura média e máxima e umidade relativa diárias por território, da reanálise ERA5.",
       "ECMWF / Copernicus Climate Change Service", "https://cds.climate.copernicus.eu/", CC_BY,
       "Média zonal diária no Google Earth Engine; umidade relativa derivada de temperatura e ponto de "
       "orvalho pela fórmula de Magnus.",
       "9 km (ERA5-Land) / 31 km (ERA5)", "diária", "1950-01-01", "diária",
       ["temp_media_c", "temp_max_c", "umidade_relativa_pct"], ["clima", "temperatura", "umidade"]),
    _c("mapbiomas-cobertura", "Uso e cobertura da terra — MapBiomas",
       "Área anual por classe de uso e cobertura da terra em cada território.",
       "Projeto MapBiomas", "https://brasil.mapbiomas.org/", CC_BY,
       "Soma da área dos pixels por classe (legenda MapBiomas) no Google Earth Engine.",
       "30 m", "anual", "1985-01-01", "anual", ["cobertura_ha"], ["uso da terra", "cobertura", "vegetação nativa"]),
    _c("mapbiomas-fogo", "Área queimada — MapBiomas Fogo",
       "Área queimada mensal em cada território.",
       "Projeto MapBiomas", "https://brasil.mapbiomas.org/", CC_BY,
       "Soma da área dos pixels queimados por mês no Google Earth Engine.",
       "30 m", "mensal", "1985-01-01", "anual", ["area_queimada_ha"], ["área queimada", "fogo"]),
    _c("prodes-desmatamento", "Desmatamento anual — PRODES Pantanal",
       "Área de supressão de vegetação nativa mapeada pelo PRODES, por território e ano.",
       "INPE — PRODES/TerraBrasilis", "https://terrabrasilis.dpi.inpe.br/", CC_BY_SA,
       "Polígonos anuais obtidos por WFS e intersectados com os territórios no PostGIS.",
       "30 m (área mínima 1 ha)", "anual", "2001-01-01", "mensal", ["desmatamento_km2"], ["desmatamento"]),
    _c("ibge-sidra", "Indicadores socioeconômicos municipais — IBGE/SIDRA",
       "Rebanho bovino (PPM), população estimada e PIB dos municípios do Pantanal.",
       "IBGE", "https://sidra.ibge.gov.br/",
       ("Uso livre com citação da fonte (IBGE)", "https://www.ibge.gov.br/acesso-informacao/institucional/politica-de-dados-abertos.html"),
       "Consulta à API do SIDRA por município; o valor do bioma é a soma dos municípios.",
       "município", "anual", None, "mensal", ["rebanho_bovino", "populacao", "pib"], ["socioeconomia", "pecuária"]),
    _c("indicadores", "Indicadores derivados e sinais de alerta",
       "Anomalias em relação à climatologia, acumulados por ano hidrológico, frequência de fogo por área "
       "e taxa de conversão da vegetação nativa.",
       "INPP — Observatório do Pantanal", "https://www.gov.br/inpp/", CC_BY,
       "Calculados a partir dos demais conjuntos deste catálogo (ver observatorio/indicadores).",
       None, "mensal e anual", None, "diária", [], ["anomalia", "alerta", "indicadores"]),
]


def sincronizar(conn: Connection, cfg: Config) -> None:
    """Grava as definições do catálogo no banco, preservando datas e versões já registradas."""
    for c in CONJUNTOS:
        conn.execute(
            text("""
                INSERT INTO conjunto_dados (id, pid, titulo, descricao, orgao, url_fonte, licenca, url_licenca,
                    metodo, resolucao_espacial, resolucao_temporal, cobertura_inicio, frequencia, variaveis, palavras_chave)
                VALUES (:id, :pid, :titulo, :descricao, :orgao, :url_fonte, :licenca, :url_licenca,
                    :metodo, :resolucao_espacial, :resolucao_temporal, :cobertura_inicio, :frequencia,
                    CAST(:variaveis AS jsonb), CAST(:palavras_chave AS jsonb))
                ON CONFLICT (id) DO UPDATE SET
                    pid = excluded.pid, titulo = excluded.titulo, descricao = excluded.descricao,
                    orgao = excluded.orgao, url_fonte = excluded.url_fonte, licenca = excluded.licenca,
                    url_licenca = excluded.url_licenca, metodo = excluded.metodo,
                    resolucao_espacial = excluded.resolucao_espacial,
                    resolucao_temporal = excluded.resolucao_temporal,
                    cobertura_inicio = excluded.cobertura_inicio, frequencia = excluded.frequencia,
                    variaveis = excluded.variaveis, palavras_chave = excluded.palavras_chave
            """),
            {**c, "pid": f"{cfg.pid_base}/conjunto/{c['id']}",
             "variaveis": json.dumps(c["variaveis"]), "palavras_chave": json.dumps(c["palavras_chave"])},
        )


def dcat_dataset(linha: dict[str, Any], cfg: Config) -> dict[str, Any]:
    """Um conjunto de dados como dcat:Dataset (DCAT 2 / schema.org compatível, JSON-LD)."""
    api = cfg.api_url_publica.rstrip("/")
    distribuicoes = [
        {
            "@type": "dcat:Distribution",
            "dct:title": f"{linha['titulo']} ({fmt.upper()})",
            "dcat:accessURL": f"{api}/api/v1/catalogo/{linha['id']}",
            "dcat:downloadURL": f"{api}/api/v1/catalogo/{linha['id']}/dados?formato={fmt}",
            "dcat:mediaType": midia,
            "dct:license": linha["url_licenca"] or linha["licenca"],
        }
        for fmt, midia in (("csv", "text/csv"), ("json", "application/json"))
    ]
    ds: dict[str, Any] = {
        "@id": linha["pid"],
        "@type": "dcat:Dataset",
        "dct:identifier": linha["pid"],
        "dct:title": linha["titulo"],
        "dct:description": linha["descricao"],
        "dct:publisher": {"@type": "foaf:Organization", "foaf:name": "Instituto Nacional de Pesquisa do Pantanal (INPP)"},
        "dct:creator": {"@type": "foaf:Organization", "foaf:name": linha["orgao"]},
        "dct:source": linha["url_fonte"],
        "dct:license": linha["url_licenca"] or linha["licenca"],
        "dct:rights": linha["licenca"],
        "dct:provenance": {"@type": "dct:ProvenanceStatement", "rdfs:label": linha["metodo"]},
        "prov:wasGeneratedBy": f"{api}/api/v1/execucoes?conjunto={linha['id']}",
        "dct:accrualPeriodicity": linha["frequencia"],
        "dct:language": "pt-BR",
        "dct:spatial": "Pantanal, Brasil",
        "dcat:keyword": linha["palavras_chave"],
        "dcat:distribution": distribuicoes,
        "obs:variaveis": linha["variaveis"],
        "obs:resolucaoEspacial": linha["resolucao_espacial"],
        "obs:resolucaoTemporal": linha["resolucao_temporal"],
        "obs:versaoFonte": linha["versao_fonte"],
    }
    if linha["cobertura_inicio"]:
        ds["dct:temporal"] = {"@type": "dct:PeriodOfTime", "dcat:startDate": str(linha["cobertura_inicio"])}
    if linha["atualizado_em"]:
        ds["dct:modified"] = linha["atualizado_em"].isoformat()
    return ds


CONTEXTO_DCAT = {
    "dcat": "http://www.w3.org/ns/dcat#",
    "dct": "http://purl.org/dc/terms/",
    "foaf": "http://xmlns.com/foaf/0.1/",
    "prov": "http://www.w3.org/ns/prov#",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "obs": "https://observatorio.inpp.gov.br/ns#",
}
