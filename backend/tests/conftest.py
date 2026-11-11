"""Testes de integração usam um PostGIS real (OBS_TEST_DATABASE_URL); sem ele, são pulados."""
import os

import pytest
from sqlalchemy import create_engine, text

URL_TESTE = os.environ.get("OBS_TEST_DATABASE_URL")
if URL_TESTE:
    os.environ["OBS_DATABASE_URL"] = URL_TESTE
for variavel in ("OBS_FIRMS_MAP_KEY", "OBS_GEE_CHAVE_JSON", "OBS_ALERTA_WEBHOOK_URL", "OBS_SMTP_HOST"):
    os.environ.pop(variavel, None)


@pytest.fixture(scope="session")
def motor():
    if not URL_TESTE:
        pytest.skip("OBS_TEST_DATABASE_URL não definida")
    base, _, nome = URL_TESTE.rpartition("/")
    admin = create_engine(f"{base}/postgres", isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{nome}" WITH (FORCE)'))
        conn.execute(text(f'CREATE DATABASE "{nome}"'))

    from alembic import command
    from alembic.config import Config as AlembicConfig

    from observatorio.db import motor as criar_motor

    command.upgrade(AlembicConfig("alembic.ini"), "head")
    return criar_motor()


@pytest.fixture
def cfg():
    from observatorio.config import Config

    return Config(_env_file=None, firms_map_key="segredo", sidra_tabelas=[
        {"variavel": "rebanho_bovino", "unidade": "cabeças", "caminho": "t/3939/v/105/c79/2670"}])


@pytest.fixture(autouse=True)
def sem_espera(monkeypatch):
    monkeypatch.setattr("observatorio.etl.base.time.sleep", lambda _: None)
