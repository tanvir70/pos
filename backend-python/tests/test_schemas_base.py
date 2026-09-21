from datetime import datetime
from app.schemas.base import CamelModel, ErrorResponse, PagedResponse

class SampleDto(CamelModel):
    product_code: str
    standard_retail_price: float
    total_purchases: float

def test_camel_model_serialization():
    dto = SampleDto(
        product_code="AGR-001",
        standard_retail_price=250.50,
        total_purchases=12000.00
    )
    dumped = dto.model_dump(by_alias=True)
    assert "productCode" in dumped
    assert "standardRetailPrice" in dumped
    assert "totalPurchases" in dumped
    assert dumped["productCode"] == "AGR-001"

def test_error_response_contract():
    err = ErrorResponse(
        timestamp=datetime.now().isoformat(),
        status=404,
        error_code="RESOURCE_NOT_FOUND",
        message="Product not found",
        path="/api/products/999"
    )
    dumped = err.model_dump(by_alias=True)
    assert dumped["errorCode"] == "RESOURCE_NOT_FOUND"
    assert dumped["status"] == 404
