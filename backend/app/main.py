"""Point d'entrée de l'API personnelle YouTube Niche Explorer."""

from typing import Literal

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.errors import SearchError
from app.routes.videos import router

app = FastAPI(title="YouFinder", version="0.2.0")
app.include_router(router)


@app.middleware("http")
async def no_api_cache(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/videos/"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(SearchError)
async def search_error_handler(request, error: SearchError):
    return JSONResponse(status_code=error.status, content={"error": {"code": error.code, "message": error.message}})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request, error: RequestValidationError):
    # Ne pas renvoyer les valeurs reçues ni les détails internes d'une exception.
    return JSONResponse(status_code=422, content={"error": {"code": "invalid_parameters", "message": "Paramètres invalides : mot-clé de 1 à 200 caractères et dates avec fuseau horaire, début antérieur à la fin."}})


class HealthResponse(BaseModel):
    status: Literal["ok"]


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Vérifie que l'application répond, sans dépendance externe."""
    return HealthResponse(status="ok")
