from app import create_app
from extensions import db
import time

app = create_app()
app.config['TESTING'] = True
with app.app_context():
    client = app.test_client()
    email = f'test+{int(time.time())}@example.com'
    res = client.post('/api/auth/register', json={'name': 'Test User', 'email': email, 'password': 'password123'})
    print('register', res.status_code, res.get_json())
    res2 = client.get('/api/auth/me')
    print('me after register', res2.status_code, res2.get_json())
    client.post('/api/auth/logout')
    res3 = client.get('/api/auth/me')
    print('me after logout', res3.status_code, res3.get_json())
    res4 = client.post('/api/auth/login', json={'email': email, 'password': 'password123'})
    print('login', res4.status_code, res4.get_json())
    res5 = client.get('/api/auth/me')
    print('me after login', res5.status_code, res5.get_json())
    res6 = client.get('/api/auth/google/login')
    print('google login redirect', res6.status_code, res6.headers.get('Location'))
