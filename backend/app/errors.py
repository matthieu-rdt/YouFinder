class SearchError(Exception):
    """Erreur publique contrôlée, sans réponse ni URL Google."""

    def __init__(self, status: int, code: str, message: str):
        self.status = status
        self.code = code
        self.message = message
        super().__init__(code)
