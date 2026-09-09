from app.routes import RbacUserCreateRequest, _derive_username


def test_user_create_request_accepts_employee_first_fields():
    payload = {
        "employeeId": "EMP-1042",
        "fullName": "Aisha Khan",
        "email": "aisha.khan@mai.com",
        "temporaryPassword": "Welcome@123",
        "department": "Operations",
        "site": "Alpha Refinery",
        "role": "Operations Head",
        "status": "ACTIVE",
    }

    model = RbacUserCreateRequest(**payload)

    assert model.employee_id == "EMP-1042"
    assert model.full_name == "Aisha Khan"
    assert model.email == "aisha.khan@mai.com"
    assert model.password == "Welcome@123"
    assert model.department == "Operations"
    assert model.site == "Alpha Refinery"
    assert model.role == "Operations Head"
    assert model.status == "ACTIVE"


def test_derive_username_uses_employee_id_when_present():
    assert _derive_username("EMP-1042", "Aisha Khan", "aisha.khan@mai.com") == "EMP-1042"
    assert _derive_username(None, "Aisha Khan", "aisha.khan@mai.com") == "aisha.khan"
    assert _derive_username(None, None, "aisha.khan@mai.com") == "aisha.khan"
