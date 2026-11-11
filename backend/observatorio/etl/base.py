"""Infraestrutura comum dos pipelines: contexto, registro de proveniência e alerta de falha."""
import json
import logging
import tempfile
import time
import traceback
from dataclasses import dataclass, field
from datetime import date
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Any, Iterable

import httpx
from sqlalchemy import Connection, Engine, text

from .. import catalogo
from ..alertas import notificar_falha
from ..config import Config

log = logging.getLogger(__name__)


class FonteIndisponivel(RuntimeError):
    """A fonte respondeu de forma inesperada (erro HTTP persistente, formato alterado...)."""


@dataclass
class Contexto:
    conn: Connection
    http: httpx.Client
    cfg: Config
    execucao_id: int
    params: dict[str, Any]
    origens: list[str] = field(default_factory=list)
    versao_fonte: str | None = None
    avisos: list[str] = field(default_factory=list)
    lidos: int = 0
    carregados: int = 0
    espera_base: float = 2.0
    ultima_modificacao: str | None = None

    def baixar(
        self, url: str, *, params: dict[str, Any] | None = None, tentativas: int = 4,
        registrar_como: str | None = None,
    ) -> httpx.Response:
        """GET com novas tentativas (espera exponencial) e registro da origem para a proveniência.

        Erros 4xx (exceto 429) levantam httpx.HTTPStatusError de imediato; erros de rede, 429 e 5xx
        são repetidos e, persistindo, viram FonteIndisponivel. Use `registrar_como` quando a URL
        contém segredo (chave de API) que não pode ir para o registro de proveniência.
        """
        ultimo: Exception | None = None
        for i in range(tentativas):
            try:
                r = self.http.get(url, params=params)
                if r.status_code < 500 and r.status_code != 429:
                    r.raise_for_status()
                    self.origens.append(registrar_como or str(r.request.url))
                    return r
                ultimo = FonteIndisponivel(f"HTTP {r.status_code}")
            except httpx.TransportError as e:
                ultimo = e
            if i < tentativas - 1:
                time.sleep(self.espera_base * (2**i))
        raise FonteIndisponivel(f"Falha ao baixar {registrar_como or url}: {ultimo}") from ultimo

    def baixar_arquivo(self, url: str) -> Path:
        """Baixa para um arquivo temporário (fontes grandes), com as mesmas regras de `baixar`.

        Quem chama é responsável por apagar o arquivo.
        """
        ultimo: Exception | None = None
        for i in range(4):
            try:
                with self.http.stream("GET", url) as r:
                    if r.status_code < 500 and r.status_code != 429:
                        r.raise_for_status()
                        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(url).suffix) as tmp:
                            for bloco in r.iter_bytes():
                                tmp.write(bloco)
                        self.origens.append(url)
                        self.ultima_modificacao = r.headers.get("last-modified")
                        return Path(tmp.name)
                    ultimo = FonteIndisponivel(f"HTTP {r.status_code}")
            except httpx.TransportError as e:
                ultimo = e
            if i < 3:
                time.sleep(self.espera_base * (2**i))
        raise FonteIndisponivel(f"Falha ao baixar {url}: {ultimo}") from ultimo

    def bioma_id(self) -> int:
        linha = self.conn.execute(text("SELECT id FROM territorio WHERE tipo = 'bioma' LIMIT 1")).first()
        if linha is None:
            raise RuntimeError("Território do bioma não carregado: execute o pipeline 'territorios' primeiro")
        return linha[0]


class Pipeline:
    nome: str
    conjunto: str

    def indisponivel(self, cfg: Config) -> str | None:
        """Motivo pelo qual o pipeline não pode rodar (credencial ausente etc.), ou None."""
        return None

    def executar(self, ctx: Contexto) -> None:
        raise NotImplementedError


def _versao_codigo() -> str:
    try:
        return version("observatorio-pantanal")
    except PackageNotFoundError:
        return "dev"


def rodar(
    pipeline: Pipeline,
    motor: Engine,
    cfg: Config,
    params: dict[str, Any] | None = None,
    http: httpx.Client | None = None,
) -> int:
    """Executa um pipeline registrando a proveniência. Devolve o id da execução.

    Os dados são gravados em uma única transação: em caso de falha nada é carregado,
    a execução fica registrada como 'falha' e a equipe é avisada. A exceção é relançada.
    """
    params = params or {}
    with motor.begin() as conn:
        catalogo.sincronizar(conn, cfg)
        execucao_id = conn.execute(
            text("""
                INSERT INTO execucao_etl (pipeline, conjunto_id, status, parametros, versao_codigo)
                VALUES (:p, :c, 'em_execucao', CAST(:params AS jsonb), :v) RETURNING id
            """),
            {"p": pipeline.nome, "c": pipeline.conjunto,
             "params": json.dumps({k: v for k, v in params.items() if not k.startswith("_")}, default=str),
             "v": _versao_codigo()},
        ).scalar_one()

    cliente = http or httpx.Client(
        timeout=httpx.Timeout(120, connect=20), follow_redirects=True,
        headers={"User-Agent": "observatorio-pantanal-etl"},
    )
    ctx: Contexto | None = None
    try:
        with motor.begin() as conn:
            ctx = Contexto(conn=conn, http=cliente, cfg=cfg, execucao_id=execucao_id, params=params)
            pipeline.executar(ctx)
            conn.execute(
                text("""
                    UPDATE execucao_etl SET status = 'sucesso', finalizado_em = now(),
                        origens = CAST(:o AS jsonb), versao_fonte = :vf,
                        registros_lidos = :l, registros_carregados = :c, erro = :avisos
                    WHERE id = :id
                """),
                {"o": json.dumps(ctx.origens[:200]), "vf": ctx.versao_fonte, "l": ctx.lidos,
                 "c": ctx.carregados, "id": execucao_id,
                 "avisos": "\n".join(ctx.avisos)[:4000] or None},
            )
            conn.execute(
                text("""
                    UPDATE conjunto_dados SET atualizado_em = now(),
                        versao_fonte = coalesce(:vf, versao_fonte) WHERE id = :id
                """),
                {"vf": ctx.versao_fonte, "id": pipeline.conjunto},
            )
        log.info("Pipeline %s concluído: %s lidos, %s carregados", pipeline.nome, ctx.lidos, ctx.carregados)
        return execucao_id
    except Exception as e:
        erro = f"{type(e).__name__}: {e}"
        with motor.begin() as conn:
            conn.execute(
                text("""
                    UPDATE execucao_etl SET status = 'falha', finalizado_em = now(), erro = :e,
                        origens = CAST(:o AS jsonb) WHERE id = :id
                """),
                {"e": erro + "\n" + traceback.format_exc()[-4000:],
                 "o": json.dumps(ctx.origens[:200] if ctx else []), "id": execucao_id},
            )
        notificar_falha(cfg, pipeline.nome, execucao_id, erro)
        raise
    finally:
        if http is None:
            cliente.close()


def em_lotes(itens: list, tamanho: int = 5000) -> Iterable[list]:
    for i in range(0, len(itens), tamanho):
        yield itens[i : i + tamanho]


def gravar_series(ctx: Contexto, conjunto: str, linhas: list[dict[str, Any]]) -> None:
    """Upsert em serie_territorial.

    Cada linha: territorio_id, variavel, periodicidade, data, valor, unidade e, opcionalmente, categoria.
    """
    sql = text("""
        INSERT INTO serie_territorial
            (territorio_id, conjunto_id, variavel, categoria, periodicidade, data, valor, unidade, execucao_id)
        VALUES (:territorio_id, :conjunto, :variavel, :categoria, :periodicidade, :data, :valor, :unidade, :execucao)
        ON CONFLICT (territorio_id, variavel, categoria, periodicidade, data)
        DO UPDATE SET valor = excluded.valor, unidade = excluded.unidade,
                      conjunto_id = excluded.conjunto_id, execucao_id = excluded.execucao_id
    """)
    for lote in em_lotes(linhas):
        ctx.conn.execute(
            sql, [{"categoria": "", **l, "conjunto": conjunto, "execucao": ctx.execucao_id} for l in lote]
        )
    ctx.carregados += len(linhas)


def ultima_data(ctx: Contexto, variavel: str, periodicidade: str) -> date | None:
    return ctx.conn.execute(
        text("SELECT max(data) FROM serie_territorial WHERE variavel = :v AND periodicidade = :p"),
        {"v": variavel, "p": periodicidade},
    ).scalar()


def para_data(valor: Any) -> date | None:
    if valor is None or isinstance(valor, date):
        return valor
    return date.fromisoformat(str(valor))
