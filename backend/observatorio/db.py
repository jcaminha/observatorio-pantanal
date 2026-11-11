from functools import lru_cache

from sqlalchemy import Engine, create_engine

from .config import config


@lru_cache
def motor() -> Engine:
    return create_engine(config().database_url, pool_pre_ping=True)
