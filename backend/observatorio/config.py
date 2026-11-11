"""Configuração por variáveis de ambiente (prefixo OBS_)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

# Expressões cron (minuto hora dia mês dia-da-semana), horário de America/Campo_Grande.
AGENDA_PADRAO: dict[str, str] = {
    "territorios": "0 3 1 * *",
    "inpe_focos": "15 * * * *",
    "firms_viirs": "45 */3 * * *",
    "ana_estacoes": "30 3 * * 1",
    "ana_hidroweb": "0 */6 * * *",
    "chirps": "0 5 * * *",
    "era5": "30 5 * * *",
    "mapbiomas_cobertura": "0 4 2 * *",
    "mapbiomas_fogo": "30 4 2 * *",
    "prodes_desmatamento": "0 2 3 * *",
    "ibge_sidra": "0 2 4 * *",
    "indicadores": "0 7 * * *",
}

# Tabelas do SIDRA/IBGE carregadas por município (ver etl/ibge_sidra.py).
SIDRA_PADRAO: list[dict[str, str]] = [
    {"variavel": "rebanho_bovino", "unidade": "cabeças", "caminho": "t/3939/v/105/c79/2670"},
    {"variavel": "populacao", "unidade": "pessoas", "caminho": "t/6579/v/9324"},
    {"variavel": "pib", "unidade": "mil R$", "caminho": "t/5938/v/37"},
]


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="OBS_", env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://observatorio:observatorio@localhost:5432/observatorio"
    # Base dos identificadores persistentes (resolvidos pela API em /id/...).
    pid_base: str = "https://observatorio.inpp.gov.br/id"
    api_url_publica: str = "http://localhost:8000"
    cors_origens: list[str] = ["*"]
    fuso: str = "America/Campo_Grande"

    # Alertas de falha para a equipe
    alerta_webhook_url: str | None = None
    smtp_host: str | None = None
    smtp_porta: int = 587
    smtp_usuario: str | None = None
    smtp_senha: str | None = None
    alerta_email_de: str = "observatorio@inpp.gov.br"
    alerta_email_para: list[str] = []

    # Fontes
    inpe_url: str = "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv"
    inpe_satelite_referencia: str = "AQUA_M-T"
    firms_url: str = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
    firms_map_key: str | None = None
    firms_produtos: list[str] = ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"]
    ana_url: str = "http://telemetriaws1.ana.gov.br/ServiceANA.asmx"
    ana_sub_bacias: list[str] = ["66", "67"]
    ana_estacoes: list[str] = []  # vazio = todas as fluviométricas telemétricas dentro do bioma
    sidra_url: str = "https://apisidra.ibge.gov.br/values"
    sidra_tabelas: list[dict[str, str]] = SIDRA_PADRAO
    terrabrasilis_wfs: str = "https://terrabrasilis.dpi.inpe.br/geoserver/prodes-pantanal-nb/ows"
    # Recortes sem serviço público estável (sub-regiões, bacias): GeoJSON por URL ou arquivo.
    # Ex.: [{"tipo":"sub_regiao","origem":"/dados/subregioes.geojson","campo_codigo":"id","campo_nome":"nome"}]
    territorios_extra: list[dict[str, str]] = []

    # Google Earth Engine (conta de serviço)
    gee_chave_json: str | None = None
    gee_projeto: str | None = None
    gee_chirps: str = "UCSB-CHG/CHIRPS/DAILY"
    gee_era5: str = "ECMWF/ERA5_LAND/DAILY_AGGR"
    gee_mapbiomas_cobertura: str = (
        "projects/mapbiomas-public/assets/brazil/lulc/collection9/mapbiomas_collection90_integration_v1"
    )
    gee_mapbiomas_fogo: str = (
        "projects/mapbiomas-public/assets/brazil/fire/collection3/"
        "mapbiomas_fire_collection3_monthly_burned_v1"
    )

    # Indicadores
    climatologia_inicio: int = 1991
    climatologia_fim: int = 2020
    ano_hidrologico_mes_inicio: int = 10  # outubro a setembro

    agenda: dict[str, str] = {}

    def agenda_efetiva(self) -> dict[str, str]:
        return {**AGENDA_PADRAO, **self.agenda}


@lru_cache
def config() -> Config:
    return Config()
