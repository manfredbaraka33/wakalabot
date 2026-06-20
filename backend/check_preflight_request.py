import httpx

url = 'http://localhost:8000/api/v1/auth/login'
headers = {
    'Origin': 'https://localhost:5173',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type,authorization,x-tenant-id'
}

resp = httpx.options(url, headers=headers, timeout=10.0)
print('status:', resp.status_code)
for k, v in resp.headers.items():
    if k.lower().startswith('access-control') or k.lower().startswith('allow'):
        print(k + ':', v)
print('\nbody:\n', resp.text)
