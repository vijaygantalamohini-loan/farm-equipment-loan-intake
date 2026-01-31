"""
Email gateway routes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
import httpx
import os

from core.security import require_admin

router = APIRouter(prefix="/email", tags=["email"])

EMAIL_SERVICE_URL = os.getenv("EMAIL_SERVICE_URL", "http://localhost:7000")


class SendEmailDto(BaseModel):
    to: EmailStr
    subject: str
    template: str
    data: dict = Field(default_factory=dict)


@router.post("/send", response_model=dict)
async def send_email(payload: SendEmailDto):
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            f"{EMAIL_SERVICE_URL}/email/send",
            json=payload.model_dump(),
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


@router.get("/logs", response_model=dict, dependencies=[Depends(require_admin)])
async def get_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{EMAIL_SERVICE_URL}/email/logs",
            params={"page": page, "page_size": page_size},
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()
