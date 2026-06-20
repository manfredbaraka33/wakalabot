from app.core import settings
print('ALLOWED_ORIGINS raw:', repr(settings.ALLOWED_ORIGINS))
print('parsed:', [o.strip() for o in settings.ALLOWED_ORIGINS.split(',') if o.strip()])
