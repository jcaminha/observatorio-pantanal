"""Estações, cotas, vazões e chuva da ANA (serviço ServiceANA do HidroWeb/Telemetria)."""
import calendar
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import text

from .base import Contexto, FonteIndisponivel, Pipeline, para_data

# tipoDados do HidroSerieHistorica -> (variável, prefixo das colunas diárias)
TIPOS_HISTORICOS = {1: ("cota_cm", "Cota"), 3: ("vazao_m3s", "Vazao")}
PARAMS_INVENTARIO = (
    "codEstDE", "codEstATE", "tpEst", "nmEst", "nmRio", "codSubBacia", "codBacia",
    "nmMunicipio", "nmEstado", "sgResp", "sgOper", "telemetrica",
)
JANELA_TELEMETRIA = 400  # dias
UFS = {"MATO GROSSO DO SUL": "MS", "MATO GROSSO": "MT"}


def _registros(xml: bytes, marca: str) -> list[dict[str, str]]:
    try:
        raiz = ET.fromstring(xml)
    except ET.ParseError as e:
        raise FonteIndisponivel(f"XML inválido da ANA: {e}") from e
    return [{c.tag: (c.text or "").strip() for c in el} for el in raiz.iter(marca)]


def _f(valor: str | None) -> float | None:
    return float(valor) if valor not in (None, "") else None


def ler_inventario(xml: bytes) -> list[dict[str, Any]]:
    estacoes = []
    for r in _registros(xml, "Table"):
        if not r.get("Latitude") or not r.get("Longitude"):
            continue
        estacoes.append({
            "codigo": r["Codigo"], "nome": r["Nome"].title(), "rio": r.get("RioNome", "").title() or None,
            "municipio": r.get("nmMunicipio", "").title() or None, "uf": UFS.get(r.get("nmEstado", "")),
            "sub_bacia": r.get("SubBaciaCodigo") or None, "area": _f(r.get("AreaDrenagem")),
            "altitude": _f(r.get("Altitude")), "telemetrica": r.get("TipoEstacaoTelemetrica") == "1",
            "operadora": r.get("OperadoraSigla") or None,
            "lat": float(r["Latitude"]), "lon": float(r["Longitude"]),
        })
    return estacoes


def ler_serie_historica(xml: bytes, prefixo: str) -> dict[date, tuple[float, int]]:
    """Série diária {data: (valor, consistência)}; o dado consistido (2) prevalece sobre o bruto (1)."""
    serie: dict[date, tuple[float, int]] = {}
    for r in _registros(xml, "SerieHistorica"):
        mes = datetime.fromisoformat(r["DataHora"]).date().replace(day=1)
        nivel = int(r.get("NivelConsistencia") or 1)
        for dia in range(1, calendar.monthrange(mes.year, mes.month)[1] + 1):
            valor = _f(r.get(f"{prefixo}{dia:02d}"))
            if valor is None:
                continue
            quando = mes.replace(day=dia)
            if quando not in serie or nivel >= serie[quando][1]:
                serie[quando] = (valor, nivel)
    return serie


def ler_telemetria(xml: bytes) -> dict[str, dict[date, float]]:
    """Agrega as leituras telemétricas por dia: média de cota e vazão, soma de chuva."""
    leituras: dict[str, dict[date, list[float]]] = {v: defaultdict(list) for v in ("cota_cm", "vazao_m3s", "chuva_mm")}
    for r in _registros(xml, "DadosHidrometereologicos"):
        dia = datetime.fromisoformat(r["DataHora"]).date()
        for campo, variavel in (("Nivel", "cota_cm"), ("Vazao", "vazao_m3s"), ("Chuva", "chuva_mm")):
            valor = _f(r.get(campo))
            if valor is not None:
                leituras[variavel][dia].append(valor)
    return {
        v: {d: (sum(xs) if v == "chuva_mm" else sum(xs) / len(xs)) for d, xs in por_dia.items()}
        for v, por_dia in leituras.items()
    }


class AnaEstacoes(Pipeline):
    """Inventário das estações fluviométricas telemétricas situadas dentro do bioma."""

    nome = "ana_estacoes"
    conjunto = "ana-hidroweb"

    def executar(self, ctx: Contexto) -> None:
        url = f"{ctx.cfg.ana_url.rstrip('/')}/HidroInventario"
        vazio = dict.fromkeys(PARAMS_INVENTARIO, "")
        if ctx.cfg.ana_estacoes:
            consultas = [{**vazio, "codEstDE": c, "codEstATE": c} for c in ctx.cfg.ana_estacoes]
        else:
            consultas = [{**vazio, "codSubBacia": s, "tpEst": "1", "telemetrica": "1"} for s in ctx.cfg.ana_sub_bacias]

        estacoes: dict[str, dict[str, Any]] = {}
        for params in consultas:
            for e in ler_inventario(ctx.baixar(url, params=params).content):
                estacoes[e["codigo"]] = e
        ctx.lidos = len(estacoes)
        if not estacoes:
            raise FonteIndisponivel("Inventário da ANA não retornou estações")

        # Com lista explícita todas entram; caso contrário, só as que caem dentro do bioma.
        filtro = "" if ctx.cfg.ana_estacoes else """
            WHERE EXISTS (SELECT 1 FROM territorio t WHERE t.tipo = 'bioma'
                          AND ST_Intersects(t.geom, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)))"""
        if not ctx.cfg.ana_estacoes:
            ctx.bioma_id()
        sql = text(f"""
            INSERT INTO estacao (codigo, nome, rio, municipio, uf, sub_bacia, area_drenagem_km2, altitude_m,
                telemetrica, operadora, execucao_id, geom)
            SELECT :codigo, :nome, :rio, :municipio, :uf, :sub_bacia, :area, :altitude, :telemetrica,
                :operadora, :execucao, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)
            {filtro}
            ON CONFLICT (codigo) DO UPDATE SET nome = excluded.nome, rio = excluded.rio,
                municipio = excluded.municipio, uf = excluded.uf, sub_bacia = excluded.sub_bacia,
                area_drenagem_km2 = excluded.area_drenagem_km2, altitude_m = excluded.altitude_m,
                telemetrica = excluded.telemetrica, operadora = excluded.operadora,
                execucao_id = excluded.execucao_id, geom = excluded.geom
        """)
        for e in estacoes.values():
            ctx.carregados += ctx.conn.execute(sql, {**e, "execucao": ctx.execucao_id}).rowcount
        ctx.versao_fonte = f"inventário consultado em {date.today().isoformat()}"


SQL_OBS = text("""
    INSERT INTO observacao_estacao (estacao_codigo, variavel, data, valor, consistencia, execucao_id)
    VALUES (:estacao, :variavel, :data, :valor, :consistencia, :execucao)
    ON CONFLICT (estacao_codigo, variavel, data) DO UPDATE
        SET valor = excluded.valor, consistencia = excluded.consistencia, execucao_id = excluded.execucao_id
        WHERE excluded.consistencia >= observacao_estacao.consistencia
          AND (excluded.valor, excluded.consistencia)
              IS DISTINCT FROM (observacao_estacao.valor, observacao_estacao.consistencia)
""")


class AnaHidroweb(Pipeline):
    """Séries diárias das estações cadastradas.

    Parâmetros opcionais: inicio (AAAA-MM-DD) para a série histórica; dias_telemetria;
    estacoes (códigos separados por vírgula).
    """

    nome = "ana_hidroweb"
    conjunto = "ana-hidroweb"

    def executar(self, ctx: Contexto) -> None:
        codigos = [c for (c,) in ctx.conn.execute(text("SELECT codigo FROM estacao ORDER BY codigo"))]
        if ctx.params.get("estacoes"):
            pedidos = set(str(ctx.params["estacoes"]).split(","))
            codigos = [c for c in codigos if c in pedidos]
        if not codigos:
            raise RuntimeError("Nenhuma estação cadastrada: execute o pipeline 'ana_estacoes' primeiro")

        hoje = date.today()
        falhas: list[str] = []
        for codigo in codigos:
            try:
                linhas = self._estacao(ctx, codigo, hoje)
            except FonteIndisponivel as e:
                falhas.append(f"{codigo}: {e}")
                continue
            ctx.lidos += len(linhas)
            for inicio in range(0, len(linhas), 5000):
                ctx.carregados += ctx.conn.execute(SQL_OBS, linhas[inicio : inicio + 5000]).rowcount

        # A ANA oscila estação a estação; só é falha do fluxo se a maioria não respondeu.
        if len(falhas) * 2 > len(codigos):
            raise FonteIndisponivel(f"{len(falhas)} de {len(codigos)} estações falharam; primeira: {falhas[0]}")
        ctx.avisos.extend(falhas)
        ctx.versao_fonte = f"consulta em {hoje.isoformat()}"

    def _estacao(self, ctx: Contexto, codigo: str, hoje: date) -> list[dict[str, Any]]:
        base = ctx.cfg.ana_url.rstrip("/")
        linhas: dict[tuple[str, date], dict[str, Any]] = {}

        def registrar(variavel: str, quando: date, valor: float, consistencia: int) -> None:
            chave = (variavel, quando)
            if chave not in linhas or consistencia >= linhas[chave]["consistencia"]:
                linhas[chave] = {"estacao": codigo, "variavel": variavel, "data": quando, "valor": valor,
                                 "consistencia": consistencia, "execucao": ctx.execucao_id}

        # Telemetria primeiro, para que o dado histórico (bruto/consistido) prevaleça onde houver ambos.
        if ctx.params.get("dias_telemetria"):
            inicio_tel = hoje - timedelta(days=int(ctx.params["dias_telemetria"]))
        else:
            # A telemetria cobre o trecho que a série histórica ainda não alcançou (até JANELA_TELEMETRIA).
            # Se esse trecho já está preenchido, basta reler os últimos dias; se há lacuna, relê tudo.
            limite = hoje - timedelta(days=JANELA_TELEMETRIA)
            fronteira, ultima, dias = ctx.conn.execute(text("""
                SELECT f.d, max(o.data) FILTER (WHERE o.consistencia = 0),
                       count(DISTINCT o.data) FILTER (WHERE o.data > f.d)
                FROM (SELECT greatest(coalesce(max(data) FILTER (WHERE consistencia >= 1), :lim), :lim) AS d
                      FROM observacao_estacao WHERE estacao_codigo = :c) f
                LEFT JOIN observacao_estacao o ON o.estacao_codigo = :c
                GROUP BY f.d
            """), {"c": codigo, "lim": limite}).one()
            preenchido = ultima is not None and dias >= 0.8 * (ultima - fronteira).days
            inicio_tel = max(ultima - timedelta(days=10), fronteira) if preenchido else fronteira
        r = ctx.baixar(f"{base}/DadosHidrometeorologicos", params={
            "codEstacao": codigo, "dataInicio": f"{inicio_tel:%d/%m/%Y}", "dataFim": f"{hoje:%d/%m/%Y}",
        })
        for variavel, por_dia in ler_telemetria(r.content).items():
            for quando, valor in por_dia.items():
                registrar(variavel, quando, round(valor, 3), 0)

        for tipo, (variavel, prefixo) in TIPOS_HISTORICOS.items():
            inicio = para_data(ctx.params.get("inicio"))
            if inicio is None:
                ultimo = ctx.conn.execute(text("""
                    SELECT max(data) FROM observacao_estacao
                    WHERE estacao_codigo = :c AND variavel = :v AND consistencia >= 1
                """), {"c": codigo, "v": variavel}).scalar()
                # Relê os últimos 2 anos: é a janela em que a ANA costuma consistir dados brutos.
                inicio = ultimo - timedelta(days=730) if ultimo else date(1900, 1, 1)
            r = ctx.baixar(f"{base}/HidroSerieHistorica", params={
                "codEstacao": codigo, "dataInicio": f"{inicio:%d/%m/%Y}", "dataFim": f"{hoje:%d/%m/%Y}",
                "tipoDados": tipo, "nivelConsistencia": "",
            })
            for quando, (valor, nivel) in ler_serie_historica(r.content, prefixo).items():
                registrar(variavel, quando, valor, nivel)
        return list(linhas.values())
