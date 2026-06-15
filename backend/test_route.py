from fastapi import FastAPI
from fastapi.testclient import TestClient

app = FastAPI()

@app.get("/{doc_id}")
def get_doc(doc_id: str):
    return {"route": "doc"}

@app.get("/users/search")
def search():
    return {"route": "search"}

client = TestClient(app)
print(client.get("/users/search").json())
