"""MCP del agente bancario.

WhatsApp emulado, Cursor y el webhook de Meta llaman a la misma entrada.
Agregar este servidor es la activación: no hay otro cableado.
"""

from mcp.server.mcpserver import MCPServer

from app.agente.entrada import procesar_entrada
from app.db import init_db

mcp = MCPServer("agente-bancario")


@mcp.tool()
async def mensaje(telefono10: str, texto: str) -> str:
    """Recibe un mensaje como si llegara por WhatsApp y devuelve la respuesta del agente.

    Es la misma función del emulador y del futuro webhook de Meta.
    No marca pagos: eso solo lo hace el webhook firmado de pey.
    """
    init_db()
    return await procesar_entrada(telefono10, texto)


@mcp.tool()
def estado_canal() -> str:
    """Dice si el agente ya está activo y por dónde entra un mensaje. No llama a Meta."""
    return (
        "Activo en esta máquina. Un mensaje entra por la herramienta mensaje, "
        "por el WhatsApp emulado en /demo, o por /webhooks/whatsapp cuando Meta esté conectado. "
        "Los tres usan la misma función."
    )


def main() -> None:
    init_db()
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
