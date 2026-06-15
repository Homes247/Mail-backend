import requests
import json

BASE_URL = "http://127.0.0.1:8000/api"

def test_api():
    print("--- Testing Office Suite API Locally ---")
    
    # 1. Login to get token
    print("\n1. Logging in...")
    # NOTE: Replace with your actual vmail email and password!
    login_data = {
        "email": "admin@vmail.com", 
        "password": "admin123"
    }
    resp = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    
    if resp.status_code != 200:
        print(f"Login failed: {resp.text}")
        print("Please update the test script with your real email and password.")
        return
        
    token = resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Login successful! Got token.")

    # 2. Create a new document
    print("\n2. Creating a new document...")
    doc_data = {
        "title": "My Test Local Document",
        "doc_type": "doc"
    }
    resp = requests.post(f"{BASE_URL}/documents/", json=doc_data, headers=headers)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text}")
    
    if resp.status_code == 200:
        doc_id = resp.json()["id"]
        
        # 3. Fetch the document
        print(f"\n3. Fetching document {doc_id}...")
        resp = requests.get(f"{BASE_URL}/documents/{doc_id}", headers=headers)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.json()['title']}")

if __name__ == "__main__":
    test_api()
