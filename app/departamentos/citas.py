"""Agenda. La cita se aparta al elegir horario y se confirma solo cuando el anticipo queda pagado."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.config import negocio
from app.db import ahora_iso, conectar, fila, filas, transaccion


def _tz() -> ZoneInfo:
    return ZoneInfo(negocio().get("zona_horaria", "America/Mexico_City"))


def _mapa_dias() -> dict[str, int]:
    return {"lun": 0, "mar": 1, "mie": 2, "jue": 3, "vie": 4, "sab": 5, "dom": 6}


def huecos_libres(limite: int = 3, fecha: str | None = None) -> list[str]:
    neg = negocio()
    hor = neg.get("horarios", {})
    dias = {_mapa_dias()[d] for d in hor.get("dias", []) if d in _mapa_dias()}
    inicio_h, inicio_m = _hm(hor.get("inicio", "10:00"))
    fin_h, fin_m = _hm(hor.get("fin", "19:00"))
    paso = int(hor.get("intervalo_min", 60))
    tz = _tz()
    ahora = datetime.now(tz)
    dia = ahora
    if fecha:
        dia = datetime.fromisoformat(fecha[:10]).replace(tzinfo=tz)
    ocupados = _ocupados()
    libres = []
    tope = dia + timedelta(days=14)
    while dia < tope and len(libres) < limite:
        if dia.weekday() in dias:
            cursor = dia.replace(hour=inicio_h, minute=inicio_m, second=0, microsecond=0)
            cierra = dia.replace(hour=fin_h, minute=fin_m, second=0, microsecond=0)
            while cursor < cierra and len(libres) < limite:
                if cursor > ahora:
                    marca = cursor.replace(tzinfo=None).isoformat(timespec="minutes")
                    if marca not in ocupados:
                        libres.append(marca)
                cursor += timedelta(minutes=paso)
        dia = (dia + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return libres


def resolver_horario(texto_hora: int, minuto: int = 0) -> str | None:
    """Siguiente hueco con esa hora, dentro del horario del negocio."""
    neg = negocio()
    hor = neg.get("horarios", {})
    dias = {_mapa_dias()[d] for d in hor.get("dias", []) if d in _mapa_dias()}
    tz = _tz()
    ahora = datetime.now(tz)
    ocupados = _ocupados()
    for delta in range(0, 14):
        dia = (ahora + timedelta(days=delta)).replace(hour=texto_hora, minute=minuto, second=0, microsecond=0)
        if dia <= ahora or dia.weekday() not in dias:
            continue
        inicio_h, inicio_m = _hm(hor.get("inicio", "10:00"))
        fin_h, fin_m = _hm(hor.get("fin", "19:00"))
        minuto_dia = dia.hour * 60 + dia.minute
        if not (inicio_h * 60 + inicio_m <= minuto_dia < fin_h * 60 + fin_m):
            continue
        marca = dia.replace(tzinfo=None).isoformat(timespec="minutes")
        if marca not in ocupados:
            return marca
    return None


def apartar(contacto_id: int, cotizacion_id: int, inicio: str) -> dict:
    with transaccion() as conn:
        choque = conn.execute(
            "SELECT id FROM citas WHERE inicio=? AND estado IN ('apartada', 'confirmada')",
            (inicio,),
        ).fetchone()
        if choque:
            raise ValueError("Ese horario acaba de ocuparse. Te paso otros.")
        conn.execute(
            """INSERT INTO citas (cotizacion_id, contacto_id, inicio, estado, creado_en)
               VALUES (?, ?, ?, 'apartada', ?)""",
            (cotizacion_id, contacto_id, inicio, ahora_iso()),
        )
        conn.execute("UPDATE cotizaciones SET estado='aceptada' WHERE id=? AND estado='enviada'", (cotizacion_id,))
        return fila(conn.execute("SELECT * FROM citas WHERE id=last_insert_rowid()").fetchone())


def confirmar_por_cotizacion(conn, cotizacion_id: int) -> dict | None:
    conn.execute(
        "UPDATE citas SET estado='confirmada' WHERE cotizacion_id=? AND estado='apartada'",
        (cotizacion_id,),
    )
    return fila(
        conn.execute(
            "SELECT * FROM citas WHERE cotizacion_id=? ORDER BY id DESC LIMIT 1",
            (cotizacion_id,),
        ).fetchone()
    )


def expirar_por_cotizacion(conn, cotizacion_id: int) -> None:
    conn.execute(
        "UPDATE citas SET estado='expirada' WHERE cotizacion_id=? AND estado='apartada'",
        (cotizacion_id,),
    )


def cita_de(cotizacion_id: int) -> dict | None:
    with conectar() as conn:
        return fila(
            conn.execute(
                "SELECT * FROM citas WHERE cotizacion_id=? ORDER BY id DESC LIMIT 1",
                (cotizacion_id,),
            ).fetchone()
        )


def agenda(fecha: str | None = None) -> list[dict]:
    with conectar() as conn:
        rows = conn.execute(
            """SELECT c.*, co.nombre, co.telefono10, q.folio
               FROM citas c
               JOIN contactos co ON co.id=c.contacto_id
               LEFT JOIN cotizaciones q ON q.id=c.cotizacion_id
               WHERE c.estado IN ('apartada', 'confirmada')
               ORDER BY c.inicio"""
        ).fetchall()
    citas = filas(rows)
    if fecha:
        citas = [c for c in citas if str(c["inicio"]).startswith(fecha)]
    return citas


def mis_citas(contacto_id: int) -> str:
    """La agenda personal solo lista citas ya pagadas. Apartar un horario no la llena."""
    with conectar() as conn:
        rows = conn.execute(
            """SELECT inicio, estado FROM citas
               WHERE contacto_id=? AND estado IN ('apartada', 'confirmada')
               ORDER BY inicio""",
            (contacto_id,),
        ).fetchall()
    confirmadas = [r for r in rows if r["estado"] == "confirmada"]
    apartadas = [r for r in rows if r["estado"] == "apartada"]
    if not confirmadas and not apartadas:
        return "Tu agenda está vacía. La cita entra cuando tu banco confirma el pago."
    lineas = []
    if confirmadas:
        lineas.append("Tu agenda:")
        for r in confirmadas:
            lineas.append(f"• {_bonito(r['inicio'])} — confirmada")
    if apartadas:
        lineas.append("Horario apartado, todavía no en tu agenda:")
        for r in apartadas:
            lineas.append(f"• {_bonito(r['inicio'])} — falta la confirmación de tu banco.")
    return "\n".join(lineas)


def texto_agenda(citas: list[dict]) -> str:
    if not citas:
        return "No hay citas apartadas ni confirmadas."
    lineas = ["Agenda:"]
    for c in citas:
        quien = c.get("nombre") or c.get("telefono10")
        lineas.append(f"• {c['inicio']} — {quien} — {c['estado']} {c.get('folio') or ''}".strip())
    return "\n".join(lineas)


def texto_huecos(huecos: list[str]) -> str:
    if not huecos:
        return "No tengo huecos en los próximos días."
    lineas = ["Horarios libres:"]
    for i, h in enumerate(huecos, start=1):
        lineas.append(f"{i}) {_bonito(h)}")
    lineas.append('Dime cuál quieres, por ejemplo "el de las 5".')
    return "\n".join(lineas)


def _bonito(iso_local: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_local)
        return dt.strftime("%d/%m %H:%M")
    except ValueError:
        return iso_local


def _hm(valor: str) -> tuple[int, int]:
    hora, minuto = valor.split(":")
    return int(hora), int(minuto)


def _ocupados() -> set[str]:
    with conectar() as conn:
        rows = conn.execute(
            "SELECT inicio FROM citas WHERE estado IN ('apartada', 'confirmada')"
        ).fetchall()
    return {r["inicio"] for r in rows}
