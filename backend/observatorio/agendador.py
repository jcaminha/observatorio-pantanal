"""Agendador: dispara os pipelines conforme a agenda (cron), sem intervenção manual."""
import logging

from apscheduler.events import EVENT_JOB_MISSED
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from .alertas import notificar_falha
from .config import config
from .db import motor
from .etl.base import rodar
from .etl.registro import PIPELINES

log = logging.getLogger(__name__)


def executar_agendado(nome: str) -> None:
    cfg = config()
    pipeline = PIPELINES[nome]
    if motivo := pipeline.indisponivel(cfg):
        log.warning("Pipeline %s ignorado: %s", nome, motivo)
        return
    try:
        rodar(pipeline, motor(), cfg)
    except Exception:
        # rodar() já registrou a falha e avisou a equipe; o agendador segue com os demais fluxos.
        log.exception("Pipeline %s falhou", nome)


def criar() -> BlockingScheduler:
    cfg = config()
    agendador = BlockingScheduler(timezone=cfg.fuso)
    for nome, cron in cfg.agenda_efetiva().items():
        if nome not in PIPELINES:
            raise ValueError(f"Pipeline desconhecido na agenda: {nome}")
        agendador.add_job(
            executar_agendado, CronTrigger.from_crontab(cron, timezone=cfg.fuso), args=[nome], id=nome,
            max_instances=1, coalesce=True, misfire_grace_time=3600,
        )
        log.info("Agendado %s: %s", nome, cron)

    def perdido(evento) -> None:
        notificar_falha(cfg, evento.job_id, None, "Execução agendada não ocorreu (agendador parado ou ocupado)")

    agendador.add_listener(perdido, EVENT_JOB_MISSED)
    return agendador
