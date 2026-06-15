from fastapi.testclient import TestClient
from main import app
from app.api.auth import get_current_user
from app.models.user import User

def mock_get_current_user():
    return User(id=1, email="admin@vmail.com")

app.dependency_overrides[get_current_user] = mock_get_current_user

client = TestClient(app)
response = client.get("/api/documents/users/search?q=aswin")
print("Status Code:", response.status_code)
print("Response:", response.json())
