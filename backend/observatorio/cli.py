"""Linha de comando: observatorio {migrar,etl,agendador,api}."""
import argparse
import logging
import sys

from .config import config


def _params(pares: list[str]) -> dict[str, str]:
    params = {}
    for par in pares:
        chave, sep, valor = par.partition("=")
        if not sep:
            raise SystemExit(f"Parâmetro inválido (use chave=valor): {par}")
        params[chave] = valor
    return params


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    ap = argparse.ArgumentParser(prog="observatorio", description="Observatório do Pantanal — backend")
    sub = ap.add_subparsers(dest="comando", required=True)
    sub.add_parser("migrar", help="aplica as migrações do banco e sincroniza o catálogo")
    sub.add_parser("agendador", help="inicia o agendador dos pipelines")
    sub.add_parser("api", help="inicia a API REST")
    etl = sub.add_parser("etl", help="executa ou lista pipelines")
    etl_sub = etl.add_subparsers(dest="acao", required=True)
    etl_sub.add_parser("listar")
    rodar_p = etl_sub.add_parser("rodar")
    rodar_p.add_argument("pipelines", nargs="+")
    rodar_p.add_argument("-p", "--param", action="append", default=[], metavar="chave=valor")
    args = ap.parse_args(argv)

    if args.comando == "migrar":
        from alembic import command
        from alembic.config import Config as AlembicConfig

        from . import catalogo
        from .db import motor

        command.upgrade(AlembicConfig("alembic.ini"), "head")
        with motor().begin() as conn:
            catalogo.sincronizar(conn, config())
        return 0

    if args.comando == "api":
        import uvicorn

        uvicorn.run("observatorio.api.app:app", host="0.0.0.0", port=8000)
        return 0

    if args.comando == "agendador":
        from .agendador import criar

        criar().start()
        return 0

    from .db import motor
    from .etl.base import rodar
    from .etl.registro import PIPELINES

    if args.acao == "listar":
        agenda = config().agenda_efetiva()
        for nome, p in PIPELINES.items():
            estado = p.indisponivel(config()) or "pronto"
            print(f"{nome:22} {agenda.get(nome, '-'):16} {estado}")
        return 0

    codigo = 0
    for nome in args.pipelines:
        if nome not in PIPELINES:
            raise SystemExit(f"Pipeline desconhecido: {nome}. Opções: {', '.join(PIPELINES)}")
        if motivo := PIPELINES[nome].indisponivel(config()):
            print(f"{nome}: indisponível ({motivo})", file=sys.stderr)
            codigo = 2
            continue
        try:
            rodar(PIPELINES[nome], motor(), config(), _params(args.param))
        except Exception:
            logging.exception("Pipeline %s falhou", nome)
            codigo = 1
    return codigo


if __name__ == "__main__":
    sys.exit(main())
