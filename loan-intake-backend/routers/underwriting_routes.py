"""
Underwriting gateway routes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
import httpx
import os

from core.security import require_admin

router = APIRouter(prefix="/underwriting", tags=["underwriting"])

UNDERWRITING_SERVICE_URL = os.getenv("UNDERWRITING_SERVICE_URL", "http://localhost:7002")


class CreateUnderwritingRequestDto(BaseModel):
    applicationId: str
    lenderId: str
    borrowerData: dict
    loanData: dict
    collateralData: dict | None = None


class UpdateUnderwritingStatusDto(BaseModel):
    status: str
    notes: str | None = None
    decision: dict | None = None


class AddNoteDto(BaseModel):
    note: str
    performedBy: str | None = None


@router.post("/requests", response_model=dict)
async def create_underwriting_request(payload: CreateUnderwritingRequestDto):
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            f"{UNDERWRITING_SERVICE_URL}/underwriting/requests",
            json=payload.model_dump(),
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


@router.get("/requests/{request_id}", response_model=dict)
async def get_underwriting_request(request_id: str):
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{UNDERWRITING_SERVICE_URL}/underwriting/requests/{request_id}",
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


@router.get("/by-application/{application_id}", response_model=dict)
async def get_by_application(application_id: str):
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{UNDERWRITING_SERVICE_URL}/underwriting/by-application/{application_id}",
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


@router.patch("/requests/{request_id}/status", response_model=dict)
async def update_status(request_id: str, payload: UpdateUnderwritingStatusDto):
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.patch(
            f"{UNDERWRITING_SERVICE_URL}/underwriting/requests/{request_id}/status",
            json=payload.model_dump(),
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


@router.post("/requests/{request_id}/notes", response_model=dict)
async def add_note(request_id: str, payload: AddNoteDto):
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            f"{UNDERWRITING_SERVICE_URL}/underwriting/requests/{request_id}/notes",
            json=payload.model_dump(),
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


@router.get("/requests", response_model=dict, dependencies=[Depends(require_admin)])
async def get_all_requests(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{UNDERWRITING_SERVICE_URL}/underwriting/requests",
            params={"page": page, "page_size": page_size},
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


@router.get("/by-lender/{lender_id}", response_model=dict)
async def get_by_lender(
    lender_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{UNDERWRITING_SERVICE_URL}/underwriting/by-lender/{lender_id}",
            params={"page": page, "page_size": page_size},
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


@router.get("/by-status/{status}", response_model=dict)
async def get_by_status(
    status: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{UNDERWRITING_SERVICE_URL}/underwriting/by-status/{status}",
            params={"page": page, "page_size": page_size},
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


@router.get("/requests/{request_id}/activities", response_model=list)
async def get_activities(request_id: str):
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{UNDERWRITING_SERVICE_URL}/underwriting/requests/{request_id}/activities",
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()
