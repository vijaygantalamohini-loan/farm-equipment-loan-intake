import requests

# Use the same token that the browser is using
token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6Ik9YUkJETnJjNjVOanpSbkt2b0lZeHZGa1l4ayJ9.eyJhdWQiOiI3YjgwNjU1My00OWQ2LTQzYzUtOGY5Zi1lNjVlN2NjOGRmNTciLCJpc3MiOiJodHRwczovL2EwOTY0MzgxLTllODYtNDZjZC05MzliLWExYjg4YzQzOTRlYy5jaWFtbG9naW4uY29tL2EwOTY0MzgxLTllODYtNDZjZC05MzliLWExYjg4YzQzOTRlYy92Mi4wIiwiaWF0IjoxNzY2MzU4OTE5LCJuYmYiOjE3NjYzNTg5MTksImV4cCI6MTc2NjM2MjgxOSwiYWlvIjoiQVlRQWUvOGFBQUFBWld5TUw1cE1jUzZFemlFT0ZZdjlzZFA1ek41Q0krdzFYdFhhY05BaStPdTFwbmw5UEVnTHlmWksyV2lmNGJPcjgxVXZwQUF1cHpXcVpGUHNYYjBOb2N6QWVLYVdBc3N6WDRWNmxoU1ZHRGNJcnE0VVVCSGMwK3dhU2FQbzFOWlo0SG5ONmtNTVR4RHlwa3FsZCtjVFVVVWpiMlQ4SGkyZTBRclRaeTFrWGdvPSIsIm5hbWUiOiJ0ZXN0IHVzZXIgMSIsIm9pZCI6IjE3YzFlMzJhLTY1MWUtNDE3Mi04MjU0LWQyNTcyOWMxMzY3MiIsInByZWZlcnJlZF91c2VybmFtZSI6InRlc3R1c2VyMUBBc3NldEZpbmFuY2VPcmlnaW5hdG9ycy5vbm1pY3Jvc29mdC5jb20iLCJyaCI6IjEuQWJnQWdVT1dvSWFlelVhVG02RzRqRU9VN0ZObGdIdldTY1ZEajVfbVhuekkzMWZWQVVLNEFBLiIsInNpZCI6IjAwYmE1NzM5LTE1NWUtYWU5My00YmQ5LTZmZDdlY2VjMTQ4MCIsInN1YiI6InVOSDdCbzNoMXNCa2piV2JHREVoUDdaX3d4dkVRSC1tZXRlQjljRk1JYTgiLCJ0aWQiOiJhMDk2NDM4MS05ZTg2LTQ2Y2QtOTM5Yi1hMWI4OGM0Mzk0ZWMiLCJ1dGkiOiJSNWh2Sk5QQURVbWhOY2xwQk9RUEFBIiwidmVyIjoiMi4wIn0.U6IO7GD22X8vEU5_whJ5O9Q4YmYcQU2EDjE9dFjl89c2IRNQESuNA5qiO2MQRDf4-ce5ZEJDlmNmZWNn5T3zVbYWd-zzl5NAd2PxCeRM2X1HAHcZi3Hf2TJdOSWTg4LXGKHq36msbPP1KZDmAB-YMN0_W0gGF29qJ9PGUyEddkM1GP6ZTH7sbpzjPLOYcfqs1jj0FuG3utp7oaTlkQiDEi25aE0GCCuwkqdYuUw5ymGMOrjd0OgE-YoXFcdu0FdSKqVGZOGji0pkfUHjX7T-y0OOz_C2qUDbiHaoKzNJOT1vFA7HRlbg7KujfdLBXVZrHSDhS28eIBYVPeOCkBaEpQ"

headers = {
    "Authorization": f"Bearer {token}"
}

try:
    r = requests.get("http://localhost:8000/loans/dashboard", headers=headers)
    print(f"Status Code: {r.status_code}")
    print(f"\nResponse Headers:")
    for key, value in r.headers.items():
        print(f"  {key}: {value}")
    print(f"\nResponse Body:")
    try:
        import json
        print(json.dumps(r.json(), indent=2))
    except:
        print(r.text)
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
