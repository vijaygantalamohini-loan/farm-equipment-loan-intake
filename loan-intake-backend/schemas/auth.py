"""Authentication-related response schemas."""

from pydantic import BaseModel


class AzureTokenResponse(BaseModel):
    access_token: str
    token_type: str
    salesperson: dict
