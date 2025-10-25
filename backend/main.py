from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
from starlette.responses import StreamingResponse
import io
import csv
import pandas as pd

app = FastAPI()

# CORSミドルウェアの設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # フロントエンドのURL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# インメモリデータストア
db: Dict[str, Any] = {
    "list1": [],
    "list2": [],
    "pairs": [],
    "results": [],
}

class ListsPayload(BaseModel):
    list1: str
    list2: str

@app.post("/api/lists")
def set_lists(payload: ListsPayload):
    items1 = [item.strip() for item in payload.list1.split('\n') if item.strip()]
    items2 = [item.strip() for item in payload.list2.split('\n') if item.strip()]
    
    db["list1"] = items1
    db["list2"] = items2
    
    pairs = []
    max_len = max(len(items1), len(items2))
    for i in range(max_len):
        pair = [items1[i] if i < len(items1) else "", items2[i] if i < len(items2) else ""]
        pairs.append(pair)
        
    db["pairs"] = pairs
    db["results"] = [None] * len(pairs)
    return {"message": "Lists received and pairs created."}

@app.post("/api/upload_csv")
def upload_csv(file: UploadFile = File(...), column1: str = Form(...), column2: str = Form(...), annotation_column: str = Form(None)):
    try:
        df = pd.read_csv(file.file)
        
        items1 = df[column1].tolist()
        items2 = df[column2].tolist()

        db["list1"] = items1
        db["list2"] = items2
        
        pairs = []
        max_len = max(len(items1), len(items2))
        for i in range(max_len):
            pair = [str(items1[i]) if i < len(items1) else "", str(items2[i]) if i < len(items2) else ""]
            pairs.append(pair)
            
        db["pairs"] = pairs
        
        if annotation_column and annotation_column in df.columns:
            # NaNをNoneに変換してJSONエンコード可能にする
            db["results"] = df[annotation_column].replace({pd.NA: None, float('nan'): None}).tolist()
        else:
            db["results"] = [None] * len(pairs)
        
        return {"message": "CSV uploaded and pairs created."}
    except Exception as e:
        return {"error": str(e)}, 400

@app.get("/api/pairs")
def get_pairs():
    return {"pairs": db["pairs"], "results": db["results"]}

class JudgmentPayload(BaseModel):
    index: int
    judgment: str

@app.post("/api/judgment")
def record_judgment(payload: JudgmentPayload):
    if 0 <= payload.index < len(db["results"]):
        db["results"][payload.index] = payload.judgment
        return {"message": f"Judgment for pair {payload.index} recorded."}
    return {"error": "Index out of range."}, 400

@app.get("/api/results")
def get_results():
    return {"results": db["results"], "pairs": db["pairs"]}

@app.get("/api/results/download")
def download_results():
    output = io.StringIO()
    writer = csv.writer(output)
    
    # ヘッダーを書き込む
    writer.writerow(["list1_item", "list2_item", "judgment"])
    
    # データを書き込む
    for i, pair in enumerate(db["pairs"]):
        judgment = db["results"][i]
        writer.writerow([pair[0], pair[1], judgment])
    
    output.seek(0)
    return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=annotation_results.csv"})

@app.delete("/api/reset")
def reset_data():
    db["list1"] = []
    db["list2"] = []
    db["pairs"] = []
    db["results"] = []
    return {"message": "Data reset."}

@app.get("/")
def read_root():
    return {"message": "Backend is running"}
