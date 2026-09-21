import pytest
from app.services.sequence_service import calculate_next_val, format_sequence_code

def test_sequence_code_format_7_digits():
    # Verify 7-digit code format requested by user
    code = format_sequence_code(prefix="INV", date_str="20260921", val=42)
    assert code == "INV-20260921-0000042"
    assert len(code.split("-")[2]) == 7

    due_code = format_sequence_code(prefix="DUE", date_str="20260921", val=5)
    assert due_code == "DUE-20260921-0000005"
    assert len(due_code.split("-")[2]) == 7

    ret_code = format_sequence_code(prefix="RET", date_str="20260921", val=1001)
    assert ret_code == "RET-20260921-0001001"
    assert len(ret_code.split("-")[2]) == 7

def test_sequence_rollover_7_digits():
    next_val = calculate_next_val(current_val=9999999, max_val=9999999)
    assert next_val == 1

    next_val_normal = calculate_next_val(current_val=42, max_val=9999999)
    assert next_val_normal == 43
