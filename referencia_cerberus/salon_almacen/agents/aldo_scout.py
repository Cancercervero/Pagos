"""
aldo_scout.py — Aldo busca proveedores cuando el cliente no tiene ninguno.

Usa navegante_seeker para buscar distribuidores de productos de salón
por ciudad. Extrae nombre, teléfono, WhatsApp, web y los propone al admin.
El admin confirma cuáles agregar a la DB.
"""
import json
import logging
import re

logger = logging.getLogger("AldoScout")

_PROMPT_EXTRAER_PROVEEDORES = """Eres Aldo, abastecedor de un salón de belleza.
Analiza estos resultados de búsqueda web y extrae proveedores de productos de salón.
Para cada proveedor que encuentres extrae lo que puedas.
Responde SOLO con JSON válido:
{
  "proveedores": [
    {
      "nombre": "...",
      "telefono": "...",
      "whatsapp": "...",
      "email": "...",
      "sitio_web": "...",
      "ciudad": "...",
      "descripcion": "qué venden"
    }
  ]
}
Si un campo no aparece en los resultados, deja la cadena vacía."""

_CATEGORIAS_BUSQUEDA = [
    "distribuidor tintes capilares {ciudad}",
    "proveedor productos salón belleza {ciudad}",
    "distribuidora Wella Loreal salon {ciudad}",
    "mayoreo productos peluquería {ciudad}",
]


def buscar_proveedores(ciudad: str, max_resultados: int = 5) -> list[dict]:
    """
    Busca proveedores de salón en la ciudad dada.
    Retorna lista de proveedores encontrados para confirmar con admin.
    """
    try:
        from host_engine.cerberus_core.navegante_seeker import NaveganteSeeker
        seeker = NaveganteSeeker()
    except Exception as e:
        logger.error(f"[AldoScout] Navegante no disponible: {e}")
        return []

    from host_engine.cerberus_core.llm_router import ask_llm

    todos = []
    for query_tpl in _CATEGORIAS_BUSQUEDA[:2]:  # 2 búsquedas para no saturar
        query = query_tpl.format(ciudad=ciudad)
        logger.info(f"[AldoScout] Buscando: {query}")
        try:
            resultado_web = seeker.search_google(query)
            if not resultado_web or len(resultado_web) < 50:
                continue

            raw = ask_llm(
                f"Resultados de búsqueda:\n{resultado_web[:3000]}",
                system=_PROMPT_EXTRAER_PROVEEDORES,
                max_tokens=600,
            )
            m = re.search(r'\{.*\}', raw, re.DOTALL)
            if not m:
                continue
            data = json.loads(m.group())
            todos.extend(data.get("proveedores", []))
        except Exception as e:
            logger.warning(f"[AldoScout] Error en búsqueda '{query}': {e}")

    # Deduplicar por nombre
    vistos = set()
    unicos = []
    for p in todos:
        nombre_key = p.get("nombre", "").lower().strip()
        if nombre_key and nombre_key not in vistos:
            vistos.add(nombre_key)
            unicos.append(p)

    return unicos[:max_resultados]


def formatear_propuesta(proveedores: list[dict]) -> str:
    """Formatea los proveedores encontrados para mostrarlos al admin."""
    if not proveedores:
        return (
            "🔍 Aldo: No encontré proveedores en internet para esa ciudad.\n"
            "Dime el nombre y WhatsApp de tu proveedor y lo registro manualmente."
        )

    lines = [f"🔍 *Aldo encontró {len(proveedores)} proveedores:*\n"]
    for i, p in enumerate(proveedores, 1):
        linea = f"*{i}. {p.get('nombre', '?')}*"
        if p.get("ciudad"):
            linea += f" — {p['ciudad']}"
        if p.get("descripcion"):
            linea += f"\n   _{p['descripcion']}_"
        if p.get("telefono"):
            linea += f"\n   📞 {p['telefono']}"
        if p.get("whatsapp"):
            linea += f"\n   📱 WA: {p['whatsapp']}"
        if p.get("sitio_web"):
            linea += f"\n   🌐 {p['sitio_web']}"
        lines.append(linea + "\n")

    lines.append("Responde con los números que quieres agregar (ej: *1 3*) o *ninguno*.")
    return "\n".join(lines)


def guardar_proveedores_seleccionados(
    proveedores: list[dict],
    seleccion: list[int],
    db_path=None,
) -> str:
    """Guarda en DB los proveedores que el admin seleccionó."""
    from host_engine.cerberus_core.almacen_db import AlmacenDB
    db = AlmacenDB(db_path=db_path) if db_path else AlmacenDB()
    db.migrate()

    guardados = []
    for idx in seleccion:
        if 0 <= idx < len(proveedores):
            p = proveedores[idx]
            nombre = p.get("nombre", "").strip()
            if not nombre:
                continue
            existente = db.get_proveedor(nombre)
            if existente:
                guardados.append(f"  ↳ Ya existe: {nombre}")
                continue
            db.registrar_proveedor(
                name=nombre,
                contacto=p.get("telefono", ""),
                whatsapp=p.get("whatsapp", ""),
                email=p.get("email", ""),
                telefono=p.get("telefono", ""),
                sitio_web=p.get("sitio_web", ""),
                ciudad=p.get("ciudad", ""),
            )
            guardados.append(f"  ✅ {nombre}")

    if not guardados:
        return "⚠️ No se guardó ningún proveedor."
    return "✅ *Aldo registró:*\n" + "\n".join(guardados)
