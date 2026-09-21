from typing import Generic, TypeVar
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

T = TypeVar("T")

class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

class ErrorResponse(CamelModel):
    timestamp: str
    status: int
    error_code: str
    message: str
    path: str
    details: dict[str, str] | None = None

class PagedResponse(CamelModel, Generic[T]):
    content: list[T]
    page_number: int
    page_size: int
    total_elements: int
    total_pages: int
    first: bool
    last: bool
