from .ana_hidroweb import AnaEstacoes, AnaHidroweb
from .base import Pipeline
from .firms_viirs import FirmsViirs
from .gee import Chirps, Era5, MapbiomasCobertura, MapbiomasFogo
from .ibge_sidra import IbgeSidra
from .inpe_focos import InpeFocos
from .prodes import ProdesDesmatamento
from .territorios import Territorios
from ..indicadores.pipeline import Indicadores

PIPELINES: dict[str, Pipeline] = {
    p.nome: p
    for p in (
        Territorios(), InpeFocos(), FirmsViirs(), AnaEstacoes(), AnaHidroweb(), Chirps(), Era5(),
        MapbiomasCobertura(), MapbiomasFogo(), ProdesDesmatamento(), IbgeSidra(), Indicadores(),
    )
}
