"""Avisos à equipe quando um fluxo falha: webhook (Slack/Teams/Mattermost) e e-mail."""
import logging
import smtplib
from email.message import EmailMessage

import httpx

from .config import Config

log = logging.getLogger(__name__)


def notificar_falha(cfg: Config, pipeline: str, execucao_id: int | None, erro: str) -> list[str]:
    """Envia o aviso pelos canais configurados e devolve os canais que receberam.

    Nunca levanta exceção: uma falha no aviso não pode mascarar a falha original.
    """
    assunto = f"[Observatório Pantanal] Falha no pipeline {pipeline}"
    corpo = f"{assunto}\nExecução: {execucao_id}\nErro: {erro[:1500]}"
    log.error(corpo)
    enviados: list[str] = []

    if cfg.alerta_webhook_url:
        try:
            httpx.post(cfg.alerta_webhook_url, json={"text": corpo}, timeout=15).raise_for_status()
            enviados.append("webhook")
        except Exception:
            log.exception("Não foi possível enviar o alerta por webhook")

    if cfg.smtp_host and cfg.alerta_email_para:
        try:
            msg = EmailMessage()
            msg["Subject"] = assunto
            msg["From"] = cfg.alerta_email_de
            msg["To"] = ", ".join(cfg.alerta_email_para)
            msg.set_content(corpo)
            with smtplib.SMTP(cfg.smtp_host, cfg.smtp_porta, timeout=20) as smtp:
                smtp.starttls()
                if cfg.smtp_usuario:
                    smtp.login(cfg.smtp_usuario, cfg.smtp_senha or "")
                smtp.send_message(msg)
            enviados.append("email")
        except Exception:
            log.exception("Não foi possível enviar o alerta por e-mail")

    if not enviados:
        log.warning("Nenhum canal de alerta entregou o aviso (configure OBS_ALERTA_WEBHOOK_URL ou SMTP)")
    return enviados
