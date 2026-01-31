"""
Notification gateway routes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
import httpx
import os

from core.security import require_admin

router = APIRouter(prefix="/notifications", tags=["notifications"])

NOTIFICATION_SERVICE_URL = os.getenv("NOTIFICATION_SERVICE_URL", "http://localhost:7001")


class SendNotificationDto(BaseModel):
    channel: str = Field(..., description="sms, push, or inapp")
    recipientId: str
    title: str | None = None
    message: str
    data: dict | None = None
    phoneNumber: str | None = None


@router.post("/send", response_model=dict)
async def send_notification(payload: SendNotificationDto):
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            f"{NOTIFICATION_SERVICE_URL}/notifications/send",
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
            f"{NOTIFICATION_SERVICE_URL}/notifications/logs",
            params={"page": page, "page_size": page_size},
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


@router.get("/recipient/{recipient_id}", response_model=dict)
async def get_recipient_notifications(
    recipient_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{NOTIFICATION_SERVICE_URL}/notifications/by-recipient/{recipient_id}",
            params={"page": page, "page_size": page_size},
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()
