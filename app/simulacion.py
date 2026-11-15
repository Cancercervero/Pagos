"""La mesa de simulación enciende esto. El chat normal sigue llamando a pey."""

from contextvars import ContextVar

_activa: ContextVar[bool] = ContextVar("simulacion_activa", default=False)


def activa() -> bool:
    return _activa.get()


def usar(encendida: bool):
    return _activa.set(encendida)


def dejar(token) -> None:
    _activa.reset(token)
