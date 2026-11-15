"""Contactos y mensajes. El rol de dueño se decide por OWNER_PHONES."""

from app.config import owner_phones
from app.db import ahora_iso, conectar, fila, filas, transaccion
from app.telefono import a_telefono10, wa_id_desde


def rol_de(telefono10: str) -> str:
    return "dueno" if telefono10 in owner_phones() else "cliente"


def obtener_o_crear(telefono10: str, wa_id: str | None = None, nombre: str | None = None) -> dict:
    telefono10 = a_telefono10(telefono10)
    rol = rol_de(telefono10)
    with transaccion() as conn:
        actual = conn.execute("SELECT * FROM contactos WHERE telefono10=?", (telefono10,)).fetchone()
        if actual:
            wa = wa_id or actual["wa_id"] or wa_id_desde(telefono10)
            nom = nombre or actual["nombre"]
            if actual["rol"] == "proveedor":
                rol = "proveedor"
            conn.execute(
                "UPDATE contactos SET wa_id=?, nombre=COALESCE(?, nombre), rol=? WHERE id=?",
                (wa, nom, rol, actual["id"]),
            )
            return fila(conn.execute("SELECT * FROM contactos WHERE id=?", (actual["id"],)).fetchone())
        conn.execute(
            """INSERT INTO contactos (telefono10, wa_id, nombre, rol, acepto_privacidad, creado_en)
               VALUES (?, ?, ?, ?, 0, ?)""",
            (telefono10, wa_id or wa_id_desde(telefono10), nombre, rol, ahora_iso()),
        )
        return fila(conn.execute("SELECT * FROM contactos WHERE telefono10=?", (telefono10,)).fetchone())


def marcar_privacidad(contacto_id: int) -> None:
    with transaccion() as conn:
        conn.execute("UPDATE contactos SET acepto_privacidad=1 WHERE id=?", (contacto_id,))


def guardar_mensaje(contacto_id: int, rol: str, contenido: str, hilo: str = "estetica") -> None:
    hilo = "estetica"
    with transaccion() as conn:
        conn.execute(
            "INSERT INTO mensajes (contacto_id, rol, contenido, hilo, creado_en) VALUES (?, ?, ?, ?, ?)",
            (contacto_id, rol, contenido, hilo, ahora_iso()),
        )


def historial(contacto_id: int, limite: int = 12, hilo: str | None = None) -> list[dict]:
    sql = """SELECT rol, contenido FROM mensajes
             WHERE contacto_id=? AND rol IN ('user', 'assistant')"""
    args: list = [contacto_id]
    if hilo:
        sql += " AND hilo=?"
        args.append(hilo)
    sql += " ORDER BY id DESC LIMIT ?"
    args.append(limite)
    with conectar() as conn:
        rows = conn.execute(sql, args).fetchall()
    return list(reversed(filas(rows)))


def ya_visto_wa(message_id: str) -> bool:
    with transaccion() as conn:
        cur = conn.execute(
            "INSERT OR IGNORE INTO wa_dedupe (message_id, recibido_en) VALUES (?, ?)",
            (message_id, ahora_iso()),
        )
        return cur.rowcount == 0


def duenos() -> list[dict]:
    with conectar() as conn:
        rows = conn.execute("SELECT * FROM contactos WHERE rol='dueno'").fetchall()
    return filas(rows)


def por_id(contacto_id: int) -> dict | None:
    with conectar() as conn:
        return fila(conn.execute("SELECT * FROM contactos WHERE id=?", (contacto_id,)).fetchone())
