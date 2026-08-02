import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from app.core.config import settings

def _get_fernet() -> Fernet:
    """Generate a Fernet instance based on TOKEN_ENCRYPTION_KEY."""
    if not settings.TOKEN_ENCRYPTION_KEY:
        raise RuntimeError("TOKEN_ENCRYPTION_KEY is required for provider token storage")
    key = settings.TOKEN_ENCRYPTION_KEY.encode('utf-8')
    
    # We use PBKDF2 to derive a 32-byte url-safe base64 key suitable for Fernet
    # Salt is hardcoded here for simplicity, in a real system could be externalized
    salt = b"nope_saas_encryption_salt"
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key_b64 = base64.urlsafe_b64encode(kdf.derive(key))
    return Fernet(key_b64)

def encrypt_token(plain_token: str) -> str:
    """Encrypt a plaintext token."""
    if not plain_token:
        return plain_token
    f = _get_fernet()
    return f.encrypt(plain_token.encode('utf-8')).decode('utf-8')

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt an encrypted token."""
    if not encrypted_token:
        return encrypted_token
    f = _get_fernet()
    return f.decrypt(encrypted_token.encode('utf-8')).decode('utf-8')
