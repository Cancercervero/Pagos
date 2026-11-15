"""Una sola vez: los cinco nombres de las cuentas pey, con historial local."""

from app.db import ahora_iso, conectar, transaccion
from app.departamentos.cotizaciones import crear_cotizacion
from app.personas import guardar_mensaje, obtener_o_crear

GENTE = (
    ("5511111111", "Miriam Nava", "dueno"),
    ("5522222222", "Adrián Soto", "cliente"),
    ("5533333333", "David Perez", "cliente"),
    ("5544444444", "Ramón Orraca", "cliente"),
    ("5555555555", "Santiago Tena", "proveedor"),
)


def ya(contacto_id: int, texto: str) -> bool:
    with conectar() as conn:
        return conn.execute(
            "SELECT id FROM mensajes WHERE contacto_id=? AND contenido=?",
            (contacto_id, texto),
        ).fetchone() is not None


def main() -> None:
    for tel, nombre, rol in GENTE:
        obtener_o_crear(tel, nombre=nombre)
        if rol == "proveedor":
            with transaccion() as conn:
                conn.execute(
                    "UPDATE contactos SET rol='proveedor', nombre=? WHERE telefono10=?",
                    (nombre, tel),
                )
        else:
            with transaccion() as conn:
                conn.execute("UPDATE contactos SET nombre=? WHERE telefono10=?", (nombre, tel))

    adrian = obtener_o_crear("5522222222", nombre="Adrián Soto")
    pedido = "Quiero un corte para el sábado en la tarde."
    if not ya(adrian["id"], pedido):
        guardar_mensaje(adrian["id"], "user", pedido)
    with conectar() as conn:
        tiene = conn.execute(
            "SELECT id FROM cotizaciones WHERE contacto_id=? AND estado!='cancelada'",
            (adrian["id"],),
        ).fetchone()
    if not tiene:
        crear_cotizacion(adrian["id"], [{"servicio_id": "corte", "cantidad": 1}])

    david = obtener_o_crear("5533333333", nombre="David Perez")
    seguimiento = "La vez pasada quedé bien con la barba. Ahora quiero un tinte."
    if not ya(david["id"], seguimiento):
        guardar_mensaje(david["id"], "user", seguimiento)
    with conectar() as conn:
        cita = conn.execute(
            "SELECT id FROM citas WHERE contacto_id=? AND estado='confirmada'",
            (david["id"],),
        ).fetchone()
    if not cita:
        with transaccion() as conn:
            conn.execute(
                """INSERT INTO citas (contacto_id, inicio, estado, creado_en)
                   VALUES (?, '2026-11-07T17:00:00', 'confirmada', ?)""",
                (david["id"], ahora_iso()),
            )

    ramon = obtener_o_crear("5544444444", nombre="Ramón Orraca")
    pregunta = "¿Cuánto sale el tratamiento capilar? Lo quiero entre semana."
    if not ya(ramon["id"], pregunta):
        guardar_mensaje(ramon["id"], "user", pregunta)

    santiago = obtener_o_crear("5555555555", nombre="Santiago Tena")
    surtido = "Soy Santiago. El lunes puedo surtir el tinte. Avísame cuántos frascos."
    if not ya(santiago["id"], surtido):
        guardar_mensaje(santiago["id"], "user", surtido)
    with transaccion() as conn:
        conn.execute("UPDATE contactos SET rol='proveedor' WHERE telefono10='5555555555'")

    with conectar() as conn:
        rows = conn.execute(
            "SELECT nombre, rol, telefono10 FROM contactos ORDER BY id"
        ).fetchall()
    for row in rows:
        print(row["rol"], row["nombre"])


if __name__ == "__main__":
    main()
