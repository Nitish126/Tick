import requests
try:
    print("Sending text to localhost:8000...")
    # Send an invalid base64 just to get the server error body
    res = requests.post("http://127.0.0.1:8000/api/ocr/process", json={"image_base64": "invalid_base64"})
    print(res.status_code)
    print(res.text)
except Exception as e:
    print(e)
