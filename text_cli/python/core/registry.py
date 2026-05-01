import logging
from typing import Callable

logger = logging.getLogger(__name__)

_registry: dict[str, dict[str, Callable]] = {}


def directive(domain: str, action: str):
    def decorator(func: Callable):
        if domain not in _registry:
            _registry[domain] = {}
        _registry[domain][action] = func
        logger.info("指令已注册: %s;%s -> %s", domain, action, func.__name__)
        return func
    return decorator


def dispatch(domain: str, action: str, params: list[str]) -> str:
    actions = _registry.get(domain)
    if not actions:
        return f"未找到匹配的指令: {domain};{action}"

    handler = actions.get(action)
    if not handler:
        return f"未找到匹配的指令: {domain};{action}"

    return handler(params)


def get_registered_directives() -> dict[str, list[str]]:
    return {
        domain: list(actions.keys())
        for domain, actions in _registry.items()
    }
