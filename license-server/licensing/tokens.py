import secrets


def generate_tokens() -> list[str]:
    return [secrets.token_hex(16) for _ in range(5)]


def validate_tokens(tokens: list[str]) -> bool:
    return len(tokens) == 5 and len(set(tokens)) == 5 and all(len(token) >= 24 for token in tokens)
