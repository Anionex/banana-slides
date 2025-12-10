"""
Encryption service for securely storing sensitive data like API keys
Uses Fernet symmetric encryption
"""
import os
import logging
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)


class EncryptionService:
    """
    Service for encrypting and decrypting sensitive data
    """
    
    _instance = None
    _fernet = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance
    
    def _initialize(self):
        """Initialize the Fernet cipher with the encryption key"""
        key = os.getenv('ENCRYPTION_KEY')
        
        if not key:
            # Generate a key for development (should be set in production)
            logger.warning(
                "ENCRYPTION_KEY not set in environment. "
                "Generating a temporary key. This is NOT safe for production!"
            )
            key = Fernet.generate_key().decode()
            logger.info(f"Generated temporary ENCRYPTION_KEY: {key}")
            logger.info("Add this to your .env file for persistence: ENCRYPTION_KEY={key}")
        
        try:
            # Ensure the key is bytes
            if isinstance(key, str):
                key = key.encode()
            self._fernet = Fernet(key)
        except Exception as e:
            logger.error(f"Failed to initialize encryption: {e}")
            raise ValueError("Invalid ENCRYPTION_KEY format. Use Fernet.generate_key() to create one.")
    
    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt a plaintext string
        
        Args:
            plaintext: The string to encrypt
            
        Returns:
            The encrypted string (base64 encoded)
        """
        if not plaintext:
            return None
        
        try:
            encrypted = self._fernet.encrypt(plaintext.encode())
            return encrypted.decode()
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise
    
    def decrypt(self, ciphertext: str) -> str:
        """
        Decrypt an encrypted string
        
        Args:
            ciphertext: The encrypted string (base64 encoded)
            
        Returns:
            The decrypted plaintext string
        """
        if not ciphertext:
            return None
        
        try:
            decrypted = self._fernet.decrypt(ciphertext.encode())
            return decrypted.decode()
        except InvalidToken:
            logger.error("Decryption failed: Invalid token (key may have changed)")
            raise ValueError("Failed to decrypt: invalid encryption key or corrupted data")
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise
    
    @staticmethod
    def generate_key() -> str:
        """
        Generate a new Fernet encryption key
        
        Returns:
            A new base64-encoded encryption key
        """
        return Fernet.generate_key().decode()


# Singleton instance
encryption_service = EncryptionService()
